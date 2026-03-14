/**
 * @module utils/librarian-utils
 *
 * Utility functions for librarian agent operations.
 * Provides context extraction helpers for briefing research.
 */

import { getRecentGameState, StrategistParameters } from "../strategist/strategy-parameters.js";

/**
 * Extracts briefing contexts from strategist parameters for librarian research.
 * Returns array of context strings based on mode (simple vs specialized briefers).
 *
 * @param parameters - The strategist parameters containing working memory and game states
 * @param mode - 'simple' for SimpleBriefer (1 context) or 'specialized' for SpecializedBriefer (3 contexts)
 * @returns Array of context strings to send to librarian agent
 */
export function extractBriefingContexts(
  parameters: StrategistParameters,
  mode: "simple" | "specialized"
): string[] {
  const state = getRecentGameState(parameters);

  if (mode === "simple") {
    // For simple briefer: return instruction or previous briefing report
    const context =
      parameters.workingMemory["briefer-instruction"] ??
      state?.reports["briefing"] ??
      "";

    return [context];
  } else {
    // For specialized briefers: return 3 contexts (Military, Economy, Diplomacy)
    const militaryContext =
      parameters.workingMemory["briefer-instruction-military"] ??
      state?.reports["briefing-military"] ??
      "";

    const economyContext =
      parameters.workingMemory["briefer-instruction-economy"] ??
      state?.reports["briefing-economy"] ??
      "";

    const diplomacyContext =
      parameters.workingMemory["briefer-instruction-diplomacy"] ??
      state?.reports["briefing-diplomacy"] ??
      "";

    return [militaryContext, economyContext, diplomacyContext];
  }
}
