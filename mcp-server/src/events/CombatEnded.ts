/**
 * Event triggered after a combat resolution between units, providing comprehensive information about the combat outcome
 */
export interface CombatEnded {
  /** Player ID of the attacking unit's owner */
  AttackingPlayerId: number;
  
  /** Unique ID of the attacking unit */
  AttackingUnitId: number;
  
  /** Damage dealt by the attacker during this combat */
  AttackerDamage: number;
  
  /** Total damage the attacker has after combat */
  AttackerFinalDamage: number;
  
  /** Maximum hit points of the attacking unit */
  AttackerMaxHP: number;
  
  /** Player ID of the defending unit's owner */
  DefendingPlayerId: number;
  
  /** Unique ID of the defending unit */
  DefendingUnitId: number;
  
  /** Damage dealt by the defender during this combat */
  DefenderDamage: number;
  
  /** Total damage the defender has after combat */
  DefenderFinalDamage: number;
  
  /** Maximum hit points of the defending unit */
  DefenderMaxHP: number;
  
  /** Player ID of the intercepting unit's owner (0 if none) */
  InterceptingPlayerId: number;
  
  /** Unique ID of the intercepting unit (0 if none) */
  InterceptingUnitId: number;
  
  /** Damage dealt by the interceptor (0 if none) */
  InterceptorDamage: number;
  
  /** X coordinate of the combat location */
  PlotX: number;
  
  /** Y coordinate of the combat location */
  PlotY: number;
}