/**
 * UnitPromoted Event
 * 
 * Triggered when a unit in Civilization V receives a promotion.
 * This event provides information about which unit was promoted, which player owns the unit,
 * and what promotion was gained.
 */
export interface UnitPromoted {
  /** The player ID who owns the promoted unit */
  Owner: number;
  
  /** The unique identifier of the unit that was promoted */
  UnitId: number;
  
  /** The promotion ID that the unit received (UnitPromotions enum value) */
  Promotion: number;
}