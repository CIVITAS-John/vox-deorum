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
import { getPlayerFlavors } from "../../knowledge/getters/player-flavors.js";
import { enumMappings } from "../../utils/knowledge/enum.js";
import { getTool } from "../index.js";
import { formatPolicyHelp } from "../../utils/database/format.js";
import { loadGrandStrategyDescriptions, loadFlavorDescriptions } from "../../utils/strategies/loader.js";

/**
 * Input schema for the GetOptions tool
 */
const GetOptionsInputSchema = z.object({
  PlayerID: z.number().min(0).max(MaxMajorCivs - 1).describe("Player ID to retrieve strategic options for"),
  Mode: z.enum(["Flavor", "Strategy"]).optional().default("Strategy").describe("Mode for retrieving options - 'Flavor' for tactical AI preferences, 'Strategy' for high-level strategies")
});

/**
 * Output schema for the GetOptions tool
 */
const GetOptionsOutputSchema = z.object({
  // Options - available choices
  Options: z.object({
    GrandStrategies: z.any(),
    MilitaryStrategies: z.any().optional(),
    EconomicStrategies: z.any().optional(),
    Flavors: z.any().optional(),
    Research: z.any(),
    Policies: z.any()
  }),
  // Persona fields
  Persona: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  // Strategy - current selections and rationale
  Strategy: z.object({
    Rationale: z.string().optional(),
    GrandStrategy: z.string().optional(),
    // Strategies - only in Strategy mode
    EconomicStrategies: z.array(z.string()).optional(),
    MilitaryStrategies: z.array(z.string()).optional(),
    // Flavors - current custom flavor values (only in Flavor mode)
    Flavors: z.record(z.string(), z.number()).optional(),
  }),
  // Research - current selection
  Research: z.object({
    Next: z.string(),
    Rationale: z.string().optional()
  }),
  // Policies - current selection
  Policies: z.object({
    Next: z.string(),
    Rationale: z.string().optional()
  })
}).passthrough();

/**
 * Type for the tool's output.
 */
export type OptionsReport = z.infer<typeof GetOptionsOutputSchema>;

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
    readOnlyHint: true
  }

  /**
   * Optional metadata for the tool
   */
  readonly metadata = {
    autoComplete: ["PlayerID", "Mode"],
    markdownConfig: ["{key}", "{key}", "{key}"]
  }

  /**
   * Execute the tool to retrieve player options
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const isFlavorMode = args.Mode === "Flavor";

    const [
      allOptions,
      persona,
      technologies,
      policies,
      grandStrategyDescriptions,
      research,
      policy,
      strategies,
      economicStrategies,
      militaryStrategies,
      flavors,
      flavorDescriptions
    ] = await Promise.all([
      getPlayerOptions(true),
      readPlayerKnowledge(args.PlayerID, "PersonaChanges", getPlayerPersona),
      getTool("getTechnology")?.getSummaries(),
      getTool("getPolicy")?.getSummaries(),
      loadGrandStrategyDescriptions(),
      readPlayerKnowledge(args.PlayerID, "ResearchChanges", async () => {
        return { Technology: "None", Rationale: undefined }
      }),
      readPlayerKnowledge(args.PlayerID, "PolicyChanges", async () => {
        return { Policy: "None", IsBranch: 0, Rationale: undefined }
      }),
      isFlavorMode ? null : readPlayerKnowledge(args.PlayerID, "StrategyChanges", getPlayerStrategy),
      isFlavorMode ? null : getTool("getEconomicStrategy")?.getSummaries(),
      isFlavorMode ? null : getTool("getMilitaryStrategy")?.getSummaries(),
      !isFlavorMode ? null : readPlayerKnowledge(args.PlayerID, "FlavorChanges", getPlayerFlavors),
      !isFlavorMode ? null : loadFlavorDescriptions()
    ]);

    // Find options for the requested player
    if (!Array.isArray(allOptions)) {
      throw new Error(`Failed to fetch player options.`);
    }
    const playerOptions = allOptions.find((options) => options.PlayerID === args.PlayerID);
    if (!playerOptions)
      throw new Error(`No options found for player ${args.PlayerID}. Player may not be alive or does not exist.`);

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
    const cleanOptions = stripTimedKnowledgeMetadata<PlayerOptions>(playerOptions);

    // Build Options object based on mode
    const optionsObject: any = {
      GrandStrategies: Object.fromEntries(
        Object.values(enumMappings["GrandStrategy"])
          .filter(s => s !== "None")
          .map(strategyName => [
            strategyName,
            grandStrategyDescriptions?.[strategyName] ?? strategyName
          ])
      ),
      Research: technologies && Array.isArray(technologies) && cleanOptions.Technologies.length > 0 ?
        Object.fromEntries(
          cleanOptions.Technologies.map(techName => {
            const tech = technologies.find((s) => s.Name === techName);
            let help = tech?.Help ?? "";
            if ((tech?.TechsUnlocked?.length ?? 0) > 0)
              help += `\nCompleting it would unlock: ${tech?.TechsUnlocked?.join(", ")}`;
            return [
              techName,
              help.trim()
            ];
          })
        ) : cleanOptions.Technologies,
      Policies: policies && Array.isArray(policies) ?
        Object.fromEntries(
          cleanOptions.Policies.map(policyName => {
            const current = policies.find((s) => s.Name === policyName);
            var Help = formatPolicyHelp(current?.Help ?? "", policyName);
            // Add tenet level information for ideology policies
            let displayName = policyName;
            if (current?.Level) {
              displayName += ` (Level ${current.Level} Tenet of Ideology ${current?.Branch})`;
            } else {
              displayName += ` (Continuing ${current?.Branch} Branch)`;
            }
            return [
              displayName,
              Help.length > 1 ? Help : Help[0]
            ];
          }).concat(cleanOptions.PolicyBranches.map(policyName => {
            const current = policies.find((s) => s.Name === policyName);
            var Help = formatPolicyHelp(current?.Help ?? "", policyName);
            return [
              policyName + " (New Branch)",
              Help.length > 1 ? Help : Help[0]
            ];
          }))
        ) : cleanOptions.Policies.concat(cleanOptions.PolicyBranches)
    };

    if (isFlavorMode) {
      // In Flavor mode: Add flavors, hide economic/military strategies
      optionsObject.Flavors = flavorDescriptions;
    } else {
      // In Strategy mode: Add economic and military strategies
      if (economicStrategies && Array.isArray(economicStrategies)) {
        optionsObject.EconomicStrategies = Object.fromEntries(
          cleanOptions.EconomicStrategies.map(strategyName => {
            const strategy = economicStrategies.find((s: any) => s.Type === strategyName);
            return [
              strategyName,
              strategy?.Description ?? {
                Production: strategy?.Production,
                Overall: strategy?.Overall
              }
            ];
          })
        );
      }
      if (militaryStrategies && Array.isArray(militaryStrategies)) {
        optionsObject.MilitaryStrategies = Object.fromEntries(
          cleanOptions.MilitaryStrategies.map(strategyName => {
            const strategy = militaryStrategies.find((s: any) => s.Type === strategyName);
            return [
              strategyName,
              strategy?.Description ?? {
                Production: strategy?.Production,
                Overall: strategy?.Overall
              }
            ];
          })
        );
      }
    }

    // Build result object
    const result: any = {
      Persona: persona as Record<string, string | number> | undefined,
      Options: optionsObject,
      Research: {
        Next: research?.Technology ?? "None",
        Rationale: research?.Rationale
      },
      Policies: {
        Next: policy?.Policy ? `${policy.Policy} (${policy.IsBranch ? "New Branch" : "Policy"})` : "None",
        Rationale: policy?.Rationale
      }
    };

    // Add mode-specific result fields
    if (isFlavorMode) {
      // In Flavor mode: Add current flavors
      const { Key, Rationale, ...flavorValues } = flavors!;
      result.Strategy = {
        Rationale: Rationale,
        GrandStrategy: strategies?.GrandStrategy,
        Flavors: flavorValues
      };
    } else {
      // In Strategy mode: Add strategy information
      result.Strategy = {
        Rationale: (strategies as any)?.Rationale,
        GrandStrategy: strategies?.GrandStrategy,
        EconomicStrategies: strategies?.EconomicStrategies,
        MilitaryStrategies: strategies?.MilitaryStrategies
      };
    }

    return result;
  };
}

/**
 * Creates a new instance of the get options tool
 */
export default function createGetOptionsTool() {
  return new GetOptionsTool();
}