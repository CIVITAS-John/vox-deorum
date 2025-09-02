/**
 * TeamSetHasTech Event
 * 
 * Triggered whenever a team's technology status is changed in Civilization V.
 * This event fires when a team either acquires or loses a technology.
 */
export interface TeamSetHasTech {
  /** The unique identifier of the team whose technology status changed */
  TeamId: number;
  
  /** The technology type index (TechTypes enum value) representing which technology was affected */
  TechType: number;
  
  /** The new technology status - true if the team now has the technology, false if they lost it */
  HasTech: boolean;
}