/**
 * @module infra/vox-context
 *
 * Runtime context for executing Vox Agents.
 * Manages agent registration, tool availability, and agent execution with observability.
 * Implements the agentic loop with tool calling, step preparation, and stop conditions.
 */

import { generateText, Output, Tool, StepResult, ToolSet, ModelMessage, streamText, tool } from "ai";
import { AgentParameters, VoxAgent } from "./vox-agent.js";
import { createLogger } from "../utils/logger.js";
import { createAgentTool, wrapMCPTools } from "../utils/tools/wrapper.js";
import { mcpClient } from "../utils/models/mcp-client.js";
import { getModel, buildProviderOptions } from "../utils/models/models.js";
import { Model, StreamingEventCallback } from "../types/index.js";
import { exponentialRetry } from "../utils/retry.js";
import { v4 as uuidv4 } from 'uuid';
import { trace, SpanStatusCode, context } from '@opentelemetry/api';
import { spanProcessor } from '../instrumentation.js';
import { VoxSpanExporter } from '../utils/telemetry/vox-exporter.js';
import { countMessagesTokens } from "../utils/token-counter.js";
import { agentRegistry } from "./agent-registry.js";
import { contextRegistry } from "./context-registry.js";

/**
 * Runtime context for executing Vox Agents.
 * Manages agent registration, tool availability, and execution flow.
 *
 * @template TParameters - The type of parameters that agents will receive
 */
export class VoxContext<TParameters extends AgentParameters> {
  private logger = createLogger('VoxContext');
  private tracer = trace.getTracer('vox-agents');

  /**
   * Unique identifier for this context instance
   */
  public readonly id: string;

  /**
   * Registry of available tools indexed by name
   */
  public tools: Record<string, Tool> = {};

  /**
   * Model configuration overrides (replaces config.json definitions)
   */
  public modelOverrides: Record<string, Model | string>;

  /**
   * AbortController for managing generation cancellation
   */
  private abortController: AbortController;

  /**
   * Total input tokens
   */
  public inputTokens: number = 0;
  /**
   * Total reasoning tokens
   */
  public reasoningTokens: number = 0;
  /**
   * Total output tokens
   */
  public outputTokens: number = 0;

  /**
   * Current game turn
   */
  public turn: number = 0

  /**
   * Constructor for VoxContext
   * @param modelOverrides - Model configuration overrides to replace config.json definitions
   * @param id - Optional context ID, generates a UUID if not provided
   */
  constructor(modelOverrides: Record<string, Model | string> = {}, id?: string) {
    this.id = id || uuidv4();
    this.modelOverrides = modelOverrides;
    this.abortController = new AbortController();
    this.logger.info(`VoxContext initialized with ID: ${this.id}`);

    // Automatically register this context in the registry
    contextRegistry.register(this);
  }


  /**
   * Register a tool in the context
   * @param name - The tool name
   * @param tool - The tool implementation
   */
  public registerTool(name: string, tool: Tool): void {
    this.tools[name] = tool;
    this.logger.info(`Tool registered: ${name}`);
  }

  /**
   * Register all MCP client tools.
   * Fetches available tools from the MCP server and wraps them for use with AI SDK.
   */
  public async registerMCP() {
    var mcpTools = wrapMCPTools(await mcpClient.getTools(), this);
    for (var tool of Object.keys(mcpTools)) {
      this.tools[tool] = mcpTools[tool];
    }
    this.logger.info(`MCP tools registered: ${Object.keys(mcpTools).length}`)
  }

  /**
   * Abort the current generation if one is in progress.
   * Creates a new AbortController after aborting for future operations.
   *
   * @param successful - Whether the abort is due to successful completion
   */
  public abort(successful: boolean = false): void {
    this.logger.info(`Aborting current generation (successful: ${successful})`);
    this.abortController.abort();
    // Create a new AbortController for future executions
    this.abortController = new AbortController();
  }

  /**
   * Call a tool by name with the given arguments.
   * Allows manual tool invocation outside of agent execution loop.
   *
   * @param name - The name of the tool to call
   * @param args - The arguments to pass to the tool
   * @param parameters - Agent parameters to pass as experimental_context
   * @returns The result of the tool execution, or undefined if tool not found or execution fails
   */
  public async callTool<T = any>(
    name: string,
    args: any,
    parameters: TParameters): Promise<T | undefined> {
    const tool = this.tools[name];
    if (!tool) {
      this.logger.error(`Tool not found: ${name}`);
      return undefined;
    }

    try {
      const result = await tool.execute?.(args, {
        toolCallId: "manual",
        messages: [],
        experimental_context: parameters
      });
      return result;
    } catch (error) {
      this.logger.error(`Error calling tool ${name}:`, error);
      return undefined;
    }
  }

  /**
   * Call an agent by name with the given input.
   * Allows manual agent invocation outside of the main execution loop.
   * This is useful for orchestrating multiple agents or calling agents programmatically.
   *
   * @param name - The name of the agent to call
   * @param input - The input to pass to the agent
   * @param parameters - The parameters to pass to the agent
   * @returns The result of the agent execution, or undefined if agent not found or execution fails
   */
  public async callAgent<T = any>(
    name: string,
    input: any,
    parameters: TParameters): Promise<T | undefined> {
    const agent = agentRegistry.get<TParameters>(name);
    if (!agent) {
      this.logger.error(`Agent not found: ${name}`);
      return undefined;
    }

    try {
      return await this.execute(name, parameters, input) as T;
    } catch (error) {
      this.logger.error(`Error calling agent ${name}:`, error);
      return undefined;
    }
  }

  /**
   * Execute an agent with the given parameters.
   * Runs the agent's system prompt, tools, and lifecycle hooks in an iterative loop
   * until the stop condition is met. Tracks token usage and provides observability.
   *
   * @param agentName - The name of the agent to execute
   * @param parameters - The parameters to pass to the agent
   * @param outputSchema - Optional output schema for structured generation
   * @returns The generated text response from the agent
   * @throws Error if the agent is not found
   */
  public async execute(
    agentName: string,
    parameters: TParameters,
    input: unknown,
    callback?: StreamingEventCallback
  ): Promise<any> {
    const agent = agentRegistry.get<TParameters>(agentName);
    if (!agent) {
      this.logger.error(`Agent not found: ${agentName}`);
      throw new Error(`Agent '${agentName}' not found in registry`);
    }

    let currentAgent = parameters.running;
    this.turn = parameters.turn;
    parameters.running = agentName;

    const span = this.tracer.startSpan(`agent.${agentName}`, {
      attributes: {
        'vox.context.id': this.id,
        'game.turn': String(parameters.turn),
        'agent.name': agentName,
        'agent.input': input ? JSON.stringify(input) : undefined
      }
    });

    return await context.with(trace.setSpan(context.active(), span), async () => {
      try {
        // Dynamically create agent tools for handoff capability
        let allTools = { ...this.tools };

        // Add other agents as tools (excluding the current agent to prevent recursion)
        const allAgents = agentRegistry.getAllAsRecord();
        for (const [otherAgentName, otherAgent] of Object.entries(allAgents)) {
          if (otherAgentName !== agentName) {
            allTools[`call-${otherAgentName}`] = createAgentTool(
              otherAgent as VoxAgent<TParameters>,
              this,
              parameters
            );
          }
        }

        // Execute the agent using generateText
        // Get model config - agent's model or default, with overrides applied
        const modelConfig = agent.getModel(parameters, input, this.modelOverrides);
        var system = await agent.getSystem(parameters, input, this);
        if (system != "") {
          var shouldStop = false;
          var messages: ModelMessage[] = [{
            role: "system",
            content: system
          }];
          var allSteps: StepResult<ToolSet>[] = [];
          var finalText = "";
          
          // Count tokens
          var inputTokens = 0;
          var reasoningTokens = 0;
          var outputTokens = 0;

          // Execute steps in a loop, one at a time
          for (let stepCount = 0; !shouldStop; stepCount++) {
            this.logger.info(`Executing ${agentName}'s step ${stepCount + 1}`, {
              GameID: parameters.gameID,
              PlayerID: parameters.playerID
            });

            // Execute the step with proper tracing
            const stepResult = await this.executeAgentStep(
              agent,
              parameters,
              input,
              allSteps,
              stepCount,
              messages,
              modelConfig,
              allTools,
              callback
            );

            // Update state from step results
            messages = stepResult.messages;
            shouldStop = stepResult.shouldStop;
            finalText = stepResult.finalText ?? "";
            inputTokens += stepResult.inputTokens;
            reasoningTokens += stepResult.reasoningTokens;
            outputTokens += stepResult.outputTokens;
          }

          this.logger.info(`Agent execution completed: ${agentName} with ${allSteps.length} steps`);

          // Log the conclusion
          this.inputTokens += inputTokens;
          this.reasoningTokens += reasoningTokens;
          this.outputTokens += outputTokens;
          span.setAttributes({
            'model': `${modelConfig.provider}/${modelConfig.name}@${modelConfig.options?.["reasoningEffort"] ?? ""}`,
            'tokens.input': inputTokens,
            'tokens.reasoning': reasoningTokens,
            'tokens.output': outputTokens,
          });
          span.setStatus({ code: SpanStatusCode.OK });
          
          // Convert into the output
          const output = agent.getOutput(parameters, input, finalText);
          if (!output) return;
          return agent.postprocessOutput(parameters, input, output);
        } else {
          span.setStatus({ code: SpanStatusCode.OK, message: 'No system prompt' });
          return undefined;
        }
      } catch (error) {
        this.logger.error(`Error executing agent ${agentName}!`, error);
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error)
        });
        return undefined;
      } finally {
        parameters.running = currentAgent;
        span.end();
      }
    });
  }

  /**
   * Execute a single agent step with proper tracing and error handling.
   * This method encapsulates the logic for preparing, executing, and processing
   * a single step in an agent's execution flow.
   *
   * @private
   * @param stepSpan - The OpenTelemetry span for this step
   * @param agent - The agent being executed
   * @param agentName - The name of the agent
   * @param parameters - The parameters for the agent
   * @param allSteps - All steps executed so far
   * @param messages - The current message history
   * @param model - The model identifier
   * @param system - The system prompt
   * @param allTools - All available tools including agent handoff tools
   * @param stepCount - The current step number
   * @returns Updated messages, stop condition, and optional final text
   */
  private async executeAgentStep(
    agent: VoxAgent<TParameters>,
    parameters: TParameters,
    input: unknown,
    allSteps: StepResult<ToolSet>[],
    stepCount: number,
    messages: ModelMessage[],
    model: Model,
    allTools: ToolSet,
    callback?: StreamingEventCallback
  ): Promise<{ messages: ModelMessage[], shouldStop: boolean, finalText?: string, inputTokens: number, reasoningTokens: number, outputTokens: number }> {
    const stepSpan = this.tracer.startSpan(`agent.${agent.name}.step.${stepCount + 1}`, {
      attributes: {
        'vox.context.id': this.id,
        'game.turn': String(parameters.turn),
        'agent.name': agent.name,
        'step.number': stepCount + 1
      }
    });

    return await context.with(trace.setSpan(context.active(), stepSpan), async () => {
      try {
        // Prepare configuration for this step
        const stepConfig = await agent.prepareStep(parameters, input,
          allSteps.length === 0 ? null : allSteps[allSteps.length - 1], allSteps, messages, this);

        // Apply prepared configuration
        messages = stepConfig.messages || messages;
        const stepModel = stepConfig.model || model;
        const stepProviderOptions = buildProviderOptions(stepConfig.model || model);
        const stepActiveTools = stepConfig.activeTools || agent.getActiveTools(parameters);
        const stepToolChoice = stepConfig.toolChoice || (stepActiveTools && stepActiveTools.length > 0 ? agent.toolChoice : "auto");
        const stepOutputSchema = stepConfig.outputSchema;

        // Prepare tool-result messages by converting nested objects to markdown
        messages.forEach((message) => {
          if (!Array.isArray(message.content)) return;
          // Process each tool result
          message.content.forEach(toolResult => {
            if (toolResult.type === 'tool-result' && typeof(toolResult.output.value) === "object") {
              delete (toolResult.output.value as any)._markdownConfig;
            }
          });
        });

        // Record step configuration in span
        stepSpan.setAttributes({
          'step.tools': JSON.stringify(stepActiveTools),
          'step.tools.choice': stepToolChoice,
          'step.messages': JSON.stringify(messages)
        });

        // Execute a single step
        const stepResults = await exponentialRetry(async () => {
          return await streamText({
            // Model settings
            model: getModel(stepModel),
            providerOptions: stepProviderOptions,
            // Abort signal for cancellation
            abortSignal: this.abortController.signal,
            // Current messages
            messages: messages,
            // Tools
            tools: allTools,
            activeTools: stepActiveTools,
            toolChoice: stepToolChoice,
            experimental_context: parameters,
            // Output schema for tool as agent
            experimental_output: stepOutputSchema ? Output.object({ schema: stepOutputSchema }) : undefined,
            // Stop after one step
            stopWhen: () => true,
            // Events
            onChunk: callback?.OnChunk,
          }).steps;
        }, this.logger);
        const stepResponse = stepResults[stepResults.length - 1];

        // Update token usage
        /* const inputTokens = stepResponse.totalUsage.inputTokens ?? 0;
        const reasoningTokens = stepResponse.totalUsage.reasoningTokens ?? 0;
        const outputTokens = (stepResponse.totalUsage.outputTokens ?? 0) - reasoningTokens; */
        const inputTokens = countMessagesTokens(messages, false);
        const reasoningTokens = countMessagesTokens(stepResponse.response.messages, true);
        const outputTokens = countMessagesTokens(stepResponse.response.messages, false);

        // Record step results in span
        const responses = stepResponse.response.messages;
        responses.forEach(response => delete response.providerOptions);
        stepSpan.setAttributes({
          'model': `${stepModel.provider}/${stepModel.name}@${stepModel.options?.["reasoningEffort"] ?? ""}`,
          'tokens.input': inputTokens,
          'tokens.reasoning': reasoningTokens,
          'tokens.output': outputTokens,
          'step.responses': JSON.stringify(stepResponse.response.messages)
        });

        // Add the step to our collection
        let shouldStop = false;
        let finalText: string | undefined;

        if (stepResults.length > 0) {
          allSteps.push(...stepResults);
          finalText = stepResponse.text;

          // Update messages with the response
          messages = messages.concat(stepResponse.response.messages);

          // Check stop condition
          shouldStop = this.abortController.signal.aborted ||
            agent.stopCheck(parameters, input, stepResponse, allSteps);

          this.logger.debug(`Stop check for ${agent.name}: ${shouldStop}`, {
            stepNumber: stepCount + 1,
            totalSteps: allSteps.length
          });
        } else {
          this.logger.warn(`Agent execution produced no steps: ${agent.name} at step ${stepCount + 1}.`);
          shouldStop = this.abortController.signal.aborted;
        }

        stepSpan.setAttribute('step.should_stop', shouldStop);
        stepSpan.setStatus({ code: SpanStatusCode.OK });

        return { messages, shouldStop, finalText, inputTokens, reasoningTokens, outputTokens };
      } catch (error) {
        stepSpan.recordException(error as Error);
        stepSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error)
        });
        throw error; // Re-throw to be handled by outer try-catch
      } finally {
        stepSpan.end();
      }
    });
  }

  /**
   * Gracefully shutdown the VoxContext.
   * Flushes telemetry data, closes SQLite databases, and unregisters from the registry.
   */
  public async shutdown(): Promise<void> {
    this.logger.info(`Shutting down VoxContext ${this.id}`);

    try {
      // Abort any ongoing generation
      this.abort(true);

      // Force flush telemetry data to ensure all spans are written
      await spanProcessor.forceFlush();

      // Close the SQLite database for this specific context
      await VoxSpanExporter.getInstance().closeContext(this.id);

      // Automatically unregister this context from the registry
      contextRegistry.unregister(this.id);

      this.logger.info(`VoxContext ${this.id} shutdown complete`);
    } catch (error) {
      this.logger.error(`Error during VoxContext shutdown for ${this.id}:`, error);
      throw error;
    }
  }
}