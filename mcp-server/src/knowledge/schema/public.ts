import { PublicKnowledge } from "./base";

/**
 * Immutable information about players
 */
export interface PlayerInformation extends PublicKnowledge {
  PlayerID: number;
  TeamID: number;
  Civilization: string; // Localized name
  Leader: string; // Localized name
  IsHuman: number;
  IsMajor: number;
}