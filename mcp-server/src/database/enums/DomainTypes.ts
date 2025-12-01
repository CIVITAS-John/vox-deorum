/**
 * @module database/enums/DomainTypes
 * @description DomainTypes enumeration mapping
 *
 * Maps numeric domain type identifiers to their string names.
 * Domains represent the operational environment of units (land, sea, air, etc.).
 *
 * Auto-generated from the game's DomainTypes enum.
 *
 * @example
 * ```typescript
 * import { DomainTypes } from './database/enums/DomainTypes.js';
 *
 * console.log(DomainTypes[2]); // "Land"
 * console.log(DomainTypes[1]); // "Air"
 * ```
 */
export const DomainTypes: Record<number, string> = {
  '-1': 'None',
  0: 'Sea',
  1: 'Air',
  2: 'Land',
  3: 'Immobile',
  4: 'Hover'
};
