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
  CreatedReligion: string | null;
  MajorityReligion: string | null;
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