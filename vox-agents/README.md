# Vox Agents

LLM-powered strategic AI agents for Civilization V. This module implements sophisticated game analysis and decision-making using modern AI models to play Civilization V autonomously.

## What's Implemented

- **Agent Framework** - Flexible base classes (`VoxAgent`/`VoxContext`) for building AI workflows
- **Briefer Agents** - Game state summarization agents for strategic analysis
  - `SimpleBriefer` - General game state briefing
  - `SpecializedBriefer` - Domain-specific briefing (military, economy, diplomacy)
- **Strategist Agents** - Turn-based decision agents with comprehensive game analysis
  - `NoneStrategist` - Baseline agent for testing
  - `SimpleStrategist` - Direct strategy implementation
  - `SimpleStrategistBriefed` - Two-stage analysis with briefing
  - `SimpleStrategistStaffed` - Multi-briefer collaborative analysis
- **Envoy Agents** - Chat-based agents for diplomacy and conversation
  - `LiveEnvoy` - Game-specific chat with briefing tools
  - `Diplomat` - Intelligence-gathering envoy
  - `Spokesperson` - Official representative
- **Analyst Agents** - Fire-and-forget intelligence assessment
  - `DiplomaticAnalyst` - Intelligence gatekeeping and relay decisions
- **Librarian Agents** - Database research for knowledge retrieval
  - `KeywordLibrarian` - Keyword-based database search
- **Telepathist Agents** - Post-game analysis via telemetry databases
  - `TalkativeTelepathist` - Conversational interface to game history
  - `Summarizer` - Unified turn/phase summarization agent
  - Database query tools: conversation logs, decisions, game overview, game state
- **Oracle Agent** - Counterfactual prompt replay system for "what-if" analysis
  - Replays past agent turns with modified prompts through same or different LLMs
  - CSV-driven experiment runner with telemetry auto-discovery
  - Schema-only tools (no MCP execution) for safe replay
  - Outputs: result CSV, JSON trails, markdown trails, telemetry DB
- **Archivist** - Batch pipeline for processing archived games into DuckDB episode databases
  - Scans archive directories for completed games and LLM-controlled players
  - Generates telepathist summaries and extracts player-turn snapshots
  - Tracks game outcome metadata (winner, victory type, max turn) for retrieval enrichment
- **MCP Client** - Robust HTTP/SSE client for MCP server communication
- **Tool Integration** - Dynamic tool wrapping, composition, and rescue middleware
- **Multi-LLM Support** - OpenRouter, OpenAI, Google AI, Anthropic, AWS Bedrock, and compatible providers
- **Session Management** - Persistent session tracking with game state storage
- **Web UI** - Vue 3 dashboard for monitoring and control
- **Observability** - OpenTelemetry integration with SQLite export

## Architecture

```
LLM Providers ← Vox Agents → MCP Server → Bridge Service → Civ V
                    ↓
              Agent Framework
         (Strategist, Briefer, Analyst,
          Librarian, Envoy, Telepathist)
                    ↓
            Agent Registry (Global)
                    ↓
              Tool Middleware
         (Wrapping, Composition, Rescue)
```

### Core Components

- **VoxAgent** ([vox-agent.ts](src/infra/vox-agent.ts)) - Base class with step execution and tool integration
- **VoxContext** ([vox-context.ts](src/infra/vox-context.ts)) - Execution context with MCP client management
- **VoxCivilization** ([vox-civilization.ts](src/infra/vox-civilization.ts)) - Game process lifecycle management
- **VoxSession** ([vox-session.ts](src/infra/vox-session.ts)) - Base session management with lifecycle hooks
- **SessionRegistry** ([session-registry.ts](src/infra/session-registry.ts)) - Global session tracking and coordination
- **ContextRegistry** ([context-registry.ts](src/infra/context-registry.ts)) - Global context lifecycle management
- **Briefer** ([briefer.ts](src/briefer/briefer.ts)) - Base class for game state analysis
- **Strategist** ([strategist.ts](src/strategist/strategist.ts)) - Base class for strategic decisions
- **Envoy** ([envoy.ts](src/envoy/envoy.ts)) - Base class for chat-based interactions
- **Analyst** ([analyst.ts](src/analyst/analyst.ts)) - Base class for fire-and-forget analysis agents
- **Librarian** ([librarian.ts](src/librarian/librarian.ts)) - Base class for database research agents
- **Telepathist** ([telepathist.ts](src/telepathist/telepathist.ts)) - Base class for database-backed chat agents
- **TelepathistTool** ([telepathist-tool.ts](src/telepathist/telepathist-tool.ts)) - Abstract base for database query tools with span hierarchy traversal
- **Summarizer** ([summarizer.ts](src/telepathist/summarizer.ts)) - Unified turn/phase summarization with caching
- **AgentRegistry** ([agent-registry.ts](src/infra/agent-registry.ts)) - Global centralized agent discovery and registration
- **MCP Client** ([mcp-client.ts](src/utils/models/mcp-client.ts)) - Event-driven MCP communication
- **Session Manager** ([strategist-session.ts](src/strategist/strategist-session.ts)) - Game session with state persistence
- **Web Server** ([server.ts](src/web/server.ts)) - Express API and Vue UI hosting
- **Agent Registry** ([agent-registry.ts](src/infra/agent-registry.ts)) - Dynamic agent discovery and loading

## Quick Start

```bash
# Setup environment
cp .env.default .env
# Edit .env and add your API keys

npm install
npm run build

# Workflows
npm run strategist                    # Strategist (default)
npm run telepathist -- -d <db-file>   # Post-game analysis console
npm run oracle -- -c <experiment.js>  # Oracle prompt replay

# Development
npm run dev          # Hot reload
npm test             # Test suite
```

## Configuration

### Environment Variables
Copy `.env.default` to `.env` and configure your API keys:

```bash
# Required (at least one)
OPENAI_API_KEY=sk-...        # OpenAI API
ANTHROPIC_API_KEY=sk-ant-... # Anthropic API
OPENROUTER_API_KEY=sk-or-... # OpenRouter API (default model uses this)
GOOGLE_GENERATIVE_AI_API_KEY=... # Google AI
```

See `.env.default` for all available options and documentation.

### Model Configuration
**Default Model**: The system uses `openai-compatible/gpt-oss-120b` by default. This is a cost-effective open-source model.

To change the default model or add custom models, edit `vox-agents/config.json`:
```json
{
  "llms": {
    "default": "openai-compatible/gpt-oss-120b",
    "openai/gpt-5-mini": {
      "provider": "openai",
      "name": "gpt-5-mini"
    }
  }
}
```

### Strategist Configuration
The strategist can be configured via JSON files in the `configs/` directory or through command-line arguments.

#### Default Behavior
By default, the strategist runs in **interactive mode**:
- Uses `play-simple.json` configuration if no config specified
- Game pauses on human turns
- AI controls specified players (default: Player 1)
- Human controls Player 0

#### Configuration Files
1. **configs/play-simple.json** - Interactive game with Simple Strategist as Player 1
2. **configs/observe-vanilla.json** - Observe mode: auto-play vanilla game
3. **configs/observe-simple.json** - Observe mode: auto-play with Simple Strategist as Player 0
4. **configs/[custom].json** - Custom configurations (gitignored)

Example configuration:
```json
{
  "llmPlayers": {              // Object mapping player IDs to strategist configs
    "1": {
      "strategist": "simple-strategist"
    }
  },
  "autoPlay": false,           // false = interactive (pauses), true = observe (auto)
  "gameMode": "start",         // Game mode ("start" for new game, "load" for saved game)
  "repetition": 1              // Number of games to play in sequence
}
```

Available strategists:
- `"none-strategist"` - No strategy changes (baseline)
- `"simple-strategist"` - Direct strategy implementation
- `"simple-strategist-briefed"` - Two-stage with briefing first
- `"simple-strategist-staffed"` - Multi-briefer collaborative analysis

#### Command-Line Usage
```bash
# Default: Interactive mode with play-simple.json
npm run strategist

# Use specific configuration file
npm run strategist -- --config=observe-vanilla.json
npm run strategist -- --config=custom.json

# Override configuration with command-line options
npm run strategist -- --autoPlay              # Enable observe mode
npm run strategist -- --players 0,1,2         # AI controls players 0, 1, 2
npm run strategist -- --strategist none       # No AI, just observe
npm run strategist -- --load                  # Load saved game

# Combine options
npm run strategist -- --config observe-simple.json --repetition 5
```

## Usage Modes

### Interactive Mode (Default)
Play alongside AI agents - you control your civilization while AI controls others:

```bash
# Default: Human as Player 0, AI as Player 1
npm run strategist

# Custom player assignment
npm run strategist -- --players 2,3,4  # AI controls players 2, 3, 4

# Or use configuration file (see Configuration Files section for format)
npm run strategist -- --config=my-game.json
```

In interactive mode:
- Game pauses when it's a human player's turn
- AI automatically plays its assigned civilizations
- Perfect for playing with AI assistance or against AI opponents
- No auto-resume between turns

### Observe Mode
Watch AI play autonomously without human intervention:

```bash
# Enable observe mode via command line
npm run strategist -- --autoPlay

# Watch AI play all civilizations
npm run strategist -- --autoPlay --players 0,1,2,3,4,5,6,7

# Or use observe configuration files
npm run strategist -- --config=observe-simple.json    # AI as Player 0
npm run strategist -- --config=observe-vanilla.json   # Watch vanilla AI
```

In observe mode:
- Game runs continuously without pausing
- AI makes all decisions automatically
- Great for testing strategies or watching AI performance
- Can run multiple games in sequence with `--repetition`

The agent workflow:
1. Connects to MCP server via HTTP
2. Subscribes to game events via SSE
3. Auto-pauses on AI turns
4. Analyzes game state and makes decisions
5. Resumes game automatically
6. Handles crashes with automatic recovery

## Telepathist Workflow

The telepathist provides a conversational interface for post-game analysis, querying telemetry databases to reconstruct and discuss past games.

### Command-Line Usage
```bash
# Analyze a game from its telemetry database
npm run telepathist -- -d game-123.db

# Use a specific agent variant
npm run telepathist -- -d game-123.db -a talkative-telepathist

# Run summarization/bootstrapping only, then exit
npm run telepathist -- -d game-123.db --prepare
```

### Options
| Flag | Description |
|------|-------------|
| `-d, --database` | Path to telemetry `.db` file (required, or first positional arg) |
| `-a, --agent` | Agent name (default: `talkative-telepathist`) |
| `-p, --prepare` | Preparation only: run summarization then exit |

Bare filenames resolve relative to the `telemetry/` directory. The web UI starts automatically on port 5173.

## Oracle Workflow

The Oracle runs counterfactual prompt replay experiments — replaying past agent turns with modified prompts or different LLMs to explore "what-if" scenarios. It operates in two phases: **retrieve** (extract raw prompts from telemetry, no LLM) and **replay** (apply modifications, run LLM, write results).

See [docs/oracle.md](docs/oracle.md) for full documentation.

### Command-Line Usage
```bash
# Full experiment (retrieve + replay)
npm run oracle -- -c my-experiment.js

# Retrieve phase only (extract prompts, no LLM calls)
npm run oracle -- -c my-experiment.js --retrieve

# Replay phase only (load saved JSONs, run LLM)
npm run oracle -- -c my-experiment.js --replay

# Override directories
npm run oracle -- -c my-experiment.js -o temp/oracle-v2 -t telemetry/custom
```

### Options
| Flag | Description |
|------|-------------|
| `-c, --config` | Experiment script filename or path (required) |
| `-o, --outputDir` | Override output directory |
| `-t, --telemetryDir` | Override telemetry directory |
| `--targetAgent` | Override target agent name |
| `--agentType` | Override agent type (e.g., `strategist`) |
| `--retrieve` | Retrieve phase only (extract raw prompts, no LLM) |
| `--replay` | Replay phase only (load retrieved JSONs, run LLM) |

Bare config filenames resolve to the `experiments/` directory. The experiment config must export an `OracleConfig` with `csvPath`, `experimentName`, and `modifyPrompt`.

Outputs:
- Retrieved JSONs: `temp/oracle/{experimentName}/retrieved/`
- Results CSV: `temp/oracle/{experimentName}-results.csv`
- JSON/Markdown trails: `temp/oracle/{experimentName}/`
- Telemetry DB: `telemetry/oracle/{experimentName}.db`

## Archivist Workflow

The archivist processes archived game databases into a DuckDB episode database for retrieval-augmented strategy. After processing, it automatically opens DuckDB UI in the browser for result inspection (suppress with `--no-ui`).

The pipeline also stores game outcome metadata (winner player, victory type, and max turn) in a `game_outcomes` table. During episode retrieval, outcome horizon turns are capped at the game's final turn to avoid missing end-game data, and the victory type is included in results.

### Command-Line Usage
```bash
# Process all games in the archive directory
npm run archivist -- -a <archive-path> -o <output.duckdb>

# Process only the next 3 incomplete games
npm run archivist -- -a ../temp/archive -o ../temp/episodes.duckdb -n 3

# Process a specific game only
npm run archivist -- -a ../temp/archive -o ../temp/episodes.duckdb -g game-abc123

# Force re-processing (deletes existing episodes first)
npm run archivist -- -a ../temp/archive -o ../temp/episodes.duckdb --force

# For quick validation of non-telepathist features
npm run archivist -- -a ../temp/archive -o ../temp/episodes.duckdb --force --skip-telepathist
```

### Options
| Flag | Description |
|------|-------------|
| `-a, --archive` | Path to archive directory (default: `archive`) |
| `-o, --output` | Path to DuckDB output file (default: `episodes.duckdb`) |
| `-g, --game` | Process only this specific game ID |
| `-n, --limit` | Max number of incomplete games to process |
| `-m, --model` | Override the Summarizer LLM model (key from config.llms) |
| `--force` | Delete existing episodes before re-processing |
| `--no-ui` | Skip opening DuckDB UI after completion - MUST use when testing changes |
| `--skip-telepathist` | Skip telepathist process for quick validation on other features |
| `--skip-embeddings` | Skip embedding generation for landmarks |


## Web UI Dashboard

The module includes a Vue 3 dashboard for monitoring and control:

```bash
# Build everything including UI
npm run build

# Development mode with hot reload
cd ui && npm run dev

# Preview production build
cd ui && npm run preview
```

The web server starts automatically with the agents and serves the UI at http://localhost:5555

Features:
- **Real-time Logs** - Stream logs from all components with filtering
- **Telemetry Viewer** - Inspect OpenTelemetry spans, traces, and sessions
- **Session Monitor** - Track active game sessions and agent states
- **Configuration Editor** - Modify runtime configuration with model selection
- **Agent Chat** - Interactive chat interface with agents and conversation history
- **Pinia State Management** - Centralized stores for sessions, chat, logs, telemetry, and health

## Key Implementation Details

### Tool Wrapping
- Automatic Zod-to-JSON schema conversion
- Dynamic tool discovery from MCP
- Batch tool execution support
- Error handling with retries

### Session Management
- Persistent session IDs for game continuity
- Automatic session recovery on crashes
- Player-specific session isolation
- Turn-based session lifecycle

### Event Handling
- SSE subscription for real-time updates
- Event consolidation and deduplication
- Turn detection and auto-pause triggering
- Graceful reconnection on disconnect

### LLM Integration
- Provider abstraction for model flexibility
- Tool middleware for enhanced capabilities
- Streaming response support
- Token usage tracking

## Testing

```bash
npm test                  # All tests (once)
npm run test:watch        # Watch mode
npm run test:unit         # Unit tests only (no game needed)
npm run test:game         # Game tests (launches Civilization V)
npm run test:coverage     # Coverage report
```

### Test Categories

- **Unit tests** (`tests/utils/`) - Pure logic, no external dependencies. Utility functions, data transformations, agent logic with mocks.
- **Game tests** (`tests/infra/`) - Full game lifecycle management. Launches CivilizationV.exe, monitors process, tests start/kill cycle. Requires Windows with Civ V installed. Extended timeouts (90-180s).

### Safety Guard

If CivilizationV.exe is already running when tests start, the entire suite aborts with an error message. Only one Civ5 instance can run at a time, and tests will not kill an active game session.

## Development Tips

### Debugging
- Check parquet-based log data
- Monitor MCP server logs
- Use breakpoints in VS Code

### Performance
- Tools cached after first discovery
- Batch MCP calls when possible
- Use appropriate model for task complexity
- Monitor token usage in production

### Common Issues

**MCP Connection Failed**
- Ensure MCP server running
- Check endpoint configuration
- Verify network connectivity

**LLM Rate Limits**
- Implement exponential backoff
- Use different models for different tasks
- Consider caching strategies

**Game Not Responding**
- Verify game pause state via MCP
- Check Bridge Service connection
- Monitor Bridge Service logs

## Integration Points

### With MCP Server
- HTTP endpoint for tool execution
- SSE for event notifications
- Session-based connection management
- Automatic reconnection handling

### With Game State
- Turn-based event notifications via SSE
- Game pause/resume control via MCP
- Session persistence and recovery
- Player-specific action execution

## Project Structure

```
vox-agents/
├── src/
│   ├── infra/                     # Core framework
│   │   ├── vox-agent.ts           # Base agent with lifecycle hooks
│   │   ├── vox-context.ts         # Execution context management
│   │   ├── vox-civilization.ts    # Game process lifecycle
│   │   ├── vox-session.ts         # Base session management
│   │   ├── agent-registry.ts      # Global centralized agent discovery
│   │   ├── session-registry.ts    # Global session tracking
│   │   └── context-registry.ts    # Global context lifecycle
│   ├── strategist/                # Strategy agents
│   │   ├── agents/
│   │   │   ├── none-strategist.ts
│   │   │   ├── simple-strategist.ts
│   │   │   ├── simple-strategist-base.ts
│   │   │   ├── simple-strategist-briefed.ts
│   │   │   └── simple-strategist-staffed.ts
│   │   ├── strategist.ts         # Base strategist
│   │   ├── strategist-session.ts  # Session management
│   │   ├── strategy-parameters.ts
│   │   ├── vox-player.ts
│   │   └── index.ts              # Entry point
│   ├── briefer/                   # Briefing agents
│   │   ├── briefer.ts            # Base briefer
│   │   ├── simple-briefer.ts     # General briefing
│   │   ├── specialized-briefer.ts # Domain-specific (military/economy/diplomacy)
│   │   └── briefing-utils.ts
│   ├── analyst/                   # Analysis agents
│   │   ├── analyst.ts            # Base analyst (fire-and-forget)
│   │   └── diplomatic-analyst.ts  # Intelligence gatekeeping
│   ├── librarian/                 # Research agents
│   │   ├── librarian.ts          # Base librarian
│   │   └── keyword-librarian.ts   # Keyword-based DB search
│   ├── envoy/                     # Chat agents
│   │   ├── envoy.ts              # Base chat agent
│   │   ├── live-envoy.ts         # Game-specific chat
│   │   ├── diplomat.ts           # Intelligence gathering
│   │   ├── spokesperson.ts       # Official representative
│   │   └── envoy-prompts.ts      # Shared prompt library
│   ├── telepathist/               # Post-game analysis agents
│   │   ├── telepathist.ts        # Base telepathist
│   │   ├── talkative-telepathist.ts
│   │   ├── summarizer.ts         # Unified turn/phase summarizer
│   │   ├── telepathist-parameters.ts # Dual-database setup
│   │   ├── telepathist-tool.ts   # Abstract base for DB query tools
│   │   ├── console.ts            # CLI entry point
│   │   └── tools/                # Database query tools
│   │       ├── get-conversation-log.ts
│   │       ├── get-decisions.ts
│   │       ├── get-game-overview.ts
│   │       └── get-game-state.ts
│   ├── oracle/                    # Counterfactual prompt replay
│   │   ├── types.ts              # Type definitions
│   │   ├── oracle-agent.ts       # VoxAgent subclass
│   │   ├── oracle.ts             # Experiment orchestrator
│   │   ├── prompt-extractor.ts   # Telemetry prompt extraction
│   │   ├── model-resolver.ts     # Model string resolution
│   │   ├── db-resolver.ts        # Telemetry DB auto-discovery
│   │   └── index.ts              # CLI entry point
│   ├── archivist/                 # Batch episode extraction
│   │   ├── index.ts              # CLI entry point
│   │   ├── scanner.ts            # Archive filesystem discovery
│   │   ├── telepathist-prep.ts   # Telepathist summary generation wrapper
│   │   ├── extractor.ts          # Raw episode extraction from game DBs
│   │   ├── writer.ts             # DuckDB episode output
│   │   └── types.ts              # Shared types and constants
│   ├── web/                       # Web UI backend
│   │   ├── server.ts             # Express + Vue hosting
│   │   ├── sse-manager.ts        # Real-time streaming
│   │   └── routes/               # API endpoints
│   ├── utils/
│   │   ├── models/               # LLM integration
│   │   │   ├── models.ts         # Model configuration
│   │   │   ├── mcp-client.ts     # MCP server communication
│   │   │   ├── concurrency.ts    # Per-model rate limiting (semaphore)
│   │   │   └── tool-rescue.ts    # JSON extraction from text responses
│   │   ├── telemetry/            # Observability
│   │   │   ├── vox-exporter.ts   # Custom Vox telemetry
│   │   │   ├── sqlite-exporter.ts # SQLite trace storage
│   │   │   └── schema.ts         # Span/metric schemas
│   │   ├── tools/                # Tool utilities
│   │   │   ├── agent-tools.ts    # Agent-as-tool wrapper
│   │   │   ├── mcp-tools.ts      # MCP tool wrapping and caching
│   │   │   ├── json-to-markdown.ts # Data formatting
│   │   │   ├── simple-tools.ts   # Basic utility tools
│   │   │   └── terminal-tools.ts # Terminal command tools
│   │   ├── config.ts             # Configuration loader
│   │   ├── logger.ts             # Winston logging
│   │   ├── retry.ts              # Exponential backoff
│   │   ├── token-counter.ts      # tiktoken-based counting
│   │   ├── game-speed.ts         # Turn calculations
│   │   ├── event-filters.ts      # Event categorization
│   │   ├── report-filters.ts     # Field filtering
│   │   ├── text-cleaning.ts      # Artifact removal
│   │   ├── identifier-parser.ts  # ID parsing
│   │   └── librarian-utils.ts    # Context extraction
│   ├── types/                     # TypeScript definitions
│   └── instrumentation.ts        # OpenTelemetry setup
├── ui/                            # Vue 3 dashboard
│   ├── src/
│   │   ├── views/                 # Page components
│   │   ├── components/            # Reusable UI components
│   │   ├── stores/                # Pinia state management
│   │   ├── composables/           # Vue composables
│   │   ├── styles/                # Shared CSS
│   │   └── api/                   # Backend API client
│   └── vite.config.ts
├── tests/                         # Vitest suite
├── configs/                       # Game configurations
└── package.json
```