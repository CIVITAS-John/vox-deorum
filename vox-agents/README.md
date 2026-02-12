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
npm start            # Run strategist

# Development
npm run dev          # Hot reload
npm run telepathist  # Post-game analysis console
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

Pre-configured models include:
- OpenAI: `openai/gpt-5-mini`, `openai/gpt-5-nano`
- Anthropic: `anthropic/claude-haiku-4-5`, `anthropic/claude-sonnet-4-5`, `anthropic/claude-opus-4-5`
- OpenRouter: `openrouter/openai/gpt-oss-120b`, `openrouter/google/gemini-2.5-flash-lite`
- AWS Bedrock: `aws/anthropic/claude-sonnet-4-5`
- Chutes: `chutes/deepseek-ai/DeepSeek-V3.2`, `chutes/zai-org/glm-4.7`

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
- **Telemetry Viewer** - Inspect OpenTelemetry spans and traces
- **Session Monitor** - Track active game sessions and agent states
- **Configuration Editor** - Modify runtime configuration
- **Agent Chat** - Interactive chat interface with agents

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
│   │   ├── agent-registry.ts      # Dynamic agent discovery
│   │   ├── session-registry.ts    # Global session tracking
│   │   └── context-registry.ts    # Global context tracking
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
│   │   ├── turn-summarizer.ts
│   │   ├── phase-summarizer.ts
│   │   ├── telepathist-parameters.ts
│   │   ├── telepathist-tool.ts   # Base tool class
│   │   ├── console.ts            # CLI entry point
│   │   └── tools/                # Database query tools
│   ├── web/                       # Web UI backend
│   │   ├── server.ts             # Express + Vue hosting
│   │   ├── sse-manager.ts        # Real-time streaming
│   │   └── routes/               # API endpoints
│   ├── utils/
│   │   ├── models/               # LLM integration
│   │   │   ├── models.ts
│   │   │   ├── mcp-client.ts
│   │   │   ├── concurrency.ts    # Per-model rate limiting
│   │   │   └── tool-rescue.ts    # JSON extraction middleware
│   │   ├── telemetry/            # Observability
│   │   │   ├── vox-exporter.ts
│   │   │   ├── sqlite-exporter.ts
│   │   │   └── schema.ts
│   │   ├── tools/                # Tool utilities
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
│   ├── src/                       # Frontend source
│   └── vite.config.ts
├── tests/                         # Vitest suite
├── configs/                       # Game configurations
└── package.json
```