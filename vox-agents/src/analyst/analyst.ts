/**
 * @module analyst/analyst
 *
 * Base analyst agent implementation. All analysts inherit from this class.
 * Analysts run as fire-and-forget agent-tools, processing information asynchronously
 * and relaying assessed results via MCP tools.
 */

import { StepResult, Tool } from "ai";
import { VoxAgent } from "../infra/vox-agent.js";
import { StrategistParameters } from "../strategist/strategy-parameters.js";

/**
 * Base analyst agent that processes information asynchronously.
 * Runs as a fire-and-forget agent-tool with a detached trace context.
 *
 * @abstract
 * @class
 */
export abstract class Analyst<TInput = unknown> extends VoxAgent<StrategistParameters, TInput, string> {
  /**
   * Tags for categorizing analyst agents
   */
  public tags = ["active-game", "analyst"];

  /**
   * Allow the LLM to decide when to call tools
   */
  public override toolChoice: string = "auto";

  /**
   * Run asynchronously — the calling agent does not wait for completion
   */
  public override fireAndForget: boolean = true;

  /**
   * Stop after 3 steps max — analysts should call their relay tool once then finish
   */
  public stopCheck(
    _parameters: StrategistParameters,
    _input: TInput,
    _lastStep: StepResult<Record<string, Tool>>,
    allSteps: StepResult<Record<string, Tool>>[]
  ): boolean {
    return allSteps.length >= 3;
  }
}
