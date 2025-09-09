import { ModelMessage, StepResult, Tool } from "ai";
import { Strategist, StrategistParameters } from "./strategist.js";

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
  public getSystem(_parameters: StrategistParameters): string {
    return `
You are a strategist playing Civilization V.
Your task is to analyze the current game state and set an appropriate strategy for the player.
You have access to various tools to gather information about the game state.

Your goal is to:
1. Gather relevant information about the current game state
2. Analyze the situation (player's position, rivals, opportunities, threats)
3. Decide on an appropriate grand strategy and supporting economic/military strategies
4. Execute the set-strategy tool with your chosen strategy and rationale

Be decisive and execute the set-strategy tool to complete your task.`
  }
  
  /**
   * Gets the initial messages for the conversation
   */
  public getInitialMessages(parameters: StrategistParameters): ModelMessage[] {
    return [{
      role: "user",
      content: `
Game context:
- Your PlayerID: ${parameters.PlayerID ?? 0}
- Turn: ${parameters.Turn ?? "Unknown"}`
    }];
  }
  
  /**
   * Gets the list of active tools for this agent
   */
  public getActiveTools(_parameters: StrategistParameters): string[] | undefined {
    // Return specific tools the strategist needs
    return [
      "get-players",
      "get-events", 
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
        console.log(result);
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