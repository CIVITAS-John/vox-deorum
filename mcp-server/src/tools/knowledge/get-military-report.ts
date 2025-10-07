/**
 * Tool for retrieving military report for a player
 * Gets units organized by AI type and tactical zones with unit assignments
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { getMilitaryReport } from "../../knowledge/getters/military-report.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * Input schema for the GetMilitaryReport tool
 */
const GetMilitaryReportInputSchema = z.object({
  PlayerID: z.number().min(0).max(MaxMajorCivs - 1).describe("Player ID whose military report to retrieve")
});

/**
 * Tool for retrieving military report
 */
class GetMilitaryReportTool extends ToolBase {
  /**
   * Unique identifier for the tool
   */
  readonly name = "get-military-report";

  /**
   * Human-readable description of the tool
   */
  readonly description = "Retrieves military report for a player including units organized by AI type and tactical zones with unit assignments";

  /**
   * Input schema for the tool
   */
  readonly inputSchema = GetMilitaryReportInputSchema;

  /**
   * Output schema for the tool
   */
  readonly outputSchema = z.record(z.string(), z.any());

  /**
   * Optional annotations for the tool
   */
  readonly annotations: ToolAnnotations = {
    autoComplete: ["PlayerID"],
    markdownConfig: [
      { format: "{key}" }
    ]
  }

  /**
   * Execute the tool to retrieve military report
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const { PlayerID } = args;

    // Get military report for the player (already post-processed)
    const report = await getMilitaryReport(PlayerID, true);
    if (!report) return {};

    // Construct the report for LLM consumption
    const results: Record<string, any> = {
      Units: report.units || []
    };
    for (var zoneID in report.zones) {
      // Postprocessing zones
      const zone = report.zones[zoneID];
      const neighbors = zone.Neighbors && Array.isArray(zone.Neighbors) ? 
        (zone.Neighbors as any[]).filter((n: number) => report.zones.hasOwnProperty(String(n))) : [];
      const postprocessed = {
        Domain: zone.Domain,
        ZoneValue: zone.Value,
        Territory: zone.Territory,
        Dominance: zone.Dominance == "No Units" ? zone.Dominance : undefined,
        Posture:
          zone.FriendlyStrength > 0 &&
          zone.EnemyStrength > 0 ? zone.Posture : undefined,
        EnemyStrength: zone.EnemyStrength > 0 ? zone.EnemyStrength : undefined,
        NeutralStrength: zone.NeutralStrength > 0 ? zone.NeutralStrength : undefined,
        FriendlyStrength: zone.FriendlyStrength > 0 ? zone.FriendlyStrength : undefined,
        City: zone.City,
        AreaID: zone.AreaID,
        Plots: zone.Plots,
        CenterX: zone.CenterX,
        CenterY: zone.CenterY,
        Units: zone.Units,
        Neighbors: neighbors.length > 0 ? neighbors : undefined,
      }
      if (zoneID === "0")
        results["Zone Unassigned"] = postprocessed;
      else
        results[`Zone ${zoneID}`] = postprocessed;
    }

    // Return the compiled report
    return results;
  }
}

/**
 * Creates a new instance of the get military report tool
 */
export default function createGetMilitaryReportTool() {
  return new GetMilitaryReportTool();
}
