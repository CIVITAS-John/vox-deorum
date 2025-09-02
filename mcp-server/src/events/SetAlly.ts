/**
 * Event triggered when a minor civilization (city-state) changes its ally status in Civilization V.
 * Occurs when the ally relationship transitions from one major civilization to another, or when established/removed.
 */
export interface SetAlly {
  /** The Player ID of the minor civilization (city-state) whose ally status is changing */
  MinorCivId: number;
  
  /** The Player ID of the previous ally, or -1 if there was no previous ally */
  OldAllyId: number;
  
  /** The Player ID of the new ally, or -1 if the city-state no longer has an ally */
  NewAllyId: number;
}