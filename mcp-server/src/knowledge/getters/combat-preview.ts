/**
 * Utility functions for combat preview data
 * Provides pre-attack combat predictions for AI accessibility (Issue #469)
 *
 * Kali ❤️‍🔥 [Visionary]: This is decision-critical - you can't play without it
 * Athena 🦉 [Reviewer]: Mirrors Game.GetCombatPrediction() + EnemyUnitPanel.lua
 * Nemesis 💀 [Accessibility]: Sighted players see this at a GLANCE when hovering
 */

import { LuaFunction } from '../../bridge/lua-function.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('CombatPreview');

/**
 * Combat modifier source
 */
export interface CombatModifier {
  Source: string;
  Value: number;
}

/**
 * Unit info for combat
 */
export interface CombatUnitInfo {
  ID: number;
  Name: string;
  Owner: string;
  X: number;
  Y: number;
  CurrentHP: number;
  MaxHP: number;
  BaseStrength: number;
  RangedStrength?: number;
  Moves?: number;
  MaxMoves?: number;
}

/**
 * Defender info (can be unit or city)
 */
export interface DefenderInfo {
  ID: number;
  Name: string;
  Type: 'Unit' | 'City';
  Owner: string;
  X: number;
  Y: number;
  CurrentHP: number;
  MaxHP: number;
  BaseStrength: number;
}

/**
 * Combat prediction result
 */
export interface CombatPrediction {
  Attacker: CombatUnitInfo;
  Defender: DefenderInfo;

  // Prediction
  Prediction: 'TotalVictory' | 'MajorVictory' | 'SmallVictory' |
              'Stalemate' |
              'SmallDefeat' | 'MajorDefeat' | 'TotalDefeat' |
              'Ranged' | 'Unknown';

  // Damage
  ExpectedDamageToDefender: number;
  ExpectedDamageToAttacker: number;
  DefenderWouldDie: boolean;
  AttackerWouldDie: boolean;

  // Risk
  RiskLevel: 'Safe' | 'Favorable' | 'Risky' | 'Dangerous' | 'Suicidal';

  // Combat type
  IsRanged: boolean;
  CanCounterAttack: boolean;

  // Modifiers
  AttackerModifiers: CombatModifier[];
  DefenderModifiers: CombatModifier[];
}

/**
 * Lua function for combat preview
 */
const luaFunc = LuaFunction.fromFile(
  'get-combat-preview.lua',
  'getCombatPreview',
  ['playerID', 'attackerUnitID', 'defenderUnitID', 'showAllTargets']
);

/**
 * Get combat preview for specific attacker vs defender
 */
export async function getCombatPreview(
  playerID: number,
  attackerUnitID: number,
  defenderUnitID?: number,
  showAllTargets?: boolean
): Promise<CombatPrediction[]> {
  const response = await luaFunc.execute(
    playerID,
    attackerUnitID,
    defenderUnitID ?? -1,
    showAllTargets ?? false
  );

  if (!response.success) {
    logger.error('Failed to get combat preview from Lua', response);
    return [];
  }

  const predictions = response.result as CombatPrediction[];
  logger.info(`Retrieved ${predictions.length} combat predictions for unit ${attackerUnitID}`);

  return predictions;
}

/**
 * Find the best target from a list of predictions
 * Best = kill with minimal damage taken, or highest damage dealt if no kills
 */
export function findBestTarget(predictions: CombatPrediction[]): {
  DefenderName: string;
  Prediction: string;
  Reason: string;
} | undefined {
  // Filter to safe kills first
  const safeKills = predictions.filter(p =>
    p.DefenderWouldDie && !p.AttackerWouldDie
  );

  if (safeKills.length > 0) {
    // Best kill = least damage to us
    const best = safeKills.reduce((a, b) =>
      a.ExpectedDamageToAttacker < b.ExpectedDamageToAttacker ? a : b
    );
    return {
      DefenderName: best.Defender.Name,
      Prediction: best.Prediction,
      Reason: `Kill with ${best.ExpectedDamageToAttacker} damage taken`,
    };
  }

  // No kills possible - find highest damage dealt safely
  const safeDamage = predictions.filter(p =>
    p.RiskLevel === 'Safe' || p.RiskLevel === 'Favorable'
  );

  if (safeDamage.length > 0) {
    const best = safeDamage.reduce((a, b) =>
      a.ExpectedDamageToDefender > b.ExpectedDamageToDefender ? a : b
    );
    return {
      DefenderName: best.Defender.Name,
      Prediction: best.Prediction,
      Reason: `Deal ${best.ExpectedDamageToDefender} damage safely`,
    };
  }

  return undefined;
}

/**
 * Find targets to avoid
 */
export function findAvoidTargets(predictions: CombatPrediction[]): {
  DefenderName: string;
  Reason: string;
}[] {
  return predictions
    .filter(p => p.AttackerWouldDie || p.RiskLevel === 'Suicidal' || p.RiskLevel === 'Dangerous')
    .map(p => ({
      DefenderName: p.Defender.Name,
      Reason: p.AttackerWouldDie
        ? 'Would result in our death'
        : 'Extremely unfavorable odds',
    }));
}
