import { ModelMessage, StepResult, Tool } from "ai";
import { Strategist, StrategistParameters } from "./strategist.js";
import { VoxContext } from "../infra/vox-context.js";

/**
 * A do-nothing strategist agent that literally does nothing
 */
export class NoneStrategist extends Strategist {
  /**
   * The name identifier for this agent
   */
  readonly name = "none-strategist";
  
  /**
   * Gets the system prompt for the strategist
   */
  public async getSystem(_parameters: StrategistParameters, context: VoxContext<StrategistParameters>): Promise<string> {
    return "";
  }
  
  /**
   * Gets the initial messages for the conversation
   */
  public async getInitialMessages(parameters: StrategistParameters, context: VoxContext<StrategistParameters>): Promise<ModelMessage[]> {
    // Get the information
    await super.getInitialMessages(parameters, context);
    // Return the messages
    return [];
  }
  
  /**
   * Gets the list of active tools for this agent
   */
  public getActiveTools(_parameters: StrategistParameters): string[] | undefined {
    return [];
  }
  
  /**
   * Determines whether the agent should stop execution
   */
  public stopCheck(
    _parameters: StrategistParameters,
    _lastStep: StepResult<Record<string, Tool>>,
    _allSteps: StepResult<Record<string, Tool>>[]
  ): boolean {
    return true;
  }
}