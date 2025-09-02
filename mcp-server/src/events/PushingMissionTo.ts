/**
 * Event triggered when a unit is about to execute a mission to a specific plot location in Civilization V.
 * Part of the Community Patch framework's RED combat mission system.
 */
export interface PushingMissionTo {
  /** The ID of the player who owns the unit executing the mission */
  PlayerId: number;
  
  /** The unique identifier of the unit that will execute the mission */
  UnitId: number;
  
  /** The X coordinate of the target plot where the mission will be executed */
  TargetX: number;
  
  /** The Y coordinate of the target plot where the mission will be executed */
  TargetY: number;
  
  /** The type of mission being executed (corresponds to MissionTypes enum) */
  MissionType: number;
}