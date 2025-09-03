import { PlayerVisibility } from "../../knowledge/schema/base.js";
import { analyzeEventVisibility } from "../lua/event-visibility.js";

/**
 * Marks the visibility of a knowledge item to specific players
 */
export function markVisibility<T extends PlayerVisibility>(data: T, visibility: Set<number>, override = false): T {
  if (override) {
    for (let i = 0; i <= 21; i++) {
      (data as any)[`Player${i}`] = false;
    }
  }
  for (const playerId of visibility) {
    (data as any)[`Player${playerId}`] = true;
  }
  return data;
}

/**
 * Parses visibility flags into a set of player IDs who can see the item
 */
export function parseVisibility<T extends PlayerVisibility>(data: T): Set<number> {
  const visibleTo = new Set<number>();
  for (let i = 0; i <= 21; i++) {
    if ((data as any)[`Player${i}`]) {
      visibleTo.add(i);
    }
  }
  return visibleTo;
}

/**
 * Checks if a knowledge item is visible to a specific player
 * Returns true if visible, false otherwise
 */
export function isVisibleToPlayer<T extends PlayerVisibility>(data: T, playerId: number): boolean {
  return (data as any)[`Player${playerId}`] || false;
}

/**
 * Automatically determine event visibility based on event type and payload
 * @param eventType The type of the event
 * @param payload The event payload
 * @returns Set of player IDs that can see this event
 */
export async function determineEventVisibility(eventType: string, payload: any): Promise<Set<number>> {
  const visibilityArray = await analyzeEventVisibility(eventType, payload);
  if (!visibilityArray) {
    // If analysis fails, default to no visibility
    return new Set<number>();
  }
  return new Set(visibilityArray);
}
