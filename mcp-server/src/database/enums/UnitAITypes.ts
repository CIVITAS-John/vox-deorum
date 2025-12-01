/**
 * @module database/enums/UnitAITypes
 * @description UnitAITypes enumeration mapping
 *
 * Maps numeric unit AI type identifiers to their string names.
 * Unit AI types determine the strategic behavior and mission assignment for units.
 *
 * Auto-generated from the game's UnitAITypes enum.
 *
 * @example
 * ```typescript
 * import { UnitAITypes } from './database/enums/UnitAITypes.js';
 *
 * console.log(UnitAITypes[0]); // "Unknown"
 * console.log(UnitAITypes[1]); // "Settle"
 * ```
 */
export const UnitAITypes: Record<number, string> = {
  '-1': 'None',
  0: 'Unknown',
  1: 'Settle',
  2: 'Worker',
  3: 'Attack',
  4: 'CityBombard',
  5: 'FastAttack',
  6: 'Defense',
  7: 'Counter',
  8: 'Ranged',
  9: 'CitySpecial',
  10: 'Explore',
  11: 'Artist',
  12: 'Scientist',
  13: 'General',
  14: 'Merchant',
  15: 'Engineer',
  16: 'Icbm',
  17: 'WorkerSea',
  18: 'AttackSea',
  19: 'ReserveSea',
  20: 'EscortSea',
  21: 'ExploreSea',
  22: 'AssaultSea',
  23: 'SettlerSea',
  24: 'CarrierSea',
  25: 'MissileCarrierSea',
  26: 'PirateSea',
  27: 'AttackAir',
  28: 'DefenseAir',
  29: 'CarrierAir',
  30: 'MissileAir',
  31: 'Paradrop',
  32: 'SpaceshipPart',
  33: 'Treasure',
  34: 'Prophet',
  35: 'Missionary',
  36: 'Inquisitor',
  37: 'Admiral',
  38: 'TradeUnit',
  39: 'Archaeologist',
  40: 'Writer',
  41: 'Musician',
  42: 'Diplomat',
  43: 'Messenger',
  44: 'Skirmisher',
  45: 'Submarine'
};
