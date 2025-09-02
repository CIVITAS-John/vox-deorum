/**
 * Event triggered whenever a combat encounter is resolved, providing detailed information about the combat outcome
 */
export interface CombatResult {
  /** Player ID of the attacking unit's owner */
  AttackingPlayerId: number;
  
  /** Unit ID of the attacking unit */
  AttackingUnitId: number;
  
  /** Damage dealt TO the attacking unit during combat */
  AttackerDamage: number;
  
  /** Final damage/health state of the attacking unit after combat */
  AttackerFinalDamage: number;
  
  /** Maximum health points of the attacking unit */
  AttackerMaxHP: number;
  
  /** Player ID of the defending unit's owner */
  DefendingPlayerId: number;
  
  /** Unit ID of the defending unit */
  DefendingUnitId: number;
  
  /** Damage dealt TO the defending unit during combat */
  DefenderDamage: number;
  
  /** Final damage/health state of the defending unit after combat */
  DefenderFinalDamage: number;
  
  /** Maximum health points of the defending unit */
  DefenderMaxHP: number;
  
  /** Player ID of any intercepting unit's owner (if applicable) */
  InterceptingPlayerId: number;
  
  /** Unit ID of any intercepting unit (if applicable) */
  InterceptingUnitId: number;
  
  /** Damage dealt TO the intercepting unit (if applicable) */
  InterceptorDamage: number;
  
  /** X coordinate of the combat location */
  PlotX: number;
  
  /** Y coordinate of the combat location */
  PlotY: number;
}