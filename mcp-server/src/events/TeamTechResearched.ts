/**
 * TeamTechResearched Event
 * 
 * Triggered when a team successfully completes research on a technology in Civilization V.
 * This event provides information about which team researched the technology and any associated changes.
 */
export interface TeamTechResearched {
  /** The ID of the team that researched the technology */
  TeamId: number;
  
  /** The ID of the technology that was researched (TechTypes enum value) */
  TechId: number;
  
  /** The change in research progress or completion status */
  Change: number;
}