/**
 * Tool for retrieving flavor descriptions from the strategies JSON file
 */

import { DatabaseQueryTool } from "../abstract/database-query.js";
import * as z from "zod";
import { loadFlavorDescriptions } from "../../utils/strategies/loader.js";

/**
 * Schema for flavor information with description
 */
const FlavorSchema = z.object({
  Name: z.string(),
  Description: z.string()
});

type Flavor = z.infer<typeof FlavorSchema>;

/**
 * Tool for querying flavor descriptions for AI preference tuning
 */
class GetFlavorsTool extends DatabaseQueryTool<Flavor, Flavor> {
  /**
   * Unique identifier for the get flavors tool
   */
  readonly name = "get-flavors";

  /**
   * Human-readable description of the get flavors tool
   */
  readonly description = "Retrieves flavor descriptions for AI preference tuning";

  /**
   * Schema for flavor summary (same as full schema)
   */
  protected readonly summarySchema = FlavorSchema;

  /**
   * Schema for full flavor information (same as summary)
   */
  protected readonly fullSchema = FlavorSchema;

  /**
   * Override identifier field since flavors use 'Name' instead of 'Type'
   */
  protected getIdentifierField(): keyof Flavor {
    return 'Name';
  }

  /**
   * Fetch flavor summaries from the JSON file
   */
  protected async fetchSummaries(): Promise<Flavor[]> {
    // Load flavor descriptions from JSON file
    const flavorDescriptions = await loadFlavorDescriptions();

    const results: Flavor[] = [];

    // Create flavor entries from descriptions
    for (const [name, description] of Object.entries(flavorDescriptions)) {
      results.push({
        Name: name,
        Description: description as string
      });
    }

    return results;
  }

  /**
   * Fetch full flavor information (same as summary)
   */
  protected async fetchFullInfo(identifier: string): Promise<Flavor> {
    // Since full schema is the same as summary, just return the cached data
    if (!this.cachedSummaries) {
      this.cachedSummaries = await this.fetchSummaries();
    }

    const flavor = this.cachedSummaries.find(f => f.Name === identifier);
    if (!flavor) {
      throw new Error(`Flavor ${identifier} not found`);
    }

    return flavor;
  }
}

/**
 * Creates a new instance of the get flavors tool
 */
export default function createGetFlavorsTool() {
  return new GetFlavorsTool();
}