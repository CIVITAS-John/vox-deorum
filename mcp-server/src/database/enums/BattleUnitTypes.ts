/**
 * @module database/enums/BattleUnitTypes
 * @description BattleUnitTypes enumeration mapping
 *
 * Maps numeric battle unit type identifiers to their string names.
 * Represents the role of a unit in combat (attacker, defender, interceptor).
 *
 * Auto-generated from the game's BattleUnitTypes enum.
 *
 * @example
 * ```typescript
 * import { BattleUnitTypes } from './database/enums/BattleUnitTypes.js';
 *
 * console.log(BattleUnitTypes[0]); // "Attacker"
 * console.log(BattleUnitTypes[1]); // "Defender"
 * ```
 */
export const BattleUnitTypes: Record<number, string> = {
  0: 'Attacker',
  1: 'Defender',
  2: 'Interceptor'
};
