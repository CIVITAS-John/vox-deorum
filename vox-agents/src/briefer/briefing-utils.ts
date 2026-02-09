/**
 * @module briefer/briefing-utils
 *
 * Shared utilities for briefing assembly, report key management, and on-demand briefing retrieval.
 * Used by both strategist agents (for pre-turn briefings) and envoy agents (for on-demand briefings).
 */

import { z } from "zod";
import { Tool } from "ai";
import type { BriefingMode, SpecializedBrieferInput } from "./specialized-briefer.js";
import type { StrategistParameters, GameState } from "../strategist/strategy-parameters.js";
import { getGameState } from "../strategist/strategy-parameters.js";
import type { VoxContext } from "../infra/vox-context.js";
import { createSimpleTool } from "../utils/tools/simple-tools.js";

/**
 * Maps each briefing mode to its report storage key in GameState.reports
 */
export const briefingReportKeys: Record<BriefingMode, string> = {
  Military: "briefing-military",
  Economy: "briefing-economy",
  Diplomacy: "briefing-diplomacy"
};

/**
 * Retrieves briefings for the requested categories from a game state.
 * Returns cached briefings when available, generates missing ones via specialized-briefer agents in parallel.
 *
 * @param categories - The briefing categories to retrieve
 * @param state - The game state to check for existing briefings
 * @param context - VoxContext for calling briefer agents when briefings are missing
 * @param parameters - Agent parameters passed to the briefer agents
 * @returns Assembled briefing markdown string
 */
export async function requestBriefings(
  categories: BriefingMode[],
  state: GameState,
  context: VoxContext<StrategistParameters>,
  parameters: StrategistParameters
): Promise<string> {
  const sections: Array<{ title: string; content: string }> = [];
  const missing: BriefingMode[] = [];

  for (const category of categories) {
    const reportKey = briefingReportKeys[category];
    const existing = state.reports[reportKey] || state.reports["briefing"];
    if (existing) {
      sections.push({ title: `${category} Briefing`, content: existing });
    } else {
      missing.push(category);
    }
  }

  // Generate missing briefings in parallel
  if (missing.length > 0) {
    const results = await Promise.all(
      missing.map(mode =>
        context.callAgent<string>("specialized-briefer", {
          mode,
          instruction: ""
        } as SpecializedBrieferInput, parameters)
      )
    );

    for (let i = 0; i < missing.length; i++) {
      sections.push({
        title: `${missing[i]} Briefing`,
        content: results[i] ?? "(Briefing unavailable for this category)"
      });
    }
  }

  return assembleBriefings(sections);
}

/**
 * Assembles briefing content with optional instructions.
 * Can handle both single briefings and multiple briefing sections.
 *
 * @param briefings - Either a single briefing content string, or an array of briefing sections with titles
 * @param instruction - Optional instruction for single briefing mode
 * @returns Formatted briefing markdown
 */
/**
 * Creates the get-briefing internal tool for on-demand briefing retrieval.
 * Shared by LiveEnvoy and Analyst base classes.
 *
 * @param context - VoxContext for calling briefer agents when briefings are missing
 * @returns A Tool instance for the get-briefing tool
 */
export function createBriefingTool(context: VoxContext<StrategistParameters>): Tool {
  return createSimpleTool({
    name: "get-briefing",
    description: "Retrieve strategic briefings for one or more categories. Returns existing briefings or generates new ones if unavailable.",
    inputSchema: z.object({
      Categories: z.array(z.enum(['Military', 'Economy', 'Diplomacy']))
        .min(1)
        .describe("The briefing categories to retrieve")
    }),
    execute: async (input, parameters) => {
      const state = getGameState(parameters, parameters.turn);
      if (!state) {
        return "No game state available for briefing retrieval.";
      }
      return requestBriefings(input.Categories, state, context, parameters);
    }
  }, context);
}

export function assembleBriefings(
  briefings: string | Array<{ title: string; content: string; instruction?: string }>,
  instruction?: string
): string {
  // Single briefing mode (simple-strategist-briefed)
  if (typeof briefings === "string") {
    if (instruction) {
      return `Produced with your instruction: \n\n${instruction}\n\n${briefings}`;
    }
    return briefings;
  }

  // Multiple briefing sections mode (staffed strategist)
  return briefings
    .map((b) => {
      if (b.instruction) {
        return `## ${b.title}\n(Produced with your instruction: ${b.instruction})\n\n${b.content}`;
      }
      return `## ${b.title}\n${b.content}`;
    })
    .join("\n\n");
}
