import { generateText, LanguageModel, Tool, StepResult } from "ai";
import { VoxAgent } from "./vox-agent.js";
import { createLogger } from "../utils/logger.js";

/**
 * Runtime context for executing Vox Agents.
 * Manages agent registration, tool availability, and execution flow.
 * 
 * @template TParameters - The type of parameters that agents will receive
 */
export class VoxContext<TParameters> {
  private logger = createLogger('VoxContext');
  
  /**
   * Registry of available agents indexed by name
   */
  public agents: Record<string, VoxAgent<TParameters>> = {};
  
  /**
   * Registry of available tools indexed by name
   */
  public tools: Record<string, Tool> = {};
  
  /**
   * Default language model to use when agents don't specify one
   */
  public defaultModel: LanguageModel;
  
  /**
   * Constructor for VoxContext
   * @param defaultModel - The default language model to use
   */
  constructor(defaultModel: LanguageModel) {
    this.defaultModel = defaultModel;
    this.logger.info('VoxContext initialized');
  }
  
  /**
   * Register an agent in the context
   * @param agent - The agent to register
   */
  public registerAgent(agent: VoxAgent<TParameters>): void {
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
   * Execute an agent with the given parameters
   * @param agentName - The name of the agent to execute
   * @param parameters - The parameters to pass to the agent
   * @returns The generated text response
   * @throws Error if the agent is not found
   */
  public async execute(agentName: string, parameters: TParameters): Promise<string> {
    const agent = this.agents[agentName];
    if (!agent) {
      this.logger.error(`Agent not found: ${agentName}`);
      throw new Error(`Agent '${agentName}' not found in context`);
    }
    
    this.logger.info(`Executing agent: ${agentName}`);
    
    try {
      // Execute the agent using generateText
      const response = await generateText({
        model: agent.getModel(parameters) ?? this.defaultModel,
        messages: [{
          role: "system",
          content: agent.getSystem(parameters)
        }],
        tools: this.tools,
        activeTools: agent.getActiveTools(parameters),
        experimental_telemetry: { isEnabled: true },
        experimental_context: parameters,
        stopWhen: (context) => {
          const lastStep = context.steps[context.steps.length - 1];
          const shouldStop = agent.stopCheck(parameters, lastStep, context.steps);
          this.logger.debug(`Stop check for ${agentName}: ${shouldStop}`, {
            stepCount: context.steps.length
          });
          return shouldStop;
        },
        prepareStep: (context) => {
          const lastStep = context.steps[context.steps.length - 1];
          this.logger.debug(`Preparing step ${context.steps.length + 1} for ${agentName}`);
          return agent.prepareStep(parameters, lastStep, context.steps, context.messages);
        },
      });
      
      this.logger.info(`Agent execution completed: ${agentName}`, {
        responseLength: response.text.length,
        totalSteps: response.steps.length
      });
      
      return response.text;
    } catch (error) {
      this.logger.error(`Error executing agent ${agentName}:`, error);
      throw error;
    }
  }
}