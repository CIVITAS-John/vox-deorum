import { gameDatabase } from "../../server.js";
import { ToolBase } from "../base.js";
import * as z from "zod";
import { search } from "fast-fuzzy";
import { ExtendedToolAnnotations } from "../types/tool-annotations.js";
import { createLogger } from "../../utils/logger.js";

const logger = createLogger('DatabaseQueryTool');

/**
 * Base class for database query tools that provides common functionality
 * for searching, filtering, and retrieving game entities
 */
export abstract class DatabaseQueryTool<
  TSummary extends Record<string, any>,
  TFull extends TSummary
> extends ToolBase {
  /**
   * Cached summary data for quick listing and searching
   */
  protected cachedSummaries: TSummary[] | null = null;

  /**
   * Schema for summary information (used for listing)
   */
  protected abstract readonly summarySchema: z.ZodSchema<TSummary>;

  /**
   * Schema for full detailed information (used for single results)
   */
  protected abstract readonly fullSchema: z.ZodSchema<TFull>;

  /**
   * Optional annotations for the get building tool
   */
  readonly annotations: ExtendedToolAnnotations = {
    readOnlyHint: true,
    markdownConfig: [
      { format: "{key}" }
    ]
  };

  /**
   * Input schema with common search parameters
   */
  readonly inputSchema = z.object({
    Search: z.string().optional().describe("Fuzzy-matching search term"),
    MaxResults: z.number().optional().default(20).describe("Maximum number to return (default: 20)")
  });

  /**
   * Get the actual output schema.
   */
  getOutputSchema() {
    return z.object({
      Count: z.number(),
      Items: z.array(z.union([this.summarySchema, this.fullSchema])),
      Error: z.string().optional(),
    });
  }

  /**
   * Output schema for query results
   */
  readonly outputSchema = z.object({
    Count: z.number(),
    Items: z.array(z.any()),
    Error: z.string().optional(),
  });

  /**
   * Default implementation searches common fields
   */
  protected getSearchFields(): string[] {
    return ['Name', 'Strategy', 'Era', 'Help', this.getIdentifierField() as string];
  }

  /**
   * Get the key selector function for fuzzy search
   * Override this to customize search fields
   */
  protected getSearchKeys(item: TSummary): string[] {
    return this.getSearchFields()
      .map(field => item[field])
      .filter(Boolean);
  }

  /**
   * Get the fuzzy search threshold
   * Override to adjust search sensitivity
   */
  protected getSearchThreshold(): number {
    return 0.6;
  }

  /**
   * Abstract method to fetch summary data from the database
   */
  protected abstract fetchSummaries(): Promise<TSummary[]>;

  /**
   * Abstract method to fetch full detailed information for a single item
   */
  protected abstract fetchFullInfo(identifier: string): Promise<TFull>;

  /**
   * Get the identifier field name for fetching full info
   * Override if your entity uses something other than 'Type'
   */
  protected getIdentifierField(): keyof TSummary {
    return 'Type' as keyof TSummary;
  }

  /**
   * Get cached summaries or fetch new ones
   */
  public async getSummaries(): Promise<TSummary[]> {
    if (this.cachedSummaries) return this.cachedSummaries;
    
    const results = await this.fetchSummaries();
    this.cachedSummaries = await gameDatabase.localizeObjects(results);
    return this.cachedSummaries;
  }

  /**
   * Execute the database query with common search and filtering logic
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    try {
      const summaries = await this.getSummaries();
      
      let results = summaries;
      
      // Apply fuzzy search if search term provided
      if (args.Search) {
        let matches = search(args.Search, summaries, {
          keySelector: (item: TSummary) => this.getSearchKeys(item),
          threshold: this.getSearchThreshold(),
          returnMatchData: true
        });
        if (matches.length > 0 && matches[0].score == 1 && 
          (matches[0].original == matches[0].item.Type || matches[0].original == matches[0].item.Name)) {
          results = [matches[0].item];
        } else {
          results = matches.map(r => r.item);
        }
      }
      
      // Limit results
      results = results.slice(0, args.MaxResults);
      
      // If only one result, fetch full information
      if (results.length === 1) {
        try {
          const identifierField = this.getIdentifierField();
          const identifier = results[0][identifierField] as string;
          const fullInfo = await this.fetchFullInfo(identifier);
          if (fullInfo) {
            results = [fullInfo] as TSummary[];
          }
        } catch (error) {
          // Fall back to summary if full info fetch fails
          logger.error("Failed to fetch full info:", error);
        }
      }
      
      // Localize all text fields
      const localized = await gameDatabase.localizeObjects(results);
      
      return {
        Count: results.length,
        Items: localized,
      };
      
    } catch (error) {
      return {
        Count: 0,
        Items: [],
        Error: (error as any).message ?? "Unknown query error."
      };
    }
  }
}