# Archivist Implementation Plan

## Overview

Batch CLI tool that processes archived Civ 5 game databases into a DuckDB episodes table.
Each row is one player-turn snapshot for LLM-controlled players only (not VPAI).
Uses Kysely + `kysely-duckdb` for type-safe DuckDB access.

## Dependencies

- `kysely-duckdb` + `@duckdb/node-api` (add to root `package.json`)
- npm script: `"archivist": "tsx src/archivist/index.ts"` in `vox-agents/package.json`

## File Structure

```
vox-agents/src/archivist/
  types.ts              -- Strong-typed interfaces (source + target) + shared constants
  scanner.ts            -- Archive filesystem discovery
  telepathist-prep.ts   -- Always-run telepathist prep wrapper
  extractor.ts          -- Reads SQLite source DBs -> RawEpisode[]
  transformer.ts        -- Computes shares, gaps, vectors -> Episode
  writer.ts             -- Kysely/DuckDB output
  embeddings.ts         -- Abstract text -> embedding vectors
  similarity.ts         -- Composite similarity (TypeScript for batch, SQL builder for retrieval)
  selector.ts           -- Diversity-first landmark pre-selection
  reader.ts             -- Read-only DuckDB connection + retrieval pipeline
  query-types.ts        -- Retrieval query, result & outcome interfaces
  index.ts              -- CLI entry point
```

---

## Phase 1: Foundation

### 1.1 Types (`types.ts`)

Strong-typed interfaces for the entire pipeline:

- `ArchiveEntry` — `{ experiment, gameId, gameDbPath, players: PlayerEntry[] }`
- `PlayerEntry` — `{ playerId, telemetryDbPath, telepathistDbPath }`
- `RawEpisode` — All non-computed columns (identity, basic state, raw values, diplomatic counts, victory progress, telepathist text). camelCase fields.
- `Episode extends RawEpisode` — Adds computed fields: shares, per-pop, gaps, ideology, vectors, embedding, `isLandmark`
- `EpisodesDatabase` — Kysely DB interface with `episodes` table. Row type refers to `schema.md` for column definitions.
- `SimilarityWeights` — `{ gameState, neighbor, embedding }` weight interface for composite similarity
- `TurnContext` — All alive major players' summaries, city info, victory progress for one turn. Built once per game.

Reuse existing types:
- `KnowledgeDatabase` from `mcp-server/src/knowledge/schema/base.ts`
- `PlayerSummary`, `CityInformation`, `VictoryProgress`, `StrategyChange` from `mcp-server/src/knowledge/schema/timed.ts`
- `PlayerInformation` from `mcp-server/src/knowledge/schema/public.ts`
- `TelepathistDatabase`, `TurnSummaryRecord` from `vox-agents/src/telepathist/telepathist-parameters.ts`
- `GameIdentifierInfo`, `parseDatabaseIdentifier` from `vox-agents/src/utils/identifier-parser.ts`

Export shared constants (used by `transformer.ts`, `similarity.ts`, and `utils/game-state-vector.ts`):
- `eraMap`: `Record<string, number>` (era string → 0-7 ordinal)
- `grandStrategyMap`: `Record<string, number>` (strategy string → 0-4)
- Clamp ranges for vector element normalization
- `landmarkWeights`, `retrievalWeights`, `retrievalNoEmbeddingWeights` — weight presets

### 1.2 Scanner (`scanner.ts`)

- Scan `archive/{experiment}/` directories for `.db` files
- Classify via regex: game DB (`{gameId}_{timestamp}.db`), telemetry DB (`{gameId}-player-{pid}.db`), telepathist DB (`{gameId}-player-{pid}.telepathist.db`)
- Group by gameId; include all players that have a telemetry DB
- **LLM vs VPAI detection**: Open each player's game DB and check for `FlavorChanges` rows matching that player. VPAI players have telemetry DBs but no FlavorChanges entries. Only include players with FlavorChanges.
- Use `parseDatabaseIdentifier()` for filename parsing
- Return `ArchiveEntry[]`

### 1.3 Writer (`writer.ts`)

- `DuckDbDialect` from `kysely-duckdb` with `@duckdb/node-api`
- Create `episodes` table via raw SQL (`CREATE TABLE IF NOT EXISTS`) for `REAL[]` array support
- Methods:
  - `getProcessedPlayers(gameId): Set<number>` — for incremental skip
  - `writeEpisodes(episodes: Episode[])` — batch insert via Kysely
  - `deleteGameEpisodes(gameId)` — for `--force` re-processing
  - `markLandmarks(gameId, keys: Array<{turn, playerId}>)` — batch UPDATE `is_landmark = TRUE`
  - `close()`

### 1.4 CLI Entry Point (`index.ts`)

```
Usage: npm run archivist -- -a <archive-path> -o <output.duckdb> [-e <experiment>] [--force]
```

Pipeline:
1. Parse CLI args, init writer
2. Scan archive -> `ArchiveEntry[]`
3. For each game:
   a. **Telepathist prep**: always invoke for each player (skips existing turns internally)
   b. **Extract turn contexts**: once per game (all turns, all players)
   c. For each LLM player:
      - Check incremental: skip if `(gameId, playerId)` already in DuckDB (unless `--force`)
      - Extract raw episodes
      - Transform each episode (per-player, using TurnContext for cross-player data)
      - Generate embeddings for abstracts
      - Write to DuckDB
   d. **Landmark selection**: run `selector.ts` for this game (marks diverse subset as landmarks)
4. Close DuckDB, log summary

Error handling: try-catch per game/player, log and continue.

---

## Phase 2: Data Extraction

### 2.1 Telepathist Prep (`telepathist-prep.ts`)

**Always invoked** for every player on every run:

1. Call `createTelepathistParameters(telemetryDbPath, parsedId)`
2. Create minimal `VoxContext<TelepathistParameters>`
3. Call `prepareTurnSummaries(parameters, context)` — existing code already:
   - Queries `turn_summaries` for existing turns, builds skip-set
   - Filters `availableTurns` to find unsummarized turns
   - Generates only missing summaries via Summarizer
   - Returns immediately if all turns exist
4. Close parameters

No changes to `turn-preparation.ts` needed — it handles resume natively.

### 2.2 Extractor (`extractor.ts`)

**`extractTurnContexts(gameDb): Map<number, TurnContext>`**
- Pre-pass: for every distinct turn, collect all alive major players' summaries, all city info, victory progress
- Done once per game, shared across all players

**`extractPlayerEpisodes(gameDb, telepathistDb, playerId, playerInfo, turnContexts, gameId, victoryPlayerId): RawEpisode[]`**
- Per turn where this player has data (`PlayerSummaries WHERE Key=playerId AND IsLatest=1`):
  - **Identity**: gameId, turn, playerId, civilization (from PlayerInformations), isWinner
  - **Basic state**: era, grand_strategy (latest StrategyChanges WHERE Key=playerId AND Turn<=turn)
  - **Raw values**: score, cities, population, yields, military, tech, votes, happiness
  - **Diplomatic counts**: parse Relationships JSON, count wars/truces/pacts/friends/denouncements/vassals, detect isVassal, extract max warWeariness
  - **City aggregates**: SUM production/food from CityInformations matching owner civ
  - **Policies**: parse PolicyBranches JSON, sum array lengths; detect ideology
  - **Minor allies**: count minors where MajorAlly matches civ name (from TurnContext)
  - **Victory progress**: parse VictoryProgress JSON columns (from TurnContext)
  - **Religion percentage**: count matching cities / total cities (from TurnContext)
  - **Telepathist text**: read turn_summaries for abstract, situation, decisions

---

## Phase 3: Transformation

### 3.1 Transformer (`transformer.ts`)

**`transformEpisode(raw: RawEpisode, turnContext: TurnContext): Episode`**

Per-player, per-turn. TurnContext provides all-player data for cross-player computations.

- **City-adjusted shares**: `cityMultiplier = max(1.05 * (cities - 1), 1.0)`, adj = metric / multiplier, share = player_adj / sum(all_adj)
- **Raw shares**: cities, population, votes, minor_allies / sum across all alive majors
- **Per-pop**: `clamp(metric / population, 1, 20) / 20` for production and food
- **Gaps**: `player.tech - max(all.tech)`, same for policies
- **Ideology**: detect from PolicyBranches keys (Freedom/Order/Autocracy), count allies, compute share
- **Game state vector** (35 elements): assemble per schema.md spec with normalization and clamping
- **Neighbor vector** (32 elements): filter neighbors by distance/stance, compute 4 features each, sort by strength_ratio, pad to 8 slots with `[0.2, 0.5, 0.5, 0.5]`

Helpers: `parseRelationships()`, `parseStance()`, `computeShares()`, `buildGameStateVector()`, `buildNeighborVector()`, `clamp()`

### 3.2 Embeddings (`embeddings.ts`)

- Use AI SDK embedding support
- `generateEmbeddings(abstracts: string[]): Promise<number[][]>`
- Configurable model, rate limited with `pLimit`

---

## Phase 4: Integration & Polish

### 4.1 Incremental Processing
- Per `(gameId, playerId)` granularity: check DuckDB before processing
- `--force` flag deletes existing episodes for the game before re-processing

### 4.2 Validation & Testing
- Unit tests for: relationship parsing, share computation, vector assembly (35 and 32 elements), scanner regex
- Integration test with a sample archived game
- Incremental test: run twice, verify second run skips

### 4.3 Error Handling
- Try-catch per game/player, log and continue
- Missing/corrupt SQLite DBs: log and skip
- Missing telepathist data: null text fields, skip embedding
- Missing VictoryProgress or empty turns: graceful defaults

### 4.4 Landmark Selection (`selector.ts`)

After all episodes for a game are written, select a diverse subset and mark `is_landmark = TRUE`.

**Algorithm** — greedy max-marginal diversity using **in-house TypeScript** composite similarity:

1. Load all episodes for the game from DuckDB (PKs + vectors: `game_state_vector`, `neighbor_vector`, `abstract_embedding`)
2. Seed: pick episode with median turn number
3. For each remaining candidate, compute composite similarity to all already-selected using `compositeSimilarity()` (TypeScript, not SQL — vectors are already in memory)
4. Add the episode with maximum minimum distance to all selected
5. Stop at ~1 landmark per 10 turns per player (e.g., 200-turn game × 1 player ≈ 20 landmarks)
6. Call `writer.markLandmarks(gameId, selectedKeys)` to batch UPDATE

### 4.5 Composite Similarity (`similarity.ts`)

**Two pathways** for computing composite similarity:

#### Pathway 1: In-House TypeScript (for batch/pre-selection)
Used by `selector.ts` when vectors are already loaded in memory.

```typescript
compositeSimilarity(
  a: { gameStateVector: number[], neighborVector: number[], embedding?: number[] },
  b: { gameStateVector: number[], neighborVector: number[], embedding?: number[] },
  weights: SimilarityWeights
): number
```

Computes `w1 * cos(a.gsv, b.gsv) + w2 * cos(a.nv, b.nv) + w3 * cos(a.emb, b.emb)`.
Includes a `cosineSimilarity(a: number[], b: number[]): number` helper.

#### Pathway 2: DuckDB SQL (for runtime retrieval)
Used by `reader.ts` when querying the database. A SQL expression builder generates the scoring clause.

```typescript
buildSimilaritySql(weights: SimilarityWeights, hasEmbedding: boolean): string
```

Generates SQL like:
```sql
:w_gs * list_cosine_similarity(game_state_vector, :query_gs)
+ :w_nb * list_cosine_similarity(neighbor_vector, :query_nb)
+ :w_em * COALESCE(list_cosine_similarity(abstract_embedding, :query_emb), 0)
```
When `hasEmbedding` is false, the embedding term is omitted entirely.

Also builds a pairwise similarity SQL for MMR diversity selection between candidate rows.

#### Weight Presets

```typescript
interface SimilarityWeights {
  gameState: number;
  neighbor: number;
  embedding: number;
}
```

- `landmarkWeights`: `{ gameState: 0.6, neighbor: 0.4, embedding: 0 }` — batch, no embedding
- `retrievalWeights`: `{ gameState: 0.4, neighbor: 0.3, embedding: 0.3 }` — runtime, all three
- `retrievalNoEmbeddingWeights`: `{ gameState: 0.55, neighbor: 0.45, embedding: 0 }` — runtime, no abstract

---

## Phase 5: Episode Retrieval Pipeline

### 5.1 Query Types (`query-types.ts`)

```typescript
/** The ONLY input to the retrieval pipeline */
interface EpisodeQuery {
  gameStateVector: number[];     // 35d
  neighborVector: number[];      // 32d
  abstract?: string;             // optional — pipeline generates embedding when provided

  // Current state for fuzzy attribute scoring in SQL
  era: string;                   // proximity-scored (neighboring eras get partial credit)
  civilization: string;
  grandStrategy: string | null;
  activeWars: number;            // proximity-scored (±1 = half credit)
  friends: number;               // proximity-scored (±1 = half credit)
  defensivePacts: number;        // proximity-scored (±1 = half credit)
  truces: number;                // proximity-scored (±1 = half credit)
  denouncements: number;         // proximity-scored (±1 = half credit)

  candidateLimit?: number;       // pre-diversity pool (default 20)
  resultLimit?: number;          // final count (default 5)
}

/** Outcome snapshot at a future horizon */
interface OutcomeSnapshot {
  horizonTurns: number;          // 5, 10, 15, or 20
  situation: string | null;
  decisions: string | null;      // null for horizon=20
  deltas: ShareDelta;
}

/** Quantitative share deltas as formatted strings */
interface ShareDelta {
  scienceShare: string | null;       // "+3%" or "-1%"
  cultureShare: string | null;
  goldShare: string | null;
  militaryShare: string | null;
  populationShare: string | null;
  citiesShare: string | null;
  dominationProgress: string | null;
  scienceProgress: string | null;
  cultureProgress: string | null;
  diplomaticProgress: string | null;
}

/** A retrieved episode with outcomes */
interface EpisodeResult {
  gameId: string;
  turn: number;
  civilization: string;
  era: string;
  grandStrategy: string | null;
  isWinner: boolean;
  similarity: number;
  abstract: string | null;
  situation: string | null;
  decisions: string | null;
  outcomes: OutcomeSnapshot[];   // 0-4 (fewer if game ended early)
  indicators: {
    scienceShare: number | null;
    cultureShare: number | null;
    militaryShare: number | null;
    populationShare: number | null;
    activeWars: number;
    dominationProgress: number | null;
    scienceProgress: number | null;
    cultureProgress: number | null;
    diplomaticProgress: number | null;
  };
}
```

### 5.2 Retrieval Pipeline (`reader.ts`)

Singleton read-only DuckDB connection. Path from `EPISODE_DB_PATH` env var. Standard dependency, no lazy import.

#### Pipeline: Score → Fetch Outcomes → Diversity Select

**Stage 1: Two-Pass Composite Score**

CTE-based two-pass: cheap fuzzy pre-filter first (top 200), then expensive vector similarity on survivors only. Single query, no temp tables.

Single CTE query with two passes — fuzzy pre-filter narrows to top 200 candidates, then vector similarity ranks survivors. Fuzzy score is only for pre-filtering, not added to the final score:

```sql
WITH candidates AS (
  SELECT *,
    -- Era proximity (exact=full, ±1=half, ±2+=zero)
    8 * GREATEST(0, 1.0 - 0.5 * ABS(
        {era_ordinal_case_expr} - :query_era_ordinal
      ))
    -- Attribute bonuses
    + CASE WHEN civilization = :civ THEN 5 ELSE 0 END
    + CASE WHEN grand_strategy = :gs THEN 3 ELSE 0 END
    -- Diplomatic proximity (same decay formula as era)
    + 3 * GREATEST(0, 1.0 - 0.5 * ABS(active_wars - :query_wars))
    + 2 * GREATEST(0, 1.0 - 0.5 * ABS(friends - :query_friends))
    + 2 * GREATEST(0, 1.0 - 0.5 * ABS(defensive_pacts - :query_pacts))
    + 2 * GREATEST(0, 1.0 - 0.5 * ABS(truces - :query_truces))
    + 2 * GREATEST(0, 1.0 - 0.5 * ABS(denouncements - :query_denouncements))
    AS fuzzy_score
  FROM episodes
  WHERE is_landmark = TRUE
    AND game_state_vector IS NOT NULL
  ORDER BY fuzzy_score DESC
  LIMIT 200
)
SELECT *,
  {similarity_sql}   -- weighted cosine on game_state_vector, neighbor_vector, embedding
  AS score
FROM candidates
ORDER BY score DESC
LIMIT :candidateLimit
```

Era proximity: eras mapped to ordinals (Ancient=0 ... Information=7). Formula: `bonus * max(0, 1 - 0.5 * |stored - query|)`. Exact=full, ±1=50%, ±2=0%. The `{era_ordinal_case_expr}` is a CASE expression mapping era strings to ordinals inline. Diplomatic counts use the same proximity formula.

Conditional embedding: when `abstract` is provided, `{similarity_sql}` includes the embedding term with `retrievalWeights`. When absent, uses `retrievalNoEmbeddingWeights` (embedding term omitted).

Embedding generation: when `query.abstract` is provided, pipeline calls `embeddings.ts` to generate the vector before running SQL.

Default weights (integers): `era = 8`, `civ = 5`, `gs = 5`, `wars = 3`, `friends = 2`, `pacts = 2`, `truces = 2`, `denouncements = 2`. Max sum = 29. Fuzzy score is used only for pre-filtering (Pass 1). Pass 2 ranks by vector similarity alone. Pre-filter limit: top 200 by fuzzy score.

**Stage 2: Fetch Outcomes** (for candidate pool)

Self-join at horizons `[5, 10, 15, 20]`:

```sql
SELECT e.game_id, e.turn, e.player_id, :horizon AS horizon,
       f.situation, f.decisions,
       f.science_share - e.science_share AS d_science,
       f.culture_share - e.culture_share AS d_culture,
       f.gold_share - e.gold_share AS d_gold,
       f.military_share - e.military_share AS d_military,
       f.population_share - e.population_share AS d_population,
       f.cities_share - e.cities_share AS d_cities,
       f.domination_progress - e.domination_progress AS d_domination,
       f.science_progress - e.science_progress AS d_science_prog,
       f.culture_progress - e.culture_progress AS d_culture_prog,
       f.diplomatic_progress - e.diplomatic_progress AS d_diplomatic
FROM candidate_pks e
LEFT JOIN episodes f
  ON f.game_id = e.game_id AND f.player_id = e.player_id
  AND f.turn = e.turn + :horizon
```

Batched across candidates × horizons. Horizon=20 → `decisions` set to null in mapping.
Raw deltas formatted as ShareDelta strings: `delta > 0 → "+X%"`, `< 0 → "-X%"`, `= 0 → "0%"` (X = `round(abs(delta * 100))`).

**Stage 3: Diversity Select**

From candidate pool (default 20), select final `resultLimit` (default 5) via greedy MMR.

Pairwise similarity between candidates computed via DuckDB SQL (pathway 2):
```sql
SELECT a.game_id, a.turn, a.player_id,
       b.game_id AS b_game_id, b.turn AS b_turn, b.player_id AS b_player_id,
       {pairwise_similarity_sql}
       AS pairwise_sim
FROM candidates a, candidates b
WHERE (a.game_id, a.turn, a.player_id) != (b.game_id, b.turn, b.player_id)
```

Then greedy MMR selection in TypeScript using the pairwise matrix:
1. Pick top-scored candidate
2. For each remaining: `mmr = lambda * score - (1-lambda) * max_sim_to_selected`
   - `lambda = 0.7`
3. Pick highest MMR, repeat until `resultLimit`

#### Key Methods

```typescript
findEpisodes(query: EpisodeQuery): Promise<EpisodeResult[]>
close(): Promise<void>
```

### 5.3 Composable Function (`utils/episode-utils.ts`)

```typescript
async function requestEpisodes(
  state: GameState,
  parameters: StrategistParameters,
  abstract?: string
): Promise<EpisodeResult[]>
```

1. Build vectors via `buildLiveGameStateVector(state, parameters)` → `{ gameStateVector, neighborVector }`
2. Extract era, civilization, grandStrategy from `state.players` / `parameters.metadata`
3. Extract diplomatic counts (activeWars, friends, defensivePacts, truces, denouncements) from the player's Relationships data in `state.players`
4. Call `reader.findEpisodes({ gameStateVector, neighborVector, abstract, era, civilization, grandStrategy, activeWars, friends, defensivePacts, truces, denouncements })`
5. Return `EpisodeResult[]`

When `abstract` is provided, embedding similarity is included. When absent, it's skipped.

Also exports `formatEpisodeResults(results: EpisodeResult[]): string` for markdown formatting.

### 5.4 Live Game State Vector (`utils/game-state-vector.ts`)

Builds 35d `game_state_vector` + 32d `neighbor_vector` from live `GameState` + `StrategistParameters`.

- Extracts current player from `state.players`
- Computes city-adjusted shares, era/strategy mappings, neighbor features
- Matches normalization spec in `schema.md`
- Returns `{ gameStateVector, neighborVector }` or undefined if insufficient data
- Imports shared constants (`eraMap`, `grandStrategyMap`, clamp ranges) from `types.ts`
