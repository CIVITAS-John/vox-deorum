#!/usr/bin/env node
/**
 * Script to split lua-events-by-name.json into individual JSON files per event
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const INPUT_FILE = './lua-events-by-name.json';
const OUTPUT_DIR = './json';

function ensureOutputDir() {
    if (!existsSync(OUTPUT_DIR)) {
        mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`Created output directory: ${OUTPUT_DIR}`);
    }
}

function splitEvents() {
    // Read the main JSON file
    const jsonContent = readFileSync(INPUT_FILE, 'utf8');
    const data = JSON.parse(jsonContent);
    
    let filesCreated = 0;
    
    // Process each event
    for (const [eventName, eventData] of Object.entries(data.events)) {
        // Create individual event file
        const eventFile = {
            eventName: eventName,
            occurrences: eventData.occurrences,
            generatedAt: data.generatedAt,
            references: eventData.references
        };
        
        // Write to individual JSON file
        const outputPath = join(OUTPUT_DIR, `${eventName}.json`);
        writeFileSync(outputPath, JSON.stringify(eventFile, null, 2));
        filesCreated++;
        
        console.log(`Created: ${outputPath}`);
    }
    
    return filesCreated;
}

function main() {
    console.log('Starting to split lua-events-by-name.json...');
    
    if (!existsSync(INPUT_FILE)) {
        console.error(`Error: Input file not found: ${INPUT_FILE}`);
        process.exit(1);
    }
    
    ensureOutputDir();
    
    const filesCreated = splitEvents();
    
    console.log(`\n=== SPLIT COMPLETE ===`);
    console.log(`Created ${filesCreated} individual event JSON files in ${OUTPUT_DIR}/`);
}

main();