import { gameDatabase } from "../../server.js";
import { ToolBase } from "../base.js";
import * as z from "zod";
import { search } from "fast-fuzzy";

/**
 * Schema for technology summary information
 */
const TechnologySummarySchema = z.object({
  Type: z.string(),
  Name: z.string(),
  Help: z.string(),
  Cost: z.number(),
  Era: z.string()
});

/**
 * Schema for full technology information including relations
 */
const TechnologyReportSchema = TechnologySummarySchema.extend({
  PrereqTechs: z.array(z.string()),
  UnitsUnlocked: z.array(z.string()),
  BuildingsUnlocked: z.array(z.string()),
  ImprovementsUnlocked: z.array(z.string()),
  WorldWondersUnlocked: z.array(z.string()),
  NationalWondersUnlocked: z.array(z.string())
});

type TechnologySummary = z.infer<typeof TechnologySummarySchema>;
type TechnologyReport = z.infer<typeof TechnologyReportSchema>;

/**
 * Tool for querying technology information from the game database
 */
class GetTechnologyTool extends ToolBase {
  /**
   * Unique identifier for the get technology tool
   */
  readonly name = "get-technology";

  /**
   * Human-readable description of the get technology tool
   */
  readonly description = "Retrieves technology information from the Civilization V game database with listing and fuzzy search capabilities";

  /**
   * Input schema defining search parameters
   */
  readonly inputSchema = z.object({
    search: z.string().optional().describe("Optional search term to filter technologies using fuzzy matching on name, era, or description"),
    maxResults: z.number().optional().default(20).describe("Maximum number of results to return (default: 20)")
  });

  /**
   * Output schema for technology query results
   */
  readonly outputSchema = z.object({
    count: z.number(),
    technologies: z.array(z.union([TechnologySummarySchema, TechnologyReportSchema])),
    error: z.string().optional(),
  });

  /**
   * Optional annotations for the get technology tool
   */
  readonly annotations = undefined;

  /**
   * Cached technology summaries
   */
  private cachedSummaries: TechnologySummary[] | null = null;

  /**
   * Get cached technology summaries or fetch new ones
   */
  private async getTechnologySummaries(): Promise<TechnologySummary[]> {
    if (this.cachedSummaries) return this.cachedSummaries;
    
    // Fetch technology summaries from database using Kysely
    const technologies = await gameDatabase.getDatabase()
      .selectFrom("Technologies")
      .select(['Type', 'Type as Name', 'Help', 'Cost', 'Era'])
      .execute();
    
    // Localize the descriptions
    const localizedTechnologies = await gameDatabase.localizeObjects(technologies);
    this.cachedSummaries = localizedTechnologies as any;
    return this.cachedSummaries!;
  }

  /**
   * Get full technology information for a specific technology
   */
  private async getTechnologyReport(techType: string): Promise<TechnologyReport> {
    // Fetch base technology info
    const db = gameDatabase.getDatabase();
    const tech = await db
      .selectFrom('Technologies')
      .selectAll()
      .where('Type', '=', techType)
      .executeTakeFirst();
    
    if (!tech) {
      throw new Error(`Technology ${techType} not found`);
    }
    
    // Get prerequisite technologies
    const prereqTechs = await db
      .selectFrom('TechnologyPrereqTechs')
      .select('PrereqTech')
      .where('TechType', '=', techType)
      .execute();
    
    // Get unlocked units
    const unitsUnlocked = await db
      .selectFrom('Units')
      .select('Description')
      .where('PrereqTech', '=', techType)
      .execute();
    
    // Get unlocked buildings
    const buildingsUnlocked = await db
      .selectFrom('Buildings')
      .innerJoin('BuildingClasses as c', 'c.Type', 'Buildings.BuildingClass')
      .where('PrereqTech', '=', techType)
      .select(['Description', 'c.MaxGlobalInstances', 'c.MaxPlayerInstances'])
      .execute();
    
    // Get unlocked improvements
    const improvementsUnlocked = await db
      .selectFrom('Builds')
      .select('ImprovementType')
      .where('PrereqTech', '=', techType)
      .execute();
    
    // Construct the full technology object
    const fullTech: TechnologyReport = {
      Type: tech.Type,
      Name: tech.Description!,
      Help: tech.Help!,
      Cost: tech.Cost!,
      Era: tech.Era!,
      PrereqTechs: prereqTechs.map(p => p.PrereqTech!),
      UnitsUnlocked: unitsUnlocked.map(u => u.Description!),
      BuildingsUnlocked: buildingsUnlocked.filter(b => b.MaxGlobalInstances == 0 && b.MaxPlayerInstances == 0).map(b => b.Description!),
      NationalWondersUnlocked: buildingsUnlocked.filter(b => b.MaxPlayerInstances == 0).map(b => b.Description!),
      WorldWondersUnlocked: buildingsUnlocked.filter(b => b.MaxPlayerInstances == 0).map(b => b.Description!),
      ImprovementsUnlocked: improvementsUnlocked.map(i => i.ImprovementType!),
    };
    
    // Localize all text fields
    const localizedTech = await gameDatabase.localizeObject(fullTech);
    
    return localizedTech;
  }

  /**
   * Execute the technology query
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    try {
      const summaries = await this.getTechnologySummaries();
      
      let results = summaries;
      
      // Apply fuzzy search if search term provided
      if (args.search) {
        const searchOptions = {
          keySelector: (tech: TechnologySummary) => tech.Name + " " + tech.Help! + " " + tech.Era!,
          threshold: 0.6
        };
        
        results = search(args.search, summaries, searchOptions);
      }
      
      // Limit results
      results = results.slice(0, args.maxResults);
      
      // If only one result, fetch full information
      if (results.length === 1) {
        try {
          const fullInfo = await this.getTechnologyReport(results[0].Type);
          if (fullInfo) {
            results = [fullInfo];
          }
        } catch (error) {
          // Fall back to summary if full info fetch fails
          console.error("Failed to fetch full technology info:", error);
        }
      }
      
      return {
        count: results.length,
        technologies: results,
      };
      
    } catch (error) {
      return {
        count: 0,
        technologies: [],
        error: (error as any).message ?? "Unknown query error."
      };
    }
  }
}

export default new GetTechnologyTool();