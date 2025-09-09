import { LanguageModel, Tool, StepResult, ModelMessage } from "ai";
import { createLogger } from "../utils/logger.js";

/**
 * Abstract base class for all Vox Agents.
 * Provides a framework for implementing AI agents that can be executed within the Vox context.
 * 
 * @template TParameters - The type of parameters that will be passed to this agent
 */
export abstract class VoxAgent<TParameters> {
  protected logger = createLogger(this.constructor.name);
  
  /**
   * The name identifier for this agent
   */
  abstract readonly name: string;
  
  /**
   * Gets the language model to use for this agent execution.
   * Can return undefined to use the default model from VoxContext.
   * 
   * @param parameters - The execution parameters
   * @returns The language model to use, or undefined for default
   */
  abstract getModel(parameters: TParameters): LanguageModel | undefined;
  
  /**
   * Gets the system prompt for this agent.
   * This defines the agent's behavior and capabilities.
   * 
   * @param parameters - The execution parameters
   * @returns The system prompt string
   */
  abstract getSystem(parameters: TParameters): string;
  
  /**
   * Gets the list of active tools for this agent execution.
   * Returns the tool names that should be available to the model.
   * 
   * @param parameters - The execution parameters
   * @returns Array of tool names that should be active, or undefined for all tools
   */
  abstract getActiveTools(parameters: TParameters): string[] | undefined;
  
  /**
   * Determines whether the agent should stop execution.
   * Called after each step to check if the generation should continue.
   * 
   * @param parameters - The execution parameters
   * @param lastStep - The most recent step result
   * @param allSteps - All steps executed so far
   * @returns True if the agent should stop, false to continue
   */
  abstract stopCheck(
    parameters: TParameters,
    lastStep: StepResult<Record<string, Tool>>,
    allSteps: StepResult<Record<string, Tool>>[]
  ): boolean;
  
  /**
   * Prepares the next step in the agent execution.
   * Allows dynamic modification of the execution context for each step.
   * 
   * @param parameters - The execution parameters
   * @param lastStep - The most recent step result
   * @param allSteps - All steps executed so far
   * @param messages - The current message history
   * @returns Configuration for the next step, or empty object for defaults
   */
  abstract prepareStep(
    parameters: TParameters,
    lastStep: StepResult<Record<string, Tool>>,
    allSteps: StepResult<Record<string, Tool>>[],
    messages: ModelMessage[]
  ): {
    model?: LanguageModel;
    toolChoice?: any;
    activeTools?: string[];
    messages?: ModelMessage[];
  };
}