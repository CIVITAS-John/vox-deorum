/**
 * Event triggered when a nuclear weapon is detonated
 */
export interface NuclearDetonationEvent {
  /** The player ID of the civilization that launched the nuclear weapon */
  AttackerOwner: number;
  
  /** The X coordinate of the plot where the nuclear weapon detonated */
  TargetX: number;
  
  /** The Y coordinate of the plot where the nuclear weapon detonated */
  TargetY: number;
  
  /** Indicates whether the attacker and target owner are at war */
  IsAtWar: boolean;
  
  /** Indicates whether there are bystander civilizations affected by the detonation */
  HasBystanders: boolean;
}