/**
 * Simple strategist agent that executes the set-strategy tool
 */

import { AgentParameters, VoxAgent } from "../infra/vox-agent.js";

/**
 * Parameters for the strategist agent
 */
export interface StrategistParameters<T = unknown> extends AgentParameters<T> {
  PlayerID: number;
  Turn: number;
  After: number;
}

/**
 * A simple strategist agent that analyzes the game state and sets an appropriate strategy
 */
export abstract class Strategist<T = unknown> extends VoxAgent<T, StrategistParameters<T>> {
}