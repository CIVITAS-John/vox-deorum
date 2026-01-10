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
import { pascalCase } from "change-case";
import { retrieveEnumName, retrieveEnumValue } from "../../utils/knowledge/enum.js";
import { loadFlavorDescriptions } from "../../utils/strategies/loader.js";
import { FlavorChange } from "../../knowledge/schema/timed.js";
import { Insertable } from "kysely";

/**
 * Schema for the result returned by the Lua script
 */
const SetFlavorsResultSchema = z.object({
  Changed: z.boolean(),
  GrandStrategy: z.number(),
  Flavors: z.record(z.string(), z.number())
});

type SetFlavorsResultType = z.infer<typeof SetFlavorsResultSchema>;

/**
 * Convert PascalCase flavor keys to FLAVOR_ format
 */
function convertToFlavorFormat(key: string): string {
  // Split at capital letters, but keep consecutive capitals together
  let result = '';
  for (let i = 0; i < key.length; i++) {
    const char = key[i];
    const nextChar = key[i + 1];

    // Add underscore before capital letter if:
    // - It's not the first character
    // - Previous char was lowercase OR next char is lowercase
    if (i > 0 && char === char.toUpperCase() &&
        (key[i - 1] === key[i - 1].toLowerCase() ||
         (nextChar && nextChar === nextChar.toLowerCase()))) {
      result += '_';
    }
    result += char.toUpperCase();
  }

  return 'FLAVOR_' + result;
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
  readonly description = "Set flavor values and/or grand strategy to shape tactical AI preferences without changing ongoing queues. Only send in values you intend to change.";

  /**
   * Input schema for the set-flavors tool
   */
  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1).describe("ID of the player"),
    GrandStrategy: z.string().optional().describe("The grand strategy name to set (and override)"),
    Flavors: z.record(
      z.string(),
      z.number().min(-300).max(300)
    ).optional().describe("Flavor values to set. Positive for prioritizing, negative for deprioritizing."),
    Rationale: z.string().describe("Briefly explain your rationale for these adjustments")
  });

  /**
   * Result schema - returns previous grand strategy and flavor values
   */
  protected resultSchema = SetFlavorsResultSchema;

  /**
   * The Lua function arguments
   */
  protected arguments = ["playerID", "flavors", "grandId"];

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
    local changed = false

    -- Capture previous grand strategy
    local previousGrandStrategy = activePlayer:GetGrandStrategy()

    -- Get ALL current custom flavors using GetCustomFlavors
    local previousFlavors = activePlayer:GetCustomFlavors()

    -- Set grand strategy if provided
    if grandId ~= -1 then
      if activePlayer:SetGrandStrategy(grandId) then
        changed = true
      end
    end

    -- Set custom flavors if provided
    if flavors then
      if activePlayer:SetCustomFlavors(flavors) then
        changed = true
      end
    end

    -- Clear the military/economic strategies as we don't need them
    activePlayer:SetEconomicStrategies({})
    activePlayer:SetMilitaryStrategies({})

    -- Return the previous values
    return {
      Changed = changed,
      GrandStrategy = previousGrandStrategy,
      Flavors = previousFlavors
    }
  `;

  /**
   * Execute the set-flavors command
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    // Load valid flavor keys from JSON
    const validFlavors = await loadFlavorDescriptions();
    const validFlavorKeys = Object.keys(validFlavors);

    // Convert PascalCase keys to FLAVOR_ format if flavors are provided
    // Only include flavors that exist in the JSON file
    const flavorsTable: Record<string, number> = {};
    const newFlavors: Record<string, number> = {};
    if (args.Flavors) {
      for (const [key, value] of Object.entries(args.Flavors)) {
        if (validFlavorKeys.includes(key)) {
          flavorsTable[convertToFlavorFormat(key)] = value;
          newFlavors[key] = value;
        }
      }
    }

    // Call the parent execute with the converted flavors and grand strategy
    let grandStrategyId = retrieveEnumValue("GrandStrategy", args.GrandStrategy)
    const result = await super.call(args.PlayerID, flavorsTable, grandStrategyId);

    if (result.Success) {
      const store = knowledgeManager.getStore();
      const previous = result.Result!;

      // Build the complete flavor state to store
      const flavorChange: Partial<Insertable<FlavorChange>> = {
        Rationale: args.Rationale
      };

      // Start with all existing flavor values from GetCustomFlavors
      const currentFlavors: Record<string, number> = {};
      for (const [key, value] of Object.entries(previous.Flavors)) {
        // Use pascalCase from change-case for consistency
        const withoutPrefix = key.replace(/^FLAVOR_/, '');
        const pascalKey = pascalCase(withoutPrefix);
        currentFlavors[pascalKey] = value as number;
      }

      const changeDescriptions: string[] = [];
      // Add grand strategy change if provided
      let previousGrandStrategy = retrieveEnumName("GrandStrategy", previous.GrandStrategy);
      if (args.GrandStrategy && previousGrandStrategy !== args.GrandStrategy) {
        changeDescriptions.push(`Grand Strategy: ${previousGrandStrategy} → ${args.GrandStrategy}`);
      }
      flavorChange.GrandStrategy = args.GrandStrategy ? retrieveEnumName("GrandStrategy", grandStrategyId) : previousGrandStrategy;

      // Compare values and apply the new flavors
      for (const [key, value] of Object.entries(newFlavors)) {
        const beforeValue = currentFlavors?.[key];
        if (beforeValue !== undefined && beforeValue !== value) {
          changeDescriptions.push(`${key}: ${beforeValue} → ${value}`);
        }
      }
      Object.assign(currentFlavors, newFlavors);

      // Store ALL flavors (both existing and new) in the knowledge store
      for (const key of validFlavorKeys) {
        (flavorChange as any)[key] = currentFlavors[key] ?? 0;
      }

      // Store in the database
      await store.storeMutableKnowledge(
        'FlavorChanges',
        args.PlayerID,
        flavorChange,
        composeVisibility([args.PlayerID])
      );

      // Compare and send replay messages for actual changes
      if (changeDescriptions.length > 0) {
        const message = `AI preferences: ${changeDescriptions.join("; ")}. Rationale: ${args.Rationale}`;
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