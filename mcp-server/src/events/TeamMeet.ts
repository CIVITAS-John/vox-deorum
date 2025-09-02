/**
 * TeamMeet Event
 * 
 * Triggered when two teams encounter each other for the first time in Civilization V.
 * This event represents the initial diplomatic contact between civilizations.
 */
export interface TeamMeet {
  /** The ID of the team that is being met (the other team) */
  MetTeamId: number;
  
  /** The ID of the current team (the team experiencing the meeting) */
  TeamId: number;
}