/**
 * @module envoy/spokesperson
 *
 * Spokesperson envoy agent that represents the current civilization and answers questions diplomatically.
 * Provides diplomatic responses based on the civilization's current state and relationships.
 */

import { SimpleEnvoy } from "./simple-envoy.js";
import { VoxContext } from "../infra/vox-context.js";
import { StrategistParameters } from "../strategist/strategy-parameters.js";
import { EnvoyThread } from "../types/index.js";

/**
 * Spokesperson agent that represents the civilization diplomatically.
 * Responds to questions about the civilization's status, relationships, and intentions
 * with appropriate diplomatic framing based on the current game state.
 *
 * @class
 */
export class Spokesperson extends SimpleEnvoy {
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
   * Gets the system prompt defining the spokesperson persona
   */
  public async getSystem(
    _parameters: StrategistParameters,
    input: EnvoyThread,
    _context: VoxContext<StrategistParameters>
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
- Frame your civilization's actions and stances positively, challenges as opportunities for growth

# Your Audience
You are speaking to ${this.formatUserDescription(input)}.
Adjust your diplomatic posture accordingly: an ally receives warmth, a rival receives measured caution, and a neutral party or observer receives professional courtesy.`.trim();
  }

  /**
   * Returns the contextual hint that anchors the LLM on its identity and audience.
   * Used as sole context in greeting mode, and appended to game state in normal mode.
   */
  protected getHint(parameters: StrategistParameters, input: EnvoyThread): string {
    const leader = parameters.metadata!.YouAre!.Leader;
    const civName = parameters.metadata!.YouAre!.Name;
    return `Remember: You represent ${civName} on the world stage. You are speaking to ${this.formatUserDescription(input)}. Every response reflects on ${leader}'s leadership and your civilization's standing. The time is at turn ${parameters.turn}.`;
  }
}
