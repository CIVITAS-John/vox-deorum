import { AiMilitaryStrategyCityFlavor, AiMilitaryStrategyPlayerFlavor } from "../../database/database.js";
import { gameDatabase } from "../../server.js";
import { DatabaseQueryTool } from "../abstract/database-query.js";
import * as z from "zod";
import * as changeCase from "change-case";

/**
 * Schema for military strategy information
 */
const MilitaryStrategySchema = z.object({
  Type: z.string(),
  Production: z.record(z.string(), z.number()),
  Overall: z.record(z.string(), z.number()),
});

type MilitaryStrategy = z.infer<typeof MilitaryStrategySchema>;

/**
 * Tool for querying AI military strategies from the game database
 */
class GetMilitaryStrategyTool extends DatabaseQueryTool<MilitaryStrategy, MilitaryStrategy> {
  /**
   * Unique identifier for the get military strategies tool
   */
  readonly name = "get-military-strategies";

  /**
   * Human-readable description of the get military strategies tool
   */
  readonly description = "Retrieves AI military strategy information including production (city) and overall (player) flavors";

  /**
   * Schema for military strategy summary (same as full schema)
   */
  protected readonly summarySchema = MilitaryStrategySchema;

  /**
   * Schema for full military strategy information (same as summary)
   */
  protected readonly fullSchema = MilitaryStrategySchema;

  /**
   * Fetch military strategy summaries from database
   */
  protected async fetchSummaries(): Promise<MilitaryStrategy[]> {
    const db = gameDatabase.getDatabase();

    // Get all military strategies
    const strategies = await db
      .selectFrom("AIMilitaryStrategies")
      .select(['Type'])
      .execute();

    // Get ALL production (city) flavors in one query
    const allProductionWeights = await db
      .selectFrom("AIMilitaryStrategy_City_Flavors")
      .select(['AIMilitaryStrategyType', 'FlavorType', 'Flavor'])
      .execute();

    // Get ALL overall (player) flavors in one query
    const allOverallWeights = await db
      .selectFrom("AIMilitaryStrategy_Player_Flavors")
      .select(['AIMilitaryStrategyType', 'FlavorType', 'Flavor'])
      .execute();

    // Group flavors by strategy type for efficient lookup
    const ProductionWeightsByStrategy = new Map<string, AiMilitaryStrategyCityFlavor[]>();
    const OverallWeightsByStrategy = new Map<string, AiMilitaryStrategyPlayerFlavor[]>();

    for (const flavor of allProductionWeights) {
      if (!ProductionWeightsByStrategy.has(flavor.AIMilitaryStrategyType!)) {
        ProductionWeightsByStrategy.set(flavor.AIMilitaryStrategyType!, []);
      }
      ProductionWeightsByStrategy.get(flavor.AIMilitaryStrategyType!)!.push(flavor);
    }

    for (const flavor of allOverallWeights) {
      if (!OverallWeightsByStrategy.has(flavor.AIMilitaryStrategyType!)) {
        OverallWeightsByStrategy.set(flavor.AIMilitaryStrategyType!, []);
      }
      OverallWeightsByStrategy.get(flavor.AIMilitaryStrategyType!)!.push(flavor);
    }

    const results: MilitaryStrategy[] = [];

    for (const strategy of strategies) {
      // Remove MILITARYAISTRATEGY_ prefix and convert to PascalCase
      const ProductionWeights = ProductionWeightsByStrategy.get(strategy.Type!) || [];
      const OverallWeights = OverallWeightsByStrategy.get(strategy.Type!) || [];

      results.push({
        Type: changeCase.pascalCase(strategy.Type!.replace('MILITARYAISTRATEGY_', '')),
        Production: Object.fromEntries(
          ProductionWeights.map((f: any) => [
            changeCase.pascalCase(f.FlavorType!.replace('FLAVOR_', '')),
            f.Flavor!
          ])),
        Overall: Object.fromEntries(
          OverallWeights.map((f: any) => [
            changeCase.pascalCase(f.FlavorType!.replace('FLAVOR_', '')),
            f.Flavor!
          ]))
      });
    }

    return results;
  }

  /**
   * Fetch full military strategy information (same as summary)
   */
  protected async fetchFullInfo(identifier: string): Promise<MilitaryStrategy> {
    // Since full schema is the same as summary, just return the cached data
    if (!this.cachedSummaries) {
      this.cachedSummaries = await this.fetchSummaries();
    }

    const strategy = this.cachedSummaries.find(s => s.Type === identifier);
    if (!strategy) {
      throw new Error(`Military strategy ${identifier} not found`);
    }

    return strategy;
  }
}

/**
 * Creates a new instance of the get military strategies tool
 */
export default function createGetMilitaryStrategyTool() {
  return new GetMilitaryStrategyTool();
}