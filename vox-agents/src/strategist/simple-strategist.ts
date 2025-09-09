import { Strategist, StrategistParameters } from "./strategist";

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
  public getSystem(parameters: StrategistParameters): string {
    return `You are a strategic advisor for Civilization V. Your task is to analyze the current game state and set an appropriate strategy for the player.

You have access to various tools to gather information about the game state, including:
- getPlayers: Get information about all players in the game
- getEvents: Get recent game events
- getTechnology: Get technology information
- getPolicy: Get policy information
- getBuilding: Get building information
- getCivilization: Get civilization information

Your goal is to:
1. Gather relevant information about the current game state
2. Analyze the situation (player's position, rivals, opportunities, threats)
3. Decide on an appropriate grand strategy and supporting economic/military strategies
4. Execute the set-strategy tool with your chosen strategy and rationale

Available Grand Strategies:
- DOMINATION: Focus on military conquest
- DIPLOMACY: Focus on diplomatic victory through alliances and city-states
- SCIENCE: Focus on technological advancement and space race
- CULTURE: Focus on cultural development and tourism

Be decisive and execute the set-strategy tool to complete your task.

Current context:
- Player ID: ${parameters.playerID ?? 0}
- Turn Number: ${parameters.turnNumber ?? "Unknown"}`;
  }
  
  /**
   * Gets the initial messages for the conversation
   */
  public getInitialMessages(_parameters: StrategistParameters): any[] {
    return [];
  }
  
  /**
   * Gets the list of active tools for this agent
   */
  public getActiveTools(_parameters: StrategistParameters): string[] | undefined {
    // Return specific tools the strategist needs
    return [
      "getPlayers",
      "getEvents", 
      "getTechnology",
      "getPolicy",
      "getBuilding",
      "getCivilization",
      "calculator",
      "set-strategy"
    ];
  }
  
  /**
   * Determines whether the agent should stop execution
   */
  public stopCheck(
    _parameters: StrategistParameters,
    lastStep: any,
    allSteps: any[]
  ): boolean {
    // Stop if we've executed set-strategy tool
    if (lastStep?.toolCalls) {
      for (const toolCall of lastStep.toolCalls) {
        if (toolCall.toolName === "set-strategy") {
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