/**
 * Tool for retrieving and updating player information from the game
 * Combines PlayerSummaries with static PlayerInformation
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { getPlayerSummaries } from "../../knowledge/getters/player-summary.js";
import { getPlayerInformations } from "../../knowledge/getters/player-information.js";
import { PlayerOpinions, PlayerSummary } from "../../knowledge/schema/timed.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { stripMutableKnowledgeMetadata } from "../../utils/knowledge/strip-metadata.js";
import { Selectable } from "kysely";
import { cleanEventData } from "./get-events.js";
import { getPlayerOpinions } from "../../knowledge/getters/player-opinions.js";

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
  TeamID: z.number(),
  Civilization: z.string(),
  Leader: z.string(),
  IsHuman: z.boolean(),
  IsMajor: z.boolean(),
  // Opinion fields
  OpinionFromMe: z.array(z.string()).optional(),
  OpinionToMe: z.array(z.string()).optional(),
  // PlayerSummary fields
  MajorAllyID: z.number().optional(),
  Cities: z.number().optional(),
  Population: z.number().optional(),
  Gold: z.number().optional(),
  GoldPerTurn: z.number().optional(),
  TourismPerTurn: z.number().optional(),
  Technologies: z.number().optional(),
  PolicyBranches: z.record(z.string(), z.number()).optional(),
  ResourcesAvailable: z.record(z.string(), z.number()).optional(),
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
  readonly description = "Retrieves a list of in-game players and their summary information";

  /**
   * Input schema for the tool
   */
  readonly inputSchema = GetPlayersInputSchema;

  /**
   * Output schema for the tool
   */
  readonly outputSchema = z.record(z.string(), z.union([PlayerDataSchema, z.string()]));

  /**
   * Optional annotations for the tool
   */
  readonly annotations: ToolAnnotations = {
    autoComplete: ["PlayerID"]
  }

  /**
   * Execute the tool to retrieve player data
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    // Get static player information and current player summaries in parallel
    const [playerInfos, playerSummaries, playerOpinions] = await Promise.all([
      getPlayerInformations(),
      getPlayerSummaries(),
      getPlayerOpinions(args.PlayerID)
    ]);
  
    // Combine the data and create dictionary
    const playersDict: Record<string, z.infer<typeof this.outputSchema>[string]> = {};
    
    for (const info of playerInfos) {
      const playerID = info.Key;
      const summary = playerSummaries.find(s => s.Key === playerID);
      
      // If a specific PlayerID is provided, check visibility
      if (args.PlayerID !== undefined && summary) {
        // Get the visibility field for the requesting player
        const visibilityField = `Player${args.PlayerID}` as keyof PlayerSummary;
        const visibility = (summary as any)[visibilityField];
        
        // If not met (visibility = 0), return unmet string
        if (visibility === 0) {
          playersDict[playerID.toString()] = info.IsMajor === 1 
            ? "Unmet Major Civilization" 
            : "Unmet Minor Civilization";
          continue;
        }
      }
      
      // Strip metadata and rename Key to PlayerID
      const cleanSummary = stripMutableKnowledgeMetadata<PlayerSummary>(summary!);
      
      const playerData: z.infer<typeof PlayerDataSchema> = {
        // Static information
        TeamID: info.TeamID,
        Civilization: info.Civilization,
        Leader: info.IsMajor ? info.Leader : "City State",
        IsHuman: info.IsHuman == 1,
        IsMajor: info.IsMajor == 1,
        // Dynamic summary (if available)
        ...postProcessSummary(cleanSummary, args.PlayerID === undefined || playerID === args.PlayerID),
      };

      if (playerOpinions) {
        playerData.OpinionFromMe = (playerOpinions[`OpinionFrom${info.Key}` as keyof PlayerOpinions] as string)?.split("\n");
        playerData.OpinionToMe = (playerOpinions[`OpinionTo${info.Key}` as keyof PlayerOpinions] as string)?.split("\n");
      }
      
      const checkedData = PlayerDataSchema.safeParse(playerData).data;
      playersDict[playerID.toString()] = cleanEventData(checkedData, false)!;
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

/**
 * Post process from a player's perspective.
 */
function postProcessSummary<T extends Partial<Selectable<PlayerSummary>>>(summary: T, isSelf: boolean): T {
  if (isSelf) return summary;
  if (summary.ResourcesAvailable) {
    // Remove resources with value 0 from other players' data
    summary.ResourcesAvailable = Object.fromEntries(
      Object.entries(summary.ResourcesAvailable).filter(([_, value]) => value !== 0)
    );
  }
  return summary;
}