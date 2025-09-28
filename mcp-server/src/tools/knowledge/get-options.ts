/**
 * Tool for retrieving player strategic options from the game
 * Returns available technologies, policies, and strategies for a specific player
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { getPlayerOptions } from "../../knowledge/getters/player-options.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { stripTimedKnowledgeMetadata } from "../../utils/knowledge/strip-metadata.js";
import { PlayerOptions } from "../../knowledge/schema/timed.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * Input schema for the GetOptions tool
 */
const GetOptionsInputSchema = z.object({
  PlayerID: z.number().min(0).max(MaxMajorCivs - 1).describe("Player ID to retrieve strategic options for")
});

/**
 * Output schema for the GetOptions tool
 */
const GetOptionsOutputSchema = z.object({
  PlayerID: z.number(),
  EconomicStrategies: z.array(z.string()),
  MilitaryStrategies: z.array(z.string()),
  Technologies: z.array(z.string()),
  Policies: z.array(z.string()),
  PolicyBranches: z.array(z.string())
}).passthrough();

/**
 * Tool for retrieving player strategic options
 */
class GetOptionsTool extends ToolBase {
  /**
   * Unique identifier for the tool
   */
  readonly name = "get-options";

  /**
   * Human-readable description of the tool
   */
  readonly description = "Retrieves available strategic options (technologies, policies, strategies) for a specific player";

  /**
   * Input schema for the tool
   */
  readonly inputSchema = GetOptionsInputSchema;

  /**
   * Output schema for the tool
   */
  readonly outputSchema = GetOptionsOutputSchema;

  /**
   * Optional annotations for the tool
   */
  readonly annotations: ToolAnnotations = {
    autoComplete: ["PlayerID"]
  }

  /**
   * Execute the tool to retrieve player options
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    // Get all player options
    const allOptions = await getPlayerOptions(true);

    // Find options for the requested player
    const playerOptions = allOptions.find(options => options.Key === args.PlayerID);

    if (!playerOptions) {
      throw new Error(`No options found for player ${args.PlayerID}. Player may not be alive or does not exist.`);
    }

    // Strip metadata and return the options
    const cleanOptions = stripTimedKnowledgeMetadata<PlayerOptions>(playerOptions as any);

    return {
      PlayerID: args.PlayerID,
      EconomicStrategies: cleanOptions.EconomicStrategies,
      MilitaryStrategies: cleanOptions.MilitaryStrategies,
      Technologies: cleanOptions.Technologies,
      Policies: cleanOptions.Policies,
      PolicyBranches: cleanOptions.PolicyBranches
    };
  }
}

/**
 * Creates a new instance of the get options tool
 */
export default function createGetOptionsTool() {
  return new GetOptionsTool();
}