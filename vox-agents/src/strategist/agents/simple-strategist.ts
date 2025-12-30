/**
 * @module strategist/simple-strategist
 *
 * Simple strategist agent implementation.
 * Provides high-level strategic decision-making for Civilization V gameplay,
 * including diplomatic persona, technology research, policy adoption, and grand strategy selection.
 */

import { ModelMessage } from "ai";
import { SimpleStrategistBase } from "./simple-strategist-base.js";
import { VoxContext } from "../../infra/vox-context.js";
import { getRecentGameState, StrategistParameters } from "../strategy-parameters.js";
import { jsonToMarkdown } from "../../utils/tools/json-to-markdown.js";
import { getModelConfig } from "../../utils/models/models.js";
import { Model } from "../../types/index.js";

/**
 * A simple strategist agent that analyzes the game state and sets an appropriate strategy.
 * Makes high-level decisions and delegates tactical execution to the in-game AI.
 *
 * @class
 */
export class SimpleStrategist extends SimpleStrategistBase {
  /**
   * The name identifier for this agent
   */
  readonly name = "simple-strategist";

  /**
   * Human-readable description of what this agent does
   */
  readonly description = "Analyzes game state and makes strategic decisions for Civ V gameplay including diplomacy, technology, policy, and grand strategy";
  
  /**
   * Gets the system prompt for the strategist
   */
  public async getSystem(_parameters: StrategistParameters, _context: VoxContext<StrategistParameters>): Promise<string> {
    return `
${SimpleStrategistBase.expertPlayerPrompt}

${SimpleStrategistBase.expectationPrompt}
When reasoning, focus on the macro-level gameplay strategy, as you DON'T have direct control over tactical decisions.

${SimpleStrategistBase.goalsPrompt}
- Each turn, you must call either \`set-strategy\` or \`keep-status-quo\` tool.
 - Set an appropriate grand strategy and supporting economic/military strategies by calling the \`set-strategy\` tool.
 - Alternatively, use the tool \`keep-status-quo\` to keep strategies the same.
 - Strategies change the weight of the in-game AI's NEXT decision. It won't directly change the production item, etc.
- Always provide a paragraph of rationale for each tool. You will be able to read the rationale next turn.

# Resources
You will receive the following reports:
${SimpleStrategistBase.optionsDescriptionPrompt}
- Strategies: existing strategic decisions and rationale from you.
 - You will receive strategies, persona, technology, and policy you set last time.
${SimpleStrategistBase.victoryConditionsPrompt}
${SimpleStrategistBase.playersInfoPrompt}
- Cities: summary reports about discovered cities in the world.
- Military: summary reports about tactical zones and visible units.
 - Tactical zones are analyzed by in-game AI to determine the value, relative strength, and tactical posture.
 - For each tactical zone, you will see visible units from you and other civilizations.
- Events: events since you last made a decision.
`.trim()
  }
  
  /**
   * Gets the initial messages for the conversation
   */
  public async getInitialMessages(parameters: StrategistParameters, input: unknown, context: VoxContext<StrategistParameters>): Promise<ModelMessage[]> {
    var state = getRecentGameState(parameters)!;
    // Get the information
    await super.getInitialMessages(parameters, input, context);
    const { YouAre, ...SituationData } = parameters.metadata || {};
    const { Options, ...Strategy } = state.options || {};
    // Return the messages
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
})}
`.trim(),
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' } }
      }
    }, {
      role: "user",
      content: `
# Strategies
Strategies: existing strategic decisions from you.

${jsonToMarkdown(Strategy)}

# Victory Progress
Victory Progress: current progress towards each type of victory.

${jsonToMarkdown(state.victory)}

# Players
Players: summary reports about visible players in the world.

${jsonToMarkdown(state.players)}

# Cities
Cities: summary reports about discovered cities in the world.

${jsonToMarkdown(state.cities)}

# Military
Military: summary reports about tactical zones and visible units.

${jsonToMarkdown(state.military)}

# Events
Events: events since you last made a decision.

${jsonToMarkdown(state.events)}

You, ${parameters.metadata?.YouAre!.Leader} (leader of ${parameters.metadata?.YouAre!.Name}, Player ${parameters.playerID ?? 0}), are making strategic decisions after turn ${parameters.turn}.
`.trim()
    }];
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