/**
 * @module envoy/spokesperson
 *
 * Spokesperson envoy agent that represents the current civilization and answers questions diplomatically.
 * Provides diplomatic responses based on the civilization's current state and relationships.
 */

import { ModelMessage, Tool } from "ai";
import { Envoy } from "./envoy.js";
import { VoxContext } from "../infra/vox-context.js";
import { StrategistParameters } from "../strategist/strategy-parameters.js";
import { EnvoyThread } from "../types/index.js";
import { jsonToMarkdown } from "../utils/tools/json-to-markdown.js";

/**
 * Spokesperson agent that represents the civilization diplomatically.
 * Responds to questions about the civilization's status, relationships, and intentions
 * with appropriate diplomatic framing based on the current game state.
 *
 * @class
 */
export class Spokesperson extends Envoy {
  /**
   * The name identifier for this agent
   */
  readonly name = "spokesperson";

  /**
   * Human-readable description of what this agent does
   */
  readonly description = "A spokesperson who answers questions about the civilization's status, relationships, and intentions with appropriate diplomatic tact";

  /**
   * Tags for categorizing this agent
   */
  public tags = ["active-game", "diplomatic"];

  /**
   * Gets the system prompt for the spokesperson
   */
  public async getSystem(
    parameters: StrategistParameters,
    input: EnvoyThread,
    context: VoxContext<StrategistParameters>
  ): Promise<string> {
    return `
You are the official spokesperson for a civilization.
You are inside a generated world (Civilization V game with Vox Populi mod), and the geography has nothing to do with the real Earth.
You represent your government's interests with diplomatic tact and strategic ambiguity when necessary.

# Your Role
- You answer questions about your civilization's status, relationships, and general intentions
- You maintain diplomatic decorum while protecting sensitive information
- You (briefly) reason about the question's intention and answer purposefully

# Communication Style
- Be professional, measured, and diplomatic in tone, always maintain your civilization's dignity and reputation
- You are providing oral answers: short, conversational, clever, as you are in a real-time conversation
- When discussing sensitive matters, be strategically vague, never reveal specific military plans or exact numbers
- Frame your civilization's actions and stances positively, challenges as opportunities for growth`.trim();
  }

  /**
   * Gets the initial messages for the conversation, incorporating thread history
   */
  public async getInitialMessages(
    parameters: StrategistParameters,
    input: EnvoyThread,
    _context: VoxContext<StrategistParameters>
  ): Promise<ModelMessage[]> {
    const leader = parameters.metadata!.YouAre!.Leader;
    const civName = parameters.metadata!.YouAre!.Name;
    const state = parameters.gameStates[parameters.turn];
    const hint = `Remember: You represent ${civName} on the world stage. Every response reflects on ${leader}'s leadership and your civilization's standing. The time is at turn ${parameters.turn}.`;

    const messages: ModelMessage[] = [{
      role: "system",
      content: `
You are the official spokesperson for ${leader} of ${civName} in Civilization V with the Vox Populi mod, answering oral questions from an audience.

# Situation
${jsonToMarkdown(parameters.metadata)}`.trim()
    }];

    // If there is a briefing, use it
    if (state.reports["briefing"]) {
      messages.push({
        role: "user",
        content: `
# Strategies and Options
${jsonToMarkdown(state.options)}

# Briefings
${state.reports["briefing"]}

${hint}`.trim()
      });
    } else {
      messages.push({
        role: "user",
        content: `
# Victory Progress
Victory Progress: current progress towards each type of victory.
${jsonToMarkdown(state.victory)}

# Strategies
Strategies: existing strategic decisions and available options for the player.
${jsonToMarkdown(state.options)}

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
Events: events since the last decision-making.
${jsonToMarkdown(state.events)}

${hint}`.trim()});
    }

    // Add the conversation history from the thread
    if (input.messages && input.messages.length > 0) {
      messages.push(...input.messages);
    }

    return messages;
  }
}