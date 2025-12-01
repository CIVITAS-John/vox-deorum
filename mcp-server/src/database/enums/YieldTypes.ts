/**
 * @module database/enums/YieldTypes
 * @description YieldTypes enumeration mapping
 *
 * Maps numeric yield type identifiers to their string names in Civilization V.
 * Yields represent the various types of resources and output that cities and tiles produce.
 *
 * Auto-generated from the game's YieldTypes enum.
 *
 * @example
 * ```typescript
 * import { YieldTypes } from './database/enums/YieldTypes.js';
 *
 * console.log(YieldTypes[0]); // "Food"
 * console.log(YieldTypes[3]); // "Science"
 * ```
 */
export const YieldTypes: Record<number, string> = {
  '-1': 'None',
  0: 'Food',
  1: 'Production',
  2: 'Gold',
  3: 'Science',
  4: 'Culture',
  5: 'Faith',
  6: 'Tourism',
  7: 'GoldenAgePoints',
  8: 'GreatGeneralPoints',
  9: 'GreatAdmiralPoints',
  10: 'Population',
  11: 'CultureLocal',
  12: 'JfdHealth',
  13: 'JfdDisease',
  14: 'JfdCrime',
  15: 'JfdLoyalty',
  16: 'JfdSovereignty'
};
