/**
 * Tool for retrieving diplomatic opinions between players
 * Gets opinions both TO and FROM a specific player with all other alive major civilizations
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { getPlayerOpinions } from "../../knowledge/getters/player-opinions.js";
import { getPlayerInformations } from "../../knowledge/getters/player-information.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { PlayerOpinions } from "../../knowledge/schema/timed.js";
import { stripTags } from "../../utils/database/localized.js";

/**
 * Input schema for the GetOpinions tool
 */
const GetOpinionsInputSchema = z.object({
  PlayerID: z.number().min(0).max(MaxMajorCivs - 1).describe("Player ID whose opinions to retrieve")
});

/**
 * Schema for opinion data between two players
 */
const OpinionDataSchema = z.object({
  myOpinion: z.array(z.string()).describe("Opinion from the requesting player TO the target player"),
  theirOpinion: z.array(z.string()).describe("Opinion FROM the target player to the requesting player")
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
  readonly description = "Retrieves diplomatic opinions TO and FROM a player with all other alive major civilizations";

  /**
   * Input schema for the tool
   */
  readonly inputSchema = GetOpinionsInputSchema;

  /**
   * Output schema for the tool
   */
  readonly outputSchema = z.record(z.string(), OpinionDataSchema);

  /**
   * Optional annotations for the tool
   */
  readonly annotations: ToolAnnotations = {
    autoComplete: ["PlayerID"]
  }

  /**
   * Execute the tool to retrieve opinion data
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const { PlayerID } = args;
    
    // Get all player information to check who is alive
    const playerInfos = await getPlayerInformations();
    
    // Get all opinions for the requesting player (both TO and FROM all others)
    const playerOpinions = await getPlayerOpinions(PlayerID, false);
    
    if (!playerOpinions) {
      return {};
    }
    
    // Build the result dictionary
    const opinionsDict: Record<string, z.infer<typeof OpinionDataSchema>> = {};
    
    // Iterate through all players to extract opinions
    for (const info of playerInfos) {
      const targetPlayerID = info.Key;
      
      // Skip self, non-major civs, and non-alive players
      if (targetPlayerID === PlayerID || info.IsMajor !== 1) {
        continue;
      }
      
      // Extract opinions from the PlayerOpinions object
      const toOpinion = playerOpinions[`OpinionTo${targetPlayerID}` as keyof(PlayerOpinions)] as string;
      const fromOpinion = playerOpinions[`OpinionFrom${targetPlayerID}` as keyof(PlayerOpinions)] as string;
      
      // Only add if we have valid opinions
      if (toOpinion || fromOpinion) {
        opinionsDict[targetPlayerID.toString()] = {
          myOpinion: stripTags(toOpinion || "Unknown").split("\n"),
          theirOpinion: stripTags(fromOpinion || "Unknown").split("\n")
        };
      }
    }
    
    return this.outputSchema.safeParse(opinionsDict).data!;
  }
}

/**
 * Creates a new instance of the get opinions tool
 */
export default function createGetOpinionsTool() {
  return new GetOpinionsTool();
}