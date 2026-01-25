/**
 * Tool for retrieving combat predictions before attacking
 * Provides the "what if I attacked?" preview that sighted players see when hovering
 *
 * Related: Issue #469 - AI Accessibility in Games
 *
 * Kali ❤️‍🔥 [Visionary]: This is the MOST important tactical information
 * Athena 🦉 [Reviewer]: Exposes Game.GetCombatPrediction() + damage calculations
 * Nemesis 💀 [Accessibility]: Without this, you're playing blind (pun intended)
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import {
  getCombatPreview,
  findBestTarget,
  findAvoidTargets,
} from "../../knowledge/getters/combat-preview.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

/**
 * Input schema
 */
const GetCombatPreviewInputSchema = z.object({
  // Player perspective
  PlayerID: z.number().min(0).max(MaxMajorCivs - 1).optional()
    .describe("Player ID (default: 0)"),

  // Specific attack query
  AttackerUnitID: z.number().describe("ID of the attacking unit"),
  DefenderUnitID: z.number().optional()
    .describe("ID of specific defender unit (optional)"),

  // Get all targets
  ShowAllTargets: z.boolean().default(false)
    .describe("If true, show predictions for all valid targets in range"),

  // Include recommendations
  IncludeRecommendations: z.boolean().default(true)
    .describe("Include best target and avoid recommendations"),
});

/**
 * Combat modifier schema
 */
const CombatModifierSchema = z.object({
  Source: z.string().describe("What's providing the modifier"),
  Value: z.number().describe("Percentage modifier (+25, -10, etc.)"),
});

/**
 * Attacker info schema
 */
const AttackerInfoSchema = z.object({
  ID: z.number(),
  Name: z.string(),
  Owner: z.string(),
  X: z.number(),
  Y: z.number(),
  CurrentHP: z.number(),
  MaxHP: z.number(),
  BaseStrength: z.number(),
  RangedStrength: z.number().optional(),
  Moves: z.number().optional(),
  MaxMoves: z.number().optional(),
});

/**
 * Defender info schema
 */
const DefenderInfoSchema = z.object({
  ID: z.number(),
  Name: z.string(),
  Type: z.enum(["Unit", "City"]),
  Owner: z.string(),
  X: z.number(),
  Y: z.number(),
  CurrentHP: z.number(),
  MaxHP: z.number(),
  BaseStrength: z.number(),
});

/**
 * Combat prediction schema
 */
const CombatPredictionSchema = z.object({
  Attacker: AttackerInfoSchema,
  Defender: DefenderInfoSchema,

  // The key prediction - matches the UI icons
  Prediction: z.enum([
    "TotalVictory",   // We kill them, minimal damage to us
    "MajorVictory",   // We kill them, some damage to us
    "SmallVictory",   // We do more damage than we take
    "Stalemate",      // Roughly equal exchange
    "SmallDefeat",    // We take more damage than we deal
    "MajorDefeat",    // We take heavy damage
    "TotalDefeat",    // We die
    "Ranged",         // Ranged attack (no counter-damage)
    "Unknown",
  ]).describe("Overall combat prediction"),

  // Damage numbers
  ExpectedDamageToDefender: z.number().describe("HP damage we expect to deal"),
  ExpectedDamageToAttacker: z.number().describe("HP damage we expect to take"),
  DefenderWouldDie: z.boolean(),
  AttackerWouldDie: z.boolean(),

  // Risk assessment
  RiskLevel: z.enum(["Safe", "Favorable", "Risky", "Dangerous", "Suicidal"]),

  // Combat type
  IsRanged: z.boolean(),
  CanCounterAttack: z.boolean(),

  // Modifiers breakdown
  AttackerModifiers: z.array(CombatModifierSchema),
  DefenderModifiers: z.array(CombatModifierSchema),
});

/**
 * Output schema
 */
const GetCombatPreviewOutputSchema = z.object({
  // All predictions
  Predictions: z.array(CombatPredictionSchema),

  // Recommendations
  BestTarget: z.object({
    DefenderName: z.string(),
    Prediction: z.string(),
    Reason: z.string(),
  }).optional().describe("Recommended target if multiple options"),

  AvoidTargets: z.array(z.object({
    DefenderName: z.string(),
    Reason: z.string(),
  })).optional().describe("Targets that would result in defeat"),
});

/**
 * Type exports
 */
export type CombatPreviewOutput = z.infer<typeof GetCombatPreviewOutputSchema>;

/**
 * Tool for combat previews
 */
class GetCombatPreviewTool extends ToolBase {
  readonly name = "get-combat-preview";

  readonly description = `Predicts combat outcomes before committing to an attack.

Use this to understand:
- Expected damage dealt and received
- Whether attacker/defender would die
- Combat modifiers affecting the fight (terrain, flanking, health)
- Risk level of the engagement (Safe → Suicidal)
- Best target recommendation if multiple options

This provides the "what if I attacked?" preview that sighted players see when hovering over enemies.`;

  readonly inputSchema = GetCombatPreviewInputSchema;
  readonly outputSchema = GetCombatPreviewOutputSchema;

  readonly annotations: ToolAnnotations = {
    readOnlyHint: true
  };

  readonly metadata = {
    autoComplete: ["PlayerID", "AttackerUnitID", "DefenderUnitID"],
  };

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const {
      PlayerID,
      AttackerUnitID,
      DefenderUnitID,
      ShowAllTargets,
      IncludeRecommendations
    } = args;

    const playerID = PlayerID ?? 0;

    // Get predictions
    const predictions = await getCombatPreview(
      playerID,
      AttackerUnitID,
      DefenderUnitID,
      ShowAllTargets
    );

    // Build output
    const result: z.infer<typeof this.outputSchema> = {
      Predictions: predictions,
    };

    // Add recommendations if requested and we have multiple predictions
    if (IncludeRecommendations && predictions.length > 0) {
      const bestTarget = findBestTarget(predictions);
      const avoidTargets = findAvoidTargets(predictions);

      if (bestTarget) {
        result.BestTarget = bestTarget;
      }

      if (avoidTargets.length > 0) {
        result.AvoidTargets = avoidTargets;
      }
    }

    return result;
  }
}

/**
 * Creates a new instance of the combat preview tool
 */
export default function createGetCombatPreviewTool() {
  return new GetCombatPreviewTool();
}
