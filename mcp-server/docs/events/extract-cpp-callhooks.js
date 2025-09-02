#!/usr/bin/env node
/**
 * Script to extract all GAMEEVENTINVOKE_HOOK references from civ5-dll directory
 * Saves results as JSON files in mcp-server/docs/events/
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, extname, resolve } from 'path';

// Configuration
const CIV5_DLL_PATH = '../../../civ5-dll';
const OUTPUT_DIR = './';
const JSON_DIR = './json';

function ensureOutputDir() {
    if (!existsSync(OUTPUT_DIR)) {
        mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`Created output directory: ${OUTPUT_DIR}`);
    }
    if (!existsSync(JSON_DIR)) {
        mkdirSync(JSON_DIR, { recursive: true });
        console.log(`Created JSON directory: ${JSON_DIR}`);
    }
}

function findFilesRecursively(dir, extensions = ['.cpp', '.c', '.cc', '.cxx']) {
    const files = [];
    
    function traverseDirectory(currentDir) {
        try {
            const items = readdirSync(currentDir, { withFileTypes: true });
            
            for (const item of items) {
                const fullPath = join(currentDir, item.name);
                
                if (item.isDirectory()) {
                    // Skip common directories that won't contain relevant source files
                    if (!['node_modules', '.git', '.vs', 'build', 'Debug', 'Release'].includes(item.name)) {
                        traverseDirectory(fullPath);
                    }
                } else if (item.isFile()) {
                    const ext = extname(item.name).toLowerCase();
                    if (extensions.includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (error) {
            console.warn(`Warning: Cannot read directory ${currentDir}: ${error.message}`);
        }
    }
    
    traverseDirectory(dir);
    return files;
}

function searchFileForGameEventHooks(filePath) {
    const references = [];
    
    try {
        const content = readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            if (line.includes('GAMEEVENTINVOKE_HOOK')) {
                // Extract the event name from the GAMEEVENTINVOKE_HOOK call
                // Format: GAMEEVENTINVOKE_HOOK(GAMEEVENT_Name, ...)
                const eventNameMatch = line.match(/GAMEEVENTINVOKE_HOOK\(\s*GAMEEVENT_([A-Za-z]+)/);
                const eventName = eventNameMatch ? eventNameMatch[1] : null;
                
                // Extract arguments from the macro call
                // Find the opening parenthesis and extract everything until the matching closing one
                let args = [];
                const startIdx = line.indexOf('GAMEEVENTINVOKE_HOOK');
                
                if (startIdx !== -1) {
                    // Find the opening parenthesis after GAMEEVENTINVOKE_HOOK
                    const openParenIdx = line.indexOf('(', startIdx);
                    
                    if (openParenIdx !== -1) {
                        // Find the matching closing parenthesis by counting depth
                        let depth = 0;
                        let closeParenIdx = -1;
                        
                        for (let i = openParenIdx; i < line.length; i++) {
                            if (line[i] === '(') {
                                depth++;
                            } else if (line[i] === ')') {
                                depth--;
                                if (depth === 0) {
                                    closeParenIdx = i;
                                    break;
                                }
                            }
                        }
                        
                        if (closeParenIdx !== -1) {
                            // Extract the content between parentheses
                            const argsString = line.substring(openParenIdx + 1, closeParenIdx);
                            
                            // Remove the GAMEEVENT_Name part to get just the arguments
                            const argsOnlyMatch = argsString.match(/GAMEEVENT_[A-Za-z]+\s*(?:,\s*(.+))?$/);
                            
                            if (argsOnlyMatch && argsOnlyMatch[1]) {
                                // Split by comma but handle nested parentheses/brackets
                                const argsList = [];
                                let currentArg = '';
                                let depth = 0;
                                
                                for (let i = 0; i < argsOnlyMatch[1].length; i++) {
                                    const char = argsOnlyMatch[1][i];
                                    
                                    if (char === '(' || char === '[' || char === '{') {
                                        depth++;
                                    } else if (char === ')' || char === ']' || char === '}') {
                                        depth--;
                                    }
                                    
                                    if (char === ',' && depth === 0) {
                                        // Found a top-level comma, push the current argument
                                        if (currentArg.trim()) {
                                            argsList.push(currentArg.trim());
                                        }
                                        currentArg = '';
                                    } else {
                                        currentArg += char;
                                    }
                                }
                                
                                // Don't forget the last argument
                                if (currentArg.trim()) {
                                    argsList.push(currentArg.trim());
                                }
                                
                                args = argsList;
                            }
                        }
                    }
                }
                
                references.push({
                    file: filePath.replace(/\\/g, '/').replace(/^.*civ5-dll\//, ''),
                    line: index + 1,
                    content: line.trim(),
                    eventName: eventName,
                    args: args
                });
            }
        });
    } catch (error) {
        console.warn(`Warning: Cannot read file ${filePath}: ${error.message}`);
    }
    
    return references;
}

function extractGameEventHookReferences() {
    console.log('Extracting GAMEEVENTINVOKE_HOOK references...');
    
    const civ5DllDir = resolve(CIV5_DLL_PATH);
    
    if (!existsSync(civ5DllDir)) {
        console.error(`Error: Directory not found: ${civ5DllDir}`);
        return [];
    }
    
    console.log(`Searching for C++ files in: ${civ5DllDir}`);
    const cppFiles = findFilesRecursively(civ5DllDir);
    console.log(`Found ${cppFiles.length} C++ files to search`);
    
    const references = [];
    
    cppFiles.forEach((filePath, index) => {
        if ((index + 1) % 50 === 0) {
            console.log(`Processing file ${index + 1}/${cppFiles.length}...`);
        }
        
        const fileReferences = searchFileForGameEventHooks(filePath);
        references.push(...fileReferences);
    });
    
    console.log(`Found ${references.length} GAMEEVENTINVOKE_HOOK references in ${cppFiles.length} files`);
    return references;
}

function groupReferencesByEvent(references) {
    const eventMap = new Map();
    
    references.forEach(ref => {
        if (ref.eventName) {
            if (!eventMap.has(ref.eventName)) {
                eventMap.set(ref.eventName, []);
            }
            eventMap.get(ref.eventName).push(ref);
        }
    });
    
    return eventMap;
}

function saveResults(references, eventMap) {
    // Save individual event files
    const eventFiles = [];
    eventMap.forEach((refs, eventName) => {
        const eventData = {
            eventName: eventName,
            generatedAt: new Date().toISOString(),
            occurrences: refs.length,
            references: refs
        };
        
        const eventFile = join(JSON_DIR, `${eventName}.json`);
        writeFileSync(eventFile, JSON.stringify(eventData, null, 2));
        eventFiles.push(eventFile);
    });
    console.log(`Saved ${eventMap.size} individual event files to ${JSON_DIR}/`);
    
    // Create a summary file
    const summaryFile = join(OUTPUT_DIR, 'game-events-summary.json');
    const summary = {
        generatedAt: new Date().toISOString(),
        totalReferences: references.length,
        totalUniqueEvents: eventMap.size,
        eventNames: Array.from(eventMap.keys()).sort(),
        filesCovered: [...new Set(references.map(ref => ref.file))].sort(),
        topEvents: Array.from(eventMap.entries())
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 10)
            .map(([name, refs]) => ({ name, count: refs.length }))
    };
    
    writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`Saved summary to ${summaryFile}`);
    
    return {
        eventFiles,
        summaryFile,
        summary
    };
}

function main() {
    console.log('Starting GAMEEVENTINVOKE_HOOK extraction...');
    console.log(`Searching in: ${CIV5_DLL_PATH}`);
    console.log(`Output directory: ${OUTPUT_DIR}`);
    
    ensureOutputDir();
    
    const references = extractGameEventHookReferences();
    if (references.length === 0) {
        console.log('No GAMEEVENTINVOKE_HOOK references found.');
        return;
    }
    
    const eventMap = groupReferencesByEvent(references);
    const results = saveResults(references, eventMap);
    
    console.log('\n=== EXTRACTION COMPLETE ===');
    console.log(`Found ${references.length} GAMEEVENTINVOKE_HOOK references`);
    console.log(`Found ${eventMap.size} unique event names`);
    console.log(`Files generated:`);
    console.log(`  - ${eventMap.size} individual event files in ${JSON_DIR}/`);
    console.log(`  - ${results.summaryFile}`);
    
    console.log('\nTop events by frequency:');
    results.summary.topEvents.forEach(event => {
        console.log(`  ${event.name}: ${event.count} occurrences`);
    });
}

main();