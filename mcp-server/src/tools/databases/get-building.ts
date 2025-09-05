import { gameDatabase } from "../../server.js";
import { DatabaseQueryTool } from "../abstract/database-query.js";
import * as z from "zod";

/**
 * Schema for building summary information
 */
const BuildingSummarySchema = z.object({
  Type: z.string(),
  Name: z.string(),
  Help: z.string(),
  Cost: z.number(),
  PrereqTech: z.string().nullable()
});

/**
 * Schema for full building information including relations
 */
const BuildingReportSchema = BuildingSummarySchema.extend({
  Strategy: z.string().nullable(),
  Class: z.string(),
  PrereqBuildings: z.array(z.string()),
  IsNationalWonder: z.boolean(),
  IsWorldWonder: z.boolean(),
  Happiness: z.number(),
  Defense: z.number(),
  HP: z.number(),
  Maintenance: z.number()
});

type BuildingSummary = z.infer<typeof BuildingSummarySchema>;
type BuildingReport = z.infer<typeof BuildingReportSchema>;

/**
 * Tool for querying building information from the game database
 */
class GetBuildingTool extends DatabaseQueryTool<BuildingSummary, BuildingReport> {
  /**
   * Unique identifier for the get building tool
   */
  readonly name = "get-building";

  /**
   * Human-readable description of the get building tool
   */
  readonly description = "Retrieves building information from the Civilization V game database with listing and fuzzy search capabilities";

  /**
   * Schema for building summary
   */
  protected readonly summarySchema = BuildingSummarySchema;

  /**
   * Schema for full building information
   */
  protected readonly fullSchema = BuildingReportSchema;

  /**
   * Fetch building summaries from database
   */
  protected async fetchSummaries(): Promise<BuildingSummary[]> {
    return await gameDatabase.getDatabase()
      .selectFrom("Buildings as b")
      .leftJoin("Technologies as t", "b.PrereqTech", "t.Type")
      .select([
        'b.Type', 
        'b.Description as Name', 
        'b.Help', 
        'b.Cost', 
        't.Description as PrereqTech'
      ])
      .execute() as BuildingSummary[];
  }
  
  protected fetchFullInfo = getBuilding;
}

export default new GetBuildingTool();

/**
 * Fetch full building information for a specific building
 */
export async function getBuilding(buildingType: string) {
  // Fetch base building info with technology name
  const db = gameDatabase.getDatabase();
  const building = await db
    .selectFrom('Buildings as b')
    .leftJoin('Technologies as t', 'b.PrereqTech', 't.Type')
    .selectAll('b')
    .select('t.Description as PrereqTechName')
    .where('b.Type', '=', buildingType)
    .executeTakeFirst();
  
  if (!building) {
    throw new Error(`Building ${buildingType} not found`);
  }
  
  // Get building class info
  const buildingClass = await db
    .selectFrom('BuildingClasses')
    .selectAll()
    .where('Type', '=', building.BuildingClass)
    .executeTakeFirst();
  
  // Get prerequisite buildings
  const prereqBuildings = await db
    .selectFrom('Building_PrereqBuildingClasses')
    .select('BuildingClassType')
    .innerJoin('BuildingClasses as bc', 'bc.Type', 'BuildingClassType')
    .select('bc.Description')
    .where('BuildingType', '=', buildingType)
    .execute();
  
  // Determine if it's a wonder
  const isNationalWonder = buildingClass?.MaxPlayerInstances === 1;
  const isWorldWonder = buildingClass?.MaxGlobalInstances === 1;
  
  // Construct the full building object
  return {
    Type: building.Type,
    Name: building.Description || '',
    Help: building.Help || '',
    Cost: building.Cost || 0,
    PrereqTech: building.PrereqTechName || null,
    Strategy: building.Strategy,
    Class: building.BuildingClass || '',
    PrereqBuildings: prereqBuildings.map(p => p.Description || ''),
    IsNationalWonder: isNationalWonder || false,
    IsWorldWonder: isWorldWonder || false,
    Happiness: building.Happiness || 0,
    Defense: building.Defense || 0,
    HP: building.ExtraCityHitPoints || 0,
    Maintenance: building.GoldMaintenance || 0
  };
}