# Archivist Episode Database Schema

## Overview

The archivist builds a DuckDB database of historical game episodes from archived games.
Each row is one **player-turn**: a snapshot of a single player's state at a single turn in a completed game.

## Source Databases

For each archived game (in `archive/{experiment}/`), three SQLite databases exist:

1. **Game DB** (`{gameId}_{timestamp}.db`) — MCP server knowledge store
2. **Telemetry DB** (`{gameId}-player-{playerId}.db`) — OpenTelemetry spans
3. **Telepathist DB** (`{gameId}-player-{playerId}.telepathist.db`) — LLM-generated summaries (built from telemetry DB if missing)

---

## DuckDB Schema

```sql
CREATE TABLE episodes (

  -- ══════════════════════════════════════════════════════════════════
  -- IDENTITY
  -- ══════════════════════════════════════════════════════════════════

  game_id         VARCHAR NOT NULL,   -- GameMetadata.Key='gameId' → Value
  turn            INTEGER NOT NULL,   -- PlayerSummaries.Turn
  player_id       INTEGER NOT NULL,   -- PlayerSummaries.Key (= PlayerID)
  civilization    VARCHAR NOT NULL,   -- PlayerInformations.Civilization WHERE Key=player_id
  is_winner       BOOLEAN NOT NULL,   -- GameMetadata.Key='victoryPlayerID' → Value == player_id

  -- ══════════════════════════════════════════════════════════════════
  -- BASIC GAME STATE
  -- ══════════════════════════════════════════════════════════════════

  -- Era as original text string from PlayerSummaries
  era             VARCHAR NOT NULL,   -- PlayerSummaries.Era (e.g. "Ancient Era", "Classical Era", ...)

  -- Latest grand strategy for this player at this turn
  grand_strategy  VARCHAR,            -- StrategyChanges.GrandStrategy
                                      --   WHERE Key=player_id AND IsLatest=1 AND Turn<=turn
                                      --   ORDER BY Turn DESC LIMIT 1

  -- ══════════════════════════════════════════════════════════════════
  -- DIPLOMATIC COUNTS
  -- Parsed from PlayerSummaries.Relationships JSON for this player_id.
  -- Relationships is Record<civName, string[]> for major civs.
  -- Each string[] entry contains status strings like:
  --   "War (Our Score: 45%; Our War Weariness: 12%)"
  --   "Defensive Pact"
  --   "Declaration of Friendship"
  --   "Denounced Them" / "Denounced By Them"
  --   "Peace Treaty (5 turns)"
  -- ══════════════════════════════════════════════════════════════════

  is_vassal         INTEGER NOT NULL DEFAULT 0,   -- whether this civ is a vassal of another ("Our Master")
  active_wars       INTEGER NOT NULL DEFAULT 0,   -- count of major civs with "War" in relationship strings
  truces            INTEGER NOT NULL DEFAULT 0,   -- count of major civs with "Peace Treaty" in relationship strings
  defensive_pacts   INTEGER NOT NULL DEFAULT 0,   -- count of major civs with "Defensive Pact"
  friends           INTEGER NOT NULL DEFAULT 0,   -- count of major civs with "Declaration of Friendship"
  denouncements     INTEGER NOT NULL DEFAULT 0,   -- count of major civs with "Denounced Them" + "Denounced By Them"
  vassals           INTEGER NOT NULL DEFAULT 0,   -- count of major civs with "Our Vassal"
  war_weariness     REAL NOT NULL DEFAULT 0,      -- max war weariness % extracted from any "War (...War Weariness: X%)"

  -- ══════════════════════════════════════════════════════════════════
  -- RAW VALUES
  -- All from PlayerSummaries WHERE Key=player_id AND Turn=turn AND IsLatest=1
  -- unless otherwise noted
  -- ══════════════════════════════════════════════════════════════════

  score               INTEGER,    -- PlayerSummaries.Score
  cities              INTEGER,    -- PlayerSummaries.Cities
  population          INTEGER,    -- PlayerSummaries.Population
  gold_per_turn       REAL,       -- PlayerSummaries.GoldPerTurn
  science_per_turn    REAL,       -- PlayerSummaries.SciencePerTurn
  culture_per_turn    REAL,       -- PlayerSummaries.CulturePerTurn
  faith_per_turn      REAL,       -- PlayerSummaries.FaithPerTurn
  tourism_per_turn    REAL,       -- PlayerSummaries.TourismPerTurn
  military_strength   REAL,       -- PlayerSummaries.MilitaryStrength
  technologies        INTEGER,    -- PlayerSummaries.Technologies
  votes               INTEGER,    -- PlayerSummaries.Votes
  happiness_percentage REAL,      -- PlayerSummaries.HappinessPercentage

  -- Production and food are per-city sums (not in PlayerSummaries directly)
  production_per_turn REAL,       -- SUM(CityInformations.ProductionPerTurn)
                                  --   WHERE Owner matches this player's civ name
                                  --   AND Turn=turn AND IsLatest=1
  food_per_turn       REAL,       -- SUM(CityInformations.FoodPerTurn) same filter

  -- Policy count: sum of all individual policies across branches
  policies            INTEGER,    -- PlayerSummaries.PolicyBranches JSON:
                                  --   Record<branchName, string[]>
                                  --   → sum of all array lengths

  -- Minor ally count
  minor_allies        INTEGER,    -- Count minor civs (IsMajor=0) in PlayerSummaries
                                  --   where that minor's MajorAlly matches this player's civ name

  -- ══════════════════════════════════════════════════════════════════
  -- ADJUSTED & SHARE VALUES
  --
  -- Step 1: City-adjust raw per-turn values
  --   city_multiplier = MAX(1.05 * (cities - 1), 1.0)
  --   {metric}_adj = {metric}_per_turn / city_multiplier
  --
  -- Step 2: Compute share as % of all alive major players that turn
  --   {metric}_share = player_{metric}_adj / SUM(all_players_{metric}_adj)
  --   For non-per-turn fields (cities, population, votes, minor_allies):
  --   {metric}_share = player_value / SUM(all_players_value)
  -- ══════════════════════════════════════════════════════════════════

  science_share       REAL,       -- science_adj / sum(all players' science_adj)
  culture_share       REAL,       -- culture_adj / sum(all players' culture_adj)
  tourism_share       REAL,       -- tourism_adj / sum(all players' tourism_adj)
  gold_share          REAL,       -- gold_adj / sum(all players' gold_adj)
  faith_share         REAL,       -- faith_adj / sum(all players' faith_adj)
  production_share    REAL,       -- production_adj / sum(all players' production_adj)
  food_share          REAL,       -- food_adj / sum(all players' food_adj)
  military_share      REAL,       -- military_adj / sum(all players' military_adj)
  cities_share        REAL,       -- cities / sum(all players' cities)
  population_share    REAL,       -- population / sum(all players' population)
  votes_share         REAL,       -- votes / sum(all players' votes)  (null if no world congress)
  minor_allies_share  REAL,       -- minor_allies / sum(all players' minor_allies)

  -- ══════════════════════════════════════════════════════════════════
  -- GAP VALUES (relative to leader among all alive major players)
  -- ══════════════════════════════════════════════════════════════════

  technologies_gap    INTEGER,    -- player.technologies - MAX(all players' technologies)
                                  --   0 for leader, negative for others
  policies_gap        INTEGER,    -- player.policies - MAX(all players' policies)
                                  --   0 for leader, negative for others

  -- ══════════════════════════════════════════════════════════════════
  -- DERIVED PERCENTAGES
  -- ══════════════════════════════════════════════════════════════════

  religion_percentage REAL,       -- percentage of world cities following the religion

  -- Ideology metrics (from PolicyBranches JSON)
  -- Ideology branch is one of: Freedom, Order, Autocracy (or null if not yet chosen)
  ideology_allies     INTEGER NOT NULL DEFAULT 0,
                                        -- count of alive major players (including self) that share
                                        --   the same ideology branch; 0 if no ideology chosen
  ideology_share      REAL NOT NULL DEFAULT 0,
                                        -- ideology_allies / count(alive major players)
                                        --   0 if no ideology chosen

  -- ══════════════════════════════════════════════════════════════════
  -- VECTORS (stored as REAL[] arrays in DuckDB)
  -- ══════════════════════════════════════════════════════════════════

  -- Game-state vector (~28 elements), normalized/scaled:
  --   [0]  era / 8                     (Ancient=0 .. Information=7)
  --   [1]  grand_strategy / 4          (Conquest=1, Culture=2, Diplomacy=3, Science=4, None=0)
  --   [2]  science_share               (already 0-1)
  --   [3]  culture_share
  --   [4]  tourism_share
  --   [5]  gold_share
  --   [6]  faith_share
  --   [7]  production_share
  --   [8]  food_share
  --   [9]  military_share
  --   [10] cities_share
  --   [11] population_share
  --   [12] votes_share                 (0 if null)
  --   [13] minor_allies_share
  --   [14] technologies_gap / 10       (clamped to [0, 1])
  --   [15] policies_gap / 5            (clamped to [0, 1])
  --   [16] happiness_percentage / 100   (clamped to [0, 1])
  --   [17] religion_percentage          (clamped to [0, 1])
  --   [18] ideology_share               (already 0-1; 0 if no ideology)
  --   [19] is_vassal                    (0 or 1)
  --   [20] vassals / 3                  (clamped to [0, 1])
  --   [21] war_weariness / 100          (clamped to [0, 1])
  --   [22] active_wars / 3              (clamped to [0, 1])
  --   [23] truces / 3                   (clamped to [0, 1])
  --   [24] friends / 3                  (clamped to [0, 1])
  --   [25] defensive_pacts / 3          (clamped to [0, 1])
  --   [26] denouncements / 3            (clamped to [0, 1])
  game_state_vector   REAL[],

  -- Neighbor vector: 8 fixed slots, sorted by strength_ratio descending.
  -- Each slot = [strength_ratio, stance, tech_gap, policy_gap] = 4 features.
  -- Total: 8 * 4 = 32 elements. Empty slots filled with neutral values:
  --   [strength_ratio=0.2, stance=0.5, tech_gap=0.5, policy_gap=0.5]
  -- Only consider civilizations with Distance: Neighbors, OR Distance: Close + hostile or below.
  --
  -- Per-neighbor values come from comparing this player with each major civ
  -- neighbor (those present in PlayerSummaries.Relationships for this player):
  --
  --   strength_ratio:  neighbor.MilitaryStrength / player.MilitaryStrength
  --                    → clamp to [0, 5], then / 5 → range [0, 1]
  --   stance:          parsed from Relationships string array (see Neighbor Stance Priority):
  --                      war=4, denounced/master=3, neutral=2, dof/vassal=1, def_pact=0
  --                    → / 4 → range [0, 1]
  --   tech_gap:        neighbor.Technologies - player.Technologies
  --                    → / 10, clamp to [0, 1]
  --   policy_gap:      neighbor.policies - player.policies
  --                    → / 5, clamp to [0, 1]
  --
  -- Stance determination priority (from Relationships strings):
  --   contains "War"                        → 4 (war)
  --   contains "Denounced"                  → 3 (hostile)
  --   contains "Our Master"                 → 3 (hostile - they own us)
  --   contains "Declaration of Friendship"  → 1 (friendly)
  --   contains "Our Vassal"                 → 1 (friendly - we own them)
  --   contains "Defensive Pact"             → 0 (ally)
  --   else                                  → 2 (neutral)
  neighbor_vector     REAL[],

  -- ══════════════════════════════════════════════════════════════════
  -- TELEPATHIST SUMMARIES
  -- From {gameId}-player-{playerId}.telepathist.db
  -- Table: turn_summaries WHERE turn=turn
  -- ══════════════════════════════════════════════════════════════════

  abstract            TEXT,        -- turn_summaries.abstract  (2-3 sentence summary for query)
  abstract_embedding  REAL[],      -- embedding on the abstract
  situation           TEXT,        -- turn_summaries.situation  (world state paragraph)
  decisions           TEXT,        -- turn_summaries.decisions  (strategic decisions made)

  PRIMARY KEY (game_id, turn, player_id)
);
```

## Data Flow

```
archive/{experiment}/
  ├── {gameId}_{ts}.db                    ──┐
  │   ├── GameMetadata                      │  identity, is_winner, experiment
  │   ├── PlayerInformations                │  civilization, isMajor lookup
  │   ├── PlayerSummaries (versioned)       │  all raw values, relationships, era
  │   ├── StrategyChanges (versioned)       │  grand_strategy
  │   └── CityInformations (versioned)      │  production_per_turn, food_per_turn
  │                                         ├──→ extractor.ts ──→ transformer.ts ──→ writer.ts ──→ DuckDB
  ├── {gameId}-player-{pid}.db            ──┤
  │   └── spans                             │  (used by telepathist prep only)
  │                                         │
  └── {gameId}-player-{pid}.telepathist.db──┘
      ├── turn_summaries                       narrative, situation, decisions
      └── phase_summaries                      (available but not stored in episodes)
```

## Querying Versioned Data (MutableKnowledge)

MutableKnowledge tables (PlayerSummaries, StrategyChanges, CityInformations) store
multiple versions per turn. Each row has:
- `Key` — entity ID (PlayerID or CityID)
- `Turn` — game turn number
- `Version` — incrementing version within a turn
- `IsLatest` — 1 if this is the most recent version for this Key+Turn

To get the canonical snapshot for a player at a turn:
```sql
SELECT * FROM PlayerSummaries
WHERE Key = :playerId AND Turn = :turn AND IsLatest = 1
```

To get all alive major players at a turn (for computing shares):
```sql
SELECT ps.* FROM PlayerSummaries ps
JOIN PlayerInformations pi ON pi.Key = ps.Key
WHERE ps.Turn = :turn AND ps.IsLatest = 1 AND pi.IsMajor = 1
```

## Era Mapping (for game_state_vector only)

The `era` column stores the original string. For the vector, map to integer:

```
"Ancient Era"      → 0
"Classical Era"    → 1
"Medieval Era"     → 2
"Renaissance Era"  → 3
"Industrial Era"   → 4
"Modern Era"       → 5
"Atomic Era"       → 6
"Information Era"  → 7
```

## Grand Strategy Mapping (for game_state_vector only)

The `grand_strategy` column stores the original string. For the vector, map to integer:

```
null / unknown     → 0
"Conquest"         → 1
"Culture"          → 2
"United Nations"   → 3
"Spaceship"        → 4
```

## Neighbor Stance Priority

When a player's Relationships entry for a neighbor contains multiple status strings,
use the highest-priority match:

| Priority | Match string                    | Stance value | Normalized (/4) |
|----------|---------------------------------|--------------|------------------|
| 1 (high) | `"War"`                         | 4            | 1.0              |
| 2        | `"Denounced"`                   | 3            | 0.75             |
| 3        | `"Our Master"` (is their vassal)| 3            | 0.75             |
| 4 (low)  | (default / neutral / guarded)   | 2            | 0.5              |
| 5        | `"Declaration of Friendship"`   | 1            | 0.25             |
| 6        | `"Our Vassal"`                  | 1            | 0.25             |
| 7        | `"Defensive Pact"`              | 0            | 0.0              |

Neutral fill value for empty neighbor slots: **0.5** (stance=2/4).

## Computing Religion Percentage

`religion_percentage` measures how many world cities follow this player's founded religion.
Requires city-level data from `CityInformations`:

1. Look up this player's `FoundedReligion` from `PlayerSummaries` (null if none founded → 0)
2. Query all `CityInformations` at this turn (`IsLatest=1`) for all alive players (major + minor)
3. Count cities where `MajorityReligion` matches this player's `FoundedReligion`
4. `religion_percentage = matching_cities / total_cities` (0–1 range)

If the player has not founded a religion, `religion_percentage = 0`.

## Computing Ideology Share

`ideology_share` measures the proportion of major civs sharing this player's ideology.
Ideology is determined from the `PolicyBranches` JSON in `PlayerSummaries`:

1. Parse `PolicyBranches` (Record<branchName, string[]>) for this player
2. Identify if any branch key is `"Freedom"`, `"Order"`, or `"Autocracy"` → that is the player's ideology
3. If no ideology chosen → `ideology_allies = 0`, `ideology_share = 0`
4. Otherwise, check all alive major players' `PolicyBranches` for the same ideology branch
5. `ideology_allies` = count of players (including self) with the same ideology
6. `ideology_share = ideology_allies / count(alive major players)`

## Computing Minor Ally Counts

`minor_allies` counts the number of city-states allied to this player.
Requires cross-referencing player summaries:

1. Identify all minor civs: `PlayerInformations` where `IsMajor = 0`
2. For each minor civ, get their `PlayerSummaries` at this turn (`IsLatest=1`)
3. Check if `MajorAlly` matches this player's civilization short description
4. `minor_allies` = count of matching minor civs

**Cache optimization**: Build a lookup map of `{ civName → player_id }` for all major players,
and a list of `{ minor_id, MajorAlly }` per turn. Reuse across all players in the same turn
to avoid redundant queries.

## Pipeline Modules

| Module              | Responsibility                                                    |
|---------------------|-------------------------------------------------------------------|
| `index.ts`          | CLI entry point, orchestrates pipeline                            |
| `scanner.ts`        | Discovers archive entries (game DBs + telemetry DBs)              |
| `telepathist-prep.ts` | Ensures telepathist DBs exist, calls preparation if needed      |
| `extractor.ts`      | Reads game DB + telepathist DB, produces raw episode records      |
| `transformer.ts`    | Computes adjusted values, shares, gaps, vectors                   |
| `writer.ts`         | Writes final episodes into DuckDB                                 |
