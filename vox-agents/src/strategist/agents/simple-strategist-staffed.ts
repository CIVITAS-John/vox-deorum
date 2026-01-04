/**
 * @module strategist/simple-strategist-staffed
 *
 * Staffed strategist agent implementation.
 * Uses multiple specialized briefer agents running in parallel to provide
 * comprehensive Military, Economy, and Diplomacy briefings before making strategic decisions.
 */

import { ModelMessage } from "ai";
import { SimpleStrategistBase } from "./simple-strategist-base.js";
import { VoxContext } from "../../infra/vox-context.js";
import { getRecentGameState, StrategistParameters } from "../strategy-parameters.js";
import { getModelConfig } from "../../utils/models/models.js";
import { Model } from "../../types/index.js";
import { jsonToMarkdown } from "../../utils/tools/json-to-markdown.js";
import { SpecializedBrieferInput } from "../../briefer/specialized-briefer.js";
import { getStrategicPlayersReport } from "../../utils/report-filters.js";

/**
 * Assembles briefing content with optional instructions.
 * Can handle both single briefings and multiple briefing sections.
 *
 * @param briefings - Either a single briefing content string, or an array of briefing sections with titles
 * @param instruction - Optional instruction for single briefing mode
 * @returns Formatted briefing markdown
 */
export function assembleBriefings(
  briefings: string | Array<{ title: string; content: string; instruction?: string }>,
  instruction?: string
): string {
  // Single briefing mode (simple-strategist-briefed)
  if (typeof briefings === "string") {
    if (instruction) {
      return `Produced with your instruction: \n\n${instruction}\n\n${briefings}`;
    }
    return briefings;
  }

  // Multiple briefing sections mode (staffed strategist)
  return briefings
    .map((b) => {
      if (b.instruction) {
        return `## ${b.title}\n(Produced with your instruction: ${b.instruction})\n\n${b.content}`;
      }
      return `## ${b.title}\n${b.content}`;
    })
    .join("\n\n");
}

/**
 * A staffed strategist agent that uses specialized briefers for comprehensive analysis.
 * Delegates game state analysis to three specialized briefers (Military, Economy, Diplomacy)
 * running in parallel to provide focused, multi-dimensional strategic insight.
 *
 * @class
 */
export class SimpleStrategistStaffed extends SimpleStrategistBase {
  /**
   * The name identifier for this agent
   */
  readonly name = "simple-strategist-staffed";

  /**
   * Human-readable description of what this agent does
   */
  readonly description = "Uses specialized briefers (Military, Economy, Diplomacy) running in parallel to provide comprehensive multi-dimensional strategic analysis";

  /**
   * Gets the system prompt for the strategist
   */
  public async getSystem(_parameters: StrategistParameters, _context: VoxContext<StrategistParameters>): Promise<string> {
    return `
${SimpleStrategistBase.expertPlayerPrompt}

${SimpleStrategistBase.expectationPrompt}

${SimpleStrategistBase.goalsPrompt}
- You can ask your specialized briefers to prepare focused reports (only for) the next turn by calling the \`focus-briefer\` tool.
  - You have three specialized briefers: Military, Economy, and Diplomacy analysts.
  - Only ask for information relevant to the macro-level decisions in your control. 
${SimpleStrategistBase.brieferCapabilitiesPrompt}
${SimpleStrategistBase.decisionPrompt}

# Resources
You will receive the following reports:
${SimpleStrategistBase.optionsDescriptionPrompt}
${SimpleStrategistBase.strategiesDescriptionPrompt}
${SimpleStrategistBase.victoryConditionsPrompt}
${SimpleStrategistBase.playersInfoPrompt}
- Briefings: prepared by your specialized briefers, covering Military, Economy, and Diplomacy aspects.
  - You will make independent and wise judgment based on all briefings.`.trim()
  }

  /**
   * Gets the initial messages for the conversation
   */
  public async getInitialMessages(parameters: StrategistParameters, input: unknown, context: VoxContext<StrategistParameters>): Promise<ModelMessage[]> {
    var state = getRecentGameState(parameters)!;
    let briefingsContent: string;
    const militaryInstruction = parameters.workingMemory["briefer-instruction-military"];
    const economyInstruction = parameters.workingMemory["briefer-instruction-economy"];
    const diplomacyInstruction = parameters.workingMemory["briefer-instruction-diplomacy"];

    // Check the event length to decide between simple/specialized briefer
    if (JSON.stringify(state.events!).length <= 5000 || state.turn <= 1) {
      // Assemble combined instruction from specialized instructions
      const combinedInstruction = [
        `- Military: ${militaryInstruction ?? "a general report."}`,
        `- Economy: ${economyInstruction ?? "a general report."}`,
        `- Diplomacy: ${diplomacyInstruction ?? "a general report."}`
      ].join("\n\n");

      // Use simple-briefer for fewer events
      const briefing = await context.callAgent<string>("simple-briefer", combinedInstruction || "", parameters);

      if (!briefing) {
        throw new Error("Failed to generate strategic briefing.");
      }

      briefingsContent = assembleBriefings(briefing, combinedInstruction || undefined);
    } else {
      // Use specialized briefers for more complex situations
      // Call all three specialized briefers in parallel
      const [militaryBriefing, economyBriefing, diplomacyBriefing] = await Promise.all([
        context.callAgent<string>("specialized-briefer", {
          mode: "Military",
          instruction: militaryInstruction ?? ""
        } as SpecializedBrieferInput, parameters),
        context.callAgent<string>("specialized-briefer", {
          mode: "Economy",
          instruction: economyInstruction ?? ""
        } as SpecializedBrieferInput, parameters),
        context.callAgent<string>("specialized-briefer", {
          mode: "Diplomacy",
          instruction: diplomacyInstruction ?? ""
        } as SpecializedBrieferInput, parameters)
      ]);

      if (!militaryBriefing || !economyBriefing || !diplomacyBriefing) {
        throw new Error("Failed to generate strategic briefings.");
      }

      // Compile briefings with any instructions provided
      briefingsContent = assembleBriefings([
        { title: "Military Briefing", content: militaryBriefing, instruction: militaryInstruction },
        { title: "Economy Briefing", content: economyBriefing, instruction: economyInstruction },
        { title: "Diplomacy Briefing", content: diplomacyBriefing, instruction: diplomacyInstruction }
      ]);
    }

    // Clear the instructions from working memory
    delete parameters.workingMemory["briefer-instruction-military"];
    delete parameters.workingMemory["briefer-instruction-economy"];
    delete parameters.workingMemory["briefer-instruction-diplomacy"];

    // Get the information
    await super.getInitialMessages(parameters, input, context);
    const { YouAre, ...SituationData } = parameters.metadata || {};
    const { Options, ...Strategy } = state.options || {};

    // Save the assembled briefings for spokesperson use
    state.reports["briefing"] = briefingsContent;

    // Return the messages with all briefings
    return [{
      role: "system",
      content: `
You are ${parameters.metadata?.YouAre!.Leader}, leader of ${parameters.metadata?.YouAre!.Name} (Player ${parameters.playerID ?? 0}).

# Situation
${jsonToMarkdown(SituationData)}

# Your Civilization
${jsonToMarkdown(YouAre)}

# Options
Options: available strategic options for you.

${jsonToMarkdown(Options, {
  configs: [{}]
})}`.trim(),
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' } }
      }
    }, {
      role: "user",
      content: `
# Strategies
Strategies: existing strategic decisions from you.

${jsonToMarkdown(Strategy)}

# Players
Players: summary reports about visible players in the world.

${jsonToMarkdown(getStrategicPlayersReport(state.players!))}

# Victory Progress
Victory Progress: current progress towards each type of victory.

${jsonToMarkdown(state.victory)}

# Briefings
${briefingsContent}

You, ${parameters.metadata?.YouAre!.Leader} (leader of ${parameters.metadata?.YouAre!.Name}, Player ${parameters.playerID ?? 0}), are making strategic decisions after turn ${parameters.turn}.
`.trim()
    }];
  }

  /**
   * Gets the list of active tools for this agent
   */
  public getActiveTools(parameters: StrategistParameters): string[] | undefined {
    // Return specific tools the strategist needs
    return ["focus-briefer", ...(super.getActiveTools(parameters) ?? [])]
  }

  /**
   * Gets the language model to use for this agent execution.
   * Can return undefined to use the default model from VoxContext.
   *
   * @param parameters - The execution parameters
   * @returns The language model to use, or undefined for default
   */
  public getModel(_parameters: StrategistParameters, _input: unknown, overrides: Record<string, Model | string>): Model {
    return getModelConfig(this.name, "medium", overrides);
  }
}
