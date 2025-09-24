import { ModelMessage, StepResult, Tool } from "ai";
import { Strategist, StrategistParameters } from "./strategist.js";
import { VoxContext } from "../infra/vox-context.js";

/**
 * A simple strategist agent that analyzes the game state and sets an appropriate strategy
 */
export class SimpleStrategist extends Strategist {
  /**
   * The name identifier for this agent
   */
  readonly name = "simple-strategist";
  
  /**
   * Whether we will remove used tools from the active list
   */
  public removeUsedTools: boolean = true;
  
  /**
   * Gets the system prompt for the strategist
   */
  public async getSystem(_parameters: StrategistParameters, context: VoxContext<StrategistParameters>): Promise<string> {
    return `
You are a expert player playing Civilization V with the latest Vox Populi mod.

# Expectation
Due to the complexity of the game, you delegate the execution level to an in-game AI.
The in-game AI calculates best tactical decisions based on the strategy you set.
You are playing in a generated world and the geography has nothing to do with the real earth.
There is no user and you will always interact with tool(s) to play the game.
You can interact with multiple tools at a time. Used tools will be removed from the available list.

# Goals
Your goal is to **use tools** and make high-level decisions for the in-game AI. 
- You can change the in-game AI's diplomatic strategy by calling the \`set-persona\` tool.
- You can set an appropriate grand strategy and supporting economic/military strategies by calling the \`set-strategy\` tool.
  - The in-game AI can only execute the tool's provided options. Double check if your choices match.
  - This operation finishes the decision-making loop. If you need to take other actions, do them before.
  - You don't have to make a change. The tool \`keep-status-quo\` also finishes the decision-making loop.
- Always provide a rationale for each decision. You will be able to read the rationale next turn.

# Resources
You will receive the following reports:
- Players: summary reports about visible players in the world. Also:
  - You will receive in-game AI's diplomatic evaluations.
  - You will receive the strategy, persona, and rationales you set last time.
  - You will receive each player's publicly available relationships.
- Cities: summary reports about discovered cities in the world.
- Units: summary reports about visible units.
- Events: events since you last made a decision.
You have tool access to the game's database to learn more about game rules.
`.trim()
  }
  
  /**
   * Gets the initial messages for the conversation
   */
  public async getInitialMessages(parameters: StrategistParameters, context: VoxContext<StrategistParameters>): Promise<ModelMessage[]> {
    // Get the information
    await super.getInitialMessages(parameters, context);
    // Return the messages
    return [{
      role: "system",
      content: `
# Situation
You are playing as Player ${parameters.playerID ?? 0}.
${parameters.store!.metadata}`.trim()
    }, {
      role: "user",
      content: `
You are making strategic decisions after turn ${parameters.turn} has been executed.

# Players
${parameters.store!.players}

# Cities
${parameters.store!.cities}

# Units
${parameters.store!.units}

# Events
${parameters.store!.events}
`.trim()
    }];
  }
  
  /**
   * Gets the list of active tools for this agent
   */
  public getActiveTools(_parameters: StrategistParameters): string[] | undefined {
    // Return specific tools the strategist needs
    return [
      "get-technology",
      "get-policy",
      "get-building",
      "get-civilization",
      "set-strategy",
      "set-persona",
      "keep-status-quo"
    ];
  }
  
  /**
   * Determines whether the agent should stop execution
   */
  public stopCheck(
    _parameters: StrategistParameters,
    lastStep: StepResult<Record<string, Tool>>,
    allSteps: StepResult<Record<string, Tool>>[]
  ): boolean {
    // Stop if we've executed set-strategy tool
    if (lastStep?.toolResults) {
      for (const result of lastStep.toolResults) {
        if (result.toolName === "set-strategy" && result.output) {
          this.logger.info("Set-strategy tool executed, stopping agent");
          return true;
        }
        if (result.toolName === "keep-status-quo" && result.output) {
          this.logger.info("Keep-status-quo tool executed, stopping agent");
          return true;
        }
      }
    }
    
    // Also stop after 10 steps to prevent infinite loops
    if (allSteps.length >= 10) {
      this.logger.warn("Reached maximum step limit (10), stopping agent");
      return true;
    }
    
    return false;
  }
}