import { JSONColumnType } from "kysely";
import { MutableKnowledge, TimedKnowledge } from "./base";

/**
 * Game events with typed payloads
 * Example implementation of dynamic content with JSONColumnType
 */
export interface GameEvent extends TimedKnowledge {
  Type: string;
  Payload: JSONColumnType<Record<string, unknown>>;
}

/**
 * Strategy change records for AI players
 * Visible to the player only, unless espionage (in the future)
 * Unchanged strategies represented as null
 */
export interface StrategyChange extends MutableKnowledge {
  GrandStrategy: number | null;
  EconomicStrategies: JSONColumnType<number[]> | null;
  MilitaryStrategies: JSONColumnType<number[]> | null;
  Rationale: string;
}

/**
 * Player summary information (visible to met players)
 */
export interface PlayerSummary extends MutableKnowledge {
  Era: string; // Localized era name (e.g., "Ancient Era", "Classical Era")
  MajorAllyID: number; // -1 = none, Player:GetAlly()
  Cities: number;
  Population: number;
  Gold: number;
  GoldPerTurn: number; // Player:CalculateGoldRateTimes100() / 100
  TourismPerTurn: number;
  Technologies: number;
  PolicyBranches: JSONColumnType<Record<string, number>>;
  FoundedReligionID: string | null;
  MajorityReligionID: string | null;
  ResourcesAvailable: JSONColumnType<Record<string, number>>;
  
  // Diplomacy visibility documented by the Visibility columns (2: team, 1: met, 0: unmet)
}

/**
 * Player AI-related information (visible to self/espionage reasons)
 */
export interface PlayerStrategy extends MutableKnowledge {
  GrandStrategy: number;
  EconomicStrategies: JSONColumnType<number[]>;
  MilitaryStrategies: JSONColumnType<number[]>;
  DiplomaticFlavors: JSONColumnType<Record<string, number>>;
}

/**
 * Player economics report (visible to self/espionage reasons)
 */
export interface PlayerEconomics extends MutableKnowledge {
}

/**
 * Player science report (visible to self/espionage reasons)
 */
export interface PlayerScience extends MutableKnowledge {
}

/**
 * Player culture report (visible to self/espionage reasons)
 */
export interface PlayerCulture extends MutableKnowledge {
}

/**
 * Player military report (visible to self/espionage reasons)
 */
export interface PlayerMilitary extends MutableKnowledge {
}

/**
 * Player diplomacy report (visible to self/espionage reasons)
 */
export interface PlayerDiplomacy extends MutableKnowledge {
}

/**
 * Player opinion data (visible to self/espionage reasons)
 * Each player has their own opinion fields following the visibility pattern
 */
export interface PlayerOpinions extends MutableKnowledge {
  // Opinion from Player 0 to the Key player
  OpinionFrom0: string | null;
  // Opinion from the Key player to Player 0
  OpinionTo0: string | null;
  
  // Opinion from Player 1 to the Key player
  OpinionFrom1: string | null;
  // Opinion from the Key player to Player 1
  OpinionTo1: string | null;
  
  // Opinion from Player 2 to the Key player
  OpinionFrom2: string | null;
  // Opinion from the Key player to Player 2
  OpinionTo2: string | null;
  
  // Opinion from Player 3 to the Key player
  OpinionFrom3: string | null;
  // Opinion from the Key player to Player 3
  OpinionTo3: string | null;
  
  // Opinion from Player 4 to the Key player
  OpinionFrom4: string | null;
  // Opinion from the Key player to Player 4
  OpinionTo4: string | null;
  
  // Opinion from Player 5 to the Key player
  OpinionFrom5: string | null;
  // Opinion from the Key player to Player 5
  OpinionTo5: string | null;
  
  // Opinion from Player 6 to the Key player
  OpinionFrom6: string | null;
  // Opinion from the Key player to Player 6
  OpinionTo6: string | null;
  
  // Opinion from Player 7 to the Key player
  OpinionFrom7: string | null;
  // Opinion from the Key player to Player 7
  OpinionTo7: string | null;
  
  // Opinion from Player 8 to the Key player
  OpinionFrom8: string | null;
  // Opinion from the Key player to Player 8
  OpinionTo8: string | null;
  
  // Opinion from Player 9 to the Key player
  OpinionFrom9: string | null;
  // Opinion from the Key player to Player 9
  OpinionTo9: string | null;
  
  // Opinion from Player 10 to the Key player
  OpinionFrom10: string | null;
  // Opinion from the Key player to Player 10
  OpinionTo10: string | null;
  
  // Opinion from Player 11 to the Key player
  OpinionFrom11: string | null;
  // Opinion from the Key player to Player 11
  OpinionTo11: string | null;
  
  // Opinion from Player 12 to the Key player
  OpinionFrom12: string | null;
  // Opinion from the Key player to Player 12
  OpinionTo12: string | null;
  
  // Opinion from Player 13 to the Key player
  OpinionFrom13: string | null;
  // Opinion from the Key player to Player 13
  OpinionTo13: string | null;
  
  // Opinion from Player 14 to the Key player
  OpinionFrom14: string | null;
  // Opinion from the Key player to Player 14
  OpinionTo14: string | null;
  
  // Opinion from Player 15 to the Key player
  OpinionFrom15: string | null;
  // Opinion from the Key player to Player 15
  OpinionTo15: string | null;
  
  // Opinion from Player 16 to the Key player
  OpinionFrom16: string | null;
  // Opinion from the Key player to Player 16
  OpinionTo16: string | null;
  
  // Opinion from Player 17 to the Key player
  OpinionFrom17: string | null;
  // Opinion from the Key player to Player 17
  OpinionTo17: string | null;
  
  // Opinion from Player 18 to the Key player
  OpinionFrom18: string | null;
  // Opinion from the Key player to Player 18
  OpinionTo18: string | null;
  
  // Opinion from Player 19 to the Key player
  OpinionFrom19: string | null;
  // Opinion from the Key player to Player 19
  OpinionTo19: string | null;
  
  // Opinion from Player 20 to the Key player
  OpinionFrom20: string | null;
  // Opinion from the Key player to Player 20
  OpinionTo20: string | null;
  
  // Opinion from Player 21 to the Key player
  OpinionFrom21: string | null;
  // Opinion from the Key player to Player 21
  OpinionTo21: string | null;
}