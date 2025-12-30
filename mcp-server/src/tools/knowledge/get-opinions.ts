/**
 * Tool for retrieving diplomatic opinions between players with static player information
 * Gets opinions both TO and FROM a specific player with all other alive major civilizations
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { getPlayerOpinions } from "../../knowledge/getters/player-opinions.js";
import { getPlayerInformations } from "../../knowledge/getters/player-information.js";
import { getPlayerSummaries } from "../../knowledge/getters/player-summary.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { PlayerOpinions, PlayerSummary } from "../../knowledge/schema/timed.js";
import { stripTags } from "../../utils/database/localized.js";
import { cleanEventData } from "./get-events.js";

/**
 * Input schema for the GetOpinions tool
 */
const GetOpinionsInputSchema = z.object({
  PlayerID: z.number().min(0).max(MaxMajorCivs - 1).describe("Player ID whose opinions to retrieve"),
  RevealAll: z.boolean().optional().describe("Optional flag to reveal all players regardless of met status (default: false)")
});

/**
 * Schema for opinion data with player information
 */
const OpinionDataSchema = z.object({
  // Static player information fields
  TeamID: z.number(),
  Civilization: z.string(),
  Leader: z.string(),
  IsMajor: z.boolean(),
  // Opinion fields
  OpinionFromMe: z.array(z.string()).describe("Opinion from the requesting player TO the target player").optional(),
  OpinionToMe: z.array(z.string()).describe("Opinion FROM the target player to the requesting player").optional(),
  MyEvaluations: z.array(z.string()).describe("My evaluation of other players").optional(),
});

/**
 * Tool for retrieving diplomatic opinions between players
 */
class GetOpinionsTool extends ToolBase {
  /**
   * Unique identifier for the tool
   */
  readonly name = "get-opinions";

  /**
   * Human-readable description of the tool
   */
  readonly description = "Retrieves diplomatic opinions TO and FROM a player with all other alive major civilizations along with their static player information";

  /**
   * Input schema for the tool
   */
  readonly inputSchema = GetOpinionsInputSchema;

  /**
   * Output schema for the tool
   */
  readonly outputSchema = z.record(z.string(), z.union([OpinionDataSchema, z.string()]));

  /**
   * Optional annotations for the tool
   */
  readonly annotations: ToolAnnotations = {
    readOnlyHint: true
  }

  /**
   * Optional metadata for the tool
   */
  readonly metadata = {
    autoComplete: ["PlayerID", "RevealAll"],
    markdownConfig: ["{key}"]
  }

  /**
   * Execute the tool to retrieve opinion data with player information
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const { PlayerID, RevealAll = false } = args;
    
    // Get all player information, summaries, and opinions in parallel
    const [playerInfos, playerSummaries, playerOpinions] = await Promise.all([
      getPlayerInformations(),
      getPlayerSummaries(),
      getPlayerOpinions(PlayerID, false)
    ]);
    
    if (!playerOpinions) {
      return {};
    }
    
    // Build the result dictionary
    const opinionsDict: Record<string, z.infer<typeof this.outputSchema>[string]> = {};
    
    // Iterate through all players to extract opinions
    for (const info of playerInfos) {
      const targetPlayerID = info.Key;
      
      // Skip non-major civs and non-alive players
      if (info.IsMajor !== 1) continue;
      
      // Check if the player has been met (unless RevealAll is true)
      if (!RevealAll) {
        const summary = playerSummaries.find(s => s.Key === targetPlayerID);
        if (summary) {
          // Get the visibility field for the requesting player
          const visibilityField = `Player${PlayerID}` as keyof PlayerSummary;
          const visibility = (summary as any)[visibilityField];
          
          // If not met (visibility = 0), return unmet string
          if (visibility === 0) {
            opinionsDict[targetPlayerID.toString()] = "Unmet Major Civilization";
            continue;
          }
        }
      }
      
      // Extract opinions from the PlayerOpinions object
      const fromOpinion = playerOpinions[`OpinionFrom${targetPlayerID}` as keyof(PlayerOpinions)] as string;
      const toOpinion = playerOpinions[`OpinionTo${targetPlayerID}` as keyof(PlayerOpinions)] as string;
      
      // Only add if we have valid opinions
      if (toOpinion || fromOpinion) {
        const playerData: z.infer<typeof OpinionDataSchema> = {
          // Include static player information
          TeamID: info.TeamID,
          Civilization: info.Civilization,
          Leader: info.Leader,
          IsMajor: info.IsMajor === 1,
          // Opinion data
          OpinionFromMe: stripTags(toOpinion)?.split("\n"),
          OpinionToMe: targetPlayerID === args.PlayerID ? undefined : stripTags(fromOpinion)?.split("\n"),
          MyEvaluations: targetPlayerID !== args.PlayerID ? undefined : stripTags(fromOpinion)?.split("\n")
        };
        
        const checkedData = OpinionDataSchema.safeParse(playerData).data;
        opinionsDict[targetPlayerID.toString()] = cleanEventData(checkedData, false)!;
      }
    }
    
    return opinionsDict;
  }
}

/**
 * Creates a new instance of the get opinions tool
 */
export default function createGetOpinionsTool() {
  return new GetOpinionsTool();
}