/**
 * @module strategist/simple-strategist-base
 *
 * Base class for simple strategist agent implementations.
 * Provides common functionality for high-level strategic decision-making in Civilization V.
 */

import { StepResult, Tool } from "ai";
import { Strategist } from "../strategist.js";
import { StrategistParameters } from "../strategy-parameters.js";

/**
 * Base class for simple strategist agents.
 * Provides common tools and stop condition logic for strategic decision-making.
 *
 * @abstract
 * @class
 */
export abstract class SimpleStrategistBase extends Strategist {
  /**
   * Whether we will remove used tools from the active list
   */
  public removeUsedTools: boolean = true;

  /**
   * Gets the list of active tools for this agent
   */
  public getActiveTools(_parameters: StrategistParameters): string[] | undefined {
    // Return specific tools the strategist needs
    return [
      "get-civilization",
      "set-strategy",
      "set-persona",
      "set-research",
      "set-policy",
      "keep-status-quo"
    ];
  }

  /**
   * Determines whether the agent should stop execution
   */
  public stopCheck(
    _parameters: StrategistParameters,
    _input: unknown,
    _lastStep: StepResult<Record<string, Tool>>,
    allSteps: StepResult<Record<string, Tool>>[]
  ): boolean {
    // Stop if we've executed set-strategy tool
    for (var step of allSteps) {
      for (const result of step.toolResults) {
        if (result.toolName === "set-strategy" && result.output) {
          this.logger.debug("Set-strategy tool executed, stopping agent");
          return true;
        }
        if (result.toolName === "keep-status-quo" && result.output) {
          this.logger.debug("Keep-status-quo tool executed, stopping agent");
          return true;
        }
      }
    }

    // Also stop after 10 steps to prevent infinite loops
    if (allSteps.length >= 10) {
      this.logger.warn("Reached maximum step limit (10), stopping agent");
      return true;
    }

    return false;
  }
}