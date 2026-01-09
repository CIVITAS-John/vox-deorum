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
  VictoryCompetitiveness: z.number().min(1).max(10).optional().describe("How aggressively the AI reacts to others pursuing victories (0-10)"),
  WonderCompetitiveness: z.number().min(1).max(10).optional().describe("How aggressively the AI reacts to others competing for wonders (0-10)"),
  MinorCivCompetitiveness: z.number().min(1).max(10).optional().describe("How aggressively the AI reacts to others competing for city-state influence (0-10)"),
  Boldness: z.number().min(1).max(10).optional().describe("Military risk-taking, territorial claim, and conquest desire (0-10)"),

  // War & Peace Tendencies
  WarBias: z.number().min(1).max(10).optional().describe("Likelihood to plan for or declare offensive war (0-10)"),
  HostileBias: z.number().min(1).max(10).optional().describe("Tendency toward hostile relationships without direct wars (0-10)"),
  WarmongerHate: z.number().min(1).max(10).optional().describe("How negatively AI reacts to warlike behaviors (0-10)"),
  NeutralBias: z.number().min(1).max(10).optional().describe("Tendency toward neutral relationships (0-10)"),
  FriendlyBias: z.number().min(1).max(10).optional().describe("Tendency toward friendly relationships (0-10)"),
  GuardedBias: z.number().min(1).max(10).optional().describe("Tendency to be guarded or cautiously defensive in diplomacy (0-10)"),
  AfraidBias: z.number().min(1).max(10).optional().describe("Tendency to be afraid of stronger civs (0-10)"),

  // Diplomacy & Cooperation
  DiplomaticBalance: z.number().min(1).max(10).optional().describe("Increases relationship with non-competitive civilizations and peaceful resolution of wars (0-10)"),
  Friendliness: z.number().min(1).max(10).optional().describe("Desire for friendship declarations and increases maximum DoFs (0-10)"),
  WorkWithWillingness: z.number().min(1).max(10).optional().describe("Tendency to support or collaborate with allies. Increase opinions to shared friends (0-10)"),
  WorkAgainstWillingness: z.number().min(1).max(10).optional().describe("Tendency to bond over shared enemies and jointly act against them (0-10)"),
  Loyalty: z.number().min(1).max(10).optional().describe("Loyalty to allies. Lower values allow for backstabbing (0-10)"),

  // Minor Civ Relations
  MinorCivFriendlyBias: z.number().min(1).max(10).optional().describe("Tendency to be friendly with city-states (0-10)"),
  MinorCivNeutralBias: z.number().min(1).max(10).optional().describe("Tendency to be neutral with city-states (0-10)"),
  MinorCivHostileBias: z.number().min(1).max(10).optional().describe("Tendency to be hostile with city-states (0-10)"),
  MinorCivWarBias: z.number().min(1).max(10).optional().describe("Likelihood to attack city-states (0-10)"),

  // Personality Traits
  DenounceWillingness: z.number().min(1).max(10).optional().describe("Readiness to denounce other civs (0-10)"),
  Forgiveness: z.number().min(1).max(10).optional().describe("How quickly to forgive past transgressions (0-10)"),
  Meanness: z.number().min(1).max(10).optional().describe("Aggressiveness in general. Demanding/bullying more while less likely to accept peace (0-10)"),
  Neediness: z.number().min(1).max(10).optional().describe("Desire for support from friends (0-10)"),
  Chattiness: z.number().min(1).max(10).optional().describe("How often they initiate diplomatic contact (0-10)"),
  DeceptiveBias: z.number().min(1).max(10).optional().describe("Tendency to be deceptively friendly (0-10)"),
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
  readonly description = "Set a player's diplomatic personality (1-10). These values control the in-game AI's diplomatic patterns and decision-making.";

  /**
   * Input schema for the set-persona tool
   */
  inputSchema = personaSchema.extend({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1).describe("ID of the player"),
    Rationale: z.string().describe("Briefly explain your rationale for adjusting these persona values")
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
        const message = `Diplomatic persona: ${changeDescriptions.join("; ")}. Rationale: ${Rationale}`;
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