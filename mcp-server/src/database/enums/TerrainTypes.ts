/**
 * @module database/enums/TerrainTypes
 * @description TerrainTypes enumeration mapping
 *
 * Maps numeric terrain type identifiers to their string names.
 * Terrain types represent the base terrain of map tiles (grass, plains, ocean, etc.).
 *
 * Auto-generated from the game's TerrainTypes enum.
 *
 * @example
 * ```typescript
 * import { TerrainTypes } from './database/enums/TerrainTypes.js';
 *
 * console.log(TerrainTypes[0]); // "Grass"
 * console.log(TerrainTypes[6]); // "Ocean"
 * ```
 */
export const TerrainTypes: Record<number, string> = {
  '-1': 'None',
  0: 'Grass',
  1: 'Plains',
  2: 'Desert',
  3: 'Tundra',
  4: 'Snow',
  5: 'Coast',
  6: 'Ocean',
  7: 'Mountain',
  8: 'Hill'
};
