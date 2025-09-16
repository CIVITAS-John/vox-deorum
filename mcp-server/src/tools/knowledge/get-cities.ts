/**
 * Tool for retrieving city information with visibility filtering
 * Gets cities from a player's perspective with optional owner filtering
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { getCityInformations, getCityBasicInfo } from "../../knowledge/getters/city-information.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { cleanEventData } from "./get-events.js";
import { CityInformation } from "../../knowledge/schema/timed.js";

/**
 * Input schema for the GetCities tool
 */
const GetCitiesInputSchema = z.object({
  PlayerID: z.number().min(0).max(MaxMajorCivs - 1).describe("Player ID from whose perspective to retrieve cities"),
  Owner: z.string().optional().describe("Optional filter to retrieve only cities owned by this leader/civilization name")
});

/**
 * Schema for city data returned by the tool
 */
const CityDataSchema = z.object({
  // Basic city information (always visible)
  Key: z.number().describe("City ID"),
  Owner: z.string().describe("Owner name (leader for major civs, civ name for minor civs)"),
  Name: z.string().describe("City name"),
  X: z.number().describe("X coordinate"),
  Y: z.number().describe("Y coordinate"),
  Population: z.number().describe("City population"),
  MajorityReligion: z.string().nullable().describe("Majority religion"),
  DefenseStrength: z.number().describe("Defense strength"),
  HitPoints: z.number().describe("Current hit points"),
  MaxHitPoints: z.number().describe("Maximum hit points"),
  IsPuppet: z.number().describe("Is puppet city (0/1)"),
  IsOccupied: z.number().describe("Is occupied (0/1)"),
  IsCoastal: z.number().describe("Is coastal city (0/1)"),

  // Detailed information (only visible to owner/team/spy)
  FoodStored: z.number().optional().describe("Current food stored"),
  FoodPerTurn: z.number().optional().describe("Food difference per turn"),
  ProductionStored: z.number().optional().describe("Current production stored"),
  ProductionPerTurn: z.number().optional().describe("Production per turn"),
  GoldPerTurn: z.number().optional().describe("Gold generated per turn"),
  SciencePerTurn: z.number().optional().describe("Science generated per turn"),
  CulturePerTurn: z.number().optional().describe("Culture generated per turn"),
  FaithPerTurn: z.number().optional().describe("Faith generated per turn"),
  TourismPerTurn: z.number().optional().describe("Tourism generated"),
  LocalHappiness: z.number().optional().describe("Local happiness"),
  RazingTurns: z.number().optional().describe("Turns until razed (0 if not razing)"),
  ResistanceTurns: z.number().optional().describe("Resistance turns remaining"),
  BuildingCount: z.number().optional().describe("Total number of buildings"),
  WonderCount: z.number().optional().describe("Number of wonders"),
  GreatWorkCount: z.number().optional().describe("Number of great works"),
  TradeRouteCount: z.number().optional().describe("Number of trade routes"),
  CurrentProduction: z.string().nullable().optional().describe("What is being produced"),
  ProductionTurnsLeft: z.number().optional().describe("Turns to complete production"),
});

/**
 * Tool for retrieving city information with visibility controls
 */
class GetCitiesTool extends ToolBase {
  /**
   * Unique identifier for the tool
   */
  readonly name = "get-cities";

  /**
   * Human-readable description of the tool
   */
  readonly description = "Retrieves city information from a player's perspective with optional owner filtering";

  /**
   * Input schema for the tool
   */
  readonly inputSchema = GetCitiesInputSchema;

  /**
   * Output schema for the tool
   */
  readonly outputSchema = z.record(z.string(), CityDataSchema);

  /**
   * Optional annotations for the tool
   */
  readonly annotations: ToolAnnotations = {
    autoComplete: ["PlayerID", "Owner"],
    markdownConfig: [
      { format: "City: {key}" }
    ]
  }

  /**
   * Execute the tool to retrieve city data
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const { PlayerID, Owner } = args;
    const cities = await getCityInformations();

    // Collect cities in an array first for sorting
    const cityList: Array<{ name: string; data: z.infer<typeof CityDataSchema> }> = [];

    for (const city of cities) {
      // Apply owner filter if specified
      if (Owner !== undefined && city.Owner !== Owner) {
        continue;
      }

      // Check visibility level based on ownership and team
      const visibility = city[`Player${PlayerID}` as keyof CityInformation];

      // Build city data object
      let cityData: any;

      if (visibility === 2) {
        // Full visibility - include all fields
        cityData = {
          // Basic information
          Key: city.Key,
          Owner: city.Owner,
          Name: city.Name,
          X: city.X,
          Y: city.Y,
          Population: city.Population,
          MajorityReligion: city.MajorityReligion,
          DefenseStrength: city.DefenseStrength,
          HitPoints: city.HitPoints,
          MaxHitPoints: city.MaxHitPoints,
          IsPuppet: city.IsPuppet,
          IsOccupied: city.IsOccupied,
          IsCoastal: city.IsCoastal,

          // Detailed information
          FoodStored: city.FoodStored,
          FoodPerTurn: city.FoodPerTurn,
          ProductionStored: city.ProductionStored,
          ProductionPerTurn: city.ProductionPerTurn,
          GoldPerTurn: city.GoldPerTurn,
          SciencePerTurn: city.SciencePerTurn,
          CulturePerTurn: city.CulturePerTurn,
          FaithPerTurn: city.FaithPerTurn,
          TourismPerTurn: city.TourismPerTurn,
          LocalHappiness: city.LocalHappiness,
          RazingTurns: city.RazingTurns,
          ResistanceTurns: city.ResistanceTurns,
          BuildingCount: city.BuildingCount,
          WonderCount: city.WonderCount,
          GreatWorkCount: city.GreatWorkCount,
          TradeRouteCount: city.TradeRouteCount,
          CurrentProduction: city.CurrentProduction,
          ProductionTurnsLeft: city.ProductionTurnsLeft,
        };
      } else if (visibility === 1) {
        // Basic visibility only - use getCityBasicInfo
        const basicInfo = getCityBasicInfo(city);
        cityData = {
          ...basicInfo
        };
      } else continue;

      // Clean and validate the data
      const validatedData = CityDataSchema.safeParse(cityData).data;
      const cleanedData = cleanEventData(validatedData, false);
      if (cleanedData) {
        cityList.push({
          name: city.Name,
          data: cleanedData as z.infer<typeof CityDataSchema>
        });
      }
    }

    // Sort cities by name alphabetically
    cityList.sort((a, b) => a.name.localeCompare(b.name));

    // Build the result dictionary with city names as keys
    const result: z.infer<typeof this.outputSchema> = {};
    for (const { name, data } of cityList) {
      result[name] = data;
    }

    return result;
  }
}

/**
 * Creates a new instance of the get cities tool
 */
export default function createGetCitiesTool() {
  return new GetCitiesTool();
}