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
    readOnlyHint: true
  }

  /**
   * Optional metadata for the tool
   */
  readonly metadata = {
    autoComplete: ["PlayerID"],
    markdownConfig: ["{key}"]
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
      "Unit Stats": report.units || []
    };
    for (var zoneID in report.zones) {
      // Postprocessing zones
      const zone = report.zones[zoneID];
      const neighbors = zone.Neighbors && Array.isArray(zone.Neighbors) ? 
        (zone.Neighbors as any[]).filter((n: number) => report.zones.hasOwnProperty(String(n))) : [];
      const postprocessed = {
        ZoneValue: zone.Value,
        Dominance: zone.Dominance === "No Units" ? undefined : zone.Dominance,
        Posture:
          zone.FriendlyStrength > 0 &&
          zone.EnemyStrength > 0 ? zone.Posture : undefined,
        EnemyStrength: zone.EnemyStrength > 0 ? Math.round(zone.EnemyStrength / 100) : undefined,
        NeutralStrength: zone.NeutralStrength > 0 ? Math.round(zone.NeutralStrength / 100) : undefined,
        FriendlyStrength: zone.FriendlyStrength > 0 ? Math.round(zone.FriendlyStrength / 100) : undefined,
        City: zone.City,
        AreaID: zone.AreaID,
        Plots: zone.Plots,
        CenterX: zone.CenterX,
        CenterY: zone.CenterY,
        Units: zone.Units,
        Neighbors: neighbors.length > 0 ? neighbors : undefined,
      }
      if (zoneID === "0")
        results["Zone Unassigned"] = {
          Units: postprocessed.Units
        };
      else
        results[`${zone.Territory} ${zone.Domain} Zone ${zoneID}`] = postprocessed;
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
