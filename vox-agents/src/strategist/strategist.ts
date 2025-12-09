/**
 * @module strategist/strategist
 *
 * Base strategist agent implementation. All strategists inherit from this class.
 */

import { VoxAgent } from "../infra/vox-agent.js";
import { StrategistParameters } from "./strategy-parameters.js";

/**
 * Base strategist agent that analyzes the game state and sets an appropriate strategy.
 *
 * @abstract
 * @class
 * @template T - Additional agent-specific data
 */
export abstract class Strategist extends VoxAgent<StrategistParameters> {
}