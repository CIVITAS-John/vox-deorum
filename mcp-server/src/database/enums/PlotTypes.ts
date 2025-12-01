/**
 * @module database/enums/PlotTypes
 * @description PlotTypes enumeration mapping
 *
 * Maps numeric plot type identifiers to their string names.
 * Plot types represent the elevation/terrain category of map tiles (flat, hills, mountains).
 *
 * Auto-generated from the game's PlotTypes enum.
 *
 * @example
 * ```typescript
 * import { PlotTypes } from './database/enums/PlotTypes.js';
 *
 * console.log(PlotTypes[0]); // "Mountain"
 * console.log(PlotTypes[2]); // "Flat"
 * ```
 */
export const PlotTypes: Record<number, string> = {
  '-1': 'None',
  0: 'Mountain',
  1: 'Hills',
  2: 'Land',
  3: 'Ocean'
};
