/**
 * Table Creation Utilities for Knowledge Database
 * Provides reusable functions for creating PublicKnowledge and TimedKnowledge-derived tables
 */

import { Kysely, sql, CreateTableBuilder } from 'kysely';
import type { KnowledgeDatabase } from './schema.js';

/**
 * Creates base columns for PublicKnowledge-derived tables
 * Includes ID (auto-increment primary key) and Data (JSON object) columns
 */
export function createPublicKnowledgeTable<T extends string>(
  db: Kysely<KnowledgeDatabase>,
  tableName: T
): CreateTableBuilder<T, 'ID' | 'Data'> {
  return db.schema
    .createTable(tableName)
    .ifNotExists()
    .addColumn('ID', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('Data', 'text', (col) => col.notNull().defaultTo('{}'));
}

/**
 * Creates base columns for TimedKnowledge-derived tables
 * Includes all standard TimedKnowledge columns with proper defaults
 */
export function createTimedKnowledgeTable<T extends string>(
  db: Kysely<KnowledgeDatabase>,
  tableName: T
): CreateTableBuilder<T, 'ID' | 'Turn' | 'Key' | 'OwnerID' | 'KnownByIDs' | 'Payload' | 'IsLatest' | 'CreatedAt'> {
  return db.schema
    .createTable(tableName)
    .ifNotExists()
    .addColumn('ID', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('Turn', 'integer', (col) => col.notNull())
    .addColumn('Key', 'integer', (col) => col.notNull())
    .addColumn('OwnerID', 'integer')
    .addColumn('KnownByIDs', 'text', (col) => col.notNull()) // JSON array
    .addColumn('Payload', 'text', (col) => col.notNull()) // JSON object
    .addColumn('IsLatest', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('CreatedAt', 'integer', (col) => col.notNull().defaultTo(sql`unixepoch()`));
}

/**
 * Creates base columns for MutableKnowledge-derived tables
 * Includes all TimedKnowledge columns plus Version and Changes
 */
export function createMutableKnowledgeTable<T extends string>(
  db: Kysely<KnowledgeDatabase>,
  tableName: T
): CreateTableBuilder<T, 'ID' | 'Turn' | 'Key' | 'OwnerID' | 'KnownByIDs' | 'Payload' | 'IsLatest' | 'CreatedAt' | 'Version' | 'Changes'> {
  return createTimedKnowledgeTable(db, tableName)
    .addColumn('Version', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('Changes', 'text', (col) => col.notNull().defaultTo('[]')); // JSON array
}

/**
 * Creates standard indexes for TimedKnowledge tables
 * Includes composite indexes for turn/type queries and key/latest lookups
 */
export async function createTimedKnowledgeIndexes(
  db: Kysely<KnowledgeDatabase>,
  tableName: string,
  typeColumn?: string
): Promise<void> {
  // Create composite index for turn and type queries if type column exists
  if (typeColumn) {
    await db.schema
      .createIndex(`idx_${tableName.toLowerCase()}_turn_type`)
      .on(tableName)
      .columns(['Turn', typeColumn])
      .ifNotExists()
      .execute();
  }
  
  // Create composite index for latest events by key
  await db.schema
    .createIndex(`idx_${tableName.toLowerCase()}_key_latest`)
    .on(tableName)
    .columns(['Key', 'IsLatest'])
    .ifNotExists()
    .execute();
  
  // Create index for owner queries
  await db.schema
    .createIndex(`idx_${tableName.toLowerCase()}_owner`)
    .on(tableName)
    .column('OwnerID')
    .ifNotExists()
    .execute();
}

/**
 * Creates standard indexes for PublicKnowledge tables
 * Can be extended for specific index requirements
 */
export async function createPublicKnowledgeIndexes(
  db: Kysely<KnowledgeDatabase>,
  tableName: string,
  uniqueColumns?: string[]
): Promise<void> {
  // Create unique indexes if specified
  if (uniqueColumns && uniqueColumns.length > 0) {
    for (const column of uniqueColumns) {
      await db.schema
        .createIndex(`idx_${tableName.toLowerCase()}_${column.toLowerCase()}`)
        .on(tableName)
        .column(column)
        .unique()
        .ifNotExists()
        .execute();
    }
  }
}