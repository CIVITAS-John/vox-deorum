import { LanguageModel, Tool, StepResult, ModelMessage } from "ai";
import { createLogger } from "../utils/logger.js";
import { z } from "zod";
import { Model } from "../utils/config.js";
import { VoxContext } from "./vox-context.js";

/**
 * Parameters for configuring agent execution.
 * Provides context about the game state and timing for agent decision-making.
 * 
 * @template T - Additional custom parameters specific to each agent implementation
 */
export interface AgentParameters {
  /** Additional custom stores specific to the agent implementation */
  store?: Record<string, unknown>;
  /** ID of the player for whom the agent is serving */
  playerID?: number;
  /** ID of the game for whom the agent is serving */
  gameID?: string;
  /** Current game turn number */
  turn?: number;
  /** Fetch events after this ID */
  after?: number;
  /** Fetch events equals to or before this ID */
  before?: number;
  /** Identifier for the currently running agent or process */
  running?: string;
}

/**
 * Abstract base class for all Vox Agents.
 * Provides a framework for implementing AI agents that can be executed within the Vox context.
 * 
 * @template TParameters - The type of parameters that will be passed to this agent
 * @template TInput - The type of input this agent accepts when called as a tool
 * @template TOutput - The type of output this agent produces when called as a tool
 */
export abstract class VoxAgent<T, TParameters extends AgentParameters, TInput = unknown, TOutput = unknown> {
  protected logger = createLogger(this.constructor.name);
  
  /**
   * The name identifier for this agent
   */
  abstract readonly name: string;
  
  /**
   * Optional description for when this agent is exposed as a tool
   */
  public toolDescription?: string;
  
  /**
   * Optional input schema for when this agent is exposed as a tool
   */
  public inputSchema?: z.ZodSchema<TInput>;
  
  /**
   * Optional output schema for when this agent is exposed as a tool
   */
  public outputSchema?: z.ZodSchema<TOutput>;

  /**
   * Whether we will remove used tools from the active list
   */
  public removeUsedTools: boolean = false;

  /**
   * Whether we will only keep the last round of agent-tool exchanges (i.e. system + user + last reasoning (if any) + last text (if any) + last tool call + last tool result)
   */
  public onlyLastRound: boolean = false;
  
  /**
   * Gets the language model to use for this agent execution.
   * Can return undefined to use the default model from VoxContext.
   * 
   * @param parameters - The execution parameters
   * @returns The language model to use, or undefined for default
   */
  public getModel(_parameters: TParameters): Model | undefined {
    return undefined;
  }
  
  /**
   * Gets the system prompt for this agent.
   * This defines the agent's behavior and capabilities.
   * 
   * @param parameters - The execution parameters
   * @returns The system prompt string
   */
  public abstract getSystem(parameters: TParameters, _context: VoxContext<TParameters>): Promise<string>;
  
  /**
   * Gets the list of active tools for this agent execution.
   * Returns the tool names that should be available to the model.
   * 
   * @param parameters - The execution parameters
   * @returns Array of tool names that should be active, or undefined for all tools
   */
  public abstract getActiveTools(parameters: TParameters): string[] | undefined;
  
  /**
   * Determines whether the agent should stop execution.
   * Called after each step to check if the generation should continue.
   * 
   * @param parameters - The execution parameters
   * @param lastStep - The most recent step result
   * @param allSteps - All steps executed so far
   * @returns True if the agent should stop, false to continue
   */
  public stopCheck(
    _parameters: TParameters,
    _lastStep: StepResult<Record<string, Tool>>,
    _allSteps: StepResult<Record<string, Tool>>[]
  ): boolean {
    return _allSteps.length >= 10;
  }
  
  /**
   * Gets the initial messages to include in the conversation.
   * These messages will be added after the system prompt.
   * 
   * @param parameters - The execution parameters
   * @returns Array of initial messages, or empty array if none
   */
  public async getInitialMessages(_parameters: TParameters, _context: VoxContext<TParameters>): Promise<ModelMessage[]> {
    return [];
  }
  
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
  public async prepareStep(
    parameters: TParameters,
    _lastStep: StepResult<Record<string, Tool>>,
    allSteps: StepResult<Record<string, Tool>>[],
    messages: ModelMessage[],
    _context: VoxContext<TParameters>
  ): Promise<{
    model?: LanguageModel;
    toolChoice?: any;
    activeTools?: string[];
    messages?: ModelMessage[];
  }> {
    const config: any = {};

    // Check for removeUsedTools option
    if (this.removeUsedTools) {
      // Get all tools that have been used so far
      const usedToolNames = new Set<string>();
      for (const step of allSteps) {
        for (const toolCall of step.toolCalls) {
          usedToolNames.add(toolCall.toolName);
        }
      }

      // Filter out used tools from active tools
      const currentActiveTools = this.getActiveTools(parameters);
      if (currentActiveTools && usedToolNames.size > 0) {
        config.activeTools = currentActiveTools.filter(
          toolName => !usedToolNames.has(toolName)
        );
      }
    }

    // Check for onlyLastRound option
    if (this.onlyLastRound) {
      // Keep all system and user messages, but only the last round of assistant/tool messages
      const filteredMessages: ModelMessage[] = [];
      let lastUserIndex = -1;

      // Pass 1: keep all system and user messages
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        filteredMessages.push(message);
        lastUserIndex = i;
        if (message.role !== 'system' && message.role !== 'user')
          break;
      }

      // Pass 2: add messages up to the last assistant interaction
      for (let i = messages.length - 1; i > lastUserIndex; i++) {
        const message = messages[i];
        filteredMessages.push(message);
        if (message.role === "assistant") break;
      }

      config.messages = filteredMessages;
    }

    return config;
  }
}