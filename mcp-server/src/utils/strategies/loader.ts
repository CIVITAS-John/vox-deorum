/**
 * Shared utility for loading and caching strategy JSON files
 */

import * as fs from "fs/promises";
import * as path from "path";
import { logger } from "../logger.js";

/**
 * Type definition for Military Strategy
 */
export interface MilitaryStrategy {
  Type: string;
  Production: Record<string, number>;
  Overall: Record<string, number>;
  Description?: string;
}

/**
 * Type definition for Economic Strategy
 */
export interface EconomicStrategy {
  Type: string;
  Production: Record<string, number>;
  Overall: Record<string, number>;
  Description?: string;
}

// Cache for loaded strategy files
const strategyCache = new Map<string, { data: any; timestamp: number }>();

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * Load and cache a strategy JSON file
 * @param filename The name of the JSON file (without path)
 * @returns The parsed JSON content or empty object if file doesn't exist
 */
async function loadStrategyFile<T = any>(filename: string): Promise<T> {
  const cacheKey = filename;
  const now = Date.now();

  // Check if we have a valid cached version
  const cached = strategyCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.data as T;
  }

  // Load from file
  try {
    const jsonPath = path.join(process.cwd(), 'docs', 'strategies', filename);
    const content = await fs.readFile(jsonPath, 'utf-8');
    const data = JSON.parse(content);

    // Update cache
    strategyCache.set(cacheKey, { data, timestamp: now });

    return data as T;
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      logger.warn(`Warning reading ${filename}: ${error.message}`);
    }
    // Return empty object if file doesn't exist or can't be read
    const emptyData = {} as T;
    strategyCache.set(cacheKey, { data: emptyData, timestamp: now });
    return emptyData;
  }
}

/**
 * Load flavor descriptions from JSON file
 */
export async function loadFlavorDescriptions(): Promise<Record<string, string>> {
  return loadStrategyFile<Record<string, string>>('flavors.json');
}

/**
 * Load grand strategy descriptions from JSON file
 */
export async function loadGrandStrategyDescriptions(): Promise<Record<string, string>> {
  return loadStrategyFile<Record<string, string>>('grand-strategy.json');
}

/**
 * Load military strategy descriptions from JSON file
 * @returns Array of military strategies or empty array if file doesn't exist
 */
export async function loadMilitaryStrategies(): Promise<MilitaryStrategy[]> {
  const data = await loadStrategyFile<MilitaryStrategy[]>('military.json');
  return Array.isArray(data) ? data : [];
}

/**
 * Load economic strategy descriptions from JSON file
 * @returns Array of economic strategies or empty array if file doesn't exist
 */
export async function loadEconomicStrategies(): Promise<EconomicStrategy[]> {
  const data = await loadStrategyFile<EconomicStrategy[]>('economic.json');
  return Array.isArray(data) ? data : [];
}

/**
 * Clear the cache for a specific file or all files
 * @param filename Optional filename to clear specific cache entry
 */
export function clearStrategyCache(filename?: string): void {
  if (filename) {
    strategyCache.delete(filename);
  } else {
    strategyCache.clear();
  }
}