/**
 * Table Creation Utilities for Knowledge Database
 * Provides reusable functions for creating PublicKnowledge and TimedKnowledge-derived tables
 */

import { Kysely, sql, CreateTableBuilder } from 'kysely';
import { MaxMajorCivs, type KnowledgeDatabase } from './base.js';

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
  var schema = db.schema
    .createTable(tableName)
    .ifNotExists()
    .addColumn('ID', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('Turn', 'integer', (col) => col.notNull())
    .addColumn('Payload', 'text', (col) => col.notNull()) // JSON object
    .addColumn('CreatedAt', 'integer', (col) => col.notNull().defaultTo(sql`(unixepoch())`));
  for (let i = 0; i < MaxMajorCivs; i++) {
    schema = schema.addColumn(`Player${i}`, 'integer', (col) => col.notNull().defaultTo(false));
  }
  return schema;
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
    .addColumn('Key', 'integer', (col) => col.notNull())
    .addColumn('Version', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('IsLatest', 'integer', (col) => col.notNull().defaultTo(true))
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
  // Create index for owner queries
  for (let i = 0; i < MaxMajorCivs; i++) {
    if (typeColumn) {
      await db.schema
        .createIndex(`idx_${tableName.toLowerCase()}_player${i}`)
        .on(tableName)
        .columns([`Turn`, typeColumn, `Player${i}`])
        .ifNotExists()
        .execute();
    } else {
      await db.schema
        .createIndex(`idx_${tableName.toLowerCase()}_player${i}`)
        .on(tableName)
        .columns([`Turn`, `Player${i}`])
        .ifNotExists()
        .execute();
    }
  }
}

/**
 * Creates standard indexes for MutableKnowledge tables
 * Includes composite indexes for turn/type queries and key/latest lookups
 */
export async function createMutableKnowledgeIndexes(
  db: Kysely<KnowledgeDatabase>,
  tableName: string,
  typeColumn?: string
): Promise<void> {
  // Create index for owner queries
  for (let i = 0; i < MaxMajorCivs; i++) {
    if (typeColumn) {
      await db.schema
        .createIndex(`idx_${tableName.toLowerCase()}_player${i}`)
        .on(tableName)
        .columns([`Turn`, `Key`, `IsLatest`, typeColumn, `Player${i}`])
        .ifNotExists()
        .execute();
    } else {
      await db.schema
        .createIndex(`idx_${tableName.toLowerCase()}_player${i}`)
        .on(tableName)
        .columns([`Turn`, `Key`, `IsLatest`, `Player${i}`])
        .ifNotExists()
        .execute();
    }
  }
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