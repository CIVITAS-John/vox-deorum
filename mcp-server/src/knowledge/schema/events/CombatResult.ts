import { z } from 'zod';

/**
 * CombatResult event schema
 * Triggered during combat preparation phase before actual combat resolution
 * Provides predicted combat parameters for analysis and potential intervention
 */
export const CombatResult = z.object({
  /** Player ID of the attacking player */
  AttackingPlayerId: z.number(),
  
  /** Unit ID of the attacking unit */
  AttackingUnitId: z.number(),
  
  /** Predicted initial damage for the attacker */
  AttackerDamage: z.number(),
  
  /** Predicted final damage state of the attacker */
  AttackerFinalDamage: z.number(),
  
  /** Maximum hit points of the attacking unit */
  AttackerMaxHp: z.number(),
  
  /** Player ID of the defending player */
  DefendingPlayerId: z.number(),
  
  /** Unit ID of the defending unit */
  DefendingUnitId: z.number(),
  
  /** Predicted initial damage for the defender */
  DefenderDamage: z.number(),
  
  /** Predicted final damage state of the defender */
  DefenderFinalDamage: z.number(),
  
  /** Maximum hit points of the defending unit */
  DefenderMaxHp: z.number(),
  
  /** Player ID of any intercepting unit (if applicable) */
  InterceptingPlayerId: z.number(),
  
  /** Unit ID of any intercepting unit (if applicable) */
  InterceptingUnitId: z.number(),
  
  /** Predicted damage for interceptor */
  InterceptorDamage: z.number(),
  
  /** X coordinate of the combat location */
  PlotX: z.number(),
  
  /** Y coordinate of the combat location */
  PlotY: z.number(),
});