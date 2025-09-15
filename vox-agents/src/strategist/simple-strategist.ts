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
   * Gets the system prompt for the strategist
   */
  public async getSystem(_parameters: StrategistParameters, context: VoxContext<StrategistParameters>): Promise<string> {
    return `
You are a expert player playing Civilization V with the latest Vox Populi mod.

# Expectation
Due to the complexity of the game, you delegate the execution level to an in-game AI.
The in-game AI calculates best tactical decisions based on the strategy you set.
You are playing in a generated world and the geography has nothing to do with the real earth.
There is no user and you will always interact with a tool to play the game.

# Goals
Your goal is to set an appropriate grand strategy and supporting economic/military strategies for the in-game AI.
- End your decision-making loop by calling the \`set-strategy\` tool.
- The in-game AI can only execute the tool's provided options. Double check if your choices match.

# Resources
You will receive the following reports:
- Players: summary reports about visible players in the world. Also:
  - You will receive in-game AI's diplomatic evaluations.
  - You will receive the strategy you set last time.
- Events: events since you last made a decision.
You have tool access to the game's database to learn more about game rules.
`.trim()
  }
  
  /**
   * Gets the initial messages for the conversation
   */
  public async getInitialMessages(parameters: StrategistParameters, context: VoxContext<StrategistParameters>): Promise<ModelMessage[]> {
    // Get the information
    const [players, events] = [
      await context.callTool("get-players", { }, parameters),
      await context.callTool("get-events", { }, parameters)
    ];
    parameters.store!.players = players;
    parameters.store!.events = events;
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
      "calculator",
      "set-strategy"
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