import { generateText, Output, Tool } from "ai";
import { AgentParameters, VoxAgent } from "./vox-agent.js";
import { createLogger } from "../utils/logger.js";
import { createAgentTool, wrapMCPTools } from "../utils/tool-wrappers.js";
import { mcpClient } from "../utils/mcp-client.js";
import { startActiveObservation } from "@langfuse/tracing";
import { ZodObject } from "zod/v4/index.js";
import { Model } from "../utils/config.js";
import { getModel } from "../utils/models.js";

/**
 * Runtime context for executing Vox Agents.
 * Manages agent registration, tool availability, and execution flow.
 * 
 * @template TParameters - The type of parameters that agents will receive
 */
export class VoxContext<TParameters extends AgentParameters<unknown>> {
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
   * Constructor for VoxContext
   * @param defaultModel - The default language model to use
   */
  constructor(defaultModel: Model) {
    this.defaultModel = defaultModel;
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
   * Execute an agent with the given parameters
   * @param agentName - The name of the agent to execute
   * @param parameters - The parameters to pass to the agent
   * @param includeAgentTools - Whether to include other agents as tools (default: true)
   * @returns The generated text response
   * @throws Error if the agent is not found
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
    parameters.running = agentName;
    
    return await startActiveObservation(agentName, async(observation) => {
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
        const response = await generateText({
          // Model settings
          model: getModel(model),
          providerOptions: {
            [model.provider]: model.options
          } as any,
          // Initial messages
          messages: [{
            role: "system",
            content: agent.getSystem(parameters)
          }, ...agent.getInitialMessages(parameters)],
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
            const shouldStop = agent.stopCheck(parameters, lastStep, context.steps);
            this.logger.debug(`Stop check for ${agentName}: ${shouldStop}`, {
              stepCount: context.steps.length
            });
            return shouldStop;
          },
          // Preparing for the next step
          prepareStep: (context) => {
            const lastStep = context.steps[context.steps.length - 1];
            this.logger.debug(`Preparing step ${context.steps.length + 1} for ${agentName}`);
            return agent.prepareStep(parameters, lastStep, context.steps, context.messages);
          },
        });
        
        this.logger.info(`Agent execution completed: ${agentName}`);
        
        // Log the conclusion
        observation.update({
          output: response.steps[response.steps.length - 1]?.toolResults ?? response.text,
          metadata: {
            agentSteps: response.steps.length,
            agentTools: response.steps.reduce((list, current) => list.concat(current.toolCalls.map(call => call.toolName)), [] as string[])
          }
        });
        return response.text;
      } catch (error: any) {
        this.logger.error(`Error executing agent ${agentName}!`);
        throw error;
      } finally {
        parameters.running = undefined;
      }
    }, {
      asType: "agent"
    });
  }
}