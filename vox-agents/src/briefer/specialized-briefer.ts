/**
 * @module briefer/specialized-briefer
 *
 * Specialized briefer agent that focuses on specific game aspects (Military, Economy, or Diplomacy).
 * Uses mode-specific prompts and filters events/data to provide targeted strategic briefings.
 */

import { ModelMessage, Tool } from "ai";
import { z } from "zod";
import { Briefer } from "./briefer.js";
import { VoxContext } from "../infra/vox-context.js";
import { getGameState, getRecentGameState, StrategistParameters } from "../strategist/strategy-parameters.js";
import { getModelConfig } from "../utils/models/models.js";
import { Model } from "../types/index.js";
import { jsonToMarkdown } from "../utils/tools/json-to-markdown.js";
import { createSimpleTool } from "../utils/tools/simple-tools.js";
import { getOffsetedTurn } from "../utils/game-speed.js";
import { SimpleBriefer } from "./simple-briefer.js";
import { filterEventsByCategory, EventCategory } from "../utils/event-filters.js";
import { SimpleStrategistBase } from "../strategist/agents/simple-strategist-base.js";

/**
 * Mode type for specialized briefer
 */
export type BriefingMode = 'Military' | 'Economy' | 'Diplomacy';

/**
 * Input type for specialized briefer
 */
export interface SpecializedBrieferInput {
  mode: BriefingMode;
  instruction: string;
}

/**
 * Configuration for a specific briefing mode
 */
interface ModeConfig {
  systemPrompt: string;
  getInitialMessages: (
    briefer: SpecializedBriefer,
    parameters: StrategistParameters,
    input: SpecializedBrieferInput,
    context: VoxContext<StrategistParameters>
  ) => Promise<ModelMessage[]>;
}

/**
 * Introduction stating the briefer's role for specialized modes
 */
function roleIntro(role: string): string {
  return `You are an expert ${role} for Civilization V with the latest Vox Populi mod.
Your role is to produce a concise ${role.toLowerCase()}-focused briefing based on the current game state, following your leader's instruction.
Your leader only has control over macro-level decision making. Focus on providing relevant ${role.toLowerCase()} information.`;
}

/**
 * Military-focused briefing configuration
 */
const militaryConfig: ModeConfig = {
  systemPrompt: `
${roleIntro('military intelligence analyst')}

# Objective
Summarize the military situation into a strategic briefing that highlights:
- Military strength and position relative to opponents
- Active conflicts, threats, and combat results
- Military unit movements and tactical developments
- Important military-related events during the past turn
- Comparison with the last available military briefing

# Guidelines
- Focus exclusively on military and combat-related information
- Highlight important strategic military changes and intelligence
${SimpleBriefer.commonGuidelines}

# Resources
You will receive the following reports:
${SimpleStrategistBase.playersInfoPrompt}
${SimpleBriefer.citiesPrompt}
${SimpleBriefer.militaryPrompt}
- Events: military-related events since the last decision-making
${SimpleBriefer.pastBriefingPrompt}

${SimpleBriefer.instructionFooter}`.trim(),

  getInitialMessages: async (briefer, parameters, input, context) => {
    const state = getRecentGameState(parameters)!;
    await Briefer.prototype.getInitialMessages.call(briefer, parameters, input.instruction, context);
    const { YouAre, ...SituationData } = parameters.metadata || {};

    // Filter events to military category
    const militaryEvents = state.events ? Object.fromEntries(
      Object.entries(state.events as Record<string, any[]>).map(([turn, events]) => [
        turn,
        filterEventsByCategory(events, 'Military')
      ])
    ) : undefined;

    const messages: ModelMessage[] = [{
      role: "system",
      content: `
You are an expert military intelligence analyst for ${parameters.metadata?.YouAre!.Leader}, leader of ${parameters.metadata?.YouAre!.Name} (Player ${parameters.playerID ?? 0}).

# Situation
${jsonToMarkdown(SituationData)}

# Your Civilization
${jsonToMarkdown(YouAre)}`.trim(),
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' } }
      }
    }, {
      role: "user",
      content: `
# Victory Progress
Victory Progress: current progress towards each type of victory.

${jsonToMarkdown(state.victory)}

# Players
Players: summary reports about visible players in the world.

${jsonToMarkdown(state.players)}

# Cities
Cities: summary reports about discovered cities in the world.

${jsonToMarkdown(state.cities)}

# Military
Military: summary reports about tactical zones and visible units.

${jsonToMarkdown(state.military)}

# Events
Events: military-related events since the last decision-making.

${jsonToMarkdown(militaryEvents)}

# Leader's Instruction
You are writing a military briefing for ${parameters.metadata?.YouAre!.Leader}, leader of ${parameters.metadata?.YouAre!.Name} (Player ${parameters.playerID ?? 0}), after turn ${parameters.turn}.

${input.instruction}`.trim()
    }];

    // Add past military briefing if available
    const lastState = getGameState(parameters, getOffsetedTurn(parameters, -5));
    if (lastState && lastState.reports["briefing-military"]) {
      messages.push({
        role: "user",
        content: `# Past Briefing
Past Briefing: your past military briefing from ${parameters.turn - lastState.turn} turns ago (turn ${lastState.turn}) for comparison.
${lastState.reports["briefing-military"]}`
      });
    }

    return messages;
  }
};

/**
 * Economy-focused briefing configuration
 */
const economyConfig: ModeConfig = {
  systemPrompt: `
${roleIntro('economic analyst')}

# Objective
Summarize the economic situation into a strategic briefing that highlights:
- Economic position and development relative to opponents
- City growth, production, and infrastructure developments
- Technology progress and policy changes
- Important economic events during the past turn
- Comparison with the last available economic briefing

# Guidelines
- Focus exclusively on economic, technological, and development-related information
- Highlight important strategic economic changes and intelligence
${SimpleBriefer.commonGuidelines}

# Resources
You will receive the following reports:
${SimpleStrategistBase.playersInfoPrompt}
${SimpleBriefer.citiesPrompt}
- Events: economy-related events since the last decision-making
${SimpleBriefer.pastBriefingPrompt}

${SimpleBriefer.instructionFooter}`.trim(),

  getInitialMessages: async (briefer, parameters, input, context) => {
    const state = getRecentGameState(parameters)!;
    await Briefer.prototype.getInitialMessages.call(briefer, parameters, input.instruction, context);
    const { YouAre, ...SituationData } = parameters.metadata || {};

    // Filter events to economy category
    const economyEvents = state.events ? Object.fromEntries(
      Object.entries(state.events as Record<string, any[]>).map(([turn, events]) => [
        turn,
        filterEventsByCategory(events, 'Economy')
      ])
    ) : undefined;

    const messages: ModelMessage[] = [{
      role: "system",
      content: `
You are an expert economic analyst for ${parameters.metadata?.YouAre!.Leader}, leader of ${parameters.metadata?.YouAre!.Name} (Player ${parameters.playerID ?? 0}).

# Situation
${jsonToMarkdown(SituationData)}

# Your Civilization
${jsonToMarkdown(YouAre)}`.trim(),
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' } }
      }
    }, {
      role: "user",
      content: `
# Victory Progress
Victory Progress: current progress towards each type of victory.

${jsonToMarkdown(state.victory)}

# Players
Players: summary reports about visible players in the world.

${jsonToMarkdown(state.players)}

# Cities
Cities: summary reports about discovered cities in the world.

${jsonToMarkdown(state.cities)}

# Events
Events: economy-related events since the last decision-making.

${jsonToMarkdown(economyEvents)}

# Leader's Instruction
You are writing an economic briefing for ${parameters.metadata?.YouAre!.Leader}, leader of ${parameters.metadata?.YouAre!.Name} (Player ${parameters.playerID ?? 0}), after turn ${parameters.turn}.

${input.instruction}`.trim()
    }];

    // Add past economic briefing if available
    const lastState = getGameState(parameters, getOffsetedTurn(parameters, -5));
    if (lastState && lastState.reports["briefing-economy"]) {
      messages.push({
        role: "user",
        content: `# Past Briefing
Past Briefing: your past economic briefing from ${parameters.turn - lastState.turn} turns ago (turn ${lastState.turn}) for comparison.
${lastState.reports["briefing-economy"]}`
      });
    }

    return messages;
  }
};

/**
 * Diplomacy-focused briefing configuration
 */
const diplomacyConfig: ModeConfig = {
  systemPrompt: `
${roleIntro('diplomatic analyst')}

# Objective
Summarize the diplomatic situation into a strategic briefing that highlights:
- Diplomatic relationships and standing with other civilizations
- Recent diplomatic events (declarations of war, peace treaties, alliances)
- World Congress activities and resolutions
- City-state relationships and influence changes
- Important diplomatic events during the past turn
- Comparison with the last available diplomatic briefing

# Guidelines
- Focus exclusively on diplomatic, relationship, and political information
- Highlight important strategic diplomatic changes and intelligence
${SimpleBriefer.commonGuidelines}

# Resources
You will receive the following reports:
${SimpleStrategistBase.playersInfoPrompt}
${SimpleBriefer.citiesPrompt}
- Events: diplomacy-related events since the last decision-making
${SimpleBriefer.pastBriefingPrompt}

${SimpleBriefer.instructionFooter}`.trim(),

  getInitialMessages: async (briefer, parameters, input, context) => {
    const state = getRecentGameState(parameters)!;
    await Briefer.prototype.getInitialMessages.call(briefer, parameters, input.instruction, context);
    const { YouAre, ...SituationData } = parameters.metadata || {};

    // Filter events to diplomacy category
    const diplomacyEvents = state.events ? Object.fromEntries(
      Object.entries(state.events as Record<string, any[]>).map(([turn, events]) => [
        turn,
        filterEventsByCategory(events, 'Diplomacy')
      ])
    ) : undefined;

    const messages: ModelMessage[] = [{
      role: "system",
      content: `
You are an expert diplomatic analyst for ${parameters.metadata?.YouAre!.Leader}, leader of ${parameters.metadata?.YouAre!.Name} (Player ${parameters.playerID ?? 0}).

# Situation
${jsonToMarkdown(SituationData)}

# Your Civilization
${jsonToMarkdown(YouAre)}`.trim(),
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' } }
      }
    }, {
      role: "user",
      content: `
# Victory Progress
Victory Progress: current progress towards each type of victory.

${jsonToMarkdown(state.victory)}

# Players
Players: summary reports about visible players in the world.

${jsonToMarkdown(state.players)}

# Cities
Cities: summary reports about discovered cities in the world.

${jsonToMarkdown(state.cities)}

# Events
Events: diplomacy-related events since the last decision-making.

${jsonToMarkdown(diplomacyEvents)}

# Leader's Instruction
You are writing a diplomatic briefing for ${parameters.metadata?.YouAre!.Leader}, leader of ${parameters.metadata?.YouAre!.Name} (Player ${parameters.playerID ?? 0}), after turn ${parameters.turn}.

${input.instruction}`.trim()
    }];

    // Add past diplomatic briefing if available
    const lastState = getGameState(parameters, getOffsetedTurn(parameters, -5));
    if (lastState && lastState.reports["briefing-diplomacy"]) {
      messages.push({
        role: "user",
        content: `# Past Briefing
Past Briefing: your past diplomatic briefing from ${parameters.turn - lastState.turn} turns ago (turn ${lastState.turn}) for comparison.
${lastState.reports["briefing-diplomacy"]}`
      });
    }

    return messages;
  }
};

/**
 * Mode configuration registry mapping mode names to their configurations
 */
const modeConfigs: Record<'Military' | 'Economy' | 'Diplomacy', ModeConfig> = {
  Military: militaryConfig,
  Economy: economyConfig,
  Diplomacy: diplomacyConfig
};

/**
 * A specialized briefer agent that focuses on specific game aspects.
 * Provides targeted briefings for Military, Economy, or Diplomacy based on mode selection.
 *
 * @class
 */
export class SpecializedBriefer extends Briefer<SpecializedBrieferInput> {
  /**
   * The name identifier for this agent
   */
  readonly name = "specialized-briefer";

  /**
   * Human-readable description of what this agent does
   */
  readonly description = "Produces specialized briefings focused on Military, Economy, or Diplomacy aspects based on selected mode";

  /**
   * Gets the system prompt for the briefer based on the selected mode
   */
  public async getSystem(
    _parameters: StrategistParameters,
    input: SpecializedBrieferInput,
    _context: VoxContext<StrategistParameters>
  ): Promise<string> {
    const config = modeConfigs[input.mode];
    return config.systemPrompt;
  }

  /**
   * Gets the initial messages for the conversation using mode-specific message construction
   */
  public async getInitialMessages(
    parameters: StrategistParameters,
    input: SpecializedBrieferInput,
    context: VoxContext<StrategistParameters>
  ): Promise<ModelMessage[]> {
    const config = modeConfigs[input.mode];
    return config.getInitialMessages(this, parameters, input, context);
  }

  /**
   * Post-processes the output and stores it in the appropriate report key
   */
  public postprocessOutput(
    parameters: StrategistParameters,
    input: SpecializedBrieferInput,
    output: string
  ): string {
    const reportKey = `briefing-${input.mode.toLowerCase()}`;
    parameters.gameStates[parameters.turn].reports[reportKey] = output;
    return output;
  }

  /**
   * Gets the language model to use for this agent execution
   */
  public getModel(
    _parameters: StrategistParameters,
    _input: unknown,
    overrides: Record<string, Model | string>
  ): Model {
    return getModelConfig(this.name, "low", overrides);
  }

  /**
   * Gets extra tools that this agent provides to the context
   */
  public getExtraTools(context: VoxContext<StrategistParameters>): Record<string, Tool> {
    return {
      "instruct-specialized-briefer": createSimpleTool({
        name: "instruct-specialized-briefer",
        description: "Set writing instructions for your specialized briefer to focus on next turn",
        inputSchema: z.object({
          Mode: z.enum(['Military', 'Economy', 'Diplomacy']).describe("The briefing mode to use"),
          Instruction: z.string().describe("Instructions for the briefer's report writing, e.g. what kind of information to prioritize")
        }),
        execute: async (input, parameters) => {
          // Store the instruction in working memory for the next specialized briefing
          const key = `specialized-briefer-instruction-${input.Mode.toLowerCase()}`;
          parameters.workingMemory[key] = input.Instruction;
          return `Specialized briefer instruction set for ${input.Mode} mode.`;
        }
      }, context)
    };
  }
}
