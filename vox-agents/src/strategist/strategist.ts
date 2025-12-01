/**
 * @module strategist/strategist
 *
 * Base strategist agent implementation.
 * Defines the abstract Strategist class that fetches game state and provides it
 * to concrete strategist implementations. All strategists inherit from this class.
 */

import { ModelMessage } from "ai";
import { AgentParameters, VoxAgent } from "../infra/vox-agent.js";
import { VoxContext } from "../infra/vox-context.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Parameters for the strategist agent
 */
export interface StrategistParameters extends AgentParameters {
  playerID: number;
  turn: number;
  after: number;
}

/**
 * Base strategist agent that analyzes the game state and sets an appropriate strategy.
 * Fetches game data (players, events, cities, victory progress, military reports) and
 * stores it in parameters for use by concrete strategist implementations.
 *
 * @abstract
 * @class
 * @template T - Additional agent-specific data
 */
export abstract class Strategist<T = unknown> extends VoxAgent<T, StrategistParameters> {
  /**
   * Gets the initial messages for the conversation.
   * Fetches all required game state data and stores it in parameters.store.
   *
   * @param parameters - Strategist execution parameters
   * @param context - Execution context
   * @returns Empty array (concrete implementations add user messages)
   * @throws Error if any required data fetch fails
   */
  public async getInitialMessages(parameters: StrategistParameters, context: VoxContext<StrategistParameters>): Promise<ModelMessage[]> {
    // Get the information
    const [players, events, cities, options, victory, military] = await Promise.all([
      context.callTool("get-players", { }, parameters),
      context.callTool("get-events", { }, parameters),
      context.callTool("get-cities", { }, parameters),
      context.callTool("get-options", { }, parameters),
      context.callTool("get-victory-progress", { }, parameters),
      context.callTool("get-military-report", { }, parameters),
    ]);

    // Validate all results are defined and not errors
    if (this.isErrorResult(players)) throw new Error(`Failed to fetch players: ${this.extractErrorText(players)}`);
    if (this.isErrorResult(events)) throw new Error(`Failed to fetch events: ${this.extractErrorText(events)}`);
    if (this.isErrorResult(cities)) throw new Error(`Failed to fetch cities: ${this.extractErrorText(cities)}`);
    if (this.isErrorResult(options)) throw new Error(`Failed to fetch options: ${this.extractErrorText(options)}`);
    if (this.isErrorResult(victory)) throw new Error(`Failed to fetch victory: ${this.extractErrorText(victory)}`);
    if (this.isErrorResult(military)) throw new Error(`Failed to fetch military: ${this.extractErrorText(military)}`);

    parameters.store!.players = players;
    parameters.store!.events = events;
    parameters.store!.cities = cities;
    parameters.store!.options = options;
    parameters.store!.military = military;
    parameters.store!.victory = victory;
    return [];
  }

  /**
   * Check if a CallToolResult contains an error.
   *
   * @private
   * @param result - Tool call result to check
   * @returns True if result is undefined or contains an error
   */
  private isErrorResult(result: CallToolResult | undefined): boolean {
    return result === undefined || result.isError === true;
  }

  /**
   * Extract error text from a CallToolResult.
   *
   * @private
   * @param result - Tool call result containing error
   * @returns Error message text, or 'Unknown error' if not found
   */
  private extractErrorText(result: CallToolResult): string {
    if (result.content && result.content.length > 0) {
      const textContent = result.content.find(c => c.type === 'text');
      if (textContent && 'text' in textContent) {
        return textContent.text;
      }
    }
    return 'Unknown error';
  }
}