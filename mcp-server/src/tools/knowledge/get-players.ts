/**
 * Tool for retrieving and updating player information from the game
 * Combines PlayerSummaries with static PlayerInformation
 */

import { knowledgeManager } from "../../server.js";
import { ToolBase } from "../base.js";
import * as z from "zod";
import { getPlayerSummaries } from "../../knowledge/getters/player-summary.js";
import { getPlayerInformations } from "../../knowledge/getters/player-information.js";
import { stripMutableKnowledgeMetadata } from "../../knowledge/utils/strip-metadata.js";
import { PlayerSummary } from "../../knowledge/schema/timed.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * Input schema for the GetPlayers tool
 */
const GetPlayersInputSchema = z.object({
  PlayerID: z.number().min(0).max(MaxMajorCivs - 1).optional().describe("Optional player ID to filter for a specific player")
});

/**
 * Schema for combined player data output
 */
const PlayerDataSchema = z.object({
  // PlayerInformation fields
  PlayerID: z.number(),
  TeamID: z.number(),
  Civilization: z.string(),
  Leader: z.string(),
  IsHuman: z.number(),
  IsMajor: z.number(),
  // PlayerSummary fields
  MajorAllyID: z.number().optional(),
  Cities: z.number().optional(),
  Population: z.number().optional(),
  Gold: z.number().optional(),
  GoldPerTurn: z.number().optional(),
  TourismPerTurn: z.number().optional(),
  Technologies: z.number().optional(),
  PolicyBranches: z.record(z.string(), z.number()).optional(),
  CreatedReligion: z.string().nullable().optional(),
  MajorityReligion: z.string().nullable().optional()
});

/**
 * Tool for retrieving player information and summaries
 */
class GetPlayersTool extends ToolBase {
  /**
   * Unique identifier for the tool
   */
  readonly name = "get-players";

  /**
   * Human-readable description of the tool
   */
  readonly description = "Retrieves player information and summaries, combining static data with current game state";

  /**
   * Input schema for the tool
   */
  readonly inputSchema = GetPlayersInputSchema;

  /**
   * Output schema for the tool
   */
  readonly outputSchema = z.record(z.string(), PlayerDataSchema);

  /**
   * Optional annotations for the tool
   */
  readonly annotations: ToolAnnotations = {
    autoComplete: ["PlayerID"]
  }

  /**
   * Save PlayerSummaries to the database using KnowledgeStore
   */
  private async savePlayerSummaries(summaries: Partial<PlayerSummary>[]): Promise<void> {
    const store = knowledgeManager.getStore();
    
    // For each summary, save using the store's mutable knowledge method
    for (const summary of summaries) {
      if (!('Key' in summary) || summary.Key === undefined) continue;
      
      const playerID = summary.Key;
      
      // Set visibility - player can see their own data
      const visibilityFlags = [playerID];
      
      // Save using the store's method which handles versioning and change detection
      await store.storeMutableKnowledge(
        'PlayerSummaries',
        playerID,
        summary as any,
        visibilityFlags
      );
    }
  }

  /**
   * Execute the tool to retrieve player data
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    // Get static player information
    const playerInfos = await getPlayerInformations();
    
    // Get current player summaries
    const playerSummaries = await getPlayerSummaries();
    try {
      await this.savePlayerSummaries(playerSummaries);
    } catch (error) {
      console.error("Failed to save player summaries to database:", error);
    }
  
    // Combine the data and create dictionary
    const playersDict: Record<string, z.infer<typeof PlayerDataSchema>> = {};
    
    for (const info of playerInfos) {
      const playerID = info.Key;
      const summary = playerSummaries.find(s => s.Key === playerID);
      
      // Strip metadata and rename Key to PlayerID
      const cleanSummary = stripMutableKnowledgeMetadata(summary as PlayerSummary);
      
      const playerData: z.infer<typeof PlayerDataSchema> = {
        // Static information
        PlayerID: playerID,
        TeamID: info.TeamID,
        Civilization: info.Civilization,
        Leader: info.Leader,
        IsHuman: info.IsHuman,
        IsMajor: info.IsMajor,
        // Dynamic summary (if available)
        ...cleanSummary,
        PolicyBranches: cleanSummary.PolicyBranches.__select__
      };
      
      // Add to dictionary if not filtered or matches filter
      if (args.PlayerID === undefined || playerID === args.PlayerID) {
        playersDict[playerID.toString()] = playerData;
      }
    }
    
    return playersDict;
  }
}

/**
 * Creates a new instance of the get players tool
 */
export default function createGetPlayersTool() {
  return new GetPlayersTool();
}