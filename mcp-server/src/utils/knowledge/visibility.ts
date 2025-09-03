import { MaxMajorCivs, PlayerVisibility } from "../../knowledge/schema/base.js";

/**
 * Marks the visibility of a knowledge item to specific players
 */
export function applyVisibility<T extends PlayerVisibility>(data: T, visibility?: number[]): T {
  if (!visibility) return data;
  for (let i = 0; i < MaxMajorCivs; i++) {
    (data as any)[`Player${i}`] = visibility[i];
  }
  return data;
}

/**
 * Parses visibility flags into a set of player IDs who can see the item
 */
export function parseVisibility<T extends PlayerVisibility>(data: T): number[] {
  const visibleTo: number[] = [];
  for (let i = 0; i < MaxMajorCivs; i++) {
    visibleTo.push((data as any)[`Player${i}`]);
  }
  return visibleTo;
}

/**
 * Checks if a knowledge item is visible to a specific player
 * Returns 2 if fully visible, 1 if partly visible, 0 if not visible
 */
export function getVisibility<T extends PlayerVisibility>(data: T, playerId: number): number {
  return (data as any)[`Player${playerId}`];
}
