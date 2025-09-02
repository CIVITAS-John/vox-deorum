/**
 * Event triggered when one team declares war against another team in Civilization V
 */
export interface DeclareWarEvent {
  /** The ID of the team that is declaring war */
  DeclaringTeam: number;
  
  /** The ID of the team that war is being declared against */
  TargetTeam: number;
}