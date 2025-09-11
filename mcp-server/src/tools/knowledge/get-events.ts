/**
 * Tool for retrieving game events from the knowledge database
 */

import { knowledgeManager } from "../../server.js";
import { ToolBase } from "../base.js";
import * as z from "zod";
import { isAfter, isAtTurn, isVisible } from "../../knowledge/expressions.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { parseVisibility } from "../../utils/knowledge/visibility.js";
import { getPlayerSummaries } from "../../knowledge/getters/player-summary.js";
import { PlayerSummary } from "../../knowledge/schema/timed.js";
import { Selectable } from "kysely";

/**
 * Input schema for the GetEvents tool
 */
const GetEventsInputSchema = z.object({
  Turn: z.number().optional().describe("Turn number filter"),
  Type: z.string().optional().describe("Event type string filter"),
  After: z.number().optional().describe("Event ID filter"),
  PlayerID: z.number().min(0).max(MaxMajorCivs - 1).optional().describe("Player ID visibility filter"),
  Consolidated: z.boolean().optional().describe("Send out consolidated events for fewer token usage")
});

/**
 * Schema for game event output
 */
const GameEventOutputSchema = z.object({
  ID: z.number(),
  Turn: z.number(),
  Type: z.string(),
  Visibility: z.array(z.number()).optional()
}).passthrough();

/**
 * Output schema for the GetEvents tool
 */
const GetEventsOutputSchema = z.object({
  Count: z.number(),
  Events: (z.union([z.array(GameEventOutputSchema), z.object({}).passthrough()])),
  LastID: z.number()
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
  readonly description = "Retrieves a detailed list of recent game events";

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
    autoComplete: ["PlayerID", "After", "Consolidated"]
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
    if (args.Turn !== undefined)
      query = query.where(isAtTurn(args.Turn));
    // Apply after filter
    if (args.After !== undefined)
      query = query.where(isAfter(args.After));
    // Apply after filter
    if (args.Type !== undefined)
      query = query.where('Type', '=', args.Type);
    // Apply player visibility filter if provided
    if (args.PlayerID !== undefined)
      query = query.where(isVisible(args.PlayerID));
    
    // Order by ID
    query = query.orderBy("ID");
    
    // Execute the query
    const events = await query.execute();

    // Get the player
    const player = args.PlayerID === undefined ? null :
      await knowledgeManager.getStore().getMutableKnowledge("PlayerSummaries", args.PlayerID, undefined, async () => await getPlayerSummaries());
    
    // Format the output
    const formattedEvents = events.map((event: any) => {
      return {
        ID: event.ID,
        Turn: event.Turn,
        Type: event.Type,
        Visibility: args.PlayerID === undefined ? parseVisibility(event) : undefined,
        ...postprocessPayload(event.Payload as any, player)
      };
    });
    
    // Find the largest event ID
    const lastID = formattedEvents.length > 0 
      ? Math.max(...formattedEvents.map(e => e.ID))
      : 0;

    // If consolidation is requested, group events by turn
    if (args.Consolidated) {
      const consolidatedEvents = consolidateEventsByTurn(formattedEvents);
      return {
        Count: formattedEvents.length,
        Events: consolidatedEvents,
        LastID: lastID
      };
    } else {
      return {
        Count: formattedEvents.length,
        Events: formattedEvents,
        LastID: lastID
      };
    }
  }
}

/**
 * Creates a new instance of the get events tool
 */
export default function createGetEventsTool() {
  return new GetEventsTool();
}


/**
 * Consolidates events by turn, stripping turn and ID from individual events
 * @param events - Array of formatted events
 * @returns Object with turn keys containing arrays of events
 */
function consolidateEventsByTurn(events: Array<any>): Record<string, any[]> {
  const consolidated: Record<string, any[]> = {};
  
  for (const event of events) {
    const turnKey = `turn-${event.Turn}`;
    
    // Create a copy of the event without Turn and ID
    const { Turn, ID, ...eventWithoutTurnAndId } = event;
    
    if (!consolidated[turnKey]) {
      consolidated[turnKey] = [];
    }
    
    consolidated[turnKey].push(eventWithoutTurnAndId);
  }
  
  return consolidated;
}

/**
 * Postprocess event payload to redact unknown resources
 * @param payload - The event payload to process
 * @param player - The player context for resource visibility
 * @returns Processed payload with redacted resources
 */
function postprocessPayload(value: Record<string, unknown>, player: Selectable<PlayerSummary> | null): Record<string, unknown> {
  if (!player) return value;

  for (const key of Object.keys(value)) {
    const val = value[key];
    if (!val) continue;
    if (key == "ResourceType") {
      if (player.ResourcesAvailable && Object.keys(player.ResourcesAvailable).indexOf(val as any) === -1) {
        value[key] = "None";
      }
    } else if (typeof(val) === "object") {
      value[key] = postprocessPayload(val as Record<string, unknown>, player);
    }
  }
  
  return value;
}