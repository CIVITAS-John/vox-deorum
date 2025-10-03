/**
 * Tool for retrieving city information with visibility filtering
 * Gets cities from a player's perspective with optional owner filtering
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { getCityInformations } from "../../knowledge/getters/city-information.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { cleanEventData } from "./get-events.js";
import { CityInformation } from "../../knowledge/schema/timed.js";

/**
 * Input schema for the GetCities tool
 */
const GetCitiesInputSchema = z.object({
  PlayerID: z.number().min(0).max(MaxMajorCivs - 1).optional().describe("Player ID from whose perspective to retrieve cities"),
  Owner: z.string().optional().describe("Optional filter to retrieve only cities owned by this leader/civilization name")
});

/**
 * Schema for city data returned by the tool
 */
const CityDataSchema = z.object({
  // Basic city information (always visible)
  ID: z.number().describe("City ID"),
  X: z.number().describe("X coordinate"),
  Y: z.number().describe("Y coordinate"),
  Population: z.number().describe("City population"),
  MajorityReligion: z.string().nullable().describe("Majority religion"),
  DefenseStrength: z.number().describe("Defense strength"),
  Health: z.string().optional().describe("Remaining hit point %"),
  IsPuppet: z.boolean().optional().describe("Is puppet city"),
  IsOccupied: z.boolean().optional().describe("Is occupied"),
  IsCoastal: z.boolean().optional().describe("Is coastal city"),

  // Detailed information (only visible to owner/team/spy)
  FoodStored: z.number().optional().describe("Current food stored"),
  FoodPerTurn: z.number().optional().describe("Food difference per turn"),
  ProductionStored: z.number().optional().describe("Current production stored"),
  ProductionPerTurn: z.number().optional().describe("Production per turn"),
  CurrentProduction: z.string().nullable().optional().describe("What is being produced"),
  ProductionTurnsLeft: z.number().optional().describe("Turns to complete production"),
  GoldPerTurn: z.number().optional().describe("Gold generated per turn"),
  SciencePerTurn: z.number().optional().describe("Science generated per turn"),
  CulturePerTurn: z.number().optional().describe("Culture generated per turn"),
  FaithPerTurn: z.number().optional().describe("Faith generated per turn"),
  TourismPerTurn: z.number().optional().describe("Tourism generated"),
  HappinessDelta: z.number().optional().describe("Happiness contribution"),
  RazingTurns: z.number().optional().describe("Turns until razed (0 if not razing)"),
  ResistanceTurns: z.number().optional().describe("Resistance turns remaining"),
  BuildingCount: z.number().optional().describe("Total number of buildings"),
  WonderCount: z.number().optional().describe("Number of wonders"),
  GreatWorkCount: z.number().optional().describe("Number of great works"),
  TradeRouteCount: z.number().optional().describe("Number of trade routes"),
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
  readonly outputSchema = z.record(z.string(), z.record(z.string(), CityDataSchema));

  /**
   * Optional annotations for the tool
   */
  readonly annotations: ToolAnnotations = {
    autoComplete: ["PlayerID", "Owner"],
    markdownConfig: [
      { format: "Player: {key}" }
    ]
  }

  /**
   * Execute the tool to retrieve city data
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const { PlayerID, Owner } = args;
    const cities = await getCityInformations();

    // Group cities by owner
    const citiesByOwner: Record<string, Record<string, z.infer<typeof CityDataSchema>>> = {};

    for (const city of cities) {
      // Apply owner filter if specified
      if (Owner !== undefined && city.Owner !== Owner) {
        continue;
      }

      // Check visibility level based on ownership and team
      const visibility = 
        args.PlayerID !== undefined ? city[`Player${PlayerID}` as keyof CityInformation] : 2;

      // Build city data object
      let cityData: any;

      if (visibility === 0) continue;
      if (visibility === 1 || visibility === 2) {
        // Basic visibility only
        cityData = {
          ID: city.Key,
          X: city.X,
          Y: city.Y,
          Population: city.Population,
          MajorityReligion: city.MajorityReligion,
          DefenseStrength: city.DefenseStrength,
          Health: city.HitPoints === city.MaxHitPoints ? undefined : 
            Math.round(city.HitPoints / city.MaxHitPoints * 100) + "%",
          IsPuppet: city.IsPuppet === 1,
          IsOccupied: city.IsOccupied === 1,
          IsCoastal: city.IsCoastal === 1,
        };
      }
      if (visibility === 2) {
        // Full visibility - include all fields
        cityData = {
          ...cityData,
          FoodStored: city.FoodStored,
          FoodPerTurn: city.FoodPerTurn,
          ProductionStored: city.ProductionStored,
          ProductionPerTurn: city.ProductionPerTurn,
          CurrentProduction: city.CurrentProduction,
          ProductionTurnsLeft: city.ProductionTurnsLeft,
          GoldPerTurn: city.GoldPerTurn,
          SciencePerTurn: city.SciencePerTurn,
          CulturePerTurn: city.CulturePerTurn,
          FaithPerTurn: city.FaithPerTurn,
          TourismPerTurn: city.TourismPerTurn,
          HappinessDelta: city.HappinessDelta,
          RazingTurns: city.RazingTurns === 0 ? -1 : city.RazingTurns,
          ResistanceTurns: city.ResistanceTurns === 0 ? -1 : city.ResistanceTurns,
          BuildingCount: city.BuildingCount,
          WonderCount: city.WonderCount,
          GreatWorkCount: city.GreatWorkCount,
          TradeRouteCount: city.TradeRouteCount,
        };
      }

      // Clean and validate the data
      const cleanedData = cleanEventData(cityData, false);
      // Initialize owner object if needed
      if (!citiesByOwner[city.Owner])
        citiesByOwner[city.Owner] = {};
      citiesByOwner[city.Owner][city.Name] = cleanedData as z.infer<typeof CityDataSchema>;
    }

    return citiesByOwner;
  }
}

/**
 * Creates a new instance of the get cities tool
 */
export default function createGetCitiesTool() {
  return new GetCitiesTool();
}