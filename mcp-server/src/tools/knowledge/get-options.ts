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
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Load grand strategy descriptions from JSON file
 */
async function loadGrandStrategyDescriptions(): Promise<Record<string, string>> {
  try {
    const jsonPath = path.join(process.cwd(), 'docs', 'strategies', 'grand-strategy.json');
    const content = await fs.readFile(jsonPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // Return empty object if file doesn't exist or can't be read
    return {};
  }
}

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
  // Options - available choices
  Options: z.object({
    GrandStrategies: z.any(),
    MilitaryStrategies: z.any(),
    EconomicStrategies: z.any(),
    Research: z.any(),
    Policies: z.any()
  }),
  // Persona fields
  Persona: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  // Strategy - current selections and rationale
  Strategy: z.object({
    Rationale: z.string().optional(),
    GrandStrategy: z.string().optional(),
    EconomicStrategies: z.array(z.string()).optional(),
    MilitaryStrategies: z.array(z.string()).optional()
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
    autoComplete: ["PlayerID"],
    markdownConfig: ["{key}", "{key}", "{key}"]
  }

  /**
   * Execute the tool to retrieve player options
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    // Get all player options
    const [allOptions, strategies, persona, economicStrategies, militaryStrategies, technologies, policies, grandStrategyDescriptions] = await Promise.all([
      getPlayerOptions(true),
      readPlayerKnowledge(args.PlayerID, "StrategyChanges", getPlayerStrategy),
      readPlayerKnowledge(args.PlayerID, "PersonaChanges", getPlayerPersona),
      getTool("getEconomicStrategy")?.getSummaries(),
      getTool("getMilitaryStrategy")?.getSummaries(),
      getTool("getTechnology")?.getSummaries(),
      getTool("getPolicy")?.getSummaries(),
      loadGrandStrategyDescriptions()
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
    // Format policy help info.
    const formatPolicyHelp = (help: string, name: string) => {
      const lines = help.split(/\n+/g).map(line => line.trim()).filter(line => line !== "" && line !== name);
      if (lines.length === 0) return "";
      return lines.length > 1 ? lines : lines[0];
    }

    // Chime in more data
    const result = {
      Persona: persona as Record<string, string | number> | undefined,
      Options: {
        GrandStrategies: Object.fromEntries(
          Object.values(enumMappings["GrandStrategy"])
            .filter(s => s !== "None")
            .map(strategyName => [
              strategyName,
              grandStrategyDescriptions[strategyName] ?? strategyName
            ])
        ),
        EconomicStrategies: Object.fromEntries(
          cleanOptions.EconomicStrategies.map(strategyName => {
            const strategy = economicStrategies!.find(s => s.Type === strategyName)!;
            return [
              strategyName,
              strategy.Description ?? {
                Production: strategy?.Production,
                Overall: strategy?.Overall
              }
            ];
          })
        ),
        MilitaryStrategies: Object.fromEntries(
          cleanOptions.MilitaryStrategies.map(strategyName => {
            const strategy = militaryStrategies!.find(s => s.Type === strategyName)!;
            return [
              strategyName,
              strategy.Description ?? {
                Production: strategy?.Production,
                Overall: strategy?.Overall
              }
            ];
          })
        ),
        Research: technologies && cleanOptions.Technologies.length > 0 ?
          Object.fromEntries(
            cleanOptions.Technologies.map(techName => {
              const tech = technologies.find(s => s.Name === techName)!;
              let help = tech?.Help ?? "";
              if ((tech?.TechsUnlocked?.length ?? 0) > 0)
                help += `\nCompleting it would unlock: ${tech?.TechsUnlocked?.join(", ")}`;
              return [
                techName,
                help.trim()
              ];
            })
          ) : cleanOptions.Technologies,
        Policies: policies ?
          Object.fromEntries(
            cleanOptions.Policies.map(policyName => {
              const current = policies.find(s => s.Name === policyName)!;
              var Help = current?.Help ?? "";
              // Add tenet level information for ideology policies
              let displayName = policyName;
              if (current?.Level) {
                displayName += ` (Level ${current.Level} Tenet of Ideology ${current?.Branch})`;
              } else {
                displayName += ` (Continuing ${current?.Branch} Branch)`;
              }
              return [
                displayName,
                formatPolicyHelp(Help, policyName)
              ];
            }).concat(cleanOptions.PolicyBranches.map(policyName => {
              const current = policies.find(s => s.Name === policyName)!;
              var Help = current?.Help ?? "";
              if (policy?.Policy !== undefined && policy?.Policy !== "None")
                Help = Help.replaceAll(/\n+/g, " ");
              return [
                policyName + " (New Branch)",
                formatPolicyHelp(Help, policyName)
              ];
            }))
          ) : cleanOptions.Policies.concat(cleanOptions.PolicyBranches)
      },
      Strategy: {
        Rationale: (strategies as any)?.Rationale,
        GrandStrategy: strategies?.GrandStrategy,
        EconomicStrategies: strategies?.EconomicStrategies,
        MilitaryStrategies: strategies?.MilitaryStrategies
      },
      Research: {
        Next: research?.Technology ?? "None",
        Rationale: research?.Rationale
      },
      Policies: {
        Next: policy?.Policy ? `${policy.Policy} (${policy.IsBranch ? "New Branch" : "Policy"})` : "None",
        Rationale: policy?.Rationale
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