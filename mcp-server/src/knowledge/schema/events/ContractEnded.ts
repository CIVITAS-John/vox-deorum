import { z } from 'zod';

/**
 * Schema for the ContractEnded event
 * Triggered when an active contract reaches its conclusion and is terminated
 */
export const ContractEnded = z.object({
  /** The player ID who held/owned the contract */
  HolderPlayerId: z.number(),
  /** The type/ID of the contract that ended */
  ContractTypeId: z.number()
});