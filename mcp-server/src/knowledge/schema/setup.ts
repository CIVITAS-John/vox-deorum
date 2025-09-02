/**
 * Knowledge Database Initialization and Migration Utility
 * Handles SQLite database creation and schema migration using Kysely
 */

import { Kysely } from 'kysely';
import type { KnowledgeDatabase } from './base.js';
import { 
  createPublicKnowledgeTable, 
  createTimedKnowledgeTable,
  createTimedKnowledgeIndexes,
  createPublicKnowledgeIndexes
} from './table-utils.js';

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
  await createTimedKnowledgeTable(db, 'GameEvents')
    .addColumn('Type', 'text', (col) => col.notNull())
    .execute();
  
  // Create PlayerInformation table (PublicKnowledge implementation)
  await createPublicKnowledgeTable(db, 'PlayerInformation')
    .addColumn('PlayerId', 'integer', (col) => col.notNull().unique())
    .addColumn('Civilization', 'text', (col) => col.notNull())
    .addColumn('Leader', 'text', (col) => col.notNull())
    .addColumn('TeamId', 'integer')
    .addColumn('IsHuman', 'boolean', (col) => col.notNull())
    .execute();

  // Create indexes for GameEvents table
  await createTimedKnowledgeIndexes(db, 'GameEvents', 'Type');
  
  // Create indexes for PlayerInformation table
  await createPublicKnowledgeIndexes(db, 'PlayerInformation', ['PlayerId']);

  return db;
}
