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
- You can ask your specialized briefers to prepare focused reports (only for) the next turn by calling the \`instruct-briefer\` tool.
 - You have three specialized briefers: Military, Economy, and Diplomacy analysts.
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

    // Get instructions for each specialized briefer from working memory
    const militaryInstruction = parameters.workingMemory["briefer-instruction-military"];
    const economyInstruction = parameters.workingMemory["briefer-instruction-economy"];
    const diplomacyInstruction = parameters.workingMemory["briefer-instruction-diplomacy"];

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

    // Clear the instructions from working memory
    delete parameters.workingMemory["briefer-instruction-military"];
    delete parameters.workingMemory["briefer-instruction-economy"];
    delete parameters.workingMemory["briefer-instruction-diplomacy"];

    if (!militaryBriefing || !economyBriefing || !diplomacyBriefing) {
      throw new Error("Failed to generate strategic briefings.");
    }

    // Get the information
    await super.getInitialMessages(parameters, input, context);
    const { YouAre, ...SituationData } = parameters.metadata || {};
    const { Options, ...Strategy } = state.options || {};

    // Compile briefings with any instructions provided
    const briefingsContent = [
      militaryInstruction ? `## Military Briefing\n(Produced with your instruction: ${militaryInstruction})\n\n${militaryBriefing}` : `## Military Briefing\n${militaryBriefing}`,
      economyInstruction ? `## Economy Briefing\n(Produced with your instruction: ${economyInstruction})\n\n${economyBriefing}` : `## Economy Briefing\n${economyBriefing}`,
      diplomacyInstruction ? `## Diplomacy Briefing\n(Produced with your instruction: ${diplomacyInstruction})\n\n${diplomacyBriefing}` : `## Diplomacy Briefing\n${diplomacyBriefing}`
    ].join("\n\n");

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

${jsonToMarkdown(state.players)}

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
    return ["instruct-briefer", ...(super.getActiveTools(parameters) ?? [])]
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
