/**
 * @module archivist/writer
 *
 * DuckDB output writer for the archivist pipeline.
 * Uses Kysely with CamelCasePlugin for type-safe access to the episodes table,
 * which stores player-turn snapshots from archived Civilization V games.
 * The table is created via raw SQL to support DuckDB-specific REAL[] array columns.
 */

import { Kysely, CamelCasePlugin, sql, type RawBuilder } from 'kysely';
import { DuckDbDialect } from 'kysely-duckdb';
import { DuckDBInstance } from '@duckdb/node-api';
import { createLogger } from '../utils/logger.js';
import type { Episode, EpisodesDatabase } from './types.js';

/** Convert a JS number array to a DuckDB REAL[] literal, or null if absent. */
function toRealArray(arr: number[] | null | undefined): RawBuilder<number[]> | null {
  if (!arr) return null;
  return sql.raw<number[]>(`[${arr.join(',')}]::REAL[]`);
}

const TABLE_DDL = `
CREATE TABLE IF NOT EXISTS episodes (
  game_id         VARCHAR NOT NULL,
  turn            INTEGER NOT NULL,
  player_id       INTEGER NOT NULL,
  civilization    VARCHAR NOT NULL,
  is_winner       BOOLEAN NOT NULL,

  era             VARCHAR NOT NULL,
  grand_strategy  VARCHAR,

  is_vassal         INTEGER NOT NULL DEFAULT 0,
  active_wars       INTEGER NOT NULL DEFAULT 0,
  truces            INTEGER NOT NULL DEFAULT 0,
  defensive_pacts   INTEGER NOT NULL DEFAULT 0,
  friends           INTEGER NOT NULL DEFAULT 0,
  denouncements     INTEGER NOT NULL DEFAULT 0,
  vassals           INTEGER NOT NULL DEFAULT 0,
  war_weariness     REAL NOT NULL DEFAULT 0,

  score               INTEGER,
  cities              INTEGER,
  population          INTEGER,
  gold_per_turn       REAL,
  culture_per_turn    REAL,
  tourism_per_turn    REAL,
  military_strength   REAL,
  technologies        INTEGER,
  votes               INTEGER,
  happiness_percentage REAL,

  production_per_turn REAL,
  food_per_turn       REAL,

  policies            INTEGER,

  minor_allies        INTEGER,

  domination_progress   REAL,
  science_progress      REAL,
  culture_progress      REAL,
  diplomatic_progress   REAL,

  domination_leader_progress  REAL,
  science_leader_progress     REAL,
  culture_leader_progress     REAL,
  diplomatic_leader_progress  REAL,

  culture_share       REAL,
  tourism_share       REAL,
  gold_share          REAL,
  science_per_pop     REAL,
  faith_per_pop       REAL,
  production_per_pop  REAL,
  food_per_pop        REAL,
  military_share      REAL,
  cities_share        REAL,
  population_share    REAL,
  votes_share         REAL,
  minor_allies_share  REAL,

  technologies_gap    INTEGER,
  policies_gap        INTEGER,

  religion_percentage REAL,

  ideology_allies     INTEGER NOT NULL DEFAULT 0,
  ideology_share      REAL NOT NULL DEFAULT 0,

  game_state_vector   REAL[],
  neighbor_vector     REAL[],

  abstract            TEXT,
  abstract_embedding  REAL[],
  situation           TEXT,
  decisions           TEXT,

  is_landmark         BOOLEAN NOT NULL DEFAULT FALSE,

  PRIMARY KEY (game_id, turn, player_id)
)`;

/** Writes episode data to a DuckDB database using Kysely with CamelCasePlugin. */
export class EpisodeWriter {
  private db: Kysely<EpisodesDatabase>;
  private logger = createLogger('EpisodeWriter');

  private constructor(db: Kysely<EpisodesDatabase>) {
    this.db = db;
  }

  /** Create an EpisodeWriter connected to the given DuckDB file path. */
  static async create(dbPath: string): Promise<EpisodeWriter> {
    const instance = await DuckDBInstance.create(dbPath);
    const db = new Kysely<EpisodesDatabase>({
      dialect: new DuckDbDialect({ database: instance, tableMappings: {} }),
      plugins: [new CamelCasePlugin()],
    });

    const writer = new EpisodeWriter(db);
    await writer.ensureTable();
    return writer;
  }

  /** Create the episodes table if it does not already exist. Uses raw SQL for REAL[] support. */
  private async ensureTable(): Promise<void> {
    await sql.raw(TABLE_DDL).execute(this.db);
    this.logger.info('Episodes table ensured');
  }

  /** Return the set of player IDs already processed for a given game. */
  async getProcessedPlayers(gameId: string): Promise<Set<number>> {
    const rows = await this.db
      .selectFrom('episodes')
      .select('playerId')
      .where('gameId', '=', gameId)
      .groupBy('playerId')
      .execute();
    return new Set(rows.map(r => r.playerId));
  }

  /** Batch insert episodes into DuckDB, chunked to avoid parameter limits. */
  async writeEpisodes(episodes: Episode[]): Promise<void> {
    if (episodes.length === 0) return;

    const chunkSize = 500;
    for (let i = 0; i < episodes.length; i += chunkSize) {
      const chunk = episodes.slice(i, i + chunkSize);
      // Convert REAL[] fields to DuckDB literals — @duckdb/node-api can't bind JS arrays
      const rows = chunk.map(ep => ({
        ...ep,
        gameStateVector: toRealArray(ep.gameStateVector),
        neighborVector: toRealArray(ep.neighborVector),
        abstractEmbedding: toRealArray(ep.abstractEmbedding),
      } as any));
      await this.db.insertInto('episodes').values(rows).execute();
    }
    this.logger.info(`Wrote ${episodes.length} episodes`);
  }

  /** Delete all episodes for a given game (used with --force flag). */
  async deleteGameEpisodes(gameId: string): Promise<void> {
    await this.db.deleteFrom('episodes').where('gameId', '=', gameId).execute();
  }

  /** Delete episodes for a specific player in a game. */
  async deletePlayerEpisodes(gameId: string, playerId: number): Promise<void> {
    await this.db.deleteFrom('episodes')
      .where('gameId', '=', gameId)
      .where('playerId', '=', playerId)
      .execute();
  }

  /** Fetch cached abstract embeddings for a specific player, keyed by turn. */
  async getAbstractEmbeddings(gameId: string, playerId: number): Promise<Map<number, { abstract: string | null; abstractEmbedding: number[] }>> {
    const rows = await this.db
      .selectFrom('episodes')
      .select(['turn', 'abstract', 'abstractEmbedding'])
      .where('gameId', '=', gameId)
      .where('playerId', '=', playerId)
      .where('abstractEmbedding', 'is not', null)
      .execute();
    return new Map(rows.map(r => [r.turn, {
      abstract: r.abstract as string | null,
      abstractEmbedding: r.abstractEmbedding as unknown as number[],
    }]));
  }

  /** Reset all landmark flags for a game so they can be re-selected fresh. */
  async resetGameLandmarks(gameId: string): Promise<void> {
    await this.db.updateTable('episodes')
      .set({ isLandmark: false } as any)
      .where('gameId', '=', gameId)
      .execute();
  }

  /** Fetch vectors needed for landmark selection (lightweight: only PKs + vectors). */
  async getGameEpisodeVectors(gameId: string): Promise<Array<{
    turn: number;
    playerId: number;
    gameStateVector: number[];
    neighborVector: number[];
    abstractEmbedding: number[] | null;
  }>> {
    const rows = await this.db
      .selectFrom('episodes')
      .select(['turn', 'playerId', 'gameStateVector', 'neighborVector', 'abstractEmbedding'])
      .where('gameId', '=', gameId)
      .where('gameStateVector', 'is not', null)
      .orderBy('turn')
      .execute();
    return rows as any;
  }

  /** Mark selected episodes as landmarks for retrieval diversity. */
  async markLandmarks(gameId: string, keys: Array<{ turn: number; playerId: number }>): Promise<void> {
    for (const { turn, playerId } of keys) {
      await this.db.updateTable('episodes')
        .set({ isLandmark: true } as any)
        .where('gameId', '=', gameId)
        .where('turn', '=', turn)
        .where('playerId', '=', playerId)
        .execute();
    }
  }

  /** Close the DuckDB connection. */
  async close(): Promise<void> {
    await this.db.destroy();
    this.logger.info('DuckDB connection closed');
  }
}
