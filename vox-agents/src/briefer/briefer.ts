/**
 * @module strategist/strategist
 *
 * Base briefer agent implementation. All briefers inherit from this class.
 */

import { VoxAgent } from "../infra/vox-agent.js";
import { StrategistParameters } from "../strategist/strategy-parameters.js";

/**
 * Base briefer agent that summarizes the game state.
 *
 * @abstract
 * @class
 * @template T - Additional agent-specific data
 */
export abstract class Briefer extends VoxAgent<StrategistParameters, string, string> {
}