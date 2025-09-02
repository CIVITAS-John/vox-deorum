/**
 * TeamSetEra Event
 * 
 * Triggered when a team (civilization) advances to a new era in Civilization V.
 * This event represents a major milestone in a civilization's technological and cultural development.
 */
export interface TeamSetEra {
  /** The ID of the team that has advanced to the new era */
  TeamId: number;
  
  /** The new era that the team has just entered (EraTypes enum value) */
  NewEra: number;
}