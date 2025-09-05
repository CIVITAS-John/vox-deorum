/**
 * Tool for retrieving game events from the knowledge database
 */

import { knowledgeManager } from "../../server.js";
import { ToolBase } from "../base.js";
import * as z from "zod";
import { isAfter, isAtTurn, isVisible } from "../../knowledge/expressions.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * Input schema for the GetEvents tool
 */
const GetEventsInputSchema = z.object({
  Turn: z.number().optional().describe("Turn number filter"),
  Type: z.string().optional().describe("Event type string filter"),
  After: z.number().optional().describe("Event ID filter"),
  PlayerID: z.number().min(0).max(21).optional().describe("Player ID visibility filter")
});

/**
 * Schema for game event output
 */
const GameEventOutputSchema = z.object({
  ID: z.number(),
  Turn: z.number(),
  Type: z.string(),
  Payload: z.record(z.unknown()),
  Visibility: z.record(z.string(), z.number()).optional()
});

/**
 * Output schema for the GetEvents tool
 */
const GetEventsOutputSchema = z.object({
  Count: z.number(),
  Events: z.array(GameEventOutputSchema)
});

/**
 * Tool for retrieving game events with optional filtering
 */
class GetEventsTool extends ToolBase {
  /**
   * Unique identifier for the tool
   */
  readonly name = "get-events";

  /**
   * Human-readable description of the tool
   */
  readonly description = "Retrieves recent game events from the knowledge database with optional filtering by turn and player visibility";

  /**
   * Input schema for the tool
   */
  readonly inputSchema = GetEventsInputSchema;

  /**
   * Output schema for the tool
   */
  readonly outputSchema = GetEventsOutputSchema;

  /**
   * Optional annotations for the tool
   */
  readonly annotations: ToolAnnotations = {
    audience: ["user", "briefer"],
    autoComplete: ["PlayerID", "After"],
    readOnlyHint: true
  }

  /**
   * Execute the tool to retrieve game events
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const db = knowledgeManager.getStore().getDatabase();
    
    // Build the query
    let query = db.selectFrom("GameEvents")
      .selectAll();
    // Apply turn filter
    if (args.Turn)
      query = query.where(isAtTurn(args.Turn));
    // Apply after filter
    if (args.After)
      query = query.where(isAfter(args.After));
    // Apply after filter
    if (args.Type)
      query = query.where('Type', '=', args.Type);
    // Apply player visibility filter if provided
    if (args.PlayerID)
      query = query.where(isVisible(args.PlayerID));
    
    // Order by ID
    query = query.orderBy("ID");
    
    // Execute the query
    const events = await query.execute();
    
    // Format the output
    const formattedEvents = events.map((event: any) => {
      return {
        ID: event.ID,
        Turn: event.Turn,
        Type: event.Type,
        Payload: event.Payload
      };
    });
    
    return {
      Count: formattedEvents.length,
      Events: formattedEvents
    };
  }
}

export default new GetEventsTool();