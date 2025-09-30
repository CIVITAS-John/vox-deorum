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
import { readPlayerKnowledge, readPublicKnowledgeBatch } from "../../utils/knowledge/cached.js";
import { PlayerInformation } from "../../knowledge/schema/public.js";

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
  MyEvaluations: z.array(z.string()).optional(),
  // PlayerSummary fields
  Score: z.number().optional(),
  Era: z.string().optional(),
  Technologies: z.number().optional(),
  CurrentResearch: z.string().nullable().optional(),
  MajorAlly: z.string().nullable().optional(),
  Cities: z.number().optional(),
  Population: z.number().optional(),
  Territory: z.number().optional(),
  Gold: z.number().optional(),
  GoldPerTurn: z.number().optional(),
  HappinessSituation: z.string().optional(),
  HappinessPercentage: z.number().optional(),
  TourismPerTurn: z.number().optional(),
  PolicyBranches: z.union([z.record(z.string(), z.array(z.string())), z.record(z.string(), z.number())]).optional(),
  ResourcesAvailable: z.record(z.string(), z.number()).optional(),
  FoundedReligion: z.string().nullable().optional(),
  MajorityReligion: z.string().nullable().optional(),
  Relationships: z.record(z.string(), z.array(z.string())).optional(),
}).passthrough();

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
    autoComplete: ["PlayerID"],
    markdownConfig: [
      { format: "Player {key}" }
    ]
  }

  /**
   * Execute the tool to retrieve player data
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    // Get static player information, current player summaries, opinions, and strategies in parallel
    const [playerInfos, playerSummaries, playerOpinions] = await Promise.all([
      readPublicKnowledgeBatch("PlayerInformations", getPlayerInformations),
      getPlayerSummaries(),
      readPlayerKnowledge(args.PlayerID, "PlayerOpinions", getPlayerOpinions)
    ]);

    // Combine the data and create dictionary
    const playersDict: Record<string, z.infer<typeof this.outputSchema>[string]> = {};
    
    for (const info of playerInfos) {
      const playerID = info.Key;
      const summary = playerSummaries.find(s => s.Key === playerID);
      // Ignore dead players
      if (playerSummaries.length > 0 && !summary) continue;
      
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
        ...postProcessSummary(info, cleanSummary, 
            !summary || args.PlayerID === undefined || playerID === args.PlayerID ? 2 : (summary[`Player${args.PlayerID}` as keyof PlayerSummary] as number)),
      } as any;

      // Text format for happiness
      if (playerData.HappinessPercentage !== undefined) {
        if (playerData.HappinessPercentage <= 20)
          playerData.HappinessSituation = "Super unhappy - severe combat penalty, rebellion and uprising coming fast"
        else if (playerData.HappinessPercentage <= 35)
          playerData.HappinessSituation = "Very unhappy - severe combat penalty, rebellion and uprising coming"
        else if (playerData.HappinessPercentage <= 50)
          playerData.HappinessSituation = "Unhappy - combat penalty"
        else playerData.HappinessSituation = "Happy"
      }

      // Load player options
      if (playerOpinions) {
        if (playerID === args.PlayerID) {
          playerData.MyEvaluations = (playerOpinions[`OpinionFrom${info.Key}` as keyof PlayerOpinions] as string)?.split("\n");
        } else {
          playerData.OpinionFromMe = (playerOpinions[`OpinionTo${info.Key}` as keyof PlayerOpinions] as string)?.split("\n");
          playerData.OpinionToMe = (playerOpinions[`OpinionFrom${info.Key}` as keyof PlayerOpinions] as string)?.split("\n");
        }
      }

      playersDict[playerID.toString()] = cleanEventData(playerData, false)!;
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
 * Post process from a player's perspective based on visibility.
 */
function postProcessSummary<T extends Partial<Selectable<PlayerSummary>>>
  (info: PlayerInformation, summary: T, visibility: number): T {
  // If it's the player's own data, return everything
  if (visibility == 2) return summary;

  // For met players (visibility 1): only show policy branch counts, not details
  if (summary.PolicyBranches) {
    const branches = summary.PolicyBranches as Record<string, string[]>;
    const counts: Record<string, number> = {};
    for (const [branch, policies] of Object.entries(branches)) {
      counts[branch] = Array.isArray(policies) ? policies.length : policies as number;
    }
    summary.PolicyBranches = counts as any;
  }

  // Hide current research from non-team members
  delete summary.CurrentResearch;

  // Hide actual happiness number
  delete summary.HappinessPercentage;

  // Hide war weariness from relationships
  if (summary.Relationships) 
    for (var player in summary.Relationships) {
      summary.Relationships[player] = summary.Relationships[player].map(rel => {
        // Remove war weariness from war relationships (keep only the score)
        const warRegex = /; War Weariness: -?[\d\.]+%/;
        return rel.replace(warRegex, "");
      });
    } 

  // Remove resources with value 0 from other players' data
  if (summary.ResourcesAvailable) {
    summary.ResourcesAvailable = Object.fromEntries(
      Object.entries(summary.ResourcesAvailable).filter(([_, value]) => value !== 0)
    );
  }

  // Remove info from minor civs
  if (!info.IsMajor) {
    delete summary.Era;
    delete summary.Cities;
    delete summary.Gold;
    delete summary.GoldPerTurn;
    delete summary.Score;
  }
  return summary;
}