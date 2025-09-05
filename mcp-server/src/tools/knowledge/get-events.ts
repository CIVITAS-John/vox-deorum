/**
 * Tool for retrieving game events from the knowledge database
 */

import { knowledgeManager } from "../../server.js";
import { ToolBase } from "../base.js";
import * as z from "zod";
import { isAtTurn, isVisible } from "../../knowledge/expressions.js";

/**
 * Input schema for the GetEvents tool
 */
const GetEventsInputSchema = z.object({
  turn: z.number().optional().describe("Optional turn number to filter events. If not provided, returns events from the last turn."),
  playerID: z.number().min(0).max(21).optional().describe("Optional player ID to filter events visible to that player. If not provided, returns events visible to all players.")
});

/**
 * Schema for game event output
 */
const GameEventOutputSchema = z.object({
  id: z.number(),
  turn: z.number(),
  type: z.string(),
  payload: z.record(z.unknown()),
  createdAt: z.number(),
  visibility: z.record(z.string(), z.number()).optional()
});

/**
 * Output schema for the GetEvents tool
 */
const GetEventsOutputSchema = z.object({
  events: z.array(GameEventOutputSchema),
  count: z.number(),
  filters: z.object({
    turn: z.number().optional(),
    playerID: z.number().optional()
  })
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
  readonly annotations = undefined;

  /**
   * Execute the tool to retrieve game events
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const db = knowledgeManager.getStore().getDatabase();
    
    // Build the query
    let query = db.selectFrom("GameEvents")
      .selectAll();
    // Apply turn filter
    if (args.turn)
      query = query.where(isAtTurn(args.turn));
    // Apply player visibility filter if provided
    if (args.playerID)
      query = query.where(isVisible(args.playerID));
    
    // Order by turn and creation time
    query = query.orderBy("Turn", "desc").orderBy("CreatedAt", "desc");
    
    // Execute the query
    const events = await query.execute();
    
    // Format the output
    const formattedEvents = events.map((event: any) => {
      const output: any = {
        id: event.ID,
        turn: event.Turn,
        type: event.Type,
        payload: event.Payload,
        createdAt: event.CreatedAt
      };
      
      return output;
    });
    
    return {
      events: formattedEvents,
      count: formattedEvents.length,
      filters: {
        turn: args.turn,
        playerID: args.playerID
      }
    };
  }
}

export default new GetEventsTool();