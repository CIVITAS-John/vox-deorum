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
  createPublicKnowledgeIndexes,
  createMutableKnowledgeTable,
  createMutableKnowledgeIndexes
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
  // Create indexes for GameEvents table
  await createTimedKnowledgeIndexes(db, 'GameEvents', 'Type');

  // Create StrategyChanges table (MutableKnowledge implementation)
  await createMutableKnowledgeTable(db, 'StrategyChanges')
    .addColumn('GrandStrategy', 'integer')
    .addColumn('EconomicStrategies', 'text') // JSON array
    .addColumn('MilitaryStrategies', 'text') // JSON array
    .execute();
  // Create indexes for StrategyChanges table
  await createMutableKnowledgeIndexes(db, 'StrategyChanges');

  // Create PlayerSummaries table (MutableKnowledge implementation)
  await createMutableKnowledgeTable(db, 'PlayerSummaries')
    .addColumn('MajorAllyID', 'integer', (col) => col.notNull())
    .addColumn('Cities', 'integer', (col) => col.notNull())
    .addColumn('Population', 'integer', (col) => col.notNull())
    .addColumn('Gold', 'integer', (col) => col.notNull())
    .addColumn('GoldPerTurn', 'real', (col) => col.notNull())
    .addColumn('TourismPerTurn', 'integer', (col) => col.notNull())
    .addColumn('PolicyBranches', 'text', (col) => col.notNull()) // JSON object
    .addColumn('Technologies', 'integer', (col) => col.notNull())
    .addColumn('CreatedReligion', 'text', (col) => col.notNull())
    .addColumn('MajorityReligion', 'text', (col) => col.notNull())
    .execute();
  // Create indexes for PlayerSummaries table
  await createMutableKnowledgeIndexes(db, 'PlayerSummaries');

  // Create PlayerStrategies table (MutableKnowledge implementation)
  await createMutableKnowledgeTable(db, 'PlayerStrategies')
    .addColumn('GrandStrategy', 'integer', (col) => col.notNull())
    .addColumn('EconomicStrategies', 'text', (col) => col.notNull()) // JSON array
    .addColumn('MilitaryStrategies', 'text', (col) => col.notNull()) // JSON array
    .addColumn('DiplomaticFlavors', 'text', (col) => col.notNull()) // JSON object
    .execute();
  // Create indexes for PlayerStrategies table
  await createMutableKnowledgeIndexes(db, 'PlayerStrategies');

  // Create PlayerEconomics table (MutableKnowledge implementation)
  await createMutableKnowledgeTable(db, 'PlayerEconomics')
    .execute();
  // Create indexes for PlayerEconomics table
  await createMutableKnowledgeIndexes(db, 'PlayerEconomics');

  // Create PlayerSciences table (MutableKnowledge implementation)
  await createMutableKnowledgeTable(db, 'PlayerSciences')
    .execute();
  // Create indexes for PlayerSciences table
  await createMutableKnowledgeIndexes(db, 'PlayerSciences');

  // Create PlayerCultures table (MutableKnowledge implementation)
  await createMutableKnowledgeTable(db, 'PlayerCultures')
    .execute();
  // Create indexes for PlayerCultures table
  await createMutableKnowledgeIndexes(db, 'PlayerCultures');

  // Create PlayerMilitaries table (MutableKnowledge implementation)
  await createMutableKnowledgeTable(db, 'PlayerMilitaries')
    .execute();
  // Create indexes for PlayerMilitaries table
  await createMutableKnowledgeIndexes(db, 'PlayerMilitaries');

  // Create PlayerDiplomacies table (MutableKnowledge implementation)
  await createMutableKnowledgeTable(db, 'PlayerDiplomacies')
    .execute();
  // Create indexes for PlayerDiplomacies table
  await createMutableKnowledgeIndexes(db, 'PlayerDiplomacies');

  // Create PlayerInformation table (PublicKnowledge implementation)
  await createPublicKnowledgeTable(db, 'PlayerInformations')
    .addColumn('PlayerID', 'integer', (col) => col.notNull().unique())
    .addColumn('Civilization', 'text', (col) => col.notNull())
    .addColumn('Leader', 'text', (col) => col.notNull())
    .addColumn('TeamID', 'integer')
    .addColumn('IsHuman', 'integer', (col) => col.notNull())
    .execute();
  // Create indexes for PlayerInformation table
  await createPublicKnowledgeIndexes(db, 'PlayerInformation', ['PlayerID']);

  return db;
}
