/**
 * @module strategist/strategist
 *
 * Base strategist agent implementation.
 * Defines the abstract Strategist class that fetches game state and provides it
 * to concrete strategist implementations. All strategists inherit from this class.
 */

import { VoxAgent } from "../infra/vox-agent.js";
import { StrategistParameters } from "./strategy-parameters.js";

/**
 * Base strategist agent that analyzes the game state and sets an appropriate strategy.
 * Fetches game data (players, events, cities, victory progress, military reports) and
 * stores it in parameters for use by concrete strategist implementations.
 *
 * @abstract
 * @class
 * @template T - Additional agent-specific data
 */
export abstract class Strategist extends VoxAgent<StrategistParameters> {
}