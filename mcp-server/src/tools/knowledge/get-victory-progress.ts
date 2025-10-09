/**
 * Tool for retrieving victory progress information
 * Shows progress towards all victory types for all players
 * Filters player data based on diplomatic visibility
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { getVictoryProgress } from "../../knowledge/getters/victory-progress.js";
import { readPublicKnowledgeBatch } from "../../utils/knowledge/cached.js";
import { stripMutableKnowledgeMetadata } from "../../utils/knowledge/strip-metadata.js";
import { VictoryProgress, PlayerSummary } from "../../knowledge/schema/timed.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { getPlayerSummaries } from "../../knowledge/getters/player-summary.js";
import { getPlayerInformations } from "../../knowledge/getters/player-information.js";
import { getPlayerVisibility } from "../../utils/knowledge/visibility.js";
import { Selectable } from "kysely";
import { PlayerInformation } from "../../knowledge/schema/public.js";

/**
 * Input schema for the GetVictoryProgress tool
 */
const GetVictoryProgressInputSchema = z.object({
  PlayerID: z.number().min(0).max(MaxMajorCivs - 1).optional().describe("Optional player ID to filter victory progress based on diplomatic visibility")
});

/**
 * Output schema for the GetVictoryProgress tool
 */
const GetVictoryProgressOutputSchema = z.object({
  DominationVictory: z.any(),
  ScienceVictory: z.any(),
  CulturalVictory: z.any(),
  DiplomaticVictory: z.any(),
});

/**
 * Tool for retrieving victory progress information
 */
class GetVictoryProgressTool extends ToolBase {
  /**
   * Unique identifier for the tool
   */
  readonly name = "get-victory-progress";

  /**
   * Human-readable description of the tool
   */
  readonly description = "Retrieves progress towards all victory types for all players, filtered by diplomatic visibility";

  /**
   * Input schema for the tool
   */
  readonly inputSchema = GetVictoryProgressInputSchema;

  /**
   * Output schema for the tool
   */
  readonly outputSchema = GetVictoryProgressOutputSchema;

  /**
   * Optional annotations for the tool
   */
  readonly annotations: ToolAnnotations = {
    autoComplete: ["PlayerID"]
  }

  /**
   * Execute the tool to retrieve victory progress data
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    // Get victory progress data (single row with Key = 0) and player summaries for visibility
    const [victoryProgress, playerSummaries, playerInfos] = await Promise.all([
      getVictoryProgress(),
      args.PlayerID !== undefined ? getPlayerSummaries() : Promise.resolve([]),
      args.PlayerID !== undefined ? readPublicKnowledgeBatch("PlayerInformations", getPlayerInformations) : Promise.resolve([])
    ]);

    if (!victoryProgress) {
      throw new Error("No victory progress data available");
    }

    // Strip metadata (readPlayerKnowledge already strips it, but ensure clean data)
    const cleanProgress = victoryProgress as unknown as Omit<VictoryProgress, keyof typeof stripMutableKnowledgeMetadata>;

    // Parse and filter victory fields based on visibility
    const filterContext = args.PlayerID !== undefined && playerSummaries.length > 0 && playerInfos.length > 0
      ? { playerSummaries, playerInfos, viewingPlayerID: args.PlayerID }
      : undefined;

    return {
      DominationVictory: parseVictoryField(cleanProgress.DominationVictory, filterContext),
      ScienceVictory: parseVictoryField(cleanProgress.ScienceVictory, filterContext),
      CulturalVictory: parseVictoryField(cleanProgress.CulturalVictory, filterContext),
      DiplomaticVictory: parseVictoryField(cleanProgress.DiplomaticVictory, filterContext),
    };
  }
}

/**
 * Parse victory field and apply visibility filtering in one step
 * Parses JSON strings and filters out unmet players if visibility data is provided
 */
function parseVictoryField(
  field: string | object,
  filterContext?: {
    playerSummaries: Selectable<PlayerSummary>[];
    playerInfos: Selectable<PlayerInformation>[];
    viewingPlayerID: number;
  }
): string | object {
  // Parse JSON if it's a string
  let parsed: string | object = field;
  if (typeof field === "string") {
    try {
      parsed = JSON.parse(field);
    } catch {
      // Not JSON, return as-is (status string like "Not available")
      return field;
    }
  }

  // Apply visibility filtering if context provided
  if (filterContext && typeof parsed === "object") {
    return filterVictoryData(
      parsed,
      filterContext.playerSummaries,
      filterContext.playerInfos,
      filterContext.viewingPlayerID
    );
  }

  return parsed;
}

/**
 * Filter player-keyed victory data based on visibility
 */
function filterVictoryData<T extends Record<string, any>>(
  data: T,
  playerSummaries: Selectable<PlayerSummary>[],
  playerInfos: Selectable<PlayerInformation>[],
  viewingPlayerID: number
): T {
  const filtered = { ...data };

  // Iterate through all keys in the data
  for (const key in filtered) {
    // Find the player info by civilization/leader name
    const playerInfo = playerInfos.find(info =>
      info.Civilization === key
    );

    if (playerInfo) {
      // Check visibility
      const visibility = getPlayerVisibility(playerSummaries, viewingPlayerID, playerInfo.Key);
      // If not met (visibility = 0), remove this player's data
      if (visibility === 0) delete filtered[key];
    }
  }

  return filtered;
}

/**
 * Creates a new instance of the get victory progress tool
 */
export default function createGetVictoryProgressTool() {
  return new GetVictoryProgressTool();
}
