/**
 * @module strategist/strategist
 *
 * Base briefer agent implementation. All briefers inherit from this class.
 */

import { StepResult, Tool } from "ai";
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
      for (const result of step.content) {
        if (result.type === "text" && result.text.length >= 10) {
          this.logger.info(`Briefing produced (length ${result.text.length}), stopping agent`, {
            Abstract: result.text.substring(0, 500).replace("\n\n", "\n") + "..."
          });
          return true;
        }
      }
    }

    // Also stop after 3 steps to prevent infinite loops
    if (allSteps.length >= 3) {
      this.logger.warn("Reached maximum step limit (3), stopping agent");
      return true;
    }

    return false;
  }
}