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
 * Configuration for event consolidation
 * Maps event types to their matching field paths (uses ID sub-field for matching)
 */
const consolidationConfig: Record<string, string[]> = {
  "TileRevealed": ["Unit", "Player"],
  "UnitMoved": ["Unit", "Player"],
  "UnitPromoted": ["Unit", "Player"]
};

const blockedKeys: string[] = [ "RevealedToTeam", "RevealedToTeamID", "RevealedByTeam", "RevealedByTeamID", "IsFirstDiscovery" ];

/**
 * Consolidates events by turn, stripping turn and ID from individual events
 * @param events - Array of formatted events
 * @returns Object with turn keys containing arrays of events
 */
function consolidateEventsByTurn(events: Array<any>): Record<string, any[]> {
  const consolidated: Record<string, any[]> = {};
  
  for (const event of events) {
    const turnKey = `turn-${event.Turn}`;
    
    // Create a copy of the event without Turn
    const { Turn, ID, ...eventWithoutTurn } = event;
    
    if (!consolidated[turnKey]) {
      consolidated[turnKey] = [];
    }
    consolidated[turnKey].push(cleanEventData(eventWithoutTurn));
  }

  for (const key of Object.keys(consolidated)) {
    consolidated[key] = consolidateConsecutiveEvents(consolidated[key]);
  }
  
  return consolidated;
}

/**
 * Consolidates consecutive events of the same type with matching fields
 */
function consolidateConsecutiveEvents(events: Array<any>): Array<any> {
  if (events.length === 0) return [];
  
  const result: Array<any> = [];
  let currentGroup: any = null;
  
  for (const event of events) {
    const eventType = event.Type;
    const matchFields = consolidationConfig[eventType];
    
    // If this event type isn't configured for consolidation, add as-is
    if (!matchFields) {
      // Flush current group if exists
      if (currentGroup) {
        result.push(currentGroup);
        currentGroup = null;
      }
      result.push(event);
      continue;
    }
    
    // Check if we can add to current group
    if (currentGroup && 
        currentGroup.Type === eventType &&
        eventsMatch(currentGroup, event, matchFields)) {
    } else {
      // Flush current group if exists
      if (currentGroup) result.push(currentGroup);
      
      // Start new group
      const matchingFields: Record<string, any> = {};
      for (const field of matchFields) {
        if (event[field] !== undefined) {
          matchingFields[field] = event[field];
        }
      }
      
      currentGroup = {
        Type: eventType,
        ...matchingFields,
        Events: []
      };
    }

    // Add non-matching fields to the Events array
    const eventCopy = { ...event };
    
    // Remove matching fields and metadata from the event copy
    for (const field of matchFields) {
      delete eventCopy[field];
    }
    delete eventCopy.Type;
    
    // Only add if there are remaining fields
    if (eventCopy && Object.keys(eventCopy).length > 0) {
      currentGroup.Events.push(eventCopy);
    }
  }
  
  // Flush final group
  if (currentGroup) {
    result.push(currentGroup);
  }

  result.forEach(item => {
    if (item.Events.length === 0) delete item["Events"];
  });
  
  return result;
}

/**
 * Extracts the ID value from a nested field path
 */
function getFieldID(obj: any, fieldPath: string): any {
  const parts = fieldPath.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[part];
  }
  
  // If the field is an object with an ID property, return the ID
  if (current && typeof current === 'object' && 'ID' in current) {
    return current.ID;
  }
  
  return current;
}

/**
 * Checks if two events match on specified fields
 */
function eventsMatch(event1: any, event2: any, matchFields: string[]): boolean {
  for (const field of matchFields) {
    const id1 = getFieldID(event1, field);
    const id2 = getFieldID(event2, field);
    
    // If either ID is undefined or they don't match, events don't match
    if (id1 === undefined || id2 === undefined || id1 !== id2) {
      return false;
    }
  }
  
  return true;
}

/**
 * Recursively cleans an object by removing -1, "None", "", and empty objects
 * @param obj - Object to clean
 * @returns Cleaned object or undefined if empty
 */
function cleanEventData(obj: any): any {
  // Handle primitives
  if (obj === -1 || obj === "None" || obj === "") {
    return undefined;
  }
  
  // Handle null/undefined
  if (obj == null) {
    return undefined;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    const cleaned = obj
      .map(item => cleanEventData(item))
      .filter(item => item !== undefined);
    return cleaned.length > 0 ? cleaned : undefined;
  }
  
  // Handle objects
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (blockedKeys.includes(key)) continue;
      cleaned[key] = cleanEventData(value);
    }

    for (const key of Object.keys(cleaned)) {
      if (key.endsWith("ID")) {
        const nested = cleaned[key.substring(0, key.length - 2)];
        if (nested && typeof(nested) === "object") {
          nested.ID = cleaned[key];
          delete cleaned[key];
        }
      }
      if (key.endsWith("X")) {
        const nested = cleaned[key.substring(0, key.length - 1)];
        if (nested && typeof(nested) === "object") {
          nested.X = cleaned[key];
          delete cleaned[key];
        }
      }
      if (key.endsWith("Y")) {
        const nested = cleaned[key.substring(0, key.length - 1)];
        if (nested && typeof(nested) === "object") {
          nested.Y = cleaned[key];
          delete cleaned[key];
        }
      }
    }
    
    // Return undefined if the object is empty after cleaning
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }
  
  // Return other values as-is
  return obj;
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