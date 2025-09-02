/**
 * Knowledge Database Initialization and Migration Utility
 * Handles SQLite database creation and schema migration using Kysely
 */

import { Kysely } from 'kysely';
import type { KnowledgeDatabase } from './schema.js';

/**
 * Setup a knowledge database
 * Creates the database file and schema if it doesn't exist
 * Always runs migrations and creates database if not exists
 */
export async function setupKnowledgeDatabase(
  db: Kysely<KnowledgeDatabase>
): Promise<Kysely<KnowledgeDatabase>> {
  
  // Create GameMetadata table
  await db.schema
    .createTable('GameMetadata')
    .ifNotExists()
    .addColumn('Key', 'text', (col) => col.primaryKey())
    .addColumn('Value', 'text', (col) => col.notNull())
    .execute();
  
  // Create GameEvents table (TimedKnowledge implementation)
  await db.schema
    .createTable('GameEvents')
    .ifNotExists()
    .addColumn('ID', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('Turn', 'integer', (col) => col.notNull())
    .addColumn('Key', 'integer', (col) => col.notNull())
    .addColumn('Type', 'text', (col) => col.notNull())
    .addColumn('OwnerID', 'integer')
    .addColumn('KnownByIDs', 'text', (col) => col.notNull()) // JSON array
    .addColumn('Payload', 'text', (col) => col.notNull()) // JSON object
    .addColumn('IsLatest', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('CreatedAt', 'integer', (col) => col.notNull().defaultTo(Date.now()))
    .execute();
  
  // Create PlayerInformation table (PublicKnowledge implementation)
  await db.schema
    .createTable('PlayerInformation')
    .ifNotExists()
    .addColumn('ID', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('PlayerId', 'integer', (col) => col.notNull().unique())
    .addColumn('Civilization', 'text', (col) => col.notNull())
    .addColumn('Leader', 'text', (col) => col.notNull())
    .addColumn('TeamId', 'integer')
    .addColumn('IsHuman', 'boolean', (col) => col.notNull())
    .addColumn('Data', 'text', (col) => col.notNull().defaultTo('{}')) // JSON object
    .execute();

  // Composite index for GameEvents queries
  await db.schema
    .createIndex('idx_game_events_turn_type')
    .on('GameEvents')
    .columns(['Turn', 'Type'])
    .ifNotExists()
    .execute();
  
  // Composite index for latest events by key
  await db.schema
    .createIndex('idx_game_events_key_latest')
    .on('GameEvents')
    .columns(['Key', 'IsLatest'])
    .ifNotExists()
    .execute();
    
  return db;
}
