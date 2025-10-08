import { generateText, Output, Tool } from "ai";
import { AgentParameters, VoxAgent } from "./vox-agent.js";
import { createLogger } from "../utils/logger.js";
import { createAgentTool, wrapMCPTools } from "../utils/tools/wrapper.js";
import { mcpClient } from "../utils/models/mcp-client.js";
import { getModel, buildProviderOptions } from "../utils/models/models.js";
import { startActiveObservation } from "@langfuse/tracing";
import { ZodObject } from "zod/v4/index.js";
import { Model } from "../utils/config.js";
import { exponentialRetry } from "../utils/retry.js";

/**
 * Runtime context for executing Vox Agents.
 * Manages agent registration, tool availability, and execution flow.
 * 
 * @template TParameters - The type of parameters that agents will receive
 */
export class VoxContext<TParameters extends AgentParameters> {
  private logger = createLogger('VoxContext');

  /**
   * Registry of available agents indexed by name
   */
  public agents: Record<string, VoxAgent<unknown, TParameters>> = {};

  /**
   * Registry of available tools indexed by name
   */
  public tools: Record<string, Tool> = {};

  /**
   * Default language model to use when agents don't specify one
   */
  public defaultModel: Model;

  /**
   * AbortController for managing generation cancellation
   */
  private abortController: AbortController;

  /**
   * Constructor for VoxContext
   * @param defaultModel - The default language model to use
   */
  constructor(defaultModel: Model) {
    this.defaultModel = defaultModel;
    this.abortController = new AbortController();
    this.logger.info('VoxContext initialized');
  }

  /**
   * Register an agent in the context
   * @param agent - The agent to register
   */
  public registerAgent(agent: VoxAgent<unknown, TParameters>): void {
    this.agents[agent.name] = agent;
    this.logger.info(`Agent registered: ${agent.name}`);
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
   * Register all MCP client tools
   */
  public async registerMCP() {
    var mcpTools = wrapMCPTools(await mcpClient.getTools());
    for (var tool of Object.keys(mcpTools)) {
      this.tools[tool] = mcpTools[tool];
    }
    this.logger.info(`MCP tools registered: ${Object.keys(mcpTools).length}`)
  }

  /**
   * Abort the current generation if one is in progress
   * Creates a new AbortController after aborting for future operations
   * @param successful - Whether the abort is due to successful completion
   */
  public abort(successful: boolean = false): void {
    this.logger.info(`Aborting current generation (successful: ${successful})`);
    this.abortController.abort();
    // Create a new AbortController for future executions
    this.abortController = new AbortController();
  }

  /**
   * Call a tool by name with the given arguments
   * @param name - The name of the tool to call
   * @param args - The arguments to pass to the tool
   * @returns The result of the tool execution
   * @throws Error if the tool is not found
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
   * Execute an agent with the given parameters
   * @param agentName - The name of the agent to execute
   * @param parameters - The parameters to pass to the agent
   * @param outputSchema - Optional output schema for structured generation
   * @returns The generated text response
   * @throws Error if the agent is not found or if aborted
   */
  public async execute(
    agentName: string,
    parameters: TParameters,
    outputSchema?: ZodObject
  ): Promise<string> {
    const agent = this.agents[agentName];
    if (!agent) {
      this.logger.error(`Agent not found: ${agentName}`);
      throw new Error(`Agent '${agentName}' not found in context`);
    }

    this.logger.info(`Executing agent: ${agentName}`);
    parameters.store = parameters.store ?? {};
    parameters.running = agentName;

    return await startActiveObservation(agentName, async (observation) => {
      observation.update({
        input: parameters
      });
      try {
        // Dynamically create agent tools for handoff capability
        let allTools = { ...this.tools };

        // Add other agents as tools (excluding the current agent to prevent recursion)
        for (const [otherAgentName, otherAgent] of Object.entries(this.agents)) {
          if (otherAgentName !== agentName) {
            allTools[`call_${otherAgentName}`] = createAgentTool(
              otherAgent,
              this,
              parameters
            );
          }
        }

        // Execute the agent using generateText
        var model = agent.getModel(parameters) ?? this.defaultModel;
        var system = await agent.getSystem(parameters, this);
        var initialMessages = await agent.getInitialMessages(parameters, this);
        if (system != "") {
          var response;
          var retry = 0;
          var shouldStop = false;
          var messages = initialMessages;
          const LLM = getModel(model);
          // Vercel AI may stop an agent prematurely if no valid tool call is issued.
          // Therefore, we have to make the agent realize that...
          while (!shouldStop && retry < 3) {
            response = await exponentialRetry(async () => {
              return await generateText({
                // Model settings
                model: LLM,
                providerOptions: buildProviderOptions(model),
                // Abort signal for cancellation
                abortSignal: this.abortController.signal,
                // Initial messages
                messages: [{
                  role: "system",
                  content: system
                }, ...messages],
                // Initial tools
                tools: allTools,
                activeTools: agent.getActiveTools(parameters),
                toolChoice: "required",
                // Telemetry support
                experimental_telemetry: {
                  isEnabled: true,
                  functionId: agentName
                },
                experimental_context: parameters,
                // Output schema for tool as agent
                experimental_output: outputSchema ? Output.object({
                  schema: outputSchema
                }) : undefined,
                // Checks each step's result and deciding to stop or not
                stopWhen: (context) => {
                  const lastStep = context.steps[context.steps.length - 1];
                  shouldStop = this.abortController.signal.aborted || agent.stopCheck(parameters, lastStep, context.steps);
                  this.logger.info(`Stop check for ${agentName}: ${shouldStop}`, {
                    stepCount: context.steps.length
                  });
                  return shouldStop;
                },
                // Preparing for the next step
                prepareStep: async (context) => {
                  const lastStep = context.steps[context.steps.length - 1];
                  this.logger.debug(`Preparing step ${context.steps.length + 1} for ${agentName}`);
                  return await agent.prepareStep(parameters, lastStep, context.steps, context.messages, this);
                }
              });
            }, this.logger);
            // If we stop unexpectedly, check with the agent again. If not, we should try to resume...
            if (!shouldStop) {
              if (response.steps.length !== 0) {
                shouldStop = this.abortController.signal.aborted || agent.stopCheck(parameters, response.steps[response.steps.length - 1], response.steps, true);
              }
              if (!shouldStop) {
                messages = initialMessages.concat(response.response.messages).concat({
                  role: "user",
                  content: "Execute the tool call appropriately with your interim reasoning/generation output. Do not repeat existing calls."
                });
                this.logger.warn(`Agent execution unexpectedly finished: ${agentName} with ${response.steps.length} steps. Resuming ${++retry}/3...`);
              }
            }
          }

          this.logger.info(`Agent execution completed: ${agentName}`);

          response = response!;
          // Log the conclusion
          observation.update({
            output: response.steps[response.steps.length - 1]?.toolCalls ?? response.text,
            metadata: {
              model: `${model.name}@${model.provider}`,
              stepCount: response.steps.length,
              stepTools: response.steps.reduce((list, current) => list.concat(current.toolCalls.map(call => call.toolName)), [] as string[]),
              steps: response.steps.map(step => step.content),
            }
          });
          return response.text;
        } else return "[nothing]";
      } catch (error) {
        this.logger.error(`Error executing agent ${agentName}!`, error);
        return "[nothing]";
      } finally {
        parameters.running = undefined;
      }
    }, {
      asType: "agent"
    });
  }
}