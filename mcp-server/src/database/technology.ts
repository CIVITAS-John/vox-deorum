/**
 * Technology utility functions for accessing Civilization V technology data
 * Provides structured access to technology information from the game database
 */

import { z } from 'zod';
import { DatabaseManager } from './database-manager.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('TechnologyUtils');

/**
 * Full technology schema matching database structure
 */
export const TechnologyFullSchema = z.object({
  ID: z.number(),
  Type: z.string(),
  Description: z.string().nullable(),
  Civilopedia: z.string().nullable(),
  Help: z.string().nullable(),
  Quote: z.string().nullable(),
  Cost: z.number(),
  Era: z.string().nullable(),
  FirstFreeUnitClass: z.string().nullable(),
  FirstFreeTechs: z.number().nullable(),
  EndsGame: z.boolean().nullable(),
  AllowsEmbarking: z.boolean().nullable(),
  AllowsDefensiveEmbarking: z.boolean().nullable(),
  EmbarkedAllWaterPassage: z.boolean().nullable(),
  AllowsBarbarianBoats: z.boolean().nullable(),
  RepeatTrade: z.boolean().nullable(),
  AllowEmbassyTradingAllowed: z.boolean().nullable(),
  OpenBordersTradingAllowed: z.boolean().nullable(),
  DefensivePactTradingAllowed: z.boolean().nullable(),
  ResearchAgreementTradingAllowed: z.boolean().nullable(),
  BridgeBuilding: z.boolean().nullable(),
  MapCentering: z.boolean().nullable(),
  MapVisible: z.boolean().nullable(),
  MapTrading: z.boolean().nullable(),
  TechTrading: z.boolean().nullable(),
  GoldTrading: z.boolean().nullable(),
  AllowsWorldCongress: z.boolean().nullable(),
  VassalageTradingAllowed: z.boolean().nullable(),
  ExpandToOcean: z.boolean().nullable(),
  GridX: z.number().nullable(),
  GridY: z.number().nullable(),
  PortraitIndex: z.number().nullable(),
  IconAtlas: z.string().nullable(),
  AudioIntro: z.string().nullable(),
  AudioIntroHeader: z.string().nullable(),
});

/**
 * Simplified technology schema with core information
 */
export const TechnologyCoreSchema = z.object({
  ID: z.number(),
  Type: z.string(),
  Description: z.string(),
  Cost: z.number(),
  Era: z.string().nullable(),
  GridX: z.number().nullable(),
  GridY: z.number().nullable(),
});

export type TechnologyFull = z.infer<typeof TechnologyFullSchema>;
export type TechnologyCore = z.infer<typeof TechnologyCoreSchema>;

/**
 * Technology utility functions
 */
export class TechnologyUtils {
  private db: DatabaseManager;

  constructor(databaseManager: DatabaseManager) {
    this.db = databaseManager;
  }

  /**
   * Get all technologies with full schema
   */
  async getAllTechnologies(core: boolean = false): Promise<TechnologyFull[] | TechnologyCore[]> {
    const query = 'SELECT * FROM Technologies ORDER BY Cost, ID';
    const results = await this.db.query(query);
    
    if (core) {
      return results.map(row => TechnologyCoreSchema.parse(row));
    }
    
    return results.map(row => TechnologyFullSchema.parse(row));
  }

  /**
   * Get technology by ID
   */
  async getTechnologyById(id: number, core: boolean = false): Promise<TechnologyFull | TechnologyCore | null> {
    const query = 'SELECT * FROM Technologies WHERE ID = ?';
    const results = await this.db.query(query, [id]);
    
    if (results.length === 0) {
      return null;
    }
    
    const row = results[0];
    return core ? TechnologyCoreSchema.parse(row) : TechnologyFullSchema.parse(row);
  }

  /**
   * Get technology by type name
   */
  async getTechnologyByType(type: string, core: boolean = false): Promise<TechnologyFull | TechnologyCore | null> {
    const query = 'SELECT * FROM Technologies WHERE Type = ?';
    const results = await this.db.query(query, [type]);
    
    if (results.length === 0) {
      return null;
    }
    
    const row = results[0];
    return core ? TechnologyCoreSchema.parse(row) : TechnologyFullSchema.parse(row);
  }

  /**
   * Get technologies by era
   */
  async getTechnologiesByEra(era: string, core: boolean = false): Promise<TechnologyFull[] | TechnologyCore[]> {
    const query = 'SELECT * FROM Technologies WHERE Era = ? ORDER BY Cost, ID';
    const results = await this.db.query(query, [era]);
    
    if (core) {
      return results.map(row => TechnologyCoreSchema.parse(row));
    }
    
    return results.map(row => TechnologyFullSchema.parse(row));
  }

  /**
   * Get technology prerequisites
   */
  async getTechnologyPrerequisites(techType: string): Promise<string[]> {
    const query = `
      SELECT PrereqTech 
      FROM Technology_PrereqTechs 
      WHERE TechType = ?
    `;
    const results = await this.db.query(query, [techType]);
    return results.map(row => row.PrereqTech);
  }

  /**
   * Get technologies that depend on a given technology
   */
  async getTechnologyDependents(prereqTech: string): Promise<string[]> {
    const query = `
      SELECT TechType 
      FROM Technology_PrereqTechs 
      WHERE PrereqTech = ?
    `;
    const results = await this.db.query(query, [prereqTech]);
    return results.map(row => row.TechType);
  }

  /**
   * Get technology tree structure
   */
  async getTechnologyTree(): Promise<Map<string, string[]>> {
    const query = 'SELECT TechType, PrereqTech FROM Technology_PrereqTechs';
    const results = await this.db.query(query);
    
    const tree = new Map<string, string[]>();
    
    for (const row of results) {
      if (!tree.has(row.TechType)) {
        tree.set(row.TechType, []);
      }
      tree.get(row.TechType)!.push(row.PrereqTech);
    }
    
    return tree;
  }

  /**
   * Search technologies by description
   */
  async searchTechnologies(searchTerm: string, core: boolean = false): Promise<TechnologyFull[] | TechnologyCore[]> {
    const query = `
      SELECT * FROM Technologies 
      WHERE Description LIKE ? OR Type LIKE ?
      ORDER BY Cost, ID
    `;
    const searchPattern = `%${searchTerm}%`;
    const results = await this.db.query(query, [searchPattern, searchPattern]);
    
    if (core) {
      return results.map(row => TechnologyCoreSchema.parse(row));
    }
    
    return results.map(row => TechnologyFullSchema.parse(row));
  }
}