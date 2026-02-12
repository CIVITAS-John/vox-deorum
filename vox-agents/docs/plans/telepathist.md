# Plan: Telepathist Agent System

## Overview
New agent family that reads from the **telemetry database** (player trajectory spans) instead of live game state. Reuses `Envoy`/`EnvoyThread` chat infrastructure with a new `TelepathistParameters` type and **semantic** internal tools for querying game history.

## Architecture

```
Envoy<TParameters> (existing)
  ├── LiveEnvoy (Envoy<StrategistParameters>) ← existing, for live game
  └── Telepathist (Envoy<TelepathistParameters>) ← NEW, for database
      └── TalkativeTelepathist ← NEW, first concrete agent
      └── (future: AgenticTelepathist)
```

## New Files

### 1. `src/telepathist/telepathist-parameters.ts`

**`TelepathistParameters`** extends `AgentParameters`:
```ts
interface TelepathistParameters extends AgentParameters {
  databasePath: string;                   // Absolute path to the telemetry .db file
  db: Kysely<TelemetryDatabase>;          // Read-only Kysely connection to telemetry DB
  telepathistDb: Kysely<TelepathistDatabase>;     // Read-write telepathist DB for generated data
  civilizationName: string;               // e.g. "Rome"
  leaderName: string;                     // e.g. "Augustus Caesar"
  availableTurns: number[];               // Sorted list of turns in the database
}
```

**Two databases**:
- `db` — telemetry DB opened **read-only** (via `SQLiteSpanExporter.openDatabaseFile()`)
- `telepathistDb` — telepathist DB at `{databasePath}.telepathist.db`, opened read-write, stores generated data (turn summaries, phase summaries, future: memory layer)

**`createTelepathistParameters(databasePath, parsedId)`**:
1. Opens telemetry DB read-only
2. Opens/creates telepathist DB (creates `turn_summaries` and `phase_summaries` tables if not exists)
3. Queries `SELECT DISTINCT turn FROM spans WHERE turn IS NOT NULL ORDER BY turn`
4. Extracts player identity from first `mcp-tool.get-metadata` span → parses `tool.output` for `YouAre.Name` and `YouAre.Leader`
5. Falls back to "Unknown" for identity if metadata span not found
  - Send out a warning for that
6. Sets `turn` to the last available turn

**`closeTelepathistParameters(params)`**: destroys both Kysely connections. Called automatically during `VoxContext.shutdown()` when the context holds a `TelepathistParameters` instance (detected by checking for `db`/`telepathistDb` properties).

---

### 2. `src/telepathist/telepathist-tool.ts` — Tool Base Class

Abstract base class that wraps `createSimpleTool` with shared database query patterns:

```ts
abstract class TelepathistTool<TInput = any> {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly inputSchema: ZodType<TInput>;

  /** Create the AI SDK tool (delegates to createSimpleTool for telemetry tracing) */
  createTool(context: VoxContext<TelepathistParameters>): Tool {
    return createSimpleTool({
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      execute: (input, params) => this.execute(input, params)
    }, context);
  }

  abstract execute(input: TInput, params: TelepathistParameters): Promise<string>;

  // --- Shared query helpers ---

  /** Parse flexible turn input ("30", "10,20,30", or range string "30-50") into number[] */
  protected parseTurns(
    turns: string,
    available: number[]
  ): number[];

  /** Get root spans for given turns (name like '%.turn.%') */
  protected async getRootSpans(db, turns: number[]): Promise<Span[]>;

  /** Get agent step spans for given turns (name like '%.turn.%.step.%') */
  protected async getAgentSteps(db, turns: number[]): Promise<Span[]>;

  /** Get MCP tool call spans for given turns, optionally filtered by tool name */
  protected async getToolCallSpans(db, turns: number[], toolNames?: string[]): Promise<Span[]>;

  /** Extract tool.output from a tool call span (parsed JSON) */
  protected getToolOutput(span: Span): any;

  /** Format a tool output using jsonToMarkdown with the tool's markdownConfig */
  protected formatToolOutput(toolName: string, output: any): string;
  // Uses a static map of tool name → markdownConfig (same configs as MCP server)

  /** Safely parse JSON attributes from a span */
  protected parseAttributes(span: Span): SpanAttributes;
}
```

Each tool extends this, inheriting DB query helpers and getting automatic `simple-tool.{name}` telemetry spans.

---

### 3. `src/telepathist/tools/` — Concrete Tool Implementations

**Design principle**: each tool is self-contained — its output serves one purpose without needing another tool to understand it. Tools are organized as zoom levels.

All tools support flexible turn input (`turns: string` — single turn, array, or range like `"30-50"`) unless noted.

#### `get-game-overview.ts` — Zoom In to a Range
**Input**: `{ turns?: string }` — optional, defaults to all turns

Returns **per-turn detailed summaries** for the requested range:
- For each turn: the detailed summary paragraph (from `telepathistDb.turn_summaries`)
- Guaranteed to exist — generated at session initialization
- No LLM calls, fast read from DB

Note: the high-level bird's eye (phase summaries + player identity) is already in the agent's context — `get-game-overview` is for zooming in to specific turns.

Self-contained answer to "What happened between turns 30-50?"

##### Session Initialization: Batch Summarization
When a telepathist session starts, summaries are generated **before the chat begins**:

1. The UI sends a `{{{Initialize}}}` special message as the first interaction
2. The Telepathist detects this and runs initialization via `context.streamProgress()` (see Streaming section)
3. For each turn without a summary:
   - Reads game state from telemetry DB (MCP tool output spans)
   - Calls `TurnSummarizer` agent with that turn's data
   - Streams progress to the user (e.g., "Analyzing turn 15/50...")
   - Stores result in telepathist DB
4. Generates **phase summaries** (per ~10 turns) from turn summaries
   - `PhaseSummarizer` agent using results from `TurnSummarizer`
5. Once complete, the LLM receives phase summaries + identity as context and generates a greeting
6. If summaries already exist (resuming a session), skips straight to greeting

##### Two Levels of Summaries

**Per-turn summaries** (`turn_summaries` table):
```sql
CREATE TABLE IF NOT EXISTS turn_summaries (
  turn INTEGER PRIMARY KEY,
  shortSummary TEXT NOT NULL,
  fullSummary TEXT NOT NULL,
  model TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);
```

**Phase summaries** (`phase_summaries` table) — generated from turn summaries, ~10 turns each:
```sql
CREATE TABLE IF NOT EXISTS phase_summaries (
  fromTurn INTEGER NOT NULL,
  toTurn INTEGER NOT NULL,
  summary TEXT NOT NULL,
  model TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  PRIMARY KEY (fromTurn, toTurn)
);
```

Phase summaries + player identity are injected into `getContextMessages()` — always available to the LLM as system context, no tool call needed.

##### TurnSummarizer Agent (`src/telepathist/turn-summarizer.ts`)
A non-interactive agent that generates summaries **one turn at a time**:
- Extends `VoxAgent<TelepathistParameters, TurnSummarizerInput, TurnSummary>`
- Input: game state data for a single turn (pre-formatted with `jsonToMarkdown`)
- No tools needed — just text generation
- Output: `{ shortSummary: string, fullSummary: string }`
- Called in a loop by the Telepathist during initialization

##### Streaming Pattern (`context.streamProgress`)
Add a `streamProgress` callback to `VoxContext`:
```ts
public streamProgress?: (message: string) => void;
```
- Set by the web route when creating the SSE stream (before `execute()`)
- Used by the Telepathist during `{{{Initialize}}}` to stream progress messages
- Reusable for any agent that needs to send non-LLM progress updates
- Progress messages are sent as SSE `message` events to the client

#### `get-game-state.ts` — Ground Truth
**Input**: `{ turns: number | number[] | string, categories?: string[] }`

The actual game data the AI had access to — reconstructed from MCP tool outputs stored in span attributes:
- **Categories** (optional filter): `players`, `cities`, `events`, `military`, `options`, `victory`
- If no category filter: returns all available data for the turn
- Data extracted from `mcp-tool.get-*` spans' `tool.output` attributes

**Formatting**: reuses `jsonToMarkdown()` (from `src/utils/tools/json-to-markdown.ts`) with each tool's markdownConfig, matching what agents see during live play:

| Span Source | markdownConfig |
|-------------|---------------|
| `mcp-tool.get-players` | `["Player {key}"]` |
| `mcp-tool.get-cities` | `["Player: {key}", "{key}"]` |
| `mcp-tool.get-events` | `["Turn {key}", "{key}"]` |
| `mcp-tool.get-military-report` | `["{key}"]` |
| `mcp-tool.get-options` | `["{key}", "{key}", "{key}"]` |
| `mcp-tool.get-victory-progress` | `["{key}"]` |

The tool parses `tool.output` JSON, attaches `_markdownConfig` (same pattern as `mcp-tools.ts` line 110-117), then calls `jsonToMarkdown()`.

Self-contained answer to "What was the situation on turn X?" — the ground truth for verifying AI decisions.

#### `get-decisions.ts` — AI Choices
**Input**: `{ turns: number | number[] | string }`

What the AI decided and did — full decision context:

1. **Strategic options available**: includes the full `get-options` output for the turn (formatted via `jsonToMarkdown` with its markdownConfig). This shows:
   - Available grand strategies, military/economic strategies, technologies, policies
   - Current strategy state (what was already set)
   - Relationship standings
   - This reveals what the AI *could* have done, not just what it did

2. **Agents involved**: describes which agents ran and their roles (e.g., "specialized-briefer generated an Economy briefing, simple-strategist-briefed made strategy decisions")

3. **AI reasoning**: per agent, the decision text from `step.responses` attributes

4. **Decisions made**: extracted from decision tool call spans:
   - `set-strategy` → grand strategy + economic/military strategies + Rationale
   - `set-research` → technology chosen + Rationale
   - `set-policy` → policy chosen + Rationale
   - `set-flavors` → flavor values + Rationale
   - `set-persona` → persona traits + Rationale
   - `set-relationship` → relationship changes + Rationale
   - `keep-status-quo` → decision NOT to change + Rationale
   - Other MCP tool calls (game actions like lua-executor, etc.)

Self-contained answer to "What did the AI do on turn X and why?" — includes both the options landscape and the choices made.

#### `get-conversation-log.ts` — Deep Dive
**Input**: `{ turn: number, agent?: string }` — single turn (verbose)

Full LLM conversation for a turn:
- Organized **per agent** (not per step): combines all steps for each agent into one coherent conversation
- Skips malformed/empty steps — only shows meaningful exchanges
- System prompt → messages → responses, presented as a continuous dialogue
- If `agent` specified: only that agent; otherwise all agents that ran on the turn

Self-contained deep dive into the exact AI conversation.

---

*(TurnSummarizer agent described above in the Session Initialization section)*

---

### 4. `src/telepathist/telepathist.ts` — Base Agent Class

**`Telepathist`** extends `Envoy<TelepathistParameters>`:

- `toolChoice = "auto"`
- `getExtraTools(context)` — instantiates all tool classes, calls `createTool(context)` on each, returns the record
- `getActiveTools()` — returns the 4 tool names (subclasses can extend)
- `getInitialMessages()` — special message detection + database context + conversation history (mirrors LiveEnvoy flow)
- `getContextMessages(params, input)` — system message with player identity + phase summaries (from telepathistDb) — always available as context
- `prepareStep()` — disables tools in special message mode
- Handles `{{{Initialize}}}` special message: runs batch summarization, streams progress, then greets
- Abstract: `getHint()`, `getSpecialMessages()`, `getSystem()`

### 5. `src/telepathist/talkative-telepathist.ts`

- `name = "talkative-telepathist"`, `tags = ["telepathist"]`
- System prompt: analyst who has "read the mind" of the AI player — knows decisions and strategies from the historical record
- `getSpecialMessages()` — `{{{Initialize}}}` (batch summarize + greet) and `{{{Greeting}}}` (just greet)
- `getHint()` — anchors on player identity
- `getActiveTools()` — all 4 tools

### 6. `src/telepathist/index.ts` — Barrel export

---

## Modified Files

### 7. `src/infra/agent-registry.ts`
- Import and register `TalkativeTelepathist` and `TurnSummarizer` in `initializeDefaults()`

### 8. `src/infra/vox-context.ts`
- Add `public streamProgress?: (message: string) => void` callback property
- Reusable for any agent that needs to stream non-LLM progress
- In `shutdown()`: detect if `lastParameter` has `TelepathistParameters` shape (has `db` and `telepathistDb` properties) and call `closeTelepathistParameters()` to destroy both Kysely connections

### 9. `src/web/routes/agent.ts`

**POST /agents/chat** (with `databasePath`):
- After creating VoxContext, call `createTelepathistParameters(databasePath, parsedId)` and set as `voxContext.lastParameter`

**POST /agents/message**:
- Guard `ensureGameState`: only when `thread.contextType === 'live'`
- Set `voxContext.streamProgress` to send SSE progress events before calling `execute()`

---

## Parameter Flow

```
POST /agents/chat (databasePath)
  → parseDatabaseIdentifier(databasePath) → { gameID, playerID }
  → creates VoxContext with telepathist ID
  → createTelepathistParameters(databasePath, { gameID, playerID })
    → opens DB, queries turns, extracts civ/leader from get-metadata span
  → stores as voxContext.lastParameter

POST /agents/message
  → thread.contextType === 'database' → skip ensureGameState
  → voxContext.execute("talkative-telepathist", params, thread)
    → tools use params.db via TelepathistTool base class helpers

VoxContext.shutdown()
  → detects TelepathistParameters → closeTelepathistParameters()
    → destroys db and telepathistDb Kysely connections
```

## Design for Future Agentic Telepathist
- Database tools in base class via `TelepathistTool`, available to all
- New tools extend `TelepathistTool` and reuse query helpers
- `getActiveTools()` / `stopCheck()` overridable for goal-driven behavior
- `TelepathistParameters` has no chat-specific state

## Verification
1. `npm run build` in vox-agents
2. Web UI → telemetry DB → "Chat" → AgentSelectDialog shows "talkative-telepathist"
3. Create thread → UI sends `{{{Initialize}}}` → streams "Analyzing turn 1/N..." progress → generates phase summaries → greeting with game overview (agent already has phase summaries + identity in context)
4. Second session with same DB → skips summarization (`.telepathist.db` exists) → greets immediately
5. "What happened between turns 30-50?" → `get-game-overview` with range → per-turn detailed summaries
6. "What was the military situation on turn 50?" → `get-game-state` with `categories: ["military"]`
7. "What did the AI do on turns 30-50?" → `get-decisions` with range → options + reasoning + actions
8. "Was building a settler on turn 45 the right call?" → `get-game-state` for ground truth + `get-decisions` for reasoning
9. "Show me the full AI conversation on turn 30" → `get-conversation-log`
