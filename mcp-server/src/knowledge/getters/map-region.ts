/**
 * Utility functions for extracting map region data
 * Provides spatial awareness for AI accessibility (Issue #469)
 *
 * Kali ❤️‍🔥 [Visionary]: This bridges the gap between "what exists" and "where it is"
 * Athena 🦉 [Reviewer]: Mirrors data from PlotMouseoverInclude.lua
 * Nemesis 💀 [Accessibility]: Sighted players see this at a GLANCE - now AI can too
 */

import { LuaFunction } from '../../bridge/lua-function.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('MapRegion');

/**
 * Unit data on a tile
 */
export interface TileUnit {
  Name: string;
  Owner: string;
  Strength?: number;
  RangedStrength?: number;
  Health: number;
}

/**
 * Yield data for a tile
 */
export interface TileYields {
  Food: number;
  Production: number;
  Gold: number;
  Science: number;
  Culture: number;
  Faith: number;
}

/**
 * Complete tile data structure
 */
export interface TileData {
  // Location
  X: number;
  Y: number;

  // Visibility
  Visibility: 'Visible' | 'Revealed' | 'Hidden';

  // Terrain
  Terrain?: string;
  IsHills?: boolean;
  IsMountain?: boolean;
  Feature?: string;

  // Water
  IsRiver?: boolean;
  IsFreshWater?: boolean;
  IsLake?: boolean;
  IsCoastal?: boolean;

  // Resources
  Resource?: string;
  ResourceQuantity?: number;
  ResourceClass?: 'Bonus' | 'Strategic' | 'Luxury';
  ResourceImproved?: boolean;

  // Improvements
  Improvement?: string;
  ImprovementPillaged?: boolean;
  Route?: string;
  RoutePillaged?: boolean;

  // Ownership
  Owner?: string;
  City?: string;
  WorkedByCity?: string;

  // Units
  Units?: TileUnit[];

  // Combat modifiers
  DefenseModifier?: number;
  MovementCost?: number;

  // Yields
  Yields?: TileYields;
}

/**
 * Lua function that extracts map region data
 */
const luaFunc = LuaFunction.fromFile(
  'get-map-region.lua',
  'getMapRegion',
  ['centerX', 'centerY', 'radius', 'playerID']
);

/**
 * Get tile data for a region centered on a point
 * @param centerX - X coordinate of region center
 * @param centerY - Y coordinate of region center
 * @param radius - Radius in tiles (max 10)
 * @param playerID - Player ID for visibility filtering
 * @returns Array of TileData for visible/revealed tiles
 */
export async function getMapRegion(
  centerX: number,
  centerY: number,
  radius: number,
  playerID: number
): Promise<TileData[]> {
  // Clamp radius
  const clampedRadius = Math.min(Math.max(radius, 1), 10);

  const response = await luaFunc.execute(centerX, centerY, clampedRadius, playerID);

  if (!response.success) {
    logger.error('Failed to get map region from Lua', response);
    return [];
  }

  const tiles = response.result as TileData[];
  logger.info(`Retrieved ${tiles.length} tiles for region (${centerX},${centerY}) r=${clampedRadius}`);

  return tiles;
}

/**
 * Generate spatial notes describing notable features in the tile data
 * This is the key accessibility feature - describing what a sighted player would notice
 *
 * Kali ❤️‍🔥 [Visionary]: Translate visual patterns to text
 * Nemesis 💀 [Accessibility]: A sighted player sees "mountain range with gap" - we say it
 */
export function generateSpatialNotes(tiles: TileData[]): string[] {
  const notes: string[] = [];

  // Group tiles by type for analysis
  const mountains: TileData[] = [];
  const rivers: TileData[] = [];
  const resources: Map<string, TileData[]> = new Map();
  const cities: TileData[] = [];
  const enemyUnits: TileData[] = [];

  for (const tile of tiles) {
    if (tile.IsMountain) {
      mountains.push(tile);
    }
    if (tile.IsRiver) {
      rivers.push(tile);
    }
    if (tile.Resource) {
      const existing = resources.get(tile.Resource) || [];
      existing.push(tile);
      resources.set(tile.Resource, existing);
    }
    if (tile.City) {
      cities.push(tile);
    }
    if (tile.Units && tile.Units.length > 0) {
      enemyUnits.push(tile);
    }
  }

  // Note mountain clusters
  if (mountains.length >= 3) {
    const coords = mountains.map(t => `(${t.X},${t.Y})`).join(', ');
    notes.push(`Mountain range: ${mountains.length} peaks at ${coords}`);
  }

  // Note resource clusters
  for (const [resourceName, resourceTiles] of resources) {
    if (resourceTiles.length >= 2) {
      const coords = resourceTiles.map(t => `(${t.X},${t.Y})`).join(', ');
      const improved = resourceTiles.filter(t => t.ResourceImproved).length;
      notes.push(`${resourceName} cluster: ${resourceTiles.length} at ${coords} (${improved} improved)`);
    }
  }

  // Note cities
  for (const tile of cities) {
    notes.push(`City "${tile.City}" at (${tile.X},${tile.Y}) owned by ${tile.Owner || 'unknown'}`);
  }

  // Note visible enemy units
  for (const tile of enemyUnits) {
    if (tile.Units) {
      for (const unit of tile.Units) {
        if (unit.Strength && unit.Strength > 0) {
          notes.push(`${unit.Owner} ${unit.Name} (${unit.Strength} str, ${unit.Health}% hp) at (${tile.X},${tile.Y})`);
        }
      }
    }
  }

  // Note defensive positions (hills with good defense)
  const defensivePositions = tiles.filter(t =>
    t.IsHills && !t.IsMountain && (t.DefenseModifier || 0) >= 25
  );
  if (defensivePositions.length >= 2) {
    const coords = defensivePositions.slice(0, 3).map(t => `(${t.X},${t.Y})`).join(', ');
    notes.push(`Defensive terrain: ${defensivePositions.length} hill positions including ${coords}`);
  }

  return notes;
}
