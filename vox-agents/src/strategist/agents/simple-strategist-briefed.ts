/**
 * @module strategist/simple-strategist-briefed
 *
 * Briefed strategist agent implementation.
 * Uses a briefer agent to summarize game state before making strategic decisions,
 * reducing context size and focusing on key strategic insights.
 */

import { ModelMessage } from "ai";
import { SimpleStrategistBase } from "./simple-strategist-base.js";
import { VoxContext } from "../../infra/vox-context.js";
import { getRecentGameState, StrategistParameters } from "../strategy-parameters.js";
import { getModelConfig } from "../../utils/models/models.js";
import { Model } from "../../types/index.js";
import { jsonToMarkdown } from "../../utils/tools/json-to-markdown.js";

/**
 * A briefed strategist agent that first requests a briefing before making strategic decisions.
 * Delegates game state summarization to a briefer agent to focus on high-level strategy.
 *
 * @class
 */
export class SimpleStrategistBriefed extends SimpleStrategistBase {
  /**
   * The name identifier for this agent
   */
  readonly name = "simple-strategist-briefed";

  /**
   * Human-readable description of what this agent does
   */
  readonly description = "Requests a strategic briefing before making decisions, using summarized game state for focused high-level strategy";

  /**
   * Gets the system prompt for the strategist
   */
  public async getSystem(_parameters: StrategistParameters, _context: VoxContext<StrategistParameters>): Promise<string> {
    return `
You are an expert player playing Civilization V with the latest Vox Populi mod.

# Expectation
Due to the complexity of the game, you delegate the execution level decision-making (e.g., unit deployment, city management) to an in-game AI.
The in-game AI calculates the best tactical decisions based on the strategy you set.
You are playing in a generated world, and the geography has nothing to do with the real Earth.
There is no user, and you will ALWAYS properly call tools to play the game.
You can interact with multiple tools at a time. Used tools will be removed from the available list.
When reasoning, focus on the gameplay strategy.

# Goals
Your goal is to **call one or more tools** to make high-level decisions for the in-game AI. Each tool has a list of acceptable options, and you must follow them.
- Carefully reason about the current situation and available options, and what kind of change each option will bring.
 - When the situation requires, do not shy away from pivoting strategies.
 - Analyze both your situation and your opponents. Avoid wishful thinking.
- You can change the in-game AI's diplomatic strategy by calling the \`set-persona\` tool.
- You can change the in-game AI's NEXT technology to research (when you finish the current one) by calling the \`set-research\` tool.
- You can change the in-game AI's NEXT policy to adopt (when you have enough culture) by calling the \`set-policy\` tool.
- You must set an appropriate grand strategy and supporting economic/military strategies by calling the \`set-strategy\` tool.
 - You don't have to make a change. Alternatively, use the tool \`keep-status-quo\` to keep strategies the same.
- Always provide a rationale for each decision. You will be able to read the rationale next turn.

# Resources
You will receive:
- Strategies: current strategic decisions and available options for you.
 - You will receive strategies, persona, technology, and policy you set last time.
 - You will also receive the rationale you wrote.
 - It is typically preferable to finish existing policy branches before starting new ones.
 - You will receive options and short descriptions for each type of decision.
 - Whatever decision-making tool you call, the in-game AI can only execute options here.
 - You must choose options from the relevant lists. Double-check if your choices match.
- Briefing: summarizing the current game situation.
  - You can give your briefer a specific instruction by calling the \`instruct-briefer\` tool.
  - You will make independent and wise judgment.`.trim()
  }

  /**
   * Gets the initial messages for the conversation
   */
  public async getInitialMessages(parameters: StrategistParameters, input: unknown, context: VoxContext<StrategistParameters>): Promise<ModelMessage[]> {
    var state = getRecentGameState(parameters)!;
    var instruction = parameters.workingMemory["briefer-instruction"] ?? "None";

    // Get the briefing from the simple-briefer agent
    const briefing = await context.callAgent<string>("simple-briefer", instruction, parameters);
    if (!briefing) throw new Error("Failed to generate strategic briefings.");

    // Get the information
    await super.getInitialMessages(parameters, input, context);

    // Return the messages with briefing instead of full state
    return [{
      role: "system",
      content: `
You are ${parameters.metadata?.YouAre!.Leader}, leader of ${parameters.metadata?.YouAre!.Name} (Player ${parameters.playerID ?? 0}).

# Situation
${jsonToMarkdown(parameters.metadata)}`.trim()
    }, {
      role: "user",
      content: `
# Strategies and Options
${jsonToMarkdown(state.options)}

# Briefings
Your last instruction: ${instruction}
${briefing}

You, ${parameters.metadata?.YouAre!.Leader} (leader of ${parameters.metadata?.YouAre!.Name}, Player ${parameters.playerID ?? 0}), are making strategic decisions after turn ${parameters.turn}.
`.trim()
    }];
  }
  
  /**
   * Gets the list of active tools for this agent
   */
  public getActiveTools(parameters: StrategistParameters): string[] | undefined {
    // Return specific tools the strategist needs
    return ["instruct-briefer", ...(super.getActiveTools(parameters) ?? [])]
  }

  /**
   * Gets the language model to use for this agent execution.
   * Can return undefined to use the default model from VoxContext.
   * 
   * @param parameters - The execution parameters
   * @returns The language model to use, or undefined for default
   */
  public getModel(_parameters: StrategistParameters, _input: unknown, overrides: Record<string, Model | string>): Model {
    return getModelConfig(this.name, "medium", overrides);
  }
}