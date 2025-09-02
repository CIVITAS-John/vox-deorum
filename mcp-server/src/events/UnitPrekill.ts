/**
 * UnitPrekill Event
 * 
 * Triggered in Civilization V just before a unit is about to be killed or destroyed.
 * This event provides an opportunity for mods and external systems to intercept
 * and potentially modify the unit destruction process.
 */
export interface UnitPrekill {
  /** The player ID who owns the unit that is about to be killed */
  UnitOwner: number;
  
  /** The unique identifier of the unit being killed */
  UnitId: number;
  
  /** The unit type identifier (corresponds to game's unit definitions) */
  UnitType: number;
  
  /** The X coordinate of the unit's current position on the map */
  X: number;
  
  /** The Y coordinate of the unit's current position on the map */
  Y: number;
  
  /** Flag indicating whether the kill operation should be delayed */
  Delay: boolean;
  
  /** The player ID associated with the kill action (may be attacker or event initiator) */
  KillingPlayer: number;
}