/**
 * UnitKilledInCombat Event
 * 
 * Triggered when a unit is killed in combat within Civilization V.
 * This event provides information about both the killed unit and the attacking unit.
 */
export interface UnitKilledInCombat {
  /** The ID of the player who owned the killed unit */
  PlayerId: number;
  
  /** The ID of the player whose unit was killed (same as PlayerId) */
  KilledPlayerId: number;
  
  /** The unit type ID of the killed unit (UnitTypes enum value) */
  UnitType: number;
  
  /** The ID of the unit that killed this unit, or -1 if no specific killing unit */
  KillingUnitId: number;
}