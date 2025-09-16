/**
 * Knowledge Database Initialization and Migration Utility
 * Handles SQLite database creation and schema migration using Kysely
 */

import { Kysely } from 'kysely';
import { MaxMajorCivs, type KnowledgeDatabase } from './base.js';
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
    .addColumn('Rationale', 'text')
    .execute();
  // Create indexes for StrategyChanges table
  await createMutableKnowledgeIndexes(db, 'StrategyChanges');

  // Create PlayerSummaries table (MutableKnowledge implementation)
  await createMutableKnowledgeTable(db, 'PlayerSummaries')
    .addColumn('Era', 'text')
    .addColumn('MajorAlly', 'text')
    .addColumn('Cities', 'integer', (col) => col.notNull())
    .addColumn('Population', 'integer', (col) => col.notNull())
    .addColumn('Gold', 'integer', (col) => col.notNull())
    .addColumn('GoldPerTurn', 'real', (col) => col.notNull())
    .addColumn('TourismPerTurn', 'integer')
    .addColumn('PolicyBranches', 'text') // JSON object
    .addColumn('Technologies', 'integer', (col) => col.notNull())
    .addColumn('ResourcesAvailable', 'text')
    .addColumn('FoundedReligion', 'text')
    .addColumn('MajorityReligion', 'text')
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

  // Create PlayerOpinions table (MutableKnowledge implementation)
  var opinions = createMutableKnowledgeTable(db, 'PlayerOpinions');
  for (var I = 0; I < MaxMajorCivs; I++) {
    opinions = opinions.addColumn('OpinionFrom' + I, 'text')
    opinions = opinions.addColumn('OpinionTo' + I, 'text')
  }
  await opinions.execute();

  // Create indexes for PlayerOpinions table
  await createMutableKnowledgeIndexes(db, 'PlayerOpinions');

  // Create CityInformations table (MutableKnowledge implementation)
  await createMutableKnowledgeTable(db, 'CityInformations')
    // Basic fields (visibility level 1)
    .addColumn('Owner', 'text', (col) => col.notNull())
    .addColumn('Name', 'text', (col) => col.notNull())
    .addColumn('X', 'integer', (col) => col.notNull())
    .addColumn('Y', 'integer', (col) => col.notNull())
    .addColumn('Population', 'integer', (col) => col.notNull())
    .addColumn('MajorityReligion', 'text')
    .addColumn('DefenseStrength', 'integer', (col) => col.notNull())
    .addColumn('HitPoints', 'integer', (col) => col.notNull())
    .addColumn('MaxHitPoints', 'integer', (col) => col.notNull())
    .addColumn('IsPuppet', 'integer', (col) => col.notNull())
    .addColumn('IsOccupied', 'integer', (col) => col.notNull())
    .addColumn('IsCoastal', 'integer', (col) => col.notNull())
    // Full fields (visibility level 2)
    .addColumn('FoodStored', 'integer', (col) => col.notNull())
    .addColumn('FoodPerTurn', 'integer', (col) => col.notNull())
    .addColumn('ProductionStored', 'integer', (col) => col.notNull())
    .addColumn('ProductionPerTurn', 'integer', (col) => col.notNull())
    .addColumn('GoldPerTurn', 'integer', (col) => col.notNull())
    .addColumn('SciencePerTurn', 'integer', (col) => col.notNull())
    .addColumn('CulturePerTurn', 'integer', (col) => col.notNull())
    .addColumn('FaithPerTurn', 'integer', (col) => col.notNull())
    .addColumn('TourismPerTurn', 'integer', (col) => col.notNull())
    .addColumn('LocalHappiness', 'integer', (col) => col.notNull())
    .addColumn('RazingTurns', 'integer', (col) => col.notNull())
    .addColumn('ResistanceTurns', 'integer', (col) => col.notNull())
    .addColumn('BuildingCount', 'integer', (col) => col.notNull())
    .addColumn('WonderCount', 'integer', (col) => col.notNull())
    .addColumn('GreatWorkCount', 'integer', (col) => col.notNull())
    .addColumn('TradeRouteCount', 'integer', (col) => col.notNull())
    .addColumn('CurrentProduction', 'text')
    .addColumn('ProductionTurnsLeft', 'integer', (col) => col.notNull())
    .execute();
  // Create indexes for CityInformations table
  await createMutableKnowledgeIndexes(db, 'CityInformations');

  // Create PlayerInformation table (PublicKnowledge implementation)
  await createPublicKnowledgeTable(db, 'PlayerInformations')
    .addColumn('Civilization', 'text', (col) => col.notNull())
    .addColumn('Leader', 'text', (col) => col.notNull())
    .addColumn('TeamID', 'integer', (col) => col.notNull())
    .addColumn('IsHuman', 'integer', (col) => col.notNull())
    .addColumn('IsMajor', 'integer', (col) => col.notNull())
    .execute();
  // Create indexes for PlayerInformation table
  await createPublicKnowledgeIndexes(db, 'PlayerInformations');

  return db;
}
