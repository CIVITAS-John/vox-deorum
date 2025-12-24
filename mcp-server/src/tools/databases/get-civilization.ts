import { gameDatabase } from "../../server.js";
import { DatabaseQueryTool } from "../abstract/database-query.js";
import * as z from "zod";
import * as changeCase from "change-case";

/**
 * Schema for civilization summary information
 */
export const CivilizationSummarySchema = z.object({
  Type: z.string().optional(),
  Name: z.string(),
  Uniques: z.array(z.string()).optional(),
  Leader: z.string()
});

/**
 * Schema for full civilization information including relations
 */
export const CivilizationReportSchema = CivilizationSummarySchema.extend({
  Abilities: z.array(z.object({
    Type: z.string(),
    Name: z.string(),
    Help: z.string(),
    Replacing: z.string().optional()
  })),
  PreferredVictory: z.string()
});

type CivilizationSummary = z.infer<typeof CivilizationSummarySchema>;
type CivilizationReport = z.infer<typeof CivilizationReportSchema>;

/**
 * Tool for querying civilization information from the game database
 */
class GetCivilizationTool extends DatabaseQueryTool<CivilizationSummary, CivilizationReport> {
  /**
   * Unique identifier for the get civilization tool
   */
  readonly name = "get-civilization";

  /**
   * Human-readable description of the get civilization tool
   */
  readonly description = "Retrieves civilization and leader information from the Civilization V game database with listing and fuzzy search capabilities";

  /**
   * Schema for civilization summary
   */
  protected readonly summarySchema = CivilizationSummarySchema;

  /**
   * Schema for full civilization information
   */
  protected readonly fullSchema = CivilizationReportSchema;

  /**
   * Fetch civilization summaries from database
   */
  protected async fetchSummaries(): Promise<CivilizationSummary[]> {
    const db = gameDatabase.getDatabase();
    
    // Get all civilizations with their leaders and traits (each leader has exactly one trait)
    const civilizations = await db
      .selectFrom("Civilizations")
      .innerJoin("Civilization_Leaders as cl", "Civilizations.Type", "cl.CivilizationType")
      .innerJoin("Leaders", "cl.LeaderheadType", "Leaders.Type")
      .leftJoin("Leader_Traits as lt", "Leaders.Type", "lt.LeaderType")
      .leftJoin("Traits", "lt.TraitType", "Traits.Type")
      .select([
        'Civilizations.Type', 
        'Civilizations.ShortDescription as Name',
        'Leaders.Description as Leader',
        'Traits.Description as TraitDescription'
      ])
      .where('Civilizations.Playable', '=', 1)
      .execute();

    // Get abilities for each civilization
    const summaries: CivilizationSummary[] = [];
    
    for (const civ of civilizations) {
      const abilities: string[] = [];
      
      // Get unique units
      const uniqueUnits = await db
        .selectFrom("Civilization_UnitClassOverrides")
        .innerJoin("Units", "Civilization_UnitClassOverrides.UnitType", "Units.Type")
        .innerJoin("UnitClasses", "Civilization_UnitClassOverrides.UnitClassType", "UnitClasses.Type")
        .innerJoin("Units as DefaultUnit", "UnitClasses.DefaultUnit", "DefaultUnit.Type")
        .select([
          'Units.Description as UniqueName',
          'DefaultUnit.Description as ReplacesName'
        ])
        .where('Civilization_UnitClassOverrides.CivilizationType', '=', civ.Type)
        .where('Civilization_UnitClassOverrides.UnitType', 'is not', null)
        .execute();
      
      for (const unit of uniqueUnits) {
        if (unit.UniqueName && unit.ReplacesName) {
          abilities.push(`Unique Unit: ${unit.UniqueName}, Replacing ${unit.ReplacesName}`);
        }
      }
      
      // Get unique buildings
      const uniqueBuildings = await db
        .selectFrom("Civilization_BuildingClassOverrides")
        .innerJoin("Buildings", "Civilization_BuildingClassOverrides.BuildingType", "Buildings.Type")
        .innerJoin("BuildingClasses", "Civilization_BuildingClassOverrides.BuildingClassType", "BuildingClasses.Type")
        .innerJoin("Buildings as DefaultBuilding", "BuildingClasses.DefaultBuilding", "DefaultBuilding.Type")
        .select([
          'Buildings.Description as UniqueName',
          'DefaultBuilding.Description as ReplacesName'
        ])
        .where('Civilization_BuildingClassOverrides.CivilizationType', '=', civ.Type)
        .where('Civilization_BuildingClassOverrides.BuildingType', 'is not', null)
        .execute();

      for (const building of uniqueBuildings) {
        if (building.UniqueName && building.ReplacesName) {
          abilities.push(`Unique Building: ${building.UniqueName}, Replacing ${building.ReplacesName}`);
        }
      }

      // Get unique improvements
      const uniqueImprovements = await db
        .selectFrom("Improvements")
        .select([
          'Description as UniqueName', 
          'Help as UniqueHelp'
        ])
        .where('CivilizationType', '=', civ.Type)
        .where('SpecificCivRequired', '=', 1)
        .execute();

      for (const improvement of uniqueImprovements) {
        if (improvement.UniqueName) {
          abilities.push(`Unique Improvement: ${improvement.UniqueName} (${improvement.UniqueHelp})`);
        }
      }
      
      // Add leader trait as ability (already fetched in the main query)
      if (civ.TraitDescription) {
        abilities.push(`Civilization Ability: ${civ.TraitDescription}`);
      }
      
      summaries.push({
        Type: civ.Type,
        Name: civ.Name!,
        Uniques: abilities,
        Leader: civ.Leader!
      });
    }
    
    return summaries;
  }
  
  protected fetchFullInfo = getCivilization;
}

/**
 * Creates a new instance of the get civilization tool
 */
export default function createGetCivilizationTool() {
  return new GetCivilizationTool();
}

/**
 * Fetch full civilization information for a specific civilization
 */
export async function getCivilization(civType: string) {
  const db = gameDatabase.getDatabase();
  
  // Fetch base civilization info with leader and trait (each leader has exactly one trait)
  const civ = await db
    .selectFrom('Civilizations')
    .innerJoin('Civilization_Leaders as cl', 'Civilizations.Type', 'cl.CivilizationType')
    .innerJoin('Leaders', 'cl.LeaderheadType', 'Leaders.Type')
    .leftJoin('Leader_Traits as lt', 'Leaders.Type', 'lt.LeaderType')
    .leftJoin('Traits', 'lt.TraitType', 'Traits.Type')
    .select([
      'Civilizations.Type',
      'Civilizations.ShortDescription',
      'Civilizations.Strategy',
      'Leaders.Type as LeaderType',
      'Leaders.Description as LeaderName',
      'Leaders.PrimaryVictoryPursuit',
      'Traits.Type as TraitType',
      'Traits.ShortDescription as TraitShortDescription',
      'Traits.Description as TraitDescription'
    ])
    .where('Civilizations.Type', '=', civType)
    .executeTakeFirst();
  
  if (!civ) {
    throw new Error(`Civilization ${civType} not found`);
  }
  
  // Build detailed abilities list
  const abilities: Array<{Type: string, Name: string, Help: string, Replacing?: string}> = [];
  
  // Get unique units with details
  const uniqueUnits = await db
    .selectFrom("Civilization_UnitClassOverrides as o")
    .innerJoin("Units", "o.UnitType", "Units.Type")
    .innerJoin("UnitClasses", "o.UnitClassType", "UnitClasses.Type")
    .innerJoin("Units as DefaultUnit", "UnitClasses.DefaultUnit", "DefaultUnit.Type")
    .select([
      'Units.Description as UniqueName',
      'Units.Help as UniqueHelp',
      'Units.Strategy as UniqueStrategy',
      'DefaultUnit.Description as ReplacesName'
    ])
    .where('o.CivilizationType', '=', civType)
    .where('o.UnitType', 'is not', null)
    .execute();
  
  for (const unit of uniqueUnits) {
    if (unit.UniqueName) {
      abilities.push({
        Type: 'Unit',
        Name: unit.UniqueName,
        Help: unit.UniqueStrategy || unit.UniqueHelp || 'Unique unit',
        Replacing: unit.ReplacesName || undefined
      });
    }
  }
  
  // Get unique buildings with details
  const uniqueBuildings = await db
    .selectFrom("Civilization_BuildingClassOverrides")
    .innerJoin("Buildings", "Civilization_BuildingClassOverrides.BuildingType", "Buildings.Type")
    .innerJoin("BuildingClasses", "Civilization_BuildingClassOverrides.BuildingClassType", "BuildingClasses.Type")
    .innerJoin("Buildings as DefaultBuilding", "BuildingClasses.DefaultBuilding", "DefaultBuilding.Type")
    .select([
      'Buildings.Description as UniqueName',
      'Buildings.Help as UniqueHelp',
      'Buildings.Strategy as UniqueStrategy',
      'DefaultBuilding.Description as ReplacesName'
    ])
    .where('Civilization_BuildingClassOverrides.CivilizationType', '=', civType)
    .where('Civilization_BuildingClassOverrides.BuildingType', 'is not', null)
    .execute();

  for (const building of uniqueBuildings) {
    if (building.UniqueName) {
      abilities.push({
        Type: 'Building',
        Name: building.UniqueName,
        Help: building.UniqueStrategy || building.UniqueHelp || 'Unique building',
        Replacing: building.ReplacesName || undefined
      });
    }
  }

  // Get unique improvements with details
  const uniqueImprovements = await db
    .selectFrom("Improvements")
    .select([
      'Description as UniqueName',
      'Help as UniqueHelp'
    ])
    .where('CivilizationType', '=', civType)
    .where('SpecificCivRequired', '=', 1)
    .execute();

  for (const improvement of uniqueImprovements) {
    if (improvement.UniqueName) {
      abilities.push({
        Type: 'Improvement',
        Name: improvement.UniqueName,
        Help: improvement.UniqueHelp || 'Unique improvement'
      });
    }
  }
  
  // Add leader trait as ability (already fetched in the main query)
  if (civ.TraitShortDescription) {
    abilities.push({
      Type: 'Ability',
      Name: civ.TraitShortDescription,
      Help: civ.TraitDescription || 'Unique leader ability'
    });
  }

  // Construct the full civilization object
  return {
    Type: civ.Type,
    Name: civ.ShortDescription!,
    Abilities: abilities,
    Leader: civ.LeaderName!,
    PreferredVictory: changeCase.pascalCase(civ.PrimaryVictoryPursuit!).substring(14)
  };
}