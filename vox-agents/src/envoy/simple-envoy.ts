/**
 * @module envoy/simple-envoy
 *
 * Base class for game-aware envoy agents with greeting mode support.
 * Orchestrates context assembly and detects greeting mode (empty thread)
 * to minimize token usage on initial contact.
 */

import { ModelMessage } from "ai";
import { Envoy } from "./envoy.js";
import { StrategistParameters, getGameState } from "../strategist/strategy-parameters.js";
import { EnvoyThread, Model } from "../types/index.js";
import { jsonToMarkdown } from "../utils/tools/json-to-markdown.js";

/**
 * Abstract base for envoy agents that operate within a game context.
 * Handles the structural pattern of assembling initial messages and
 * provides greeting mode: when the thread is empty, only the system
 * prompt and a contextual hint are sent, saving context tokens.
 *
 * Subclasses provide prompt content via abstract methods.
 *
 * @abstract
 * @class
 */
export abstract class SimpleEnvoy extends Envoy {
  /**
   * Returns the full game context messages: civilization identity + game state.
   * Uses briefing when available, otherwise includes raw game reports.
   */
  protected getContextMessages(parameters: StrategistParameters, input: EnvoyThread): ModelMessage[] {
    const leader = parameters.metadata!.YouAre!.Leader;
    const civName = parameters.metadata!.YouAre!.Name;
    const state = getGameState(parameters, parameters.turn);
    if (!state) {
      throw new Error(`No game state available near turn ${parameters.turn}`);
    }
    const hint = this.getHint(parameters, input);
    const { YouAre, ...SituationData } = parameters.metadata || {};
    const { Options, ...Strategy } = state.options || {};

    const messages: ModelMessage[] = [{
      role: "system",
      content: `
You are the official spokesperson for ${leader} of ${civName} in Civilization V with the Vox Populi mod, answering oral questions from an audience.

# Situation
${jsonToMarkdown(SituationData)}

# Your Civilization
${jsonToMarkdown(YouAre)}`.trim()
    }];

    // If there is a briefing, use it
    if (state.reports["briefing"]) {
      messages.push({
        role: "user",
        content: `
# Strategies
Strategies: existing strategic decisions from the player.

${jsonToMarkdown(Strategy)}

# Briefings
${state.reports["briefing"]}

${hint}`.trim()
      });
    } else {
      messages.push({
        role: "user",
        content: `
# Victory Progress
Victory Progress: current progress towards each type of victory.

${jsonToMarkdown(state.victory)}

# Strategies
Strategies: existing strategic decisions from the player.

${jsonToMarkdown(Strategy)}

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
Events: events since the last decision-making.

${jsonToMarkdown(state.events)}

${hint}`.trim()});
    }

    return messages;
  }
}
