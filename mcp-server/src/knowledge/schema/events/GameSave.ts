import { z } from "zod";

/**
 * GameSave event - triggered when the game is being saved to disk
 * This event takes no parameters and provides a general hook for save processing
 */
export const GameSave = z.object({});