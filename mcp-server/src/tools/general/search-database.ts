/**
 * Tool for fuzzy searching across all database-related tools
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { search } from "fast-fuzzy";
import { reciprocalRankFusion } from "rerank";
import { getTool } from "../index.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { createLogger } from "../../utils/logger.js";

const logger = createLogger('SearchDatabaseTool');

// List of database tools to search (excluding strategy tools)
const searchableTools = [
  'getTechnology',
  'getPolicy',
  'getBuilding',
  'getCivilization',
  'getUnit',
  'getFlavors'
] as const;

// Human-readable tool type names
const toolTypeNames: Record<typeof searchableTools[number], string> = {
  getTechnology: 'Technology',
  getPolicy: 'Policy',
  getBuilding: 'Building',
  getCivilization: 'Civilization',
  getUnit: 'Unit',
  getFlavors: 'Flavor'
};

/**
 * Input schema for the search database tool
 */
const SearchDatabaseInputSchema = z.object({
  Keywords: z.array(z.string()).describe("Keywords to search for across all database tools"),
  MaxResults: z.number().optional().default(10).describe("Maximum number of results to return (default: 10)")
});

/**
 * Output schema for the search database tool
 */
const SearchDatabaseOutputSchema = z.record(
  z.string(),
  z.object({
    Relevance: z.number()
  }).passthrough()
);

/**
 * Tool for searching across all database-related tools with fuzzy matching and reranking
 */
class SearchDatabaseTool extends ToolBase {
  /**
   * Unique identifier for the tool
   */
  readonly name = "search-database";

  /**
   * Human-readable description of the tool
   */
  readonly description = "Searches across all database tools (technologies, policies, buildings, civilizations, units, flavors) using fuzzy matching and returns reranked results";

  /**
   * Input schema for the tool
   */
  readonly inputSchema = SearchDatabaseInputSchema;

  /**
   * Output schema for the tool
   */
  readonly outputSchema = SearchDatabaseOutputSchema;

  /**
   * Optional annotations for the tool
   */
  readonly annotations: ToolAnnotations = {
    readOnlyHint: true
  };

  /**
   * Execute the search across all database tools
   */
  async execute(args: z.infer<typeof SearchDatabaseInputSchema>): Promise<z.infer<typeof SearchDatabaseOutputSchema>> {
    try {
      // Collect all ranked lists for RRF
      const rankedLists: Array<Array<{ key: string; data: any }>> = [];

      // Search each tool with each keyword
      for (const keyword of args.Keywords) {
        for (const toolName of searchableTools) {
          const tool = getTool(toolName);
          if (!tool || !('getSummaries' in tool)) {
            logger.warn(`Tool ${toolName} not found or doesn't support getSummaries`);
            continue;
          }

          try {
            // Get cached summaries
            const summaries = await (tool as any).getSummaries();

            // Perform fuzzy search
            const matches = search(keyword, summaries, {
              keySelector: (item: any) => {
                const fields: string[] = [];
                // Get common searchable fields
                if (item.Name) fields.push(item.Name);
                if (item.Type) fields.push(item.Type);
                if (item.Help) fields.push(item.Help);
                if (item.Description) fields.push(item.Description);
                if (item.Strategy) fields.push(item.Strategy);
                if (item.Branch) fields.push(item.Branch);
                if (item.Era) fields.push(item.Era);
                return fields;
              },
              threshold: 0.6,
              returnMatchData: true
            });

            // Convert matches to ranked list with unique keys
            const rankedList = matches.map(match => {
              const item = match.item as any;
              const typeName = toolTypeNames[toolName];
              const itemName = (item.Name || item.Type || 'Unknown') as string;
              const key = `${typeName}: ${itemName}`;

              // Delete the item.
              delete item.Type;

              return {
                key,
                data: item
              };
            });

            if (rankedList.length > 0) {
              rankedLists.push(rankedList);
            }
          } catch (error) {
            logger.error(`Error searching tool ${toolName}:`, error);
          }
        }
      }

      if (rankedLists.length === 0) {
        return {};
      }

      // Use Reciprocal Rank Fusion to combine all ranked lists
      const fusedKeysResult = reciprocalRankFusion(rankedLists, 'key');
      const fusedKeys = Array.from((fusedKeysResult as Map<string, number>).keys());

      // Build result record with relevance scores
      const results: Record<string, any> = {};
      const maxResults = Math.min(args.MaxResults, fusedKeys.length);

      for (let i = 0; i < maxResults; i++) {
        const key = fusedKeys[i];

        // Find the original data for this key
        let itemData: any = null;
        for (const rankedList of rankedLists) {
          const found = rankedList.find(item => item.key === key);
          if (found) {
            itemData = found.data;
            break;
          }
        }

        if (itemData) {
          // Calculate relevance as inverse of rank (1.0 for first, decreasing)
          const relevance = 1.0 - (i / fusedKeys.length);

          results[key] = {
            Relevance: relevance,
            ...itemData
          };
        }
      }

      return results;
    } catch (error) {
      logger.error("Search database error:", error);
      return {};
    }
  }
}

/**
 * Creates a new instance of the search database tool
 */
export default function createSearchDatabaseTool() {
  return new SearchDatabaseTool();
}
