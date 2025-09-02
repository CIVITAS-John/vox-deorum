/**
 * Event triggered when two teams establish a peace agreement, ending their state of war
 */
export interface MakePeaceEvent {
  /** The ID of the team that is making peace (the initiating team) */
  TeamId: number;
  
  /** The ID of the other team involved in the peace agreement */
  OtherTeamId: number;
}