/**
 * Event triggered when a player discovers a technology from a goody hut (ancient ruins)
 */
export interface GoodyHutTechResearchedEvent {
  /** The unique identifier of the player who discovered the technology */
  PlayerId: number;
  
  /** The identifier of the technology that was researched */
  TechId: number;
}