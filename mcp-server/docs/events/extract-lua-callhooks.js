#!/usr/bin/env node
/**
 * Script to extract all LuaSupport::CallHook references from civ5-dll directory
 * Saves results as JSON files in mcp-server/docs/events/
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, extname, resolve } from 'path';

// Configuration
const CIV5_DLL_PATH = '../../../civ5-dll';
const OUTPUT_DIR = './';

function ensureOutputDir() {
    if (!existsSync(OUTPUT_DIR)) {
        mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`Created output directory: ${OUTPUT_DIR}`);
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

function searchFileForCallHooks(filePath) {
    const references = [];
    
    try {
        const content = readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            if (line.includes('CallHook') && line.includes('LuaSupport::CallHook')) {
                // Extract the event name from the CallHook call
                const eventNameMatch = line.match(/CallHook\([^,]+,\s*"([^"]+)"/);
                const eventName = eventNameMatch ? eventNameMatch[1] : null;
                
                references.push({
                    file: filePath.replace(/\\/g, '/').replace(/^.*civ5-dll\//, ''),
                    line: index + 1,
                    content: line.trim(),
                    eventName: eventName,
                    fullPath: filePath
                });
            }
        });
    } catch (error) {
        console.warn(`Warning: Cannot read file ${filePath}: ${error.message}`);
    }
    
    return references;
}

function extractCallHookReferences() {
    console.log('Extracting LuaSupport::CallHook references...');
    
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
        
        const fileReferences = searchFileForCallHooks(filePath);
        references.push(...fileReferences);
    });
    
    console.log(`Found ${references.length} CallHook references in ${cppFiles.length} files`);
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
    // Save all references
    /*const allReferencesFile = join(OUTPUT_DIR, 'lua-callhook-references.json');
    writeFileSync(allReferencesFile, JSON.stringify({
        generatedAt: new Date().toISOString(),
        totalReferences: references.length,
        references: references
    }, null, 2));
    console.log(`Saved ${references.length} references to ${allReferencesFile}`);*/
    
    // Save events grouped by name
    const eventsByNameFile = join(OUTPUT_DIR, 'lua-events-by-name.json');
    const eventsData = {};
    eventMap.forEach((refs, eventName) => {
        eventsData[eventName] = {
            occurrences: refs.length,
            references: refs
        };
    });
    
    writeFileSync(eventsByNameFile, JSON.stringify({
        generatedAt: new Date().toISOString(),
        totalEvents: eventMap.size,
        events: eventsData
    }, null, 2));
    console.log(`Saved ${eventMap.size} unique events to ${eventsByNameFile}`);
    
    // Create a summary file
    const summaryFile = join(OUTPUT_DIR, 'lua-events-summary.json');
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
        allReferencesFile,
        eventsByNameFile,
        summaryFile,
        summary
    };
}

function main() {
    console.log('Starting LuaSupport::CallHook extraction...');
    console.log(`Searching in: ${CIV5_DLL_PATH}`);
    console.log(`Output directory: ${OUTPUT_DIR}`);
    
    ensureOutputDir();
    
    const references = extractCallHookReferences();
    if (references.length === 0) {
        console.log('No CallHook references found.');
        return;
    }
    
    const eventMap = groupReferencesByEvent(references);
    const results = saveResults(references, eventMap);
    
    console.log('\n=== EXTRACTION COMPLETE ===');
    console.log(`Found ${references.length} CallHook references`);
    console.log(`Found ${eventMap.size} unique event names`);
    console.log(`Files generated:`);
    console.log(`  - ${results.allReferencesFile}`);
    console.log(`  - ${results.eventsByNameFile}`);
    console.log(`  - ${results.summaryFile}`);
    
    console.log('\nTop events by frequency:');
    results.summary.topEvents.forEach(event => {
        console.log(`  ${event.name}: ${event.count} occurrences`);
    });
}

main();