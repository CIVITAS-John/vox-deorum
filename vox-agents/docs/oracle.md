# Oracle

Oracle runs counterfactual prompt replay experiments — replaying past agent turns with modified prompts or different LLMs to explore "what-if" scenarios. Given a CSV of real game turns, it re-runs each turn's LLM call with whatever modifications you specify, and records what the model decides.

## How It Works

Oracle operates in two phases:

**Retrieve phase** (`--retrieve`): reads the input CSV, locates each row's telemetry database, and extracts the raw original prompt — system messages, conversation history, and active tools — exactly as they were during the real game. Nothing is modified. The extracted data is saved as JSON files in `{experimentDir}/retrieved/`.

**Replay phase** (`--replay`): loads those JSON files, calls your `modifyPrompt` callback to transform the prompts, initializes schema-only MCP tools (so the LLM generates tool call intents but nothing executes), runs each row through the LLM, and writes results to a CSV plus JSON/markdown trails.

Running without flags does both in sequence, passing retrieved rows directly to the replay phase without a disk round-trip.

### Why two phases?

- **Iterate cheaply**: run `--retrieve` once to extract and inspect all prompts before spending LLM budget. Verify that rationale matching found the right turns.
- **Replay multiple times**: the same retrieved JSONs can be replayed with different `modifyPrompt` callbacks, different `modelOverride` configs, or different models — without re-reading telemetry.
- **Multi-model comparison**: `modelOverride` can return an array of models. Each model produces one `ReplayResult` per source row, with separate trail files.

## Input Data Requirements

### Input CSV

Required columns:

| Column | Description |
|---|---|
| `game_id` | Game identifier — used to locate the telemetry database |
| `player_id` | Player identifier — used to locate the telemetry database |
| `turn` | Turn number to replay |
| `player_type` | Player type (informational, preserved in output) |
| `rationale` | A fragment of the original decision rationale — used for turn validation |

Any additional columns are preserved verbatim in the output CSV.

### Telemetry Databases

Oracle reads from SQLite telemetry databases produced by live game runs. Each database covers one game/player pair and is expected at:

```
{telemetryDir}/{any-subdirectory}/{gameId}-player-{playerId}.db
```

Oracle scans all subdirectories of `telemetryDir` automatically. The default `telemetryDir` is `telemetry/` relative to the working directory.

### What telemetry contains

The databases store OpenTelemetry spans from real game sessions. Oracle traverses:

1. Root spans matching `strategist.turn.{N}` — one per game turn
2. Agent spans matching `agent.{name}` — identifies the strategist agent
3. Step spans — the first step's `step.messages` attribute contains the original system prompts and conversation history; `step.tools` contains the active tool names

### Rationale validation

The `rationale` column is used to verify that the correct turn was found. Oracle fuzzy-matches it against the `Rationale` argument of tool calls in the telemetry (default threshold: 0.75). If no match is found for turn N, it falls back to turn N−1 and logs a warning. If neither matches, retrieval continues anyway with a warning.

## Experiment Script

Create a `.js` file (ESM) that exports a default `OracleConfig`:

```js
// experiments/my-experiment.js
export default {
  csvPath: 'experiments/my-turns.csv',
  experimentName: 'my-experiment-v1',

  // Optional: override telemetry directory
  telemetryDir: '/path/to/telemetry',

  // Required: modify the original prompt before replay
  modifyPrompt: (ctx) => ({
    system: ctx.system.map(s => s.replace('old text', 'new text')),
    // messages and activeTools default to originals if omitted
  }),

  // Optional: choose which model(s) to replay with
  // Return an array for multi-model comparison
  modelOverride: (originalModel, row) => originalModel,

  // Optional: rewrite MCP tool JSON schemas before replay
  rewriteToolSchemas: (json) => json.replaceAll('game', 'world'),

  // Optional: extract custom columns into the output CSV
  extractColumns: ({ originalMessages, decisions, row }) => ({
    myColumn: decisions[0]?.toolName ?? '',
  }),
};
```

Run it with:

```bash
npm run oracle -- -c my-experiment.js
npm run oracle -- -c my-experiment.js --retrieve   # retrieve only
npm run oracle -- -c my-experiment.js --replay     # replay only
```

## Configuration Reference

### `OracleConfig`

| Field | Type | Required | Description |
|---|---|---|---|
| `csvPath` | `string` | Yes | Path to input CSV (relative or absolute) |
| `experimentName` | `string` | Yes | Names output files and telemetry context |
| `modifyPrompt` | `(ctx) => ModifiedPrompt` | Yes | Callback to transform the original prompt |
| `modelOverride` | `(model, row) => model(s)` | No | Override model per-row; return array for multi-model |
| `rewriteToolSchemas` | `(json) => string` | No | Rewrite MCP tool schemas globally |
| `extractColumns` | `(ctx) => Record<string, any>` | No | Extract custom CSV columns from replay context |
| `outputDir` | `string` | No | Output directory (default: `../temp/oracle`) |
| `telemetryDir` | `string` | No | Telemetry directory (default: `telemetry`) |
| `targetAgent` | `string` | No | Target agent name (default: auto-detect strategist) |
| `agentType` | `string` | No | Agent type for stop behavior (e.g. `strategist`) |
| `concurrency` | `number` | No | Max parallel executions (default: `5`) |
| `filter` | `(row, index) => boolean` | No | Filter which CSV rows to process (both phases) |
| `retrievalName` | `string` | No | Directory name for retrieved data (share across experiments) |

### `modifyPrompt` callback

Receives `OriginalPromptContext` with the raw extracted data:

```typescript
interface OriginalPromptContext {
  row: OracleRow;           // the CSV row
  system: string[];         // original system prompt parts (unmodified)
  messages: ModelMessage[]; // original conversation messages (unmodified)
  activeTools: string[];    // tool names from the original turn
  originalModel: string;    // model string from telemetry
  agentName: string;        // agent name from telemetry
}
```

Returns `ModifiedPrompt` — all fields optional; omitting a field keeps the original:

```typescript
interface ModifiedPrompt {
  system?: string[];         // override system prompt parts
  messages?: ModelMessage[]; // override conversation messages
  activeTools?: string[];    // override active tool list
  metadata?: Record<string, any>; // stored in trail, not sent to LLM
}
```

### `modelOverride` — single or multiple models

Return a single model to use a different model than the original:

```js
modelOverride: (original) => 'openai-compatible/Kimi-K2.5@Medium'
```

Return an array to replay each row with multiple models. Each model produces one `ReplayResult` and one trail file (suffixed with the model name):

```js
modelOverride: (original) => [
  'anthropic/claude-sonnet-4-6',
  'openai-compatible/Kimi-K2.5@Medium',
]
```

Duplicate model names in the array are supported for repeated sampling. Each duplicate gets a 1-based index suffix to distinguish trail files:

```js
// Three runs of the same model
modelOverride: (original) => [
  'anthropic/claude-sonnet-4-6',
  'anthropic/claude-sonnet-4-6',
  'anthropic/claude-sonnet-4-6',
]
// Produces trails: ...-claude-sonnet-4-6-1.json, ...-claude-sonnet-4-6-2.json, ...-claude-sonnet-4-6-3.json
// CSV includes a `repetition` column (1, 2, 3)
```

In mixed arrays, only duplicated models get indexed. A model appearing once keeps its suffix without an index.

Return `undefined` (or omit the callback) to keep the original model.

### `rewriteToolSchemas`

Receives a JSON string `{ description, inputSchema }` for each MCP tool and returns the modified JSON. Applied once at replay startup, before any rows are processed:

```js
rewriteToolSchemas: (json) => json
  .replaceAll('"game"', '"world"')
  .replaceAll('Civilization', 'Nation')
```

### `extractColumns` callback

Called after replay for each row. Receives `ExtractionContext`:

```typescript
interface ExtractionContext {
  originalPrompts: string[];     // raw system prompt parts from telemetry
  originalMessages: ModelMessage[]; // raw messages from telemetry
  replayPrompts: string[];       // system prompt parts after modifyPrompt
  decisions: ReplayDecision[];   // tool calls from the replay
  row: OracleRow;                // the CSV row
  agentName: string;             // agent name from telemetry
}
```

Returns an object of key-value pairs added as columns to the output CSV.

### `filter` — row filtering

Filter which CSV rows to process. Applied in both retrieve and replay phases:

```js
// Process only a specific game
filter: (row) => row.game_id === 'game-42',

// Process only the first 10 rows (for testing)
filter: (row, index) => index < 10,

// Complex filter
filter: (row) => row.player_type === 'human' && parseInt(row.turn) > 20,
```

### `retrievalName` — sharing retrieved data

By default, retrieved JSONs are stored under `{experimentName}/retrieved/`. To share retrieved data across experiments, set `retrievalName` to a common name:

```js
// experiments/baseline.js
export default {
  experimentName: 'baseline-v1',
  retrievalName: 'shared-nuke-data',
  // ...
};

// experiments/aggressive-prompt.js
export default {
  experimentName: 'aggressive-v1',
  retrievalName: 'shared-nuke-data',
  // ...
};
```

Run retrieve once with either config, then replay with any config that shares the same `retrievalName`:

```bash
npm run oracle -- -c baseline.js --retrieve
npm run oracle -- -c aggressive-prompt.js --replay
```

Can also be set via CLI: `--retrievalName shared-nuke-data`

## Output Files

```
{outputDir}/                                     (default: temp/oracle/)
  {experimentName}-results.csv                   ← one row per source row per model
  {experimentName}/
    retrieved/
      {gameId}-p{playerId}-t{turn}.json          ← raw telemetry data (retrieve phase)
    {gameId}-p{playerId}-t{turn}.json            ← replay trail
    {gameId}-p{playerId}-t{turn}.md              ← replay trail (markdown)
    {gameId}-p{playerId}-t{turn}-{model}.json    ← multi-model trails (when array returned)
    {gameId}-p{playerId}-t{turn}-{model}.md

telemetry/oracle/{experimentName}.db             ← OpenTelemetry spans from LLM calls
```

### Results CSV columns

The output CSV contains all original CSV columns (with `rationale` renamed to `originalRationale`) plus:

| Column | Description |
|---|---|
| `originalRationale` | Original `rationale` column value |
| `model` | Model used for replay |
| `replayRationale` | Rationale from the replay's decision tool call |
| `input_tokens` | Input tokens used |
| `reasoning_tokens` | Reasoning tokens used |
| `output_tokens` | Output tokens used |
| `error` | Error message (if replay failed) |
| `repetition` | 1-based index when same model appears multiple times (omitted otherwise) |
| *(custom)* | Any columns returned by `extractColumns` |

## CLI Reference

```bash
npm run oracle -- -c <experiment-script> [options]
```

| Flag | Short | Description |
|---|---|---|
| `--config` | `-c` | Experiment script filename or path (required) |
| `--outputDir` | `-o` | Override output directory |
| `--telemetryDir` | `-t` | Override telemetry directory |
| `--targetAgent` | | Override target agent name |
| `--agentType` | | Override agent type (e.g. `strategist`) |
| `--retrievalName` | | Override retrieval directory name (share across experiments) |
| `--retrieve` | | Retrieve phase only (no LLM calls) |
| `--replay` | | Replay phase only (load retrieved JSONs) |

Bare config filenames (no path separator) resolve to the `experiments/` directory.
