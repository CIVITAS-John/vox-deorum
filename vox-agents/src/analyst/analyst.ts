/**
 * @module analyst/analyst
 *
 * Base analyst agent implementation. All analysts inherit from this class.
 * Analysts run as fire-and-forget agent-tools, processing information asynchronously
 * and relaying assessed results via MCP tools.
 */

import { StepResult, Tool } from "ai";
import { VoxAgent } from "../infra/vox-agent.js";
import { VoxContext } from "../infra/vox-context.js";
import { StrategistParameters } from "../strategist/strategy-parameters.js";
import { createBriefingTool } from "../briefer/briefing-utils.js";

/** Base input type for all analysts */
export interface AnalystInput {
  /** The player ID this information concerns */
  PlayerID: number;
  /** The game turn this information relates to */
  Turn: number;
  /** The main content/report to analyze */
  Content: string;
  /** Context about the situation or source */
  Context: string;
}

/**
 * Base analyst agent that processes information asynchronously.
 * Runs as a fire-and-forget agent-tool with a detached trace context.
 * Provides all analysts with relay-message, get-briefing, and get-diplomatic-events tools.
 *
 * @abstract
 * @class
 */
export abstract class Analyst<TInput extends AnalystInput = AnalystInput> extends VoxAgent<StrategistParameters, TInput, string> {
  /**
   * Allow the LLM to decide when to call tools
   */
  public override toolChoice: string = "auto";

  /**
   * Run asynchronously — the calling agent does not wait for completion
   */
  public override fireAndForget: boolean = true;

  /**
   * Base active tools for all analysts: relay-message for output, get-briefing and get-diplomatic-events for context
   */
  public getActiveTools(_parameters: StrategistParameters): string[] | undefined {
    return ["relay-message", "get-briefing", "get-diplomatic-events"];
  }

  /**
   * Provides the get-briefing internal tool for on-demand briefing retrieval
   */
  public override getExtraTools(context: VoxContext<StrategistParameters>): Record<string, Tool> {
    return { "get-briefing": createBriefingTool(context) };
  }

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
