/**
 * @module archivist/writer
 *
 * DuckDB output writer for the archivist pipeline.
 * Uses Kysely with CamelCasePlugin for type-safe access to the episodes table,
 * which stores player-turn snapshots from archived Civilization V games.
 * The table is created via raw SQL to support DuckDB-specific REAL[] array columns.
 */

import { Kysely, CamelCasePlugin, sql } from 'kysely';
import { DuckDbDialect } from 'kysely-duckdb';
import { DuckDBInstance, DuckDBListType, FLOAT } from '@duckdb/node-api';
import { createLogger } from '../utils/logger.js';
import type { Episode, EpisodesDatabase } from './types.js';

/** DuckDB LIST(FLOAT) type for appender list columns. */
const realListType = new DuckDBListType(FLOAT);

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
  private instance: DuckDBInstance;
  private logger = createLogger('EpisodeWriter');

  private constructor(db: Kysely<EpisodesDatabase>, instance: DuckDBInstance) {
    this.db = db;
    this.instance = instance;
  }

  /** Create an EpisodeWriter connected to the given DuckDB file path. */
  static async create(dbPath: string): Promise<EpisodeWriter> {
    const instance = await DuckDBInstance.create(dbPath);
    const db = new Kysely<EpisodesDatabase>({
      dialect: new DuckDbDialect({ database: instance, tableMappings: {} }),
      plugins: [new CamelCasePlugin()],
    });

    const writer = new EpisodeWriter(db, instance);
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

  /**
   * Bulk insert episodes into DuckDB using the Appender API.
   * Bypasses SQL parsing entirely for dramatically faster writes with large REAL[] columns.
   */
  async writeEpisodes(episodes: Episode[]): Promise<void> {
    if (episodes.length === 0) return;

    const totalStart = performance.now();
    const embDim = episodes.find(ep => ep.abstractEmbedding)?.abstractEmbedding?.length ?? 0;
    this.logger.info(`Appending ${episodes.length} episodes (embDim=${embDim})`);

    const conn = await this.instance.connect();
    try {
      const appender = await conn.createAppender('episodes');

      for (const ep of episodes) {
        // Identity — columns 1-5
        appender.appendVarchar(ep.gameId);
        appender.appendInteger(ep.turn);
        appender.appendInteger(ep.playerId);
        appender.appendVarchar(ep.civilization);
        appender.appendBoolean(ep.isWinner);

        // Basic state — columns 6-7
        appender.appendVarchar(ep.era);
        ep.grandStrategy != null ? appender.appendVarchar(ep.grandStrategy) : appender.appendNull();

        // Diplomatic counts — columns 8-15
        appender.appendInteger(ep.isVassal);
        appender.appendInteger(ep.activeWars);
        appender.appendInteger(ep.truces);
        appender.appendInteger(ep.defensivePacts);
        appender.appendInteger(ep.friends);
        appender.appendInteger(ep.denouncements);
        appender.appendInteger(ep.vassals);
        appender.appendFloat(ep.warWeariness);

        // Raw values (nullable) — columns 16-28
        ep.score != null ? appender.appendInteger(ep.score) : appender.appendNull();
        ep.cities != null ? appender.appendInteger(ep.cities) : appender.appendNull();
        ep.population != null ? appender.appendInteger(ep.population) : appender.appendNull();
        ep.goldPerTurn != null ? appender.appendFloat(ep.goldPerTurn) : appender.appendNull();
        ep.culturePerTurn != null ? appender.appendFloat(ep.culturePerTurn) : appender.appendNull();
        ep.tourismPerTurn != null ? appender.appendFloat(ep.tourismPerTurn) : appender.appendNull();
        ep.militaryStrength != null ? appender.appendFloat(ep.militaryStrength) : appender.appendNull();
        ep.technologies != null ? appender.appendInteger(ep.technologies) : appender.appendNull();
        ep.votes != null ? appender.appendInteger(ep.votes) : appender.appendNull();
        ep.happinessPercentage != null ? appender.appendFloat(ep.happinessPercentage) : appender.appendNull();
        ep.productionPerTurn != null ? appender.appendFloat(ep.productionPerTurn) : appender.appendNull();
        ep.foodPerTurn != null ? appender.appendFloat(ep.foodPerTurn) : appender.appendNull();
        ep.policies != null ? appender.appendInteger(ep.policies) : appender.appendNull();
        ep.minorAllies != null ? appender.appendInteger(ep.minorAllies) : appender.appendNull();

        // Victory progress (nullable) — columns 29-36
        ep.dominationProgress != null ? appender.appendFloat(ep.dominationProgress) : appender.appendNull();
        ep.scienceProgress != null ? appender.appendFloat(ep.scienceProgress) : appender.appendNull();
        ep.cultureProgress != null ? appender.appendFloat(ep.cultureProgress) : appender.appendNull();
        ep.diplomaticProgress != null ? appender.appendFloat(ep.diplomaticProgress) : appender.appendNull();
        ep.dominationLeaderProgress != null ? appender.appendFloat(ep.dominationLeaderProgress) : appender.appendNull();
        ep.scienceLeaderProgress != null ? appender.appendFloat(ep.scienceLeaderProgress) : appender.appendNull();
        ep.cultureLeaderProgress != null ? appender.appendFloat(ep.cultureLeaderProgress) : appender.appendNull();
        ep.diplomaticLeaderProgress != null ? appender.appendFloat(ep.diplomaticLeaderProgress) : appender.appendNull();

        // Shares (nullable) — columns 37-48
        ep.cultureShare != null ? appender.appendFloat(ep.cultureShare) : appender.appendNull();
        ep.tourismShare != null ? appender.appendFloat(ep.tourismShare) : appender.appendNull();
        ep.goldShare != null ? appender.appendFloat(ep.goldShare) : appender.appendNull();
        ep.sciencePerPop != null ? appender.appendFloat(ep.sciencePerPop) : appender.appendNull();
        ep.faithPerPop != null ? appender.appendFloat(ep.faithPerPop) : appender.appendNull();
        ep.productionPerPop != null ? appender.appendFloat(ep.productionPerPop) : appender.appendNull();
        ep.foodPerPop != null ? appender.appendFloat(ep.foodPerPop) : appender.appendNull();
        ep.militaryShare != null ? appender.appendFloat(ep.militaryShare) : appender.appendNull();
        ep.citiesShare != null ? appender.appendFloat(ep.citiesShare) : appender.appendNull();
        ep.populationShare != null ? appender.appendFloat(ep.populationShare) : appender.appendNull();
        ep.votesShare != null ? appender.appendFloat(ep.votesShare) : appender.appendNull();
        ep.minorAlliesShare != null ? appender.appendFloat(ep.minorAlliesShare) : appender.appendNull();

        // Gaps and derived — columns 49-53
        appender.appendInteger(ep.technologiesGap);
        appender.appendInteger(ep.policiesGap);
        appender.appendFloat(ep.religionPercentage);
        appender.appendInteger(ep.ideologyAllies);
        appender.appendFloat(ep.ideologyShare);

        // Vectors — columns 54-55
        ep.gameStateVector ? appender.appendList(ep.gameStateVector, realListType) : appender.appendNull();
        ep.neighborVector ? appender.appendList(ep.neighborVector, realListType) : appender.appendNull();

        // Text fields — columns 56-58
        ep.abstract != null ? appender.appendVarchar(ep.abstract) : appender.appendNull();
        ep.abstractEmbedding ? appender.appendList(ep.abstractEmbedding, realListType) : appender.appendNull();
        ep.situation != null ? appender.appendVarchar(ep.situation) : appender.appendNull();
        ep.decisions != null ? appender.appendVarchar(ep.decisions) : appender.appendNull();

        // Landmark flag — column 59
        appender.appendBoolean(ep.isLandmark);

        appender.endRow();
      }

      appender.flushSync();
      appender.closeSync();
    } finally {
      conn.disconnectSync();
    }

    const totalMs = performance.now() - totalStart;
    this.logger.info(`Wrote ${episodes.length} episodes in ${(totalMs / 1000).toFixed(1)}s via appender`);
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
