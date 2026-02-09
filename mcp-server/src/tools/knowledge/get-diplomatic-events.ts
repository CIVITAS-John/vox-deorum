/**
 * Tool for retrieving diplomatic game events from the knowledge database,
 * with optional markdown formatting grouped by turn.
 */

import { knowledgeManager } from "../../server.js";
import { ToolBase } from "../base.js";
import * as z from "zod";
import { isVisible } from "../../knowledge/expressions.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { readPublicKnowledgeBatch } from "../../utils/knowledge/cached.js";
import { getPlayerInformations } from "../../knowledge/getters/player-information.js";
import { getCityInformations } from "../../knowledge/getters/city-information.js";
import { retrieveEnumName } from "../../utils/knowledge/enum.js";
import { cleanEventData } from "./get-events.js";
import { Selectable } from "kysely";
import { PlayerInformation } from "../../knowledge/schema/public.js";

// ─── Formatting Helpers ───────────────────────────────────────────────

/** Context for resolving player/team/city IDs to display names */
interface FormatContext {
  /** Current game turn number */
  currentTurn: number;
  /** Resolve a player ID to a display name */
  player: (id: number) => string;
  /** Resolve a team ID to a display name (joined member names) */
  team: (teamId: number) => string;
  /** Resolve city coordinates to a display name */
  city: (x: number, y: number) => string;
}

/** Format a single trade item from a DealMade event */
function fmtTradeItem(item: Record<string, any>, ctx: FormatContext): string {
  switch (item.ItemType) {
    case "Gold": return `${item.Data1} Gold`;
    case "GoldPerTurn": return `${item.Data1} Gold Per Turn`;
    case "Maps": return "World Map";
    case "Resources": return `${item.Data2} ${retrieveEnumName("ResourceType", item.Data1) ?? `Resource ${item.Data1}`}`;
    case "Cities": return `City of ${ctx.city(item.Data1, item.Data2)}`;
    case "OpenBorders": return "Open Borders";
    case "DefensivePact": return "Defensive Pact";
    case "ResearchAgreement": return "Research Agreement";
    case "PeaceTreaty": return "Peace Treaty";
    case "ThirdPartyPeace": return `Peace with ${ctx.player(item.Data1)}`;
    case "ThirdPartyWar": return `War against ${ctx.player(item.Data1)}`;
    case "AllowEmbassy": return "Embassy";
    case "DeclarationOfFriendship": return "Declaration of Friendship";
    case "VoteCommitment": return `Vote Commitment: ${retrieveEnumName("ResolutionType", item.Data1) ?? "World Congress"}`;
    case "Techs": return `Technology: ${retrieveEnumName("TechID", item.Data1) ?? `Tech ${item.Data1}`}`;
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

/** Extract city name from enriched payload, falling back to ctx.city coordinate lookup */
function getCityName(payload: Record<string, any>, ctx: FormatContext): string {
  // Try enriched names first
  const enriched = payload.Capital?.Name ?? payload.City?.Name;
  if (enriched) return enriched;
  // Fall back to coordinate-based lookup (CityX/CityY or CapitalX/CapitalY)
  const x = payload.CityX ?? payload.CapitalX;
  const y = payload.CityY ?? payload.CapitalY;
  if (x !== undefined && y !== undefined) return ctx.city(x, y);
  return "a city";
}

/** Compute deal expiration suffix from TradedItems and StartTurn, marking expired deals */
function getDealExpiry(e: Record<string, any>, ctx: FormatContext): string {
  const items = (e.TradedItems as any[]) ?? [];
  const duration = items.find((i: any) => i.Duration > 0)?.Duration;
  if (duration && e.StartTurn !== undefined) {
    const expiryTurn = e.StartTurn + duration;
    if (ctx.currentTurn > expiryTurn) return " (expired at turn ${expiryTurn})";
    return ` (will expire at turn ${expiryTurn})`;
  }
  return "";
}

// ─── Diplomatic Event Configuration ───────────────────────────────────

/** Configuration for a single diplomatic event type */
interface DiploEventConfig {
  /** Payload fields containing player IDs for relevance filtering */
  playerIdFields: string[];
  /** Payload fields containing team IDs for relevance filtering */
  teamIdFields?: string[];
  /** Convert event payload to a markdown summary line, or null to skip irrelevant events */
  toMarkdown: (payload: Record<string, any>, ctx: FormatContext) => string | null;
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
      return `**${ctx.player(e.OriginatingPlayerID)}**  declared war on **${ctx.team(e.TargetTeamID)}**${aggressor}`;
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
      return `Deal: **${from}** gives [${fmtDealSide(fromGives, ctx)}] ↔ **${to}** gives [${fmtDealSide(toGives, ctx)}]${getDealExpiry(e, ctx)}`;
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
      return `**${ctx.player(e.NewOwnerID)}** ${method} **${getCityName(e, ctx)}** from **${ctx.player(e.OldOwnerID)}** (pop ${e.Population})`;
    }
  },
  CityFlipped: {
    playerIdFields: ["OldOwnerID", "NewOwnerID"],
    toMarkdown: (e, ctx) =>
      `**${getCityName(e, ctx)}** flipped from **${ctx.player(e.OldOwnerID)}** to **${ctx.player(e.NewOwnerID)}**`
  },
  PlayerLiberated: {
    playerIdFields: ["LiberatingPlayerID", "LiberatedPlayerID"],
    toMarkdown: (e, ctx) =>
      `**${ctx.player(e.LiberatingPlayerID)}** liberated **${getCityName(e, ctx)}**, restoring the rule of **${ctx.player(e.LiberatedPlayerID)}**`
  },

  // ── City-State Relations ──

  MinorAlliesChanged: {
    playerIdFields: ["MinorPlayerID", "MajorPlayerID"],
    toMarkdown: (e, ctx) => {
      const status = e.IsNowAlly ? "became ally of" : "lost alliance with";
      return `**${ctx.player(e.MajorPlayerID)}** ${status} **${ctx.player(e.MinorPlayerID)}** (at ${e.NewFriendship} influence)`;
    }
  },
  MinorFriendsChanged: {
    playerIdFields: ["MinorPlayerID", "MajorPlayerID"],
    toMarkdown: (e, ctx) => {
      const status = e.IsNowFriend ? "became friend of" : "lost friendship with";
      return `**${ctx.player(e.MajorPlayerID)}** ${status} **${ctx.player(e.MinorPlayerID)}** (at ${e.NewFriendship} influence)`;
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
      `**${ctx.player(e.PlayerID)}** successfully rigged election of ${getCityName(e, ctx)} (+${e.Value} influence)`
  },
  ElectionResultFailure: {
    playerIdFields: ["PlayerID"],
    toMarkdown: (e, ctx) => {
      if (e.DiminishAmount === 0) return null;
      return `**${ctx.player(e.PlayerID)}** failed to rig election of ${getCityName(e, ctx)} (-${e.DiminishAmount} influence)`;
    }
  },

  // ── Trade ──

  PlayerPlunderedTradeRoute: {
    playerIdFields: ["PlunderingPlayerID", "OriginOwnerID", "DestinationOwnerID"],
    toMarkdown: (e, ctx) =>
      `**${ctx.player(e.PlunderingPlayerID)}** plundered trade route between **${ctx.player(e.OriginOwnerID)}** and **${ctx.player(e.DestinationOwnerID)}** (+${e.PlunderGoldValue} gold)`
  },

  // ── Territory ──

  StealPlot: {
    playerIdFields: ["FromPlayerID", "ToPlayerID"],
    toMarkdown: (e, ctx) =>
      `**${ctx.player(e.ToPlayerID)}** stole territory from **${ctx.player(e.FromPlayerID)}** at (${e.PlotX},${e.PlotY})`
  },

  // ── World Congress ──

  ResolutionResult: {
    playerIdFields: ["ProposerPlayerID"],
    toMarkdown: (e, ctx) => {
      const action = e.IsEnact ? "Enact" : "Repeal";
      const result = e.Passed ? "passed" : "failed";
      const resolution = retrieveEnumName("ResolutionType", e.ResolutionType) ?? `Resolution ${e.ResolutionType}`;
      return `World Congress ${action}: **${resolution}** ${result} (proposed by **${ctx.player(e.ProposerPlayerID)}**)`;
    }
  },

  // ── Multi-Civ Events (synced from event-categories.json) ──

  UnitConverted: {
    playerIdFields: ["OldOwnerID", "NewOwnerID"],
    toMarkdown: (e, ctx) =>
      `**${ctx.player(e.NewOwnerID)}** converted a unit from **${ctx.player(e.OldOwnerID)}**`
  },
  PlayerTradeRouteCompleted: {
    playerIdFields: ["OriginPlayerID", "DestinationPlayerID"],
    toMarkdown: (e, ctx) =>
      `Trade route completed: **${ctx.player(e.OriginPlayerID)}** → **${ctx.player(e.DestinationPlayerID)}**`
  },
  NuclearDetonation: {
    playerIdFields: ["PlayerID"],
    toMarkdown: (e, ctx) => {
      const bystander = e.HurtBystander ? " (and hurt bystanders)" : "";
      return `**${ctx.player(e.PlayerID)}** detonated a nuclear weapon${bystander}`;
    }
  },

  // ── Dynamic Events ──

  RelayedMessage: {
    playerIdFields: ["ToPlayerID", "FromPlayerID"],
    toMarkdown: (e, ctx) => {
      const typeLabel = e.Type === "intelligence" ? "Intelligence" : "Diplomatic message";
      const categories = Array.isArray(e.Categories) ? ` {${e.Categories.join(", ")}}` : "";
      return `${typeLabel} [${e.Confidence ?? "?"}/9]${categories}: **${ctx.player(e.FromPlayerID)}** → **${ctx.player(e.ToPlayerID)}**: "${e.Message}" — Memo: "${e.Memo}"`;
    }
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
  Formatted: z.boolean().optional().default(false)
    .describe("Return formatted markdown summaries instead of raw event data"),
});

/** Output schema: either markdown summaries or raw event payloads, grouped by turn */
const GetDiplomaticEventsOutputSchema = z.union([
  z.record(z.string(), z.array(z.string())),
  z.record(z.string(), z.array(z.any()))
]);

/**
 * Tool that retrieves diplomatic game events (wars, peace treaties, deals,
 * city-state relations, espionage, trade route plundering, world congress)
 * visible to a player, grouped by turn.
 */
class GetDiplomaticEventsTool extends ToolBase {
  /** Unique identifier for the tool */
  readonly name = "get-diplomatic-events";

  /** Human-readable description of the tool */
  readonly description = "Retrieves diplomatic events (wars, peace, deals, city-state relations, espionage, world congress) grouped by turn";

  /** Input schema for the tool */
  readonly inputSchema = GetDiplomaticEventsInputSchema;

  /** Output schema for the tool */
  readonly outputSchema = GetDiplomaticEventsOutputSchema;

  /** Mark as read-only */
  readonly annotations: ToolAnnotations = { readOnlyHint: true };

  /** Rendering hints for MCP clients */
  readonly metadata = {
    autoComplete: ["PlayerID", "OtherPlayerID", "Formatted"],
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

    // Build city coordinate map for resolving traded cities
    const cities = await getCityInformations();
    const cityMap = new Map<string, string>();
    for (const city of cities) {
      cityMap.set(`${city.X},${city.Y}`, city.Name);
    }

    // Build format context with resolvers
    const ctx: FormatContext = {
      currentTurn: knowledgeManager.getTurn(),
      player: (id) => playerNames.get(id) ?? `Player ${id}`,
      team: (teamId) => {
        const members = teamMembers.get(teamId);
        if (!members || members.length === 0) return `Team ${teamId}`;
        return members.map(id => playerNames.get(id) ?? `Player ${id}`).join(" & ");
      },
      city: (x, y) => cityMap.get(`${x},${y}`) ?? `(${x},${y})`
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

    // Process events with relevance filtering
    const result: Record<string, any[]> = {};

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

      if (args.Formatted) {
        // Formatted mode: markdown summaries (skip irrelevant events returning null)
        const line = config.toMarkdown(payload, ctx);
        if (line === null) continue;
        const turnKey = String(event.Turn);
        if (!result[turnKey]) result[turnKey] = [];
        result[turnKey].push(line);
      } else {
        // Raw mode: cleaned event payloads with type
        const turnKey = String(event.Turn);
        if (!result[turnKey]) result[turnKey] = [];
        result[turnKey].push(cleanEventData({ Type: event.Type, ...payload }, false));
      }
    }

    return result;
  }
}

/** Creates a new instance of the get-diplomatic-events tool */
export default function createGetDiplomaticEventsTool() {
  return new GetDiplomaticEventsTool();
}
