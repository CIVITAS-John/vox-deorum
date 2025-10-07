/**
 * Tool for retrieving military report for a player
 * Gets units organized by AI type and tactical zones with unit assignments
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { getMilitaryReport } from "../../knowledge/getters/military-report.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { enumMappings } from "../../utils/knowledge/enum.js";
import { createLogger } from "../../utils/logger.js";

const logger = createLogger("get-military-report");

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

    // Get military report for the player
    const report = await getMilitaryReport(PlayerID, true);
    if (!report) return {};

    // Get enum mappings
    const unitTypes = enumMappings["UnitType"];
    const aiTypes = enumMappings["AIType"];
    if (!unitTypes) logger.warn("UnitType enum does not exist!");
    if (!aiTypes) logger.warn("AIType enum does not exist!");

    // Convert numeric AI types and unit types to their string representations
    if (report.units) {
      const convertedUnits: Record<string, any> = {};

      for (const [aiTypeNum, unitsByType] of Object.entries(report.units)) {
        // Convert AI type enum to string
        const aiType = aiTypes?.[Number(aiTypeNum)] ?? `Unknown_${aiTypeNum}`;
        convertedUnits[aiType] = {};

        // Convert unit type IDs to their string representations
        for (const [unitTypeNum, unitData] of Object.entries(unitsByType as Record<string, any>)) {
          const unitType = unitTypes?.[Number(unitTypeNum)] ?? `Unknown_${unitTypeNum}`;
          convertedUnits[aiType][unitType] = unitData;
        }
      }

      report.units = convertedUnits;
    }

    // Convert unit types in zones
    if (report.zones) {
      for (const zone of Object.values(report.zones as Record<string, any>)) {
        if (zone.Units) {
          for (const civName in zone.Units) {
            const convertedUnits: Record<string, number> = {};
            for (const [unitTypeNum, count] of Object.entries(zone.Units[civName] as Record<string, number>)) {
              const unitType = unitTypes?.[Number(unitTypeNum)] ?? `Unknown_${unitTypeNum}`;
              convertedUnits[unitType] = count;
            }
            zone.Units[civName] = convertedUnits;
          }
        }
      }
    }

    // Construct the report for LLM consumption
    const results: Record<string, any> = {
      Units: report.units || []
    };
    for (var zoneID in report.zones) {
      // Postprocessing zones
      const zone = report.zones[zoneID];
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
        Neighbors: zone.Neighbors.filter((n: number) => report.zones.hasOwnProperty(String(n))),
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
