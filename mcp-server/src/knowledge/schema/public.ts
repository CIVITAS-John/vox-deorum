import { PublicKnowledge } from "./base";

/**
 * Immutable information about players
 */
export interface PlayerInformation extends PublicKnowledge {
  TeamID: number;
  Civilization: string; // Localized short description
  Leader: string; // Localized name
  IsHuman: number;
  IsMajor: number;
}