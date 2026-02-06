/**
 * Tool for retrieving diplomatic game events from the knowledge database,
 * formatted as markdown summaries grouped by turn.
 */

import { knowledgeManager } from "../../server.js";
import { ToolBase } from "../base.js";
import * as z from "zod";
import { isVisible } from "../../knowledge/expressions.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { readPublicKnowledgeBatch } from "../../utils/knowledge/cached.js";
import { getPlayerInformations } from "../../knowledge/getters/player-information.js";
import { Selectable } from "kysely";
import { PlayerInformation } from "../../knowledge/schema/public.js";

// ─── Formatting Helpers ───────────────────────────────────────────────

/** Context for resolving player/team IDs to display names */
interface FormatContext {
  /** Resolve a player ID to a display name */
  player: (id: number) => string;
  /** Resolve a team ID to a display name (joined member names) */
  team: (teamId: number) => string;
}

/** Format a single trade item from a DealMade event */
function fmtTradeItem(item: Record<string, any>, ctx: FormatContext): string {
  switch (item.ItemType) {
    case "Gold": return `${item.Data1} Gold`;
    case "GoldPerTurn": return `${item.Data1} GPT`;
    case "Maps": return "World Map";
    case "Resources": return "Resource";
    case "Cities": return "City";
    case "OpenBorders": return "Open Borders";
    case "DefensivePact": return "Defensive Pact";
    case "ResearchAgreement": return "Research Agreement";
    case "PeaceTreaty": return "Peace Treaty";
    case "ThirdPartyPeace": return `Peace with ${ctx.player(item.Data1)}`;
    case "ThirdPartyWar": return `War against ${ctx.player(item.Data1)}`;
    case "AllowEmbassy": return "Embassy";
    case "DeclarationOfFriendship": return "Declaration of Friendship";
    case "VoteCommitment": return "Vote Commitment";
    case "Techs": return "Technology";
    case "Vassalage": return "Vassalage";
    case "VassalageRevoke": return "Vassalage Revoked";
    default: return String(item.ItemType);
  }
}

/** Format items for one side of a deal */
function fmtDealSide(items: Record<string, any>[], ctx: FormatContext): string {
  if (items.length === 0) return "nothing";
  return items.map(i => fmtTradeItem(i, ctx)).join(", ");
}

/** Extract city name from enriched payload (handles both CityID and CityX/CityY enrichment patterns) */
function getCityName(payload: Record<string, any>): string {
  return payload.City?.Name ?? payload.City?.City ?? "a city";
}

// ─── Diplomatic Event Configuration ───────────────────────────────────

/** Configuration for a single diplomatic event type */
interface DiploEventConfig {
  /** Payload fields containing player IDs for relevance filtering */
  playerIdFields: string[];
  /** Payload fields containing team IDs for relevance filtering */
  teamIdFields?: string[];
  /** Convert event payload to a markdown summary line */
  toMarkdown: (payload: Record<string, any>, ctx: FormatContext) => string;
}

/**
 * Diplomatic event configuration object.
 * Keys are event type names used as the database filter list.
 * Values define player/team fields for relevance filtering and markdown formatters.
 */
const diplomaticEvents: Record<string, DiploEventConfig> = {

  // ── Major Civ Diplomacy ──

  DeclareWar: {
    playerIdFields: ["OriginatingPlayerID"],
    teamIdFields: ["TargetTeamID"],
    toMarkdown: (e, ctx) => {
      const aggressor = e.IsAggressor ? " (aggressor)" : "";
      return `**${ctx.player(e.OriginatingPlayerID)}** declared war on **${ctx.team(e.TargetTeamID)}**${aggressor}`;
    }
  },
  MakePeace: {
    playerIdFields: ["OriginatingPlayerID"],
    teamIdFields: ["TargetTeamID"],
    toMarkdown: (e, ctx) =>
      `**${ctx.player(e.OriginatingPlayerID)}** made peace with **${ctx.team(e.TargetTeamID)}**`
  },
  DealMade: {
    playerIdFields: ["FromPlayerID", "ToPlayerID"],
    toMarkdown: (e, ctx) => {
      const from = ctx.player(e.FromPlayerID);
      const to = ctx.player(e.ToPlayerID);
      const items = (e.TradedItems as any[]) ?? [];
      const fromGives = items.filter((i: any) => i.FromPlayerID === e.FromPlayerID);
      const toGives = items.filter((i: any) => i.FromPlayerID === e.ToPlayerID);
      return `Deal: **${from}** gives [${fmtDealSide(fromGives, ctx)}] ↔ **${to}** gives [${fmtDealSide(toGives, ctx)}]`;
    }
  },
  TeamMeet: {
    playerIdFields: [],
    teamIdFields: ["CurrentTeamID", "OtherTeamID"],
    toMarkdown: (e, ctx) =>
      `**${ctx.team(e.CurrentTeamID)}** met **${ctx.team(e.OtherTeamID)}** for the first time`
  },

  // ── City Ownership ──

  CityCaptureComplete: {
    playerIdFields: ["OldOwnerID", "NewOwnerID"],
    toMarkdown: (e, ctx) => {
      const method = e.IsConquest ? "conquered" : "acquired";
      return `**${ctx.player(e.NewOwnerID)}** ${method} **${getCityName(e)}** from **${ctx.player(e.OldOwnerID)}** (pop ${e.Population})`;
    }
  },
  CityFlipped: {
    playerIdFields: ["OldOwnerID", "NewOwnerID"],
    toMarkdown: (e, ctx) =>
      `**${getCityName(e)}** flipped from **${ctx.player(e.OldOwnerID)}** to **${ctx.player(e.NewOwnerID)}**`
  },
  PlayerLiberated: {
    playerIdFields: ["LiberatingPlayerID", "LiberatedPlayerID"],
    toMarkdown: (e, ctx) =>
      `**${ctx.player(e.LiberatingPlayerID)}** liberated **${getCityName(e)}**, restoring **${ctx.player(e.LiberatedPlayerID)}**`
  },

  // ── City-State Relations ──

  MinorAlliesChanged: {
    playerIdFields: ["MinorPlayerID", "MajorPlayerID"],
    toMarkdown: (e, ctx) => {
      const status = e.IsNowAlly ? "became ally of" : "lost alliance with";
      return `**${ctx.player(e.MajorPlayerID)}** ${status} **${ctx.player(e.MinorPlayerID)}** (${e.OldFriendship}→${e.NewFriendship})`;
    }
  },
  MinorFriendsChanged: {
    playerIdFields: ["MinorPlayerID", "MajorPlayerID"],
    toMarkdown: (e, ctx) => {
      const status = e.IsNowFriend ? "became friend of" : "lost friendship with";
      return `**${ctx.player(e.MajorPlayerID)}** ${status} **${ctx.player(e.MinorPlayerID)}** (${e.OldFriendship}→${e.NewFriendship})`;
    }
  },
  SetAlly: {
    playerIdFields: ["MinorPlayerID", "OldAllyPlayerID", "NewAllyPlayerID"],
    toMarkdown: (e, ctx) => {
      const oldAlly = e.OldAllyPlayerID >= 0 ? ctx.player(e.OldAllyPlayerID) : "none";
      const newAlly = e.NewAllyPlayerID >= 0 ? ctx.player(e.NewAllyPlayerID) : "none";
      return `**${ctx.player(e.MinorPlayerID)}** ally changed: **${oldAlly}** → **${newAlly}**`;
    }
  },
  MinorGift: {
    playerIdFields: ["MinorPlayerID", "MajorPlayerID"],
    toMarkdown: (e, ctx) =>
      `**${ctx.player(e.MinorPlayerID)}** gave first-contact gift to **${ctx.player(e.MajorPlayerID)}** (+${e.FriendshipBoost} influence)`
  },
  MinorGiftUnit: {
    playerIdFields: ["MinorPlayerID", "MajorPlayerID"],
    toMarkdown: (e, ctx) =>
      `**${ctx.player(e.MinorPlayerID)}** gifted a military unit to **${ctx.player(e.MajorPlayerID)}**`
  },
  PlayerGifted: {
    playerIdFields: ["GivingPlayerID", "ReceivingPlayerID"],
    toMarkdown: (e, ctx) => {
      const detail = e.GoldAmount > 0 ? ` ${e.GoldAmount} gold` : "";
      return `**${ctx.player(e.GivingPlayerID)}** gifted${detail} to **${ctx.player(e.ReceivingPlayerID)}**`;
    }
  },
  PlayerBullied: {
    playerIdFields: ["BullyingPlayerID", "MinorPlayerID"],
    toMarkdown: (e, ctx) => {
      const tribute = e.Amount > 0 ? ` (${e.Amount})` : "";
      return `**${ctx.player(e.BullyingPlayerID)}** bullied **${ctx.player(e.MinorPlayerID)}** for tribute${tribute}`;
    }
  },
  PlayerBoughtOut: {
    playerIdFields: ["BuyingPlayerID", "MinorPlayerID"],
    toMarkdown: (e, ctx) =>
      `**${ctx.player(e.BuyingPlayerID)}** bought out **${ctx.player(e.MinorPlayerID)}**`
  },
  PlayerProtected: {
    playerIdFields: ["MajorPlayerID", "MinorPlayerID"],
    toMarkdown: (e, ctx) =>
      `**${ctx.player(e.MajorPlayerID)}** pledged to protect **${ctx.player(e.MinorPlayerID)}**`
  },
  PlayerRevoked: {
    playerIdFields: ["MajorPlayerID", "MinorPlayerID"],
    toMarkdown: (e, ctx) =>
      `**${ctx.player(e.MajorPlayerID)}** revoked protection of **${ctx.player(e.MinorPlayerID)}**`
  },

  // ── Espionage ──

  EspionageNotificationData: {
    playerIdFields: ["SourcePlayerID", "TargetPlayerID"],
    toMarkdown: (e, ctx) =>
      `Espionage: **${ctx.player(e.SourcePlayerID)}** conducted operation against **${ctx.player(e.TargetPlayerID)}** (result: ${e.SpyResult})`
  },
  ElectionResultSuccess: {
    playerIdFields: ["PlayerID"],
    toMarkdown: (e, ctx) =>
      `**${ctx.player(e.PlayerID)}** successfully rigged election (+${e.Value} influence)`
  },
  ElectionResultFailure: {
    playerIdFields: ["PlayerID"],
    toMarkdown: (e, ctx) =>
      `**${ctx.player(e.PlayerID)}** failed to rig election (-${e.DiminishAmount} influence)`
  },

  // ── Trade ──

  PlayerPlunderedTradeRoute: {
    playerIdFields: ["PlunderingPlayerID", "OriginOwnerID", "DestinationOwnerID"],
    toMarkdown: (e, ctx) =>
      `**${ctx.player(e.PlunderingPlayerID)}** plundered trade route between **${ctx.player(e.OriginOwnerID)}** and **${ctx.player(e.DestinationOwnerID)}** (+${e.PlunderGoldValue} gold)`
  }
};

/** All diplomatic event type names, derived from the config keys */
const diplomaticEventTypes = Object.keys(diplomaticEvents);

// ─── Tool Definition ──────────────────────────────────────────────────

/** Input schema for the get-diplomatic-events tool */
const GetDiplomaticEventsInputSchema = z.object({
  PlayerID: z.number().min(0).max(MaxMajorCivs - 1)
    .describe("Player ID whose perspective to view from (visibility filter)"),
  OtherPlayerID: z.number().min(0).max(MaxMajorCivs - 1).optional()
    .describe("Only show events relevant to this other player"),
  FromTurn: z.number().optional()
    .describe("Only show events from this turn onwards"),
  ToTurn: z.number().optional()
    .describe("Only show events up to and including this turn"),
});

/** Output schema: turn number keys mapping to arrays of markdown summary lines */
const GetDiplomaticEventsOutputSchema = z.record(z.string(), z.array(z.string()));

/**
 * Tool that retrieves diplomatic game events (wars, peace treaties, deals,
 * city-state relations, espionage, trade route plundering) visible to a player,
 * formatted as markdown summaries grouped by turn.
 */
class GetDiplomaticEventsTool extends ToolBase {
  /** Unique identifier for the tool */
  readonly name = "get-diplomatic-events";

  /** Human-readable description of the tool */
  readonly description = "Retrieves diplomatic events (wars, peace, deals, city-state relations, espionage) formatted as markdown summaries grouped by turn";

  /** Input schema for the tool */
  readonly inputSchema = GetDiplomaticEventsInputSchema;

  /** Output schema for the tool */
  readonly outputSchema = GetDiplomaticEventsOutputSchema;

  /** Mark as read-only */
  readonly annotations: ToolAnnotations = { readOnlyHint: true };

  /** Rendering hints for MCP clients */
  readonly metadata = {
    autoComplete: ["PlayerID", "OtherPlayerID"],
    markdownConfig: ["Turn {key}", "{key}"]
  };

  /** Execute the tool to retrieve and format diplomatic events */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const db = knowledgeManager.getStore().getDatabase();

    // Load player info for name resolution
    const players = await readPublicKnowledgeBatch(
      "PlayerInformations", getPlayerInformations
    ) as Selectable<PlayerInformation>[];

    // Build name and team membership maps
    const playerNames = new Map<number, string>();
    const teamMembers = new Map<number, number[]>();
    for (const p of players) {
      playerNames.set(p.Key, p.IsMajor ? p.Civilization : p.Leader);
      if (!teamMembers.has(p.TeamID)) teamMembers.set(p.TeamID, []);
      teamMembers.get(p.TeamID)!.push(p.Key);
    }

    // Build format context with resolvers
    const ctx: FormatContext = {
      player: (id) => playerNames.get(id) ?? `Player ${id}`,
      team: (teamId) => {
        const members = teamMembers.get(teamId);
        if (!members || members.length === 0) return `Team ${teamId}`;
        return members.map(id => playerNames.get(id) ?? `Player ${id}`).join(" & ");
      }
    };

    // Resolve OtherPlayer's team ID for team-based relevance filtering
    const otherTeamId = args.OtherPlayerID !== undefined
      ? players.find(p => p.Key === args.OtherPlayerID)?.TeamID
      : undefined;

    // Query diplomatic events visible to the player
    let query = db.selectFrom("GameEvents")
      .selectAll()
      .where("Type", "in", diplomaticEventTypes)
      .where(isVisible(args.PlayerID))
      .orderBy("ID");

    if (args.FromTurn !== undefined)
      query = query.where("Turn", ">=", args.FromTurn);
    if (args.ToTurn !== undefined)
      query = query.where("Turn", "<=", args.ToTurn);

    const events = await query.execute();

    // Process events: apply relevance filter and format to markdown
    const result: Record<string, string[]> = {};

    for (const event of events) {
      const config = diplomaticEvents[event.Type];
      if (!config) continue;

      const payload = event.Payload as Record<string, any>;

      // Apply OtherPlayerID relevance filter
      if (args.OtherPlayerID !== undefined) {
        const playerMatch = config.playerIdFields.some(
          field => payload[field] === args.OtherPlayerID
        );
        const teamMatch = config.teamIdFields?.some(
          field => otherTeamId !== undefined && payload[field] === otherTeamId
        ) ?? false;

        if (!playerMatch && !teamMatch) continue;
      }

      // Format to markdown and group by turn
      const markdown = config.toMarkdown(payload, ctx);
      const turnKey = String(event.Turn);

      if (!result[turnKey]) result[turnKey] = [];
      result[turnKey].push(markdown);
    }

    return result;
  }
}

/** Creates a new instance of the get-diplomatic-events tool */
export default function createGetDiplomaticEventsTool() {
  return new GetDiplomaticEventsTool();
}
