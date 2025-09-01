/**
 * Export Civilization V Debug Database table schemas to JSON files
 * Reads the database and creates individual JSON files for each table
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get Documents folder using PowerShell
const getDocumentsFolder = () => {
  try {
    // Use PowerShell to get the Documents folder path
    const documentsPath = execSync('powershell -Command "[Environment]::GetFolderPath(\'MyDocuments\')"', {
      encoding: 'utf8'
    }).trim();
    
    console.log('Documents folder found:', documentsPath);
    return documentsPath;
  } catch (error) {
    console.error('Failed to get Documents folder from PowerShell:', error.message);
    // Fallback to environment variable
    return path.join(process.env.USERPROFILE || os.homedir(), 'Documents');
  }
};

// Build database path using PowerShell-retrieved Documents folder
const dbPath = path.join(
  getDocumentsFolder(),
  'My Games',
  "Sid Meier's Civilization 5",
  'cache',
  'Civ5DebugDatabase.db'
);

const outputDir = path.join(__dirname, 'json');

/**
 * Parse column information from CREATE TABLE statement
 * @param {string} sql - CREATE TABLE SQL statement
 * @returns {Array} Array of column definitions
 */
function parseColumns(sql) {
  // Extract content between parentheses
  const match = sql.match(/\(([\s\S]*)\)/);
  if (!match) return [];
  
  const content = match[1];
  const columns = [];
  
  // Split by comma but respect nested parentheses
  const parts = [];
  let current = '';
  let parenDepth = 0;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '(') parenDepth++;
    if (char === ')') parenDepth--;
    if (char === ',' && parenDepth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  
  // Parse each column definition
  for (const part of parts) {
    // Skip constraints that start with keywords
    if (/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)/i.test(part)) {
      continue;
    }
    
    // Parse column name and type
    const tokens = part.split(/\s+/);
    if (tokens.length >= 2) {
      const name = tokens[0].replace(/["`\[\]]/g, '');
      const type = tokens[1];
      const constraints = tokens.slice(2).join(' ');
      
      columns.push({
        name,
        type,
        constraints: constraints || null,
        isPrimaryKey: constraints.includes('PRIMARY KEY'),
        isNotNull: constraints.includes('NOT NULL'),
        isUnique: constraints.includes('UNIQUE'),
        defaultValue: extractDefault(constraints)
      });
    }
  }
  
  return columns;
}

/**
 * Extract default value from constraints
 * @param {string} constraints - Column constraints string
 * @returns {string|null} Default value or null
 */
function extractDefault(constraints) {
  if (!constraints) return null;
  const match = constraints.match(/DEFAULT\s+([^\s,)]+)/i);
  return match ? match[1] : null;
}

/**
 * Main function to export database schemas
 */
async function exportSchemas() {
  console.log('Opening database:', dbPath);
  
  try {
    // Check if database exists
    await fs.access(dbPath);
  } catch (error) {
    console.error('Database file not found:', dbPath);
    console.log('Please ensure Civilization V has been run at least once and created the debug database.');
    process.exit(1);
  }
  
  // Open database connection
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
    mode: sqlite3.OPEN_READONLY
  });
  
  // Create output directory if it doesn't exist
  try {
    await fs.mkdir(outputDir, { recursive: true });
    console.log('Created output directory:', outputDir);
  } catch (error) {
    // Directory might already exist
  }
  
  // Get all tables
  const tables = await db.all(`
    SELECT name, sql 
    FROM sqlite_master 
    WHERE type='table' 
    AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `);
  
  console.log(`Found ${tables.length} tables`);
  
  // Process each table
  for (const table of tables) {
    const { name, sql } = table;
    console.log(`Processing table: ${name}`);
    
    // Get table info
    const columns = await db.all(`PRAGMA table_info('${name}')`);
    const foreignKeys = await db.all(`PRAGMA foreign_key_list('${name}')`);
    const indexes = await db.all(`PRAGMA index_list('${name}')`);
    
    // Get row count
    const countResult = await db.get(`SELECT COUNT(*) as count FROM '${name}'`);
    const rowCount = countResult.count;
    
    // Parse columns from CREATE TABLE statement for more details
    const parsedColumns = parseColumns(sql);
    
    // Combine PRAGMA info with parsed info
    const enrichedColumns = columns.map(col => {
      const parsed = parsedColumns.find(p => p.name === col.name) || {};
      return {
        name: col.name,
        type: col.type,
        notNull: col.notnull === 1,
        defaultValue: col.dflt_value,
        primaryKey: col.pk > 0,
        position: col.cid,
        ...parsed
      };
    });
    
    // Create schema object
    const schema = {
      tableName: name,
      rowCount,
      columns: enrichedColumns,
      primaryKeys: enrichedColumns.filter(c => c.primaryKey).map(c => c.name),
      foreignKeys: foreignKeys.map(fk => ({
        column: fk.from,
        referencedTable: fk.table,
        referencedColumn: fk.to,
        onUpdate: fk.on_update,
        onDelete: fk.on_delete
      })),
      indexes: indexes.map(idx => ({
        name: idx.name,
        unique: idx.unique === 1,
        partial: idx.partial === 1
      })),
      createStatement: sql,
      metadata: {
        exportDate: new Date().toISOString()
      }
    };
    
    // Write to JSON file
    const outputPath = path.join(outputDir, `${name}.json`);
    await fs.writeFile(
      outputPath,
      JSON.stringify(schema, null, 2),
      'utf8'
    );
    
    console.log(`  ✓ Exported to ${path.basename(outputPath)} (${rowCount} rows)`);
  }
  
  // Create index file with all table names
  const indexData = {
    database: 'Civ5DebugDatabase',
    description: 'Civilization V debug database containing game state and configuration data',
    tableCount: tables.length,
    tables: tables.map(t => ({
      name: t.name,
      description: getTableDescription(t.name),
      schemaFile: `${t.name}.json`
    })),
    exportDate: new Date().toISOString()
  };
  
  await fs.writeFile(
    path.join(outputDir, '_index.json'),
    JSON.stringify(indexData, null, 2),
    'utf8'
  );
  
  console.log('\n✓ Export complete!');
  console.log(`  ${tables.length} table schemas exported to ${outputDir}`);
  console.log('  Index file created: _index.json');
  
  await db.close();
}

// Run the export
exportSchemas().catch(console.error);