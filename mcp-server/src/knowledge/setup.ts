/**
 * Knowledge Database Initialization and Migration Utility
 * Handles SQLite database creation and schema migration using Kysely
 */

import { Kysely } from 'kysely';
import { createLogger } from '../utils/logger.js';
import type { KnowledgeDatabase } from './schema.js';

const logger = createLogger('KnowledgeDatabase');

/**
 * Setup a knowledge database
 * Creates the database file and schema if it doesn't exist
 * Always runs migrations and creates database if not exists
 */
export async function setupKnowledgeDatabase(
  db: Kysely<KnowledgeDatabase>
): Promise<Kysely<KnowledgeDatabase>> {
  
  logger.info(`Initializing knowledge database...`);
  
  try {
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

    // Create CityKnowledge table (MutableKnowledge implementation)
    await db.schema
      .createTable('CityKnowledge')
      .ifNotExists()
      .addColumn('ID', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('Turn', 'integer', (col) => col.notNull())
      .addColumn('Key', 'integer', (col) => col.notNull()) // CityID as Key
      .addColumn('CityID', 'integer', (col) => col.notNull())
      .addColumn('Name', 'text', (col) => col.notNull())
      .addColumn('OwnerID', 'integer', (col) => col.notNull())
      .addColumn('Population', 'integer', (col) => col.notNull())
      .addColumn('Production', 'integer', (col) => col.notNull())
      .addColumn('Food', 'integer', (col) => col.notNull())
      .addColumn('Gold', 'integer', (col) => col.notNull())
      .addColumn('Science', 'integer', (col) => col.notNull())
      .addColumn('Culture', 'integer', (col) => col.notNull())
      .addColumn('Faith', 'integer', (col) => col.notNull())
      .addColumn('X', 'integer', (col) => col.notNull())
      .addColumn('Y', 'integer', (col) => col.notNull())
      .addColumn('KnownByIDs', 'text', (col) => col.notNull()) // JSON array
      .addColumn('Payload', 'text', (col) => col.notNull().defaultTo('{}')) // JSON object
      .addColumn('Version', 'integer', (col) => col.notNull().defaultTo(1))
      .addColumn('Changes', 'text', (col) => col.notNull().defaultTo('[]')) // JSON array
      .addColumn('IsLatest', 'boolean', (col) => col.notNull().defaultTo(true))
      .addColumn('CreatedAt', 'integer', (col) => col.notNull().defaultTo(Date.now()))
      .execute();

    // Create UnitKnowledge table (MutableKnowledge implementation)
    await db.schema
      .createTable('UnitKnowledge')
      .ifNotExists()
      .addColumn('ID', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('Turn', 'integer', (col) => col.notNull())
      .addColumn('Key', 'integer', (col) => col.notNull()) // UnitID as Key
      .addColumn('UnitID', 'integer', (col) => col.notNull())
      .addColumn('Name', 'text', (col) => col.notNull())
      .addColumn('OwnerID', 'integer', (col) => col.notNull())
      .addColumn('UnitType', 'text', (col) => col.notNull())
      .addColumn('X', 'integer', (col) => col.notNull())
      .addColumn('Y', 'integer', (col) => col.notNull())
      .addColumn('Health', 'integer', (col) => col.notNull())
      .addColumn('Moves', 'integer', (col) => col.notNull())
      .addColumn('Experience', 'integer', (col) => col.notNull())
      .addColumn('Promotions', 'text', (col) => col.notNull().defaultTo('[]')) // JSON array
      .addColumn('KnownByIDs', 'text', (col) => col.notNull()) // JSON array
      .addColumn('Payload', 'text', (col) => col.notNull().defaultTo('{}')) // JSON object
      .addColumn('Version', 'integer', (col) => col.notNull().defaultTo(1))
      .addColumn('Changes', 'text', (col) => col.notNull().defaultTo('[]')) // JSON array
      .addColumn('IsLatest', 'boolean', (col) => col.notNull().defaultTo(true))
      .addColumn('CreatedAt', 'integer', (col) => col.notNull().defaultTo(Date.now()))
      .execute();

    // Create TechnologyKnowledge table (TimedKnowledge implementation)
    await db.schema
      .createTable('TechnologyKnowledge')
      .ifNotExists()
      .addColumn('ID', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('Turn', 'integer', (col) => col.notNull())
      .addColumn('Key', 'integer', (col) => col.notNull()) // TechID as Key
      .addColumn('TechID', 'integer', (col) => col.notNull())
      .addColumn('TechType', 'text', (col) => col.notNull())
      .addColumn('PlayerID', 'integer', (col) => col.notNull())
      .addColumn('OwnerID', 'integer')
      .addColumn('IsResearched', 'boolean', (col) => col.notNull())
      .addColumn('Progress', 'integer', (col) => col.notNull())
      .addColumn('TurnsLeft', 'integer', (col) => col.notNull())
      .addColumn('KnownByIDs', 'text', (col) => col.notNull()) // JSON array
      .addColumn('Payload', 'text', (col) => col.notNull().defaultTo('{}')) // JSON object
      .addColumn('IsLatest', 'boolean', (col) => col.notNull().defaultTo(true))
      .addColumn('CreatedAt', 'integer', (col) => col.notNull().defaultTo(Date.now()))
      .execute();

    // Create DiplomaticKnowledge table (MutableKnowledge implementation)
    await db.schema
      .createTable('DiplomaticKnowledge')
      .ifNotExists()
      .addColumn('ID', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('Turn', 'integer', (col) => col.notNull())
      .addColumn('Key', 'integer', (col) => col.notNull()) // Composite key: PlayerID * 1000 + OtherPlayerID
      .addColumn('PlayerID', 'integer', (col) => col.notNull())
      .addColumn('OtherPlayerID', 'integer', (col) => col.notNull())
      .addColumn('OwnerID', 'integer')
      .addColumn('Relationship', 'text', (col) => col.notNull())
      .addColumn('Opinion', 'integer', (col) => col.notNull())
      .addColumn('TradeDeals', 'text', (col) => col.notNull().defaultTo('[]')) // JSON array
      .addColumn('KnownByIDs', 'text', (col) => col.notNull()) // JSON array
      .addColumn('Payload', 'text', (col) => col.notNull().defaultTo('{}')) // JSON object
      .addColumn('Version', 'integer', (col) => col.notNull().defaultTo(1))
      .addColumn('Changes', 'text', (col) => col.notNull().defaultTo('[]')) // JSON array
      .addColumn('IsLatest', 'boolean', (col) => col.notNull().defaultTo(true))
      .addColumn('CreatedAt', 'integer', (col) => col.notNull().defaultTo(Date.now()))
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

    // Indexes for CityKnowledge
    await db.schema
      .createIndex('idx_city_knowledge_key_latest')
      .on('CityKnowledge')
      .columns(['Key', 'IsLatest'])
      .ifNotExists()
      .execute();

    await db.schema
      .createIndex('idx_city_knowledge_owner_turn')
      .on('CityKnowledge')
      .columns(['OwnerID', 'Turn'])
      .ifNotExists()
      .execute();

    // Indexes for UnitKnowledge
    await db.schema
      .createIndex('idx_unit_knowledge_key_latest')
      .on('UnitKnowledge')
      .columns(['Key', 'IsLatest'])
      .ifNotExists()
      .execute();

    await db.schema
      .createIndex('idx_unit_knowledge_owner_turn')
      .on('UnitKnowledge')
      .columns(['OwnerID', 'Turn'])
      .ifNotExists()
      .execute();

    // Indexes for TechnologyKnowledge
    await db.schema
      .createIndex('idx_tech_knowledge_player_turn')
      .on('TechnologyKnowledge')
      .columns(['PlayerID', 'Turn'])
      .ifNotExists()
      .execute();

    // Indexes for DiplomaticKnowledge
    await db.schema
      .createIndex('idx_diplomatic_knowledge_key_latest')
      .on('DiplomaticKnowledge')
      .columns(['Key', 'IsLatest'])
      .ifNotExists()
      .execute();

    await db.schema
      .createIndex('idx_diplomatic_knowledge_players')
      .on('DiplomaticKnowledge')
      .columns(['PlayerID', 'OtherPlayerID'])
      .ifNotExists()
      .execute();
    
  } catch (error) {
    logger.error('Failed to create database:', error);
    await db.destroy();
    throw error;
  }
  
  logger.info('Knowledge database initialized successfully');
  return db;
}
