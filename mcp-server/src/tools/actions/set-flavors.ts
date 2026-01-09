/**
 * Tool for setting custom flavor values for a player in Civilization V
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { knowledgeManager } from "../../server.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { composeVisibility } from "../../utils/knowledge/visibility.js";
import { addReplayMessages } from "../../utils/lua/replay-messages.js";
import { constantCase, pascalCase } from "change-case";

/**
 * All available flavor types in PascalCase
 */
const flavorKeys = [
  // Military (17)
  "Offense", "Defense", "CityDefense", "MilitaryTraining",
  "Recon", "Ranged", "Mobile", "Nuke", "UseNuke",
  "Naval", "NavalRecon", "NavalGrowth", "NavalTileImprovement",
  "Air", "AirCarrier", "AntiAir", "Airlift",
  // Economy (9)
  "Expansion", "Growth", "TileImprovement", "Infrastructure",
  "Production", "WaterConnection", "Gold", "Science", "Culture",
  // Development (7)
  "Happiness", "GreatPeople", "Wonder", "Religion",
  "Diplomacy", "Spaceship", "Espionage"
] as const;

/**
 * Schema for the result returned by the Lua script
 */
const SetFlavorsResultSchema = z.object({
  previousGrandStrategy: z.string().optional(),
  previousFlavors: z.record(z.string(), z.number())
});

type SetFlavorsResultType = z.infer<typeof SetFlavorsResultSchema>;

/**
 * Convert PascalCase flavor keys to FLAVOR_ format
 */
function convertToFlavorFormat(key: string): string {
  // Convert to CONSTANT_CASE and add FLAVOR_ prefix
  return 'FLAVOR_' + constantCase(key);
}

/**
 * Tool that sets custom flavor values for a player using a Lua function
 */
class SetFlavorsTool extends LuaFunctionTool<SetFlavorsResultType> {
  /**
   * Unique identifier for the set-flavors tool
   */
  readonly name = "set-flavors";

  /**
   * Human-readable description of the tool
   */
  readonly description = "Set custom flavor values and/or grand strategy for a player that override default AI preferences. Custom flavors auto-expire after 10 turns.";

  /**
   * Input schema for the set-flavors tool
   */
  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1).describe("ID of the player"),
    GrandStrategy: z.enum([
      "AIGRANDSTRATEGY_CONQUEST",
      "AIGRANDSTRATEGY_CULTURE",
      "AIGRANDSTRATEGY_UNITED_NATIONS",
      "AIGRANDSTRATEGY_SPACESHIP"
    ]).optional().describe("Grand strategy to set for the player (optional)"),
    Flavors: z.record(
      z.enum(flavorKeys),
      z.number().min(0).max(20)
    ).optional().describe("Flavor values to set (0-20 scale). Available flavors: Military (Offense, Defense, CityDefense, MilitaryTraining, Recon, Ranged, Mobile, Nuke, UseNuke, Naval, NavalRecon, NavalGrowth, NavalTileImprovement, Air, AirCarrier, AntiAir, Airlift), Economy (Expansion, Growth, TileImprovement, Infrastructure, Production, WaterConnection, Gold, Science, Culture), Development (Happiness, GreatPeople, Wonder, Religion, Diplomacy, Spaceship, Espionage)"),
    Rationale: z.string().describe("Briefly explain your rationale for these adjustments")
  });

  /**
   * Result schema - returns previous grand strategy and flavor values
   */
  protected resultSchema = SetFlavorsResultSchema;

  /**
   * The Lua function arguments
   */
  protected arguments = ["playerID", "flavors", "grandStrategy"];

  /**
   * Optional annotations for the Lua executor tool
   */
  readonly annotations: ToolAnnotations = {
    readOnlyHint: false
  }

  /**
   * Optional metadata
   */
  readonly metadata = {
    autoComplete: ["PlayerID"]
  }

  /**
   * The Lua script to execute
   */
  protected script = `
    local activePlayer = Players[playerID]

    -- Capture previous grand strategy
    local previousGrandStrategy = activePlayer:GetGrandStrategyType()

    -- Get ALL current custom flavors using GetCustomFlavors
    local previousFlavors = activePlayer:GetCustomFlavors()

    -- Set grand strategy if provided
    if grandStrategy then
      activePlayer:SetGrandStrategyType(grandStrategy)
    end

    -- Set custom flavors if provided
    if flavors then
      activePlayer:SetCustomFlavors(flavors)
    end

    -- Clear the military/economic strategies as we don't need them
    activePlayer:SetEconomicStrategies({})
    activePlayer:SetMilitaryStrategies({})

    -- Return the previous values
    return {
      previousGrandStrategy = previousGrandStrategy,
      previousFlavors = previousFlavors
    }
  `;

  /**
   * Execute the set-flavors command
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    // Convert PascalCase keys to FLAVOR_ format if flavors are provided
    const flavorsTable: Record<string, number> | null = args.Flavors ? {} : null;
    if (args.Flavors) {
      for (const [key, value] of Object.entries(args.Flavors)) {
        flavorsTable![convertToFlavorFormat(key)] = value;
      }
    }

    // Call the parent execute with the converted flavors and grand strategy
    const result = await super.call(args.PlayerID, flavorsTable, args.GrandStrategy || null);

    if (result.Success) {
      const store = knowledgeManager.getStore();
      const { previousGrandStrategy, previousFlavors } = result.Result!;

      // Build the complete flavor state to store
      const flavorChange: any = {
        Rationale: args.Rationale,
        GrandStrategy: args.GrandStrategy ?? null
      };

      // Start with all existing flavor values from GetCustomFlavors
      const currentFlavors: Record<string, number> = {};

      // Convert previous flavors from FLAVOR_ format to PascalCase
      if (previousFlavors) {
        for (const [key, value] of Object.entries(previousFlavors)) {
          // Use pascalCase from change-case for consistency
          const withoutPrefix = key.replace(/^FLAVOR_/, '');
          const pascalKey = pascalCase(withoutPrefix);
          currentFlavors[pascalKey] = value as number;
        }
      }

      // Apply the new flavor values (overwriting existing ones)
      if (args.Flavors) {
        Object.assign(currentFlavors, args.Flavors);
      }

      // Store ALL flavors (both existing and new) in the knowledge store
      for (const key of flavorKeys) {
        flavorChange[key] = currentFlavors[key] ?? null;
      }

      // Store in the database
      await store.storeMutableKnowledge(
        'FlavorChanges',
        args.PlayerID,
        flavorChange,
        composeVisibility([args.PlayerID])
      );

      // Compare and send replay messages for actual changes
      const changeDescriptions: string[] = [];

      // Add grand strategy change if provided
      if (args.GrandStrategy && previousGrandStrategy !== args.GrandStrategy) {
        changeDescriptions.push(`Grand Strategy: ${previousGrandStrategy} → ${args.GrandStrategy}`);
      }

      // Add flavor changes if provided
      if (args.Flavors) {
        for (const [key, value] of Object.entries(args.Flavors)) {
          const flavorKey = convertToFlavorFormat(key);
          const beforeValue = previousFlavors?.[flavorKey];
          if (beforeValue !== undefined && beforeValue !== value) {
            changeDescriptions.push(`${key}: ${beforeValue} → ${value}`);
          }
        }
      }

      if (changeDescriptions.length > 0) {
        const message = `Changed AI preferences: ${changeDescriptions.join("; ")}. Rationale: ${args.Rationale}`;
        await addReplayMessages(args.PlayerID, message);
      }
    }

    delete result.Result;
    return result;
  }
}

/**
 * Creates a new instance of the set flavors tool
 */
export default function createSetFlavorsTool() {
  return new SetFlavorsTool();
}