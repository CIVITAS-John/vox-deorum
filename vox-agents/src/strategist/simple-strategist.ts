/**
 * @module strategist/simple-strategist
 *
 * Simple strategist agent implementation.
 * Provides high-level strategic decision-making for Civilization V gameplay,
 * including diplomatic persona, technology research, policy adoption, and grand strategy selection.
 */

import { ModelMessage, StepResult, Tool } from "ai";
import { Strategist } from "./strategist.js";
import { VoxContext } from "../infra/vox-context.js";
import { getRecentGameState, StrategistParameters } from "./strategy-parameters.js";

/**
 * A simple strategist agent that analyzes the game state and sets an appropriate strategy.
 * Makes high-level decisions and delegates tactical execution to the in-game AI.
 *
 * @class
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
  public async getSystem(_parameters: StrategistParameters, _context: VoxContext<StrategistParameters>): Promise<string> {
    return `
You are a expert player playing Civilization V with the latest Vox Populi mod.

# Expectation
Due to the complexity of the game, you delegate the execution level decision-making (e.g. deployment of units, city management) to an in-game AI.
The in-game AI calculates best tactical decisions based on the strategy you set.
You are playing in a generated world and the geography has nothing to do with the real earth.
There is no user and you will ALWAYS properly call tools to play the game.
You can interact with multiple tools at a time. Used tools will be removed from the available list.

# Goals
Your goal is to **call tools** to make high-level decisions for the in-game AI. Each tool has a list of acceptable options and you must follow them.
- Carefully reason about the current situation and available options and what kind of change each option will bring.
  - When situation requires, do not shy away from pivoting strategies.
  - Analyze both your situation and your opponents. Avoid wishful thinking.
- You can change the in-game AI's diplomatic strategy by calling the \`set-persona\` tool.
- You can change the in-game AI's NEXT technology to research (when you finish the current one) by calling the \`set-research\` tool.
- You can change the in-game AI's NEXT policy to adopt (when you have enough culture) by calling the \`set-policy\` tool.
- You can set an appropriate grand strategy and supporting economic/military strategies by calling the \`set-strategy\` tool.
  - This operation finishes the decision-making loop. If you need to take other actions, do them before.
  - You don't have to make a change. The tool \`keep-status-quo\` also finishes the decision-making loop.
- Always provide a rationale for each decision. You will be able to read the rationale next turn.

# Resources
You will receive the following reports:
- Strategies: current strategic decisions and available options for you.
  - You will receive strategies, persona, technology, policy you set last time.
    - You will also receive the rationale you wrote.
    - It is typically preferable to finish existing policy branches before starting new ones.
  - You will receive options and short descriptions for each type of decisions.
    - Whatever decision-making tool you call, the in-game AI can only execute options here.
    - You must choose options from the relevant lists. Double check if your choices match.
- Victory Progress: current progress towards each type of victory.
    - Domination Victory: Control or vassalize all original capitals.
    - Science Victory: Be the first to finish all spaceship parts and launch the spaceship.
    - Cultural Victory: Accumulate tourism (that outpaces other civilizations' culture) to influence all others.
    - Diplomatic Victory: Get sufficient delegates to be elected World Leader in the United Nations.
    - Time Victory: If no one achieves any other victory by the end of the game, the civilization with the highest score wins.
- Players: summary reports about visible players in the world. Also:
  - You will receive in-game AI's diplomatic evaluations.
  - You will receive each player's publicly available relationships.
  - Pay attention to master/vassal relationships. Vassals cannot achieve conquest victory.
- Cities: summary reports about discovered cities in the world.
- Military: summary reports about tactical zones and visible units.
  - Tactical zones are analyzed by in-game AI to determine the value, relative strength, and tactical posture.
  - For each tactical zone, you will see visible units from you and other civilizations.
- Events: events since you last made a decision.
`.trim()
  }
  
  /**
   * Gets the initial messages for the conversation
   */
  public async getInitialMessages(parameters: StrategistParameters, context: VoxContext<StrategistParameters>): Promise<ModelMessage[]> {
    var state = getRecentGameState(parameters)!;
    // Get the information
    await super.getInitialMessages(parameters, context);
    // Return the messages
    return [{
      role: "system",
      content: `
# Situation
You are Player ${parameters.playerID ?? 0}.
${parameters.metadata}`.trim()
    }, {
      role: "user",
      content: `
You, Player ${parameters.playerID ?? 0}, are making strategic decisions after turn ${parameters.turn}.

# Victory Progress
Victory Progress: current progress towards each type of victory.
${state.victory}

# Strategies
Strategies: existing strategic decisions and available options for you.
${state.options}

# Players
Players: summary reports about visible players in the world.
${state.players}

# Cities
Cities: summary reports about discovered cities in the world.
${state.cities}

# Military
Military: summary reports about tactical zones and visible units.
${state.military}

# Events
Events: events since you last made a decision.
${state.events}
`.trim()
    }];
  }
  
  /**
   * Gets the list of active tools for this agent
   */
  public getActiveTools(_parameters: StrategistParameters): string[] | undefined {
    // Return specific tools the strategist needs
    return [
      "get-civilization",
      "set-strategy",
      "set-persona",
      "set-research",
      "set-policy",
      "keep-status-quo"
    ];
  }
  
  /**
   * Determines whether the agent should stop execution
   */
  public stopCheck(
    _parameters: StrategistParameters,
    _input: unknown,
    _lastStep: StepResult<Record<string, Tool>>,
    allSteps: StepResult<Record<string, Tool>>[]
  ): boolean {
    // Stop if we've executed set-strategy tool
    for (var step of allSteps) {
      for (const result of step.toolResults) {
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