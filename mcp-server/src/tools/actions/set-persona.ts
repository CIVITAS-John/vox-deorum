/**
 * Tool for setting a player's AI persona values in Civilization V
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { knowledgeManager } from "../../server.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { composeVisibility } from "../../utils/knowledge/visibility.js";
import { addReplayMessages } from "../../utils/lua/replay-messages.js";

const personaSchema = z.object({
  // Core Competitiveness & Ambition
  VictoryCompetitiveness: z.number().min(1).max(10).optional().describe("How competitive the AI is toward victory (0-10)"),
  WonderCompetitiveness: z.number().min(1).max(10).optional().describe("How aggressively the AI pursues wonders (0-10)"),
  MinorCivCompetitiveness: z.number().min(1).max(10).optional().describe("How aggressively the AI competes for city-state influence (0-10)"),
  Boldness: z.number().min(1).max(10).optional().describe("General boldness in decision-making (0-10)"),

  // War & Peace Tendencies
  WarBias: z.number().min(1).max(10).optional().describe("Likelihood to declare war (0-10)"),
  HostileBias: z.number().min(1).max(10).optional().describe("Tendency toward hostile relationships (0-10)"),
  WarmongerHate: z.number().min(1).max(10).optional().describe("How much they dislike warmongers (0-10)"),
  NeutralBias: z.number().min(1).max(10).optional().describe("Tendency toward neutral relationships (0-10)"),
  FriendlyBias: z.number().min(1).max(10).optional().describe("Tendency toward friendly relationships (0-10)"),
  GuardedBias: z.number().min(1).max(10).optional().describe("Tendency to be guarded in diplomacy (0-10)"),
  AfraidBias: z.number().min(1).max(10).optional().describe("Tendency to be afraid of stronger civs (0-10)"),

  // Diplomacy & Cooperation
  DiplomaticBalance: z.number().min(1).max(10).optional().describe("Balance in diplomatic approach (0-10)"),
  Friendliness: z.number().min(1).max(10).optional().describe("Overall friendliness level (0-10)"),
  WorkWithWillingness: z.number().min(1).max(10).optional().describe("Willingness to cooperate with others (0-10)"),
  WorkAgainstWillingness: z.number().min(1).max(10).optional().describe("Willingness to work against others (0-10)"),
  Loyalty: z.number().min(1).max(10).optional().describe("Loyalty to friends and allies (0-10)"),

  // Minor Civ Relations
  MinorCivFriendlyBias: z.number().min(1).max(10).optional().describe("Tendency to be friendly with city-states (0-10)"),
  MinorCivNeutralBias: z.number().min(1).max(10).optional().describe("Tendency to be neutral with city-states (0-10)"),
  MinorCivHostileBias: z.number().min(1).max(10).optional().describe("Tendency to be hostile with city-states (0-10)"),
  MinorCivWarBias: z.number().min(1).max(10).optional().describe("Likelihood to attack city-states (0-10)"),

  // Personality Traits
  DenounceWillingness: z.number().min(1).max(10).optional().describe("Willingness to denounce other civs (0-10)"),
  Forgiveness: z.number().min(1).max(10).optional().describe("How quickly they forgive past transgressions (0-10)"),
  Meanness: z.number().min(1).max(10).optional().describe("General meanness in behavior (0-10)"),
  Neediness: z.number().min(1).max(10).optional().describe("How needy they are in trades and deals (0-10)"),
  Chattiness: z.number().min(1).max(10).optional().describe("How often they initiate diplomatic contact (0-10)"),
  DeceptiveBias: z.number().min(1).max(10).optional().describe("Tendency to be deceptive (0-10)"),
});

/**
 * Tool that sets a player's AI persona values using a Lua function
 */
class SetPersonaTool extends LuaFunctionTool<Record<string, number>> {
  /**
   * Unique identifier for the set-persona tool
   */
  readonly name = "set-persona";

  /**
   * Human-readable description of the tool
   */
  readonly description = "Set a player's personality values (1-10). These values control the in-game AI's diplomatic patterns and decision-making.";

  /**
   * Input schema for the set-persona tool
   */
  inputSchema = personaSchema.extend({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1).describe("ID of the player"),
    Rationale: z.string().describe("Explain your rationale for adjusting these persona values in a paragraph")
  });

  /**
   * Result schema - returns previous persona values
   */
  protected resultSchema = z.record(z.string(), z.number());

  /**
   * The Lua function arguments
   */
  protected arguments = ["playerID", "personaValues"];
  
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

    -- Capture previous persona values before setting new ones
    local previousPersona = activePlayer:GetPersona()

    -- Set new persona values (only non-nil values are updated)
    activePlayer:SetPersona(personaValues)

    -- Return the previous persona values
    return previousPersona
  `;

  /**
   * Execute the set-persona command
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    // Extract the rationale and player ID
    const { Rationale, PlayerID, ...personaValues } = args;

    // Filter out undefined values to only send what needs to be changed
    const filteredPersona = Object.fromEntries(
      Object.entries(personaValues).filter(([_, value]) => value !== undefined)
    );

    // Call the parent execute with the persona values table
    const result = await super.call(PlayerID, filteredPersona);

    if (result.Success) {
      const store = knowledgeManager.getStore();
      const previousPersona = result.Result;
      const lastRationale = (await store.getMutableKnowledge("PersonaChanges", PlayerID))?.Rationale ?? "Unknown";

      // Store the previous persona with reason "In-Game AI"
      if (previousPersona && Object.keys(previousPersona).length > 0) {
        await store.storeMutableKnowledge(
          'PersonaChanges',
          PlayerID,
          {
            ...previousPersona,
            Rationale: lastRationale.startsWith("Tweaked by In-Game AI") ? lastRationale : `Tweaked by In-Game AI (${lastRationale.trim()})`
          },
          composeVisibility([PlayerID]),
          ["Rationale"] // Only ignore Rationale when checking for changes
        );
      }

      // Store the new persona values in the database
      const newPersona = {
        ...previousPersona, // Start with previous values
        ...filteredPersona  // Override with new values
      };

      await store.storeMutableKnowledge(
        'PersonaChanges',
        PlayerID,
        {
          ...newPersona,
          Rationale: Rationale
        },
        composeVisibility([PlayerID])
      );

      // Compare and send replay messages for actual changes
      const changeDescriptions: string[] = [];
      for (const field of Object.keys(filteredPersona)) {
        const beforeValue = previousPersona?.[field];
        const afterValue = filteredPersona[field as keyof typeof filteredPersona];
        if (beforeValue !== afterValue) {
          changeDescriptions.push(`${field}: ${beforeValue || "Default"} → ${afterValue}`);
        }
      }

      if (changeDescriptions.length > 0) {
        const message = `Changed persona values: ${changeDescriptions.join("; ")}. Rationale: ${Rationale}`;
        await addReplayMessages(PlayerID, message);
      }
    }

    delete result.Result;
    return result;
  }
}

/**
 * Creates a new instance of the set persona tool
 */
export default function createSetPersonaTool() {
  return new SetPersonaTool();
}