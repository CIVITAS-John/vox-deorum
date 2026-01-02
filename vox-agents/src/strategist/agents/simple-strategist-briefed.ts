/**
 * @module strategist/simple-strategist-briefed
 *
 * Briefed strategist agent implementation.
 * Uses a briefer agent to summarize game state before making strategic decisions,
 * reducing context size and focusing on key strategic insights.
 */

import { ModelMessage } from "ai";
import { SimpleStrategistBase } from "./simple-strategist-base.js";
import { VoxContext } from "../../infra/vox-context.js";
import { getRecentGameState, StrategistParameters } from "../strategy-parameters.js";
import { getModelConfig } from "../../utils/models/models.js";
import { Model } from "../../types/index.js";
import { jsonToMarkdown } from "../../utils/tools/json-to-markdown.js";

/**
 * A briefed strategist agent that first requests a briefing before making strategic decisions.
 * Delegates game state summarization to a briefer agent to focus on high-level strategy.
 *
 * @class
 */
export class SimpleStrategistBriefed extends SimpleStrategistBase {
  /**
   * The name identifier for this agent
   */
  readonly name = "simple-strategist-briefed";

  /**
   * Human-readable description of what this agent does
   */
  readonly description = "Requests a strategic briefing before making decisions, using summarized game state for focused high-level strategy";

  /**
   * Gets the system prompt for the strategist
   */
  public async getSystem(_parameters: StrategistParameters, _context: VoxContext<StrategistParameters>): Promise<string> {
    return `
${SimpleStrategistBase.expertPlayerPrompt}

${SimpleStrategistBase.expectationPrompt}

${SimpleStrategistBase.goalsPrompt}
- You can ask your briefer to prepare a focused report (only for) the next turn by calling the \`instruct-briefer\` tool.
${SimpleStrategistBase.brieferCapabilitiesPrompt}
${SimpleStrategistBase.decisionPrompt}

# Resources
You will receive the following reports:
${SimpleStrategistBase.optionsDescriptionPrompt}
${SimpleStrategistBase.strategiesDescriptionPrompt}
${SimpleStrategistBase.victoryConditionsPrompt}
${SimpleStrategistBase.playersInfoPrompt}
- Briefing: prepared by your briefer, summarizing the current game situation.
 - You will make independent and wise judgment.`.trim()
  }

  /**
   * Gets the initial messages for the conversation
   */
  public async getInitialMessages(parameters: StrategistParameters, input: unknown, context: VoxContext<StrategistParameters>): Promise<ModelMessage[]> {
    var state = getRecentGameState(parameters)!;
    var instruction = parameters.workingMemory["briefer-instruction"];

    // Get the briefing from the simple-briefer agent
    const briefing = await context.callAgent<string>("simple-briefer", instruction ?? "", parameters);
    delete parameters.workingMemory["briefer-instruction"];
    if (!briefing) throw new Error("Failed to generate strategic briefings.");

    // Get the information
    await super.getInitialMessages(parameters, input, context);
    const { YouAre, ...SituationData } = parameters.metadata || {};
    const { Options, ...Strategy } = state.options || {};

    // Return the messages with briefing instead of full state
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
${instruction ? `Produced with your instruction: \n\n${instruction}\n\n` : ""}${briefing}

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