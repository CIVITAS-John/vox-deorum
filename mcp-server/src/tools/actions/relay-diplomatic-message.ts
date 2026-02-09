/**
 * Tool for relaying diplomatic messages from one civilization's diplomat to the leader.
 * Creates a DiplomaticMessage event in the GameEvents table.
 */

import { DynamicEventTool, resolvePlayerName } from '../abstract/dynamic-event.js';
import * as z from 'zod';
import { Selectable } from 'kysely';
import { MaxMajorCivs } from '../../knowledge/schema/base.js';
import { PlayerInformation } from '../../knowledge/schema/public.js';

/** Input schema for the diplomatic message relay tool */
const RelayDiplomaticMessageInputSchema = z.object({
  PlayerID: z.number().min(0).max(MaxMajorCivs - 1)
    .describe('The receiving player ID (the leader being informed)'),
  FromPlayerID: z.number().min(0).max(MaxMajorCivs - 1)
    .describe('The player ID of the civilization whose diplomat is sending the message'),
  Message: z.string().min(1).max(2000)
    .describe('The diplomatic message content'),
  Reaction: z.string().min(1).max(500)
    .describe("The diplomat's assessment or reaction to the situation"),
  VisibleTo: z.array(z.number().min(0).max(MaxMajorCivs - 1)).optional()
    .describe('Override: player IDs who can see this event (defaults to [ToPlayerID])')
});

/**
 * Tool that relays a diplomatic message from one player's diplomat to the leader.
 * Creates a DiplomaticMessage event in the GameEvents table.
 */
class DiplomaticMessageRelayTool extends DynamicEventTool {
  readonly name = 'relay-diplomatic-message';
  readonly description = 'Relay a diplomatic message from a diplomat to the leader, stored as a game event';
  readonly eventType = 'DiplomaticMessage';
  readonly inputSchema = RelayDiplomaticMessageInputSchema;

  readonly metadata = {
    autoComplete: ['PlayerID']
  };

  /**
   * Build the enriched payload with resolved player names.
   */
  protected async buildPayload(
    args: z.infer<typeof RelayDiplomaticMessageInputSchema>,
    playerMap: Map<number, Selectable<PlayerInformation>>
  ): Promise<Record<string, unknown>> {
    return {
      ToPlayerID: args.PlayerID,
      FromPlayerID: args.FromPlayerID,
      ToPlayer: resolvePlayerName(playerMap, args.PlayerID),
      FromPlayer: resolvePlayerName(playerMap, args.FromPlayerID),
      Message: args.Message,
      Reaction: args.Reaction
    };
  }
}

/** Factory function for tool registration */
export default function createRelayDiplomaticMessageTool() {
  return new DiplomaticMessageRelayTool();
}
