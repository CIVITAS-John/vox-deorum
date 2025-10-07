/**
 * Simple strategist agent that executes the set-strategy tool
 */

import { ModelMessage } from "ai";
import { AgentParameters, VoxAgent } from "../infra/vox-agent.js";
import { VoxContext } from "../infra/vox-context.js";

/**
 * Parameters for the strategist agent
 */
export interface StrategistParameters extends AgentParameters {
  playerID: number;
  turn: number;
  after: number;
}

/**
 * A simple strategist agent that analyzes the game state and sets an appropriate strategy
 */
export abstract class Strategist<T = unknown> extends VoxAgent<T, StrategistParameters> {
  /**
   * Gets the initial messages for the conversation
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
    if (players === undefined || events === undefined || cities === undefined || military === undefined)
      throw Error("Cannot fetch necessary data for decision-making. Aborting.")
    parameters.store!.players = players;
    parameters.store!.events = events;
    parameters.store!.cities = cities;
    parameters.store!.options = options;
    parameters.store!.military = military;
    parameters.store!.victory = victory;
    return [];
  }
}