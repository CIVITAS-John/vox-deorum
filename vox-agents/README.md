# Vox Agents

LLM-powered strategic AI agents for Civilization V. This module implements sophisticated game analysis and decision-making using modern AI models to play Civilization V autonomously.

## What's Implemented

- **Agent Framework** - Flexible base classes (`VoxAgent`/`VoxContext`) for building AI workflows
- **Simple Strategist** - Turn-based decision agent with comprehensive game analysis
- **MCP Client** - Robust HTTP/SSE client for MCP server communication
- **Tool Integration** - Dynamic tool wrapping and composition for game actions
- **Multi-LLM Support** - OpenAI, OpenRouter, and Google AI providers
- **Session Management** - Persistent session tracking for game continuity
- **Observability** - Langfuse tracing for monitoring agent behavior

## Architecture

```
LLM Providers ← Vox Agents → MCP Server → Bridge Service → Civ V
                    ↓
              Tool Middleware
              (Wrapping, Composition)
```

### Core Components

- **VoxAgent** (`infra/vox-agent.ts`) - Base class with step execution and tool integration
- **VoxContext** (`infra/vox-context.ts`) - Execution context with MCP client management
- **SimpleStrategist** (`strategist/simple-strategist.ts`) - Production-ready strategy agent
- **MCP Client** (`utils/models/mcp-client.ts`) - Event-driven MCP communication
- **Tool Wrapper** (`utils/tools/wrapper.ts`) - Dynamic tool adaptation for LLMs
- **Session Manager** (`strategist/strategist-session.ts`) - Game session tracking

## Quick Start

```bash
# Setup environment
cp .env.default .env
# Edit .env and add your API keys

npm install
npm run build
npm start         # Run strategist

# Development
npm run dev       # Hot reload
npm test          # Test suite
```

## Configuration

### Environment Variables
Copy `.env.default` to `.env` and configure your API keys:

```bash
# Required (at least one)
OPENAI_API_KEY=sk-...        # OpenAI API
ANTHROPIC_API_KEY=sk-ant-... # Anthropic API
OPENROUTER_API_KEY=sk-or-... # OpenRouter API
GOOGLE_GENERATIVE_AI_API_KEY=... # Google AI

# Optional
LANGFUSE_PUBLIC_KEY=...       # Telemetry
LANGFUSE_SECRET_KEY=...       # Telemetry
```

See `.env.default` for all available options and documentation.

### Strategist Configuration
The strategist can be configured via JSON files in the `configs/` directory. The default configuration is in `configs/default.json`, which is tracked in version control. Custom configuration files (gitignored) can override these defaults.

#### Configuration Files
1. **configs/observe-vanilla.json** - Observe an auto-play vanilla game with all data saved into a SQLite database
2. **configs/observe-simple.json** - Observe an auto-play game with Simple Strategist as Player 0 with all data saved into a SQLite database
3. **configs/interactive-simple.json** - Play an interactive game with Simple Strategist as Player 1 with all data saved into a SQLite database
4. **configs/[custom].json** - Custom configurations (gitignored)

Copy `configs/observe-vanilla.json` to create your own configuration:
```json
{
  "llmPlayers": [0],           // Array of player IDs to control with LLM
  "autoPlay": true,            // Whether to auto-resume after decisions
  "strategist": "simple-strategist", // Agent to use ("none-strategist", "simple-strategist", etc.)
  "gameMode": "start",         // Game mode ("start" for new game, "load" for saved game)
  "repetition": 10             // Number of games to play in sequence
}
```

#### Using Custom Configurations
```bash
# Use default configuration
npm run strategist

# Use specific configuration file
npm run strategist -- --config=myconfig.json
npm run strategist -- --config production.json

# Combine with other flags
npm run strategist -- --config=tournament.json --load
```

#### Command Line Flags
- `--config=<filename>`: Load configuration from `configs/<filename>` (default: `default.json`)
- `--load`: Override gameMode to "load" (loads saved game instead of starting new)

#### Configuration Priority
1. Command line flags (highest priority)
2. Specified config file
3. Default config file (lowest priority)

### Configuration Files
```typescript
// src/utils/models/models.ts
export const MODELS = {
  default: "claude-3-5-sonnet",  // Primary model
  vision: "gpt-4-vision",         // Screenshot analysis
  fast: "gpt-3.5-turbo"          // Quick decisions
};
```

## Usage Modes

### Standalone Mode
Autonomous agent that connects to MCP server and plays independently:

```bash
npm run strategist   # Start autonomous strategist
```

The agent will:
1. Connect to MCP server via HTTP
2. Subscribe to game events via SSE
3. Auto-pause on its turn
4. Analyze game state
5. Make strategic decisions
6. Resume game if crashes

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
npm test                  # All tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage
npm run test:integration  # With real Civ5
```

Test categories:
- Unit tests for core logic
- Integration tests with MCP
- Session management tests
- Tool wrapping validation

## Development Tips

### Debugging
- Enable debug logging: `DEBUG=vox:* npm run dev`
- Check Langfuse dashboard for traces
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
│   ├── infra/           # Core framework
│   │   ├── vox-agent.ts
│   │   └── vox-context.ts
│   ├── strategist/      # Strategy agents
│   │   └── simple-strategist.ts
│   ├── utils/           # Utilities
│   │   ├── models/      # LLM clients
│   │   └── tools/       # Tool wrappers
│   └── index.ts         # Entry points
├── tests/               # Vitest suite
└── package.json
```