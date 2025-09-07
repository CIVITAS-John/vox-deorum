import { PublicKnowledge } from "./base";

/**
 * Immutable information about players
 */
export interface PlayerInformation extends PublicKnowledge {
  PlayerID: number;
  TeamID: number;
  Civilization: string;
  Leader: string;
  IsHuman: number;
  IsMajor: number;
}