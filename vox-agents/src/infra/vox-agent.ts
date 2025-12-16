/**
 * @module infra/vox-agent
 *
 * Base agent infrastructure for Vox Agents.
 * Defines the abstract VoxAgent class and AgentParameters interface that all agents must implement.
 * Provides lifecycle hooks and execution control for agent behavior.
 */

import { Tool, StepResult, ModelMessage } from "ai";
import { createLogger } from "../utils/logger.js";
import { z, ZodObject } from "zod";
import { Model } from "../types/index.js";
import { VoxContext } from "./vox-context.js";
import { getModelConfig } from "../utils/models/models.js";

/**
 * Parameters for configuring agent execution.
 * Provides context about the game state and timing for agent decision-making.
 */
export interface AgentParameters {
  /** ID of the player for whom the agent is serving, -1 for none */
  playerID: number;
  /** ID of the game for whom the agent is serving */
  gameID: string;
  /** Current game turn number */
  turn: number;
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
export abstract class VoxAgent<TParameters extends AgentParameters, TInput = unknown, TOutput = unknown> {
  protected logger = createLogger(this.constructor.name);
  
  /**
   * The name identifier for this agent
   */
  abstract readonly name: string;

  /**
   * Human-readable description of what this agent does
   */
  abstract readonly description: string;

  /**
   * Tags for categorizing and filtering agents (e.g., ["chat", "strategist", "briefer"])
   */
  public tags: string[] = [];

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
   * Whether we want to force the LLM to call tools (only works when activeTools exist)
   */
  public toolChoice: string = "required";

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
  public getModel(_parameters: TParameters, _input: TInput, overrides: Record<string, Model | string>): Model {
    return getModelConfig(this.name, undefined, overrides);
  }
  
  /**
   * Gets the system prompt for this agent.
   * This defines the agent's behavior and capabilities.
   * 
   * @param parameters - The execution parameters
   * @returns The system prompt string
   */
  public abstract getSystem(parameters: TParameters, _input: TInput, _context: VoxContext<TParameters>): Promise<string>;
  
  /**
   * Gets the list of active tools for this agent execution.
   * Returns the tool names that should be available to the model.
   * 
   * @param parameters - The execution parameters
   * @returns Array of tool names that should be active, or undefined for all tools
   */
  public getActiveTools(parameters: TParameters): string[] | undefined {
    return [];
  }
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
    _input: TInput,
    _lastStep: StepResult<Record<string, Tool>>,
    _allSteps: StepResult<Record<string, Tool>>[]
  ): boolean {
    return _allSteps.length >= 10;
  }
  
  /**
   * Manually post-process LLM results and send back the output.
   *
   * @param parameters - The execution parameters
   * @param input - The starting input
   * @param finalText - The final generated text
   * @returns True if the agent should stop, false to continue
   */
  public getOutput(
    _parameters: TParameters,
    _input: TInput,
    finalText: string
  ): TOutput | undefined {
    if (finalText === "") return;
    if (this.outputSchema) {
      return this.outputSchema.parse(finalText);
    } else {
      return finalText as any;
    }
  }

  /**
   * Post-processes the output before returning it.
   * Override this method to modify the output after getOutput.
   *
   * @param output - The output from getOutput
   * @returns The post-processed output
   */
  public postprocessOutput(
    _parameters: TParameters,
    _input: TInput,
    output: TOutput
  ): TOutput {
    return output;
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
    input: TInput,
    lastStep: StepResult<Record<string, Tool>> | null,
    allSteps: StepResult<Record<string, Tool>>[],
    messages: ModelMessage[],
    context: VoxContext<TParameters>
  ) {
    const config: {
      model?: Model;
      toolChoice?: any;
      activeTools?: string[];
      messages?: ModelMessage[];
      outputSchema?: ZodObject;
    } = {};

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

    // Handle messages
    if (lastStep === null) {
      config.messages = [...messages, ...await this.getInitialMessages(parameters, context)];
    } else if (this.onlyLastRound) {
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

    config.model = this.getModel(parameters, input, context.modelOverrides);

    return config;
  }
}