/**
 * @module strategist/simple-strategist-base
 *
 * Base class for simple strategist agent implementations.
 * Provides common functionality for high-level strategic decision-making in Civilization V.
 */

import { StepResult, Tool } from "ai";
import { Strategist } from "../strategist.js";
import { StrategistParameters } from "../strategy-parameters.js";

/**
 * Base class for simple strategist agents.
 * Provides common tools and stop condition logic for strategic decision-making.
 *
 * @abstract
 * @class
 */
export abstract class SimpleStrategistBase extends Strategist {
  /**
   * Whether we will remove used tools from the active list
   */
  public removeUsedTools: boolean = true;

  // ============================================================
  // System Section Prompts (for getSystem method)
  // ============================================================

  /**
   * Shared prompt: Expert player introduction
   */
  public static readonly expertPlayerPrompt = `You are an expert player playing Civilization V with the latest Vox Populi mod.`;

  /**
   * Shared prompt: Expectation about delegating tactical decisions
   */
  public static readonly expectationPrompt = `# Expectation
- Due to the complexity of the game, you delegate the tactical level decision-making (e.g., unit deployment, city management, scouting) to an in-game AI.
- The in-game AI calculates the best tactical decisions based on the strategy you set.
- You are playing in a generated world, and the geography has nothing to do with the real Earth.
- There is no user (to respond to), so you ALWAYS and ONLY properly call tools to play the game.
- You can interact with multiple tools at a time. Used tools will be removed from the available list.
- Focus on the **macro-level** gameplay strategy (instead of coordinates etc.), as you DON'T have direct control over tactical actions.
- The world is complicated and dynamic. Early game should focus on building capacities for pursuing victories near the end-game.`;

  /**
   * Shared prompt: Goals for strategic decision-making
   */
  public static readonly goalsPrompt = `# Goals
Your goal is to **call as many tools as you need** to make high-level decisions for the in-game AI.
- Each tool has a list of acceptable options, and you must use them.
- Carefully reason about the current situation and available options, and what kind of change each option will bring.
  - When the situation requires, do not shy away from pivoting strategies.
  - Analyze both your situation and your opponents. Avoid wishful thinking.
- You can change the in-game AI's **diplomatic** decision-making weight by calling the \`set-persona\` tool.
- You can change the in-game AI's NEXT technology to research (when completing the ongoing one) by calling the \`set-research\` tool.
- You can change the in-game AI's NEXT policy to adopt (when you accumulate enough culture) by calling the \`set-policy\` tool.`;

  /**
   * Shared prompt: Briefer capabilities and limitations
   */
  public static readonly brieferCapabilitiesPrompt = ` - Your briefer(s) ONLY have limited information of the current game state.
  - Your briefer(s) DO NOT have control over tactical decisions and cannot predict tactical AI's next decision.
  - Your briefer(s) ARE BEST on summarizing and synthesizing information, NOT analyzing or calculating (which is your responsibility).`;

  /**
   * Shared prompt: Decision-making description
   */
  public static readonly decisionPrompt = `- Each turn, you must call either \`set-strategy\` or \`keep-status-quo\` tool.
  - Set an appropriate grand strategy and supporting economic/military strategies by calling the \`set-strategy\` tool.
  - Alternatively, use the tool \`keep-status-quo\` to keep strategies the same.
  - Strategies change the weight of the in-game AI's NEXT decision. It won't directly change the ongoing production queue (or other similar things).
- Always provide a short paragraph of rationale for each tool. You will read this rationale next turn.`;

  // ============================================================
  // Resource Section Prompts (for Resources section)
  // ============================================================

  /**
   * Shared prompt: Options resource description
   */
  public static readonly optionsDescriptionPrompt = `- Options: available strategic options for you.
  - You will receive options and short descriptions for each type of decision.
  - Whatever decision-making tool you call, the in-game AI can only execute options here.
  - You must choose options from the relevant lists. Double-check if your choices match.
  - It is typically preferable to finish existing policy branches before starting new ones.`;

  /**
   * Shared prompt: Strategies resource description
   */
  public static readonly strategiesDescriptionPrompt = `- Strategies: existing strategic decisions and rationale from you.
  - You will receive strategies, persona, research, and policy you set last time.`;

  /**
   * Shared prompt: Victory conditions description
   */
  public static readonly victoryConditionsPrompt = `- Victory Progress: current progress towards each type of victory.
  - Domination Victory: Control or vassalize all original capitals.
  - Science Victory: Be the first to finish all spaceship parts and launch the spaceship.
  - Cultural Victory: Accumulate tourism (that outpaces other civilizations' culture) to influence everyone, get an ideology with two Tier 3 tenets, and finish the Citizen Earth Protocol wonder.
  - Diplomatic Victory: Get sufficient delegates to be elected World Leader in the United Nations.
  - Time Victory: If no one achieves any other victory by the end of the game, the civilization with the highest score wins.`;

  /**
   * Shared prompt: Players information description
   */
  public static readonly playersInfoPrompt = `- Players: summary reports about visible players in the world. Also:
  - You will receive in-game AI's diplomatic evaluations.
  - You will receive each player's publicly available relationships.
  - Pay attention to master/vassal relationships. If you are a vassal, you cannot achieve a domination victory before independence.`;

  /**
   * Gets the list of active tools for this agent
   */
  public getActiveTools(_parameters: StrategistParameters): string[] | undefined {
    // Return specific tools the strategist needs
    return [
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
          this.logger.debug("Set-strategy tool executed, stopping agent");
          return true;
        }
        if (result.toolName === "keep-status-quo" && result.output) {
          this.logger.debug("Keep-status-quo tool executed, stopping agent");
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