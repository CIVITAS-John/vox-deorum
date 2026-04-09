/**
 * @module narrators/sessions/assemble-session
 *
 * Stage 1 of the narrator pipeline: parses segments.jsonl and the game's
 * knowledge DB to produce workspace/episodes.json.
 * No LLM — pure data transformation.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Kysely, Selectable } from 'kysely';
import type { KnowledgeDatabase } from '../../../../mcp-server/dist/knowledge/schema/index.js';
import type { PlayerInformation } from '../../../../mcp-server/dist/knowledge/schema/index.js';
import { VoxSession } from '../../infra/vox-session.js';
import { createLogger } from '../../utils/logger.js';
import { openReadonlyGameDb } from '../../archivist/pipeline/scanner.js';
import { agentRegistry } from '../../infra/agent-registry.js';
import type { Strategist } from '../../strategist/strategist.js';
import { NarratorWorkspace } from '../workspace.js';
import { parseAndDecompose } from '../utils/episode-parser.js';
import type { AssembleConfig, Episode, Episodes } from '../types.js';
import type { SessionStatus } from '../../types/api.js';

const logger = createLogger('AssembleSession');

/** Regex for game database files: {gameId}_{timestamp}.db */
const GAME_DB_REGEX = /^(.+?)_(\d+)\.db$/;

export class AssembleSession extends VoxSession<AssembleConfig> {
  private workspace: NarratorWorkspace;

  constructor(config: AssembleConfig) {
    super(config);
    this.workspace = new NarratorWorkspace(config.workspace);
  }

  async start(): Promise<void> {
    this.onStateChange('running');
    this.gameID = this.config.gameID;

    let db: Kysely<KnowledgeDatabase> | undefined;

    try {
      // 1. Prepare workspace
      this.workspace.ensureDir();

      // 2. Validate recording directory
      const segmentsPath = path.join(this.config.recordingDir, 'segments.jsonl');
      if (!fs.existsSync(segmentsPath)) {
        throw new Error(`segments.jsonl not found at ${segmentsPath}`);
      }

      // 3. Resolve knowledge DB path
      const knowledgePath = this.config.knowledgePath
        ? path.resolve(this.config.knowledgePath)
        : this.findKnowledgeDb(this.config.gameID);

      if (!knowledgePath) {
        throw new Error(
          `Could not find knowledge DB for game ${this.config.gameID}. ` +
          `Provide knowledgePath explicitly or ensure the DB exists in mcp-server/archive/.`
        );
      }

      if (!fs.existsSync(knowledgePath)) {
        throw new Error(`Knowledge DB not found at ${knowledgePath}`);
      }

      // 4. Write workspace context for later stages
      this.workspace.writeContext({
        gameID: this.config.gameID,
        knowledgePath,
        recordingDir: path.resolve(this.config.recordingDir),
      });

      // 5. Open knowledge DB
      db = openReadonlyGameDb(knowledgePath) ?? undefined;
      if (!db) {
        throw new Error(`Failed to open knowledge DB at ${knowledgePath}`);
      }

      // 6. Query PlayerInformations
      const playerInfoRows = await db
        .selectFrom('PlayerInformations')
        .selectAll()
        .execute();

      const playerInfoMap = new Map<number, Selectable<PlayerInformation>>();
      const minorCivIDs = new Set<number>();
      for (const row of playerInfoRows) {
        playerInfoMap.set(row.Key, row);
        if (!row.IsMajor) {
          minorCivIDs.add(row.Key);
        }
      }

      // 7. Parse segments.jsonl into episodes
      const segmentsContent = fs.readFileSync(segmentsPath, 'utf-8');
      const episodes = parseAndDecompose(segmentsContent, minorCivIDs);
      logger.info(`Parsed ${episodes.length} episodes from segments.jsonl`);

      if (episodes.length === 0) {
        logger.warn('No valid episodes found in segments.jsonl');
      }

      // 8. Batch-query GameEvents and populate eventCounts
      await this.populateEventCounts(db, episodes);

      // 9. Query game metadata (winner)
      const winner = await this.queryWinner(db);

      // 10. Extract player types
      const playerTypes = await this.extractPlayerTypes(db, playerInfoMap);

      // 11. Compute totalTurns
      const totalTurns = episodes.length > 0
        ? Math.max(...episodes.map((e) => e.turn))
        : 0;

      // 12. Assemble and write output
      const output: Episodes = {
        gameID: this.config.gameID,
        totalTurns,
        players: playerInfoRows,
        playerTypes,
        ...(winner && { winner }),
        episodes,
      };

      this.workspace.writeEpisodes(output);
      logger.info(`Stage 1 complete: ${episodes.length} episodes, ${totalTurns} turns`);
      this.onStateChange('stopped');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Assemble failed: ${message}`);
      this.onStateChange('error', message);
      throw error;
    } finally {
      if (db) await db.destroy();
    }
  }

  async stop(): Promise<void> {
    this.abortController.abort();
    this.onStateChange('stopped');
  }

  getStatus(): SessionStatus {
    return {
      id: this.id,
      type: this.config.type,
      state: this.state,
      config: this.config,
      startTime: this.startTime,
      gameID: this.gameID,
      error: this.errorMessage,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────

  /**
   * Search mcp-server/archive/ for a knowledge DB matching the gameID.
   * Returns the path with the latest timestamp, or null if not found.
   */
  private findKnowledgeDb(gameID: string): string | null {
    // Resolve archive path relative to project root
    const archiveDir = path.resolve('mcp-server', 'archive');
    if (!fs.existsSync(archiveDir)) {
      logger.warn(`Archive directory not found: ${archiveDir}`);
      return null;
    }

    let bestPath: string | null = null;
    let bestTimestamp = 0;

    const experiments = fs.readdirSync(archiveDir, { withFileTypes: true });
    for (const entry of experiments) {
      if (!entry.isDirectory()) continue;
      const expDir = path.join(archiveDir, entry.name);
      const files = fs.readdirSync(expDir);

      for (const file of files) {
        const match = GAME_DB_REGEX.exec(file);
        if (match && match[1] === gameID) {
          const timestamp = parseInt(match[2], 10);
          if (timestamp > bestTimestamp) {
            bestTimestamp = timestamp;
            bestPath = path.join(expDir, file);
          }
        }
      }
    }

    // Also check mcp-server/data/ for an active game DB
    const dataDir = path.resolve('mcp-server', 'data');
    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir);
      for (const file of files) {
        // Active DBs may be named {gameID}.db (no timestamp)
        if (file === `${gameID}.db`) {
          const candidate = path.join(dataDir, file);
          // Prefer archive (has full game data) unless no archive exists
          if (!bestPath) bestPath = candidate;
        }
        const match = GAME_DB_REGEX.exec(file);
        if (match && match[1] === gameID) {
          const timestamp = parseInt(match[2], 10);
          if (timestamp > bestTimestamp) {
            bestTimestamp = timestamp;
            bestPath = path.join(dataDir, file);
          }
        }
      }
    }

    if (bestPath) {
      logger.info(`Found knowledge DB for ${gameID}: ${bestPath}`);
    }

    return bestPath;
  }

  /**
   * Batch-query all GameEvents for relevant turns and populate episode eventCounts.
   * For minor civ episodes, also checks for ResolutionResult → worldCongress flag.
   */
  private async populateEventCounts(
    db: Kysely<KnowledgeDatabase>,
    episodes: Episode[],
  ): Promise<void> {
    // Collect unique turns
    const turns = [...new Set(episodes.map((e) => e.turn))];
    if (turns.length === 0) return;

    // Batch-query all events for these turns
    const events = await db
      .selectFrom('GameEvents')
      .selectAll()
      .where('Turn', 'in', turns)
      .execute();

    // Build lookup: (turn, playerID) → eventType → count
    // Also track ResolutionResult turns for World Congress detection
    const eventBuckets = new Map<string, Record<string, number>>();
    const resolutionTurns = new Set<number>();

    for (const event of events) {
      if (event.Type === 'ResolutionResult') {
        resolutionTurns.add(event.Turn);
      }

      // Check which players can see this event via Player{N} visibility flags
      for (let pid = 0; pid < 22; pid++) {
        const visibility = (event as any)[`Player${pid}`];
        if (typeof visibility === 'number' && visibility >= 1) {
          const key = `${event.Turn}:${pid}`;
          if (!eventBuckets.has(key)) {
            eventBuckets.set(key, {});
          }
          const bucket = eventBuckets.get(key)!;
          bucket[event.Type] = (bucket[event.Type] || 0) + 1;
        }
      }
    }

    // Apply to episodes
    for (const episode of episodes) {
      if (episode.playerID === -1) {
        // Minor civ: check for World Congress
        if (resolutionTurns.has(episode.turn)) {
          episode.worldCongress = true;
        }
      } else {
        const key = `${episode.turn}:${episode.playerID}`;
        const counts = eventBuckets.get(key);
        if (counts) {
          episode.eventCounts = counts;
        }
      }
    }

    logger.info(
      `Processed ${events.length} events across ${turns.length} turns`
    );
  }

  /** Query victoryPlayerID and victoryType from GameMetadata */
  private async queryWinner(
    db: Kysely<KnowledgeDatabase>,
  ): Promise<{ playerID: number; victoryType: string } | null> {
    const victoryRow = await db
      .selectFrom('GameMetadata')
      .select('Value')
      .where('Key', '=', 'victoryPlayerID')
      .executeTakeFirst();

    if (!victoryRow) return null;

    const playerID = parseInt(victoryRow.Value, 10);
    if (isNaN(playerID) || playerID < 0) return null;

    const victoryTypeRow = await db
      .selectFrom('GameMetadata')
      .select('Value')
      .where('Key', '=', 'victoryType')
      .executeTakeFirst();

    const victoryType = victoryTypeRow?.Value ?? 'Unknown';
    return { playerID, victoryType };
  }

  /**
   * Extract player type labels from GameMetadata + agent registry.
   * For each major player: look up strategist name and model from GameMetadata,
   * then resolve display name from the agent registry.
   */
  private async extractPlayerTypes(
    db: Kysely<KnowledgeDatabase>,
    playerInfoMap: Map<number, Selectable<PlayerInformation>>,
  ): Promise<Record<number, string>> {
    const playerTypes: Record<number, string> = {};

    for (const [playerID, info] of playerInfoMap) {
      if (!info.IsMajor) continue;

      const strategistRow = await db
        .selectFrom('GameMetadata')
        .select('Value')
        .where('Key', '=', `strategist-${playerID}`)
        .executeTakeFirst();

      const modelRow = await db
        .selectFrom('GameMetadata')
        .select('Value')
        .where('Key', '=', `model-${playerID}`)
        .executeTakeFirst();

      const strategistName = strategistRow?.Value;
      const modelName = modelRow?.Value;

      if (strategistName) {
        const agent = agentRegistry.get(strategistName);
        const displayName = agent
          ? (agent as unknown as Strategist).displayName
          : strategistName;

        if (modelName && modelName !== 'VPAI') {
          playerTypes[playerID] = `${displayName} (${modelName})`;
        } else {
          playerTypes[playerID] = displayName;
        }
      } else {
        playerTypes[playerID] = 'Vox Populi AI';
      }
    }

    return playerTypes;
  }
}
