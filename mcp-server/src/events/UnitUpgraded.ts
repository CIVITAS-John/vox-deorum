/**
 * UnitUpgraded Event
 * 
 * Triggered when a unit in Civilization V undergoes an upgrade transformation,
 * changing from one unit type to another. This event captures both regular unit upgrades
 * (using gold or resources) and special upgrades that may occur through other game mechanics.
 */
export interface UnitUpgraded {
  /** The ID of the player who owns the unit being upgraded */
  PlayerId: number;
  
  /** The unique ID of the original unit before upgrade (this unit no longer exists after the event) */
  OldUnitId: number;
  
  /** The unique ID of the new unit after upgrade */
  NewUnitId: number;
  
  /** Indicates whether the upgrade was triggered by a goody hut (true) or regular upgrade (false) */
  IsGoodyHut: boolean;
}