/**
 * @module strategist/strategist
 *
 * Base strategist agent implementation. All strategists inherit from this class.
 */

import { ModelMessage, StepResult, Tool } from "ai";
import { VoxAgent } from "../infra/vox-agent.js";
import { StrategistParameters } from "./strategy-parameters.js";
import { VoxContext } from "../infra/vox-context.js";
import { Model } from "../types/config.js";
import { getModelConfig } from "../utils/models/models.js";

/**
 * Base strategist agent that analyzes the game state and sets an appropriate strategy.
 *
 * @abstract
 * @class
 */
export abstract class Strategist extends VoxAgent<StrategistParameters> {
  /**
   * Gets the language model to use for this agent execution.
   * Can return undefined to use the default model from VoxContext.
   *
   * @param parameters - The execution parameters
   * @returns The language model to use, or undefined for default
   */
  public getModel(_parameters: StrategistParameters, _input: unknown, overrides: Record<string, Model | string>): Model {
    return getModelConfig(this.name, "default", overrides);
  }
}