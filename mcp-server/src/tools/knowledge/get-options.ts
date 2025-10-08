/**
 * Tool for retrieving player strategic options from the game
 * Returns available technologies, policies, and strategies for a specific player
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { getPlayerOptions } from "../../knowledge/getters/player-options.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { stripTimedKnowledgeMetadata } from "../../utils/knowledge/strip-metadata.js";
import { PlayerOptions } from "../../knowledge/schema/timed.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { readPlayerKnowledge } from "../../utils/knowledge/cached.js";
import { getPlayerStrategy } from "../../knowledge/getters/player-strategy.js";
import { getPlayerPersona } from "../../knowledge/getters/player-persona.js";
import { enumMappings } from "../../utils/knowledge/enum.js";
import { getTool } from "../index.js";

/**
 * Input schema for the GetOptions tool
 */
const GetOptionsInputSchema = z.object({
  PlayerID: z.number().min(0).max(MaxMajorCivs - 1).describe("Player ID to retrieve strategic options for")
});

/**
 * Output schema for the GetOptions tool
 */
const GetOptionsOutputSchema = z.object({
  // Persona fields
  Persona: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  // Strategy fields (only for active player when requested)
  Strategy: z.object({
    Rationale: z.string().optional(),
    GrandStrategy: z.object({
      Current: z.string().optional(),
      Options: z.any(),
    }),
    EconomicStrategies: z.object({
      Current: z.array(z.string()).optional(),
      Options: z.any(),
    }),
    MilitaryStrategies: z.object({
      Current: z.array(z.string()).optional(),
      Options: z.any(),
    })
  }),
  // Technology and Policies
  Research: z.object({
    Next: z.string(),
    Rationale: z.string().optional(),
    Options: z.any(),
  }),
  Policies: z.object({
    Next: z.string(),
    Rationale: z.string().optional(),
    Options: z.any(),
  })
}).passthrough();

/**
 * Tool for retrieving player strategic options
 */
class GetOptionsTool extends ToolBase {
  /**
   * Unique identifier for the tool
   */
  readonly name = "get-options";

  /**
   * Human-readable description of the tool
   */
  readonly description = "Retrieves available strategic options (technologies, policies, strategies) for a specific player";

  /**
   * Input schema for the tool
   */
  readonly inputSchema = GetOptionsInputSchema;

  /**
   * Output schema for the tool
   */
  readonly outputSchema = GetOptionsOutputSchema;

  /**
   * Optional annotations for the tool
   */
  readonly annotations: ToolAnnotations = {
    autoComplete: ["PlayerID"],
    markdownConfig: [
      { format: "{key}" },
      { format: "{key}" },
      { format: "{key}" }
    ]
  }

  /**
   * Execute the tool to retrieve player options
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    // Get all player options
    const [allOptions, strategies, persona, economicStrategies, militaryStrategies, technologies, policies] = await Promise.all([
      getPlayerOptions(true),
      readPlayerKnowledge(args.PlayerID, "StrategyChanges", getPlayerStrategy),
      readPlayerKnowledge(args.PlayerID, "PersonaChanges", getPlayerPersona),
      getTool("getEconomicStrategy")?.getSummaries(),
      getTool("getMilitaryStrategy")?.getSummaries(),
      getTool("getTechnology")?.getSummaries(),
      getTool("getPolicy")?.getSummaries()
    ]);

    // Find options for the requested player
    const playerOptions = allOptions.find(options => options.PlayerID === args.PlayerID);
    if (!playerOptions)
      throw new Error(`No options found for player ${args.PlayerID}. Player may not be alive or does not exist.`);

    // Read last research/policy changes
    const [research, policy] = await Promise.all([
      readPlayerKnowledge(args.PlayerID, "ResearchChanges", async () => {
        return { Technology: "None", Rationale: undefined }
      }),
      readPlayerKnowledge(args.PlayerID, "PolicyChanges", async () => {
        return { Policy: "None", IsBranch: 0, Rationale: undefined }
      })
    ]);

    // If the research has been done, remove the rationale
    if (research) {
      if (playerOptions.NextResearch === "None" || research.Technology === "None") {
        delete research.Rationale;
        research.Technology = "None";
      }
    }
    if (policy) {
      if ((playerOptions.NextPolicy === "None" && playerOptions.NextBranch === "None") || policy.Policy == "None") {
        delete policy.Rationale;
        policy.Policy = "None";
      }
    }

    // Strip metadata from the options
    const cleanOptions = stripTimedKnowledgeMetadata<PlayerOptions>(playerOptions as any);

    // Chime in more data
    const result = {
      Strategy: {
        Rationale: (strategies as any)?.Rationale,
        GrandStrategy: {
          Current: strategies?.GrandStrategy,
          Options: Object.values(enumMappings["GrandStrategy"])
        },
        EconomicStrategies: {
          Current: strategies?.EconomicStrategies,
          Options: economicStrategies ?
            Object.fromEntries(
              cleanOptions.EconomicStrategies.map(strategyName => {
                const strategy = economicStrategies.find(s => s.Type === strategyName)!;
                return [
                  strategyName,
                  strategy.Description ?? {
                    Production: strategy?.Production,
                    Overall: strategy?.Overall
                  }
                ];
              })
            ) : cleanOptions.EconomicStrategies
        },
        MilitaryStrategies: {
          Current: strategies?.MilitaryStrategies,
          Options: militaryStrategies ?
            Object.fromEntries(
              cleanOptions.MilitaryStrategies.map(strategyName => {
                const strategy = militaryStrategies.find(s => s.Type === strategyName)!;
                return [
                  strategyName,
                  strategy.Description ?? {
                    Production: strategy?.Production,
                    Overall: strategy?.Overall
                  }
                ];
              })
            ) : cleanOptions.MilitaryStrategies
        },
      },
      Persona: persona as Record<string, string | number> | undefined,
      Research: {
        Next: research?.Technology ?? "None",
        Rationale: research?.Rationale,
        Options: technologies && cleanOptions.Technologies.length > 0 ?
          Object.fromEntries(
            cleanOptions.Technologies.map(techName => {
              const tech = technologies.find(s => s.Name === techName)!;
              let help = tech?.Help ?? "";
              if ((tech.TechsUnlocked?.length ?? 0) > 0)
                help += `\nLeading to: ${tech.TechsUnlocked?.join(", ")}`;
              return [
                techName,
                help.trim()
              ];
            })
          ) : cleanOptions.Technologies
      },
      Policies: {
        Next: policy?.Policy ? `${policy.Policy} (${policy.IsBranch ? "New Branch" : "Policy"})` : "None",
        Rationale: policy?.Rationale,
        Options: policies && cleanOptions.Policies.length > 0 ?
          Object.fromEntries(
            cleanOptions.Policies.map(policyName => {
              const current = policies.find(s => s.Name === policyName)!;
              var Help = current?.Help ?? "";
              if (policy?.Policy !== undefined && policy?.Policy !== "None") 
                Help = Help.substring(0, Help.indexOf("\n")).trim();
              return [
                policyName + ` (Policy in ${current?.Branch})`,
                Help
              ];
            }).concat(cleanOptions.PolicyBranches.map(policyName => {
              const current = policies.find(s => s.Name === policyName)!;
              var Help = current?.Help ?? "";
              if (policy?.Policy !== undefined && policy?.Policy !== "None") 
                Help = Help.substring(0, Help.indexOf("\n")).trim();
              return [
                policyName + " (New Branch)",
                Help
              ];
            }))
          ) : cleanOptions.Policies
      }
    };
    return result;
  };
}

/**
 * Creates a new instance of the get options tool
 */
export default function createGetOptionsTool() {
  return new GetOptionsTool();
}