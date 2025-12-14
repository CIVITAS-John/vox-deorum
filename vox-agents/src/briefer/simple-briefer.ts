/**
 * @module briefer/simple-briefer
 *
 * Simple briefer agent that summarizes game state into a concise strategic briefing.
 * Condenses full game reports into key insights for strategic decision-making.
 */

import { ModelMessage } from "ai";
import { Briefer } from "./briefer.js";
import { VoxContext } from "../infra/vox-context.js";
import { getRecentGameState, StrategistParameters } from "../strategist/strategy-parameters.js";
import { getModelConfig } from "../utils/models/models.js";
import { Model } from "../types/index.js";

/**
 * A simple briefer agent that analyzes the game state and produces a concise briefing.
 * Summarizes key strategic information from detailed game reports.
 *
 * @class
 */
export class SimpleBriefer extends Briefer {
  /**
   * The name identifier for this agent
   */
  readonly name = "simple-briefer";

  /**
   * Human-readable description of what this agent does
   */
  readonly description = "Summarizes detailed game reports into concise strategic briefings highlighting threats, opportunities, and key insights";

  /**
   * Gets the system prompt for the briefer
   */
  public async getSystem(_parameters: StrategistParameters, _input: string, _context: VoxContext<StrategistParameters>): Promise<string> {
    return `
You are an export briefing writer for Civilization V with the latest Vox Populi mod.
Your role is to produce a concise briefing based on the current game state.

# Objective
Summarize the full game state into a strategic briefing that highlights:
- Critical threats and opportunities
- Key diplomatic relationships and tensions
- Economic and military position relative to opponents
- Important events since the last decision

# Guidelines
- Highlight important strategic changes and intelligence
- The briefing should be objective and analytical, do not bias towards existing strategy
- Never provide raw, excessive, or tactical information (e.g. coordinates, IDs)
- Never give suggestions or considerations, not your responsibilities
- Never send out verbatim from Strategies

# Resources
You will receive the following reports:
- Strategies: existing strategic decisions and available options for the player.
 - Strategies, persona, technology, and policy of the player, as well as the current rationale.
- Victory Progress: current progress towards each type of victory.
 - Domination Victory: Control or vassalize all original capitals.
 - Science Victory: Be the first to finish all spaceship parts and launch the spaceship.
 - Cultural Victory: Accumulate tourism (that outpaces other civilizations' culture) to influence all others.
 - Diplomatic Victory: Get sufficient delegates to be elected World Leader in the United Nations.
 - Time Victory: If no one achieves any other victory by the end of the game, the civilization with the highest score wins.
- Players: summary reports about visible players in the world. Also:
 - You will receive in-game AI's diplomatic evaluations.
 - You will receive each player's publicly available relationships.
 - Pay attention to master/vassal relationships. Vassals cannot achieve a conquest victory before independence.
- Cities: summary reports about discovered cities in the world.
- Military: summary reports about tactical zones and visible units.
 - Tactical zones are analyzed by in-game AI to determine the value, relative strength, and tactical posture.
 - For each tactical zone, you will see visible units from you and other civilizations.
- Events: events since the last decision-making.

# Instruction
Reason briefly. Write your briefing as a text document in a clear, direct, concise language.`.trim()
  }

  /**
   * Gets the initial messages for the conversation
   */
  public async getInitialMessages(parameters: StrategistParameters, context: VoxContext<StrategistParameters>): Promise<ModelMessage[]> {
    var state = getRecentGameState(parameters)!;
    // Get the information
    await super.getInitialMessages(parameters, context);
    // Return the messages
    return [{
      role: "system",
      content: `
# Situation
You are writing a strategic briefing for Player ${parameters.playerID ?? 0}.
${parameters.metadata}`.trim()
    }, {
      role: "user",
      content: `
# Victory Progress
Victory Progress: current progress towards each type of victory.
${state.victory}

# Strategies
Strategies: existing strategic decisions and available options for the player.
${state.options}

# Players
Players: summary reports about visible players in the world.
${state.players}

# Cities
Cities: summary reports about discovered cities in the world.
${state.cities}

# Military
Military: summary reports about tactical zones and visible units.
${state.military}

# Events
Events: events since the last decision-making.
${state.events}

You are writing the briefing for Player ${parameters.playerID ?? 0} after turn ${parameters.turn}.`.trim()
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
    return getModelConfig(this.name, "low", overrides);
  }
}