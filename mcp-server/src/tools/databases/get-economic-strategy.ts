import { AiEconomicStrategyCityFlavor, AiEconomicStrategyPlayerFlavor } from "../../database/database.js";
import { gameDatabase } from "../../server.js";
import { DatabaseQueryTool } from "../abstract/database-query.js";
import * as z from "zod";
import * as changeCase from "change-case";

/**
 * Schema for economic strategy information
 */
const EconomicStrategySchema = z.object({
  Type: z.string(),
  Weights: z.record(z.string(), z.number()),
});

type EconomicStrategy = z.infer<typeof EconomicStrategySchema>;

/**
 * Tool for querying AI economic strategies from the game database
 */
class GetEconomicStrategyTool extends DatabaseQueryTool<EconomicStrategy, EconomicStrategy> {
  /**
   * Unique identifier for the get economic strategies tool
   */
  readonly name = "get-economic-strategies";

  /**
   * Human-readable description of the get economic strategies tool
   */
  readonly description = "Retrieves AI economic strategy information including production (city) and overall (player) flavors";

  /**
   * Schema for economic strategy summary (same as full schema)
   */
  protected readonly summarySchema = EconomicStrategySchema;

  /**
   * Schema for full economic strategy information (same as summary)
   */
  protected readonly fullSchema = EconomicStrategySchema;

  /**
   * Fetch economic strategy summaries from database
   */
  protected async fetchSummaries(): Promise<EconomicStrategy[]> {
    const db = gameDatabase.getDatabase();

    // Get all economic strategies
    const strategies = await db
      .selectFrom("AIEconomicStrategies")
      .select(['Type'])
      .execute();

    // Get ALL production (city) flavors in one query
    const allProductionWeights = await db
      .selectFrom("AIEconomicStrategy_City_Flavors")
      .select(['AIEconomicStrategyType', 'FlavorType', 'Flavor'])
      .execute();

    // Get ALL overall (player) flavors in one query
    const allOverallWeights = await db
      .selectFrom("AIEconomicStrategy_Player_Flavors")
      .select(['AIEconomicStrategyType', 'FlavorType', 'Flavor'])
      .execute();

    // Group flavors by strategy type for efficient lookup
    const ProductionWeightsByStrategy = new Map<string, AiEconomicStrategyCityFlavor[]>();
    const OverallWeightsByStrategy = new Map<string, AiEconomicStrategyPlayerFlavor[]>();

    for (const flavor of allProductionWeights) {
      if (!ProductionWeightsByStrategy.has(flavor.AIEconomicStrategyType!)) {
        ProductionWeightsByStrategy.set(flavor.AIEconomicStrategyType!, []);
      }
      ProductionWeightsByStrategy.get(flavor.AIEconomicStrategyType!)!.push(flavor);
    }

    for (const flavor of allOverallWeights) {
      if (!OverallWeightsByStrategy.has(flavor.AIEconomicStrategyType!)) {
        OverallWeightsByStrategy.set(flavor.AIEconomicStrategyType!, []);
      }
      OverallWeightsByStrategy.get(flavor.AIEconomicStrategyType!)!.push(flavor);
    }

    const results: EconomicStrategy[] = [];

    for (const strategy of strategies) {
      // Remove ECONOMICAISTRATEGY_ prefix and convert to PascalCase
      const ProductionWeights = ProductionWeightsByStrategy.get(strategy.Type!) || [];
      const OverallWeights = OverallWeightsByStrategy.get(strategy.Type!) || [];
      const Weights = new Map<string, number>();

      // Combine production and overall weights into a single Weights object
      ProductionWeights.map((f: any) => Weights.set(
        changeCase.pascalCase(f.FlavorType!.replace('FLAVOR_', '')),
        f.Flavor!
      ));
      OverallWeights.map((f: any) => Weights.set(
        changeCase.pascalCase(f.FlavorType!.replace('FLAVOR_', '')),
        f.Flavor!
      ));

      results.push({
        Type: changeCase.pascalCase(strategy.Type!.replace('ECONOMICAISTRATEGY_', '')),
        Weights: Object.fromEntries(Weights)
      });
    }

    return results;
  }

  /**
   * Fetch full economic strategy information (same as summary)
   */
  protected async fetchFullInfo(identifier: string): Promise<EconomicStrategy> {
    // Since full schema is the same as summary, just return the cached data
    if (!this.cachedSummaries) {
      this.cachedSummaries = await this.fetchSummaries();
    }

    const strategy = this.cachedSummaries.find(s => s.Type === identifier);
    if (!strategy) {
      throw new Error(`Economic strategy ${identifier} not found`);
    }

    return strategy;
  }
}

/**
 * Creates a new instance of the get economic strategies tool
 */
export default function createGetEconomicStrategyTool() {
  return new GetEconomicStrategyTool();
}