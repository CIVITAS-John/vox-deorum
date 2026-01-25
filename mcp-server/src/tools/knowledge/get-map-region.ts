/**
 * Tool for retrieving map region data for AI accessibility
 * Provides spatial awareness that sighted players get from looking at the map
 *
 * Related: Issue #469 - AI Accessibility in Games
 *
 * Kali ❤️‍🔥 [Visionary]: This is what lets AI "see" the map
 * Athena 🦉 [Reviewer]: Exposes terrain, features, resources, improvements
 * Nemesis 💀 [Accessibility]: Parity with sighted player experience
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { getMapRegion, generateSpatialNotes, TileData } from "../../knowledge/getters/map-region.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

/**
 * Input schema for the GetMapRegion tool
 */
const GetMapRegionInputSchema = z.object({
  // Center point + radius query
  CenterX: z.number().describe("X coordinate of region center"),
  CenterY: z.number().describe("Y coordinate of region center"),
  Radius: z.number().min(1).max(10).default(5).describe("Radius in tiles (1-10, default 5)"),

  // Player perspective
  PlayerID: z.number().min(0).max(MaxMajorCivs - 1).optional()
    .describe("Player ID for visibility filtering (default: active player)"),

  // Options
  IncludeUnits: z.boolean().default(true).describe("Include unit information on tiles"),
  IncludeYields: z.boolean().default(false).describe("Include tile yield breakdown"),
  IncludeSpatialNotes: z.boolean().default(true).describe("Include AI-generated spatial analysis"),
});

/**
 * Schema for unit data on a tile
 */
const TileUnitSchema = z.object({
  Name: z.string(),
  Owner: z.string(),
  Strength: z.number().optional(),
  RangedStrength: z.number().optional(),
  Health: z.number().describe("Health percentage"),
});

/**
 * Schema for tile yields
 */
const TileYieldsSchema = z.object({
  Food: z.number(),
  Production: z.number(),
  Gold: z.number(),
  Science: z.number(),
  Culture: z.number(),
  Faith: z.number(),
});

/**
 * Schema for individual tile data
 */
const TileDataSchema = z.object({
  // Location
  X: z.number(),
  Y: z.number(),

  // Visibility
  Visibility: z.enum(["Visible", "Revealed", "Hidden"]),

  // Terrain
  Terrain: z.string().optional().describe("Base terrain: Grassland, Plains, Desert, etc."),
  IsHills: z.boolean().optional(),
  IsMountain: z.boolean().optional(),
  Feature: z.string().optional().describe("Feature: Forest, Jungle, Marsh, etc."),

  // Water
  IsRiver: z.boolean().optional(),
  IsFreshWater: z.boolean().optional(),
  IsLake: z.boolean().optional(),
  IsCoastal: z.boolean().optional(),

  // Resources
  Resource: z.string().optional(),
  ResourceQuantity: z.number().optional(),
  ResourceClass: z.enum(["Bonus", "Strategic", "Luxury"]).optional(),
  ResourceImproved: z.boolean().optional(),

  // Improvements
  Improvement: z.string().optional(),
  ImprovementPillaged: z.boolean().optional(),
  Route: z.string().optional(),
  RoutePillaged: z.boolean().optional(),

  // Ownership
  Owner: z.string().optional(),
  City: z.string().optional(),
  WorkedByCity: z.string().optional(),

  // Units
  Units: z.array(TileUnitSchema).optional(),

  // Combat modifiers
  DefenseModifier: z.number().optional().describe("Defense bonus percentage"),
  MovementCost: z.number().optional().describe("Movement points to enter"),

  // Yields
  Yields: TileYieldsSchema.optional(),
});

/**
 * Output schema for the tool
 */
const GetMapRegionOutputSchema = z.object({
  // Summary statistics
  Summary: z.object({
    TotalTiles: z.number(),
    VisibleTiles: z.number(),
    RevealedTiles: z.number(),
    TerrainBreakdown: z.record(z.string(), z.number()).describe("Count of each terrain type"),
    ResourcesFound: z.array(z.string()).describe("Unique resources in region"),
  }),

  // Tile data keyed by "X,Y"
  Tiles: z.record(z.string(), TileDataSchema),

  // AI-generated spatial analysis
  SpatialNotes: z.array(z.string()).optional()
    .describe("Notable features: chokepoints, clusters, defensive positions"),
});

/**
 * Type exports
 */
export type MapRegionOutput = z.infer<typeof GetMapRegionOutputSchema>;

/**
 * Tool for retrieving map region data
 */
class GetMapRegionTool extends ToolBase {
  readonly name = "get-map-region";

  readonly description = `Retrieves terrain, features, resources, and improvements for a map region.

Use this to understand:
- Geography and terrain (mountains, rivers, forests, hills)
- Resource locations (strategic, luxury, bonus) and whether they're improved
- Improvements and roads (what's built, what's pillaged)
- Defensive positions and movement costs
- Spatial relationships (the SpatialNotes field highlights notable features)

This provides spatial awareness that complements get-cities and get-military-report.`;

  readonly inputSchema = GetMapRegionInputSchema;
  readonly outputSchema = GetMapRegionOutputSchema;

  readonly annotations: ToolAnnotations = {
    readOnlyHint: true
  };

  readonly metadata = {
    autoComplete: ["CenterX", "CenterY", "Radius", "PlayerID"],
  };

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const {
      CenterX,
      CenterY,
      Radius,
      PlayerID,
      IncludeUnits,
      IncludeYields,
      IncludeSpatialNotes
    } = args;

    // Default to player 0 if not specified
    const playerID = PlayerID ?? 0;

    // Get raw tile data
    const rawTiles = await getMapRegion(CenterX, CenterY, Radius, playerID);

    // Build output
    const tiles: Record<string, z.infer<typeof TileDataSchema>> = {};
    const terrainCounts: Record<string, number> = {};
    const resourcesFound: Set<string> = new Set();
    let visibleCount = 0;
    let revealedCount = 0;

    for (const tile of rawTiles) {
      // Filter based on options
      const filteredTile: TileData = { ...tile };

      if (!IncludeUnits) {
        delete filteredTile.Units;
      }

      if (!IncludeYields) {
        delete filteredTile.Yields;
      }

      // Track statistics
      if (tile.Visibility === "Visible") visibleCount++;
      if (tile.Visibility === "Revealed") revealedCount++;

      if (tile.Terrain) {
        terrainCounts[tile.Terrain] = (terrainCounts[tile.Terrain] || 0) + 1;
      }

      if (tile.Resource) {
        resourcesFound.add(tile.Resource);
      }

      // Key by coordinates
      tiles[`${tile.X},${tile.Y}`] = filteredTile;
    }

    // Generate spatial notes if requested
    const spatialNotes = IncludeSpatialNotes ? generateSpatialNotes(rawTiles) : undefined;

    return {
      Summary: {
        TotalTiles: rawTiles.length,
        VisibleTiles: visibleCount,
        RevealedTiles: revealedCount,
        TerrainBreakdown: terrainCounts,
        ResourcesFound: Array.from(resourcesFound),
      },
      Tiles: tiles,
      SpatialNotes: spatialNotes,
    };
  }
}

/**
 * Creates a new instance of the get map region tool
 */
export default function createGetMapRegionTool() {
  return new GetMapRegionTool();
}
