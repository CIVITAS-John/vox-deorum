# MCP Server

The MCP (Model Context Protocol) server exposes Civilization V game state and controls to AI agents. It provides a comprehensive toolkit for game analysis, decision-making, and automated gameplay through standardized MCP interfaces.

## What's Implemented

- **17 MCP Tools** across multiple categories with Zod validation
- **Real-time SSE Integration** - Automatic reconnection to Bridge Service for game events
- **Civ5 Database Access** - Kysely ORM with multi-language localization and TXT_KEY resolution
- **Knowledge Management** - Persistent state tracking with auto-save and player visibility filtering
- **Tool Framework** - Extensible base class with auto-registration and type-safe schemas
- **Bridge Integration** - Queue-based Lua execution with SSE event streaming
- **Multi-Transport Support** - Both stdio and HTTP transports for MCP clients

## Architecture

```
AI Agents ← MCP Protocol → MCP Server ← HTTP/SSE → Bridge Service
                                ↓
                        Database & Knowledge Store
                         (SQLite, Localization)
```

### Core Components

- **Server** (`server.ts`) - Singleton-based MCP server with session management
- **Tool Framework** (`base.ts`) - Abstract base class with auto-discovery
- **Bridge Manager** (`bridge/manager.ts`) - Queue-based Lua execution with SSE events
- **Database Manager** (`database/manager.ts`) - Multi-database access with caching
- **Knowledge Manager** (`knowledge/manager.ts`) - Persistent/transient state with auto-save
- **Localization Engine** (`database/localization.ts`) - TXT_KEY resolution across languages

## Available Tools

### General Tools
- `calculator` - Basic math operations
- `luaExecutor` - Execute Lua scripts in game

### Database Tools
- `getTechnology` - Get technology information
- `getPolicy` - Get policy details
- `getBuilding` - Get building specifications
- `getCivilization` - Get civilization traits
- `getUnit` - Get unit statistics

### Knowledge Tools
- `getEvents` - Retrieve game events
- `getPlayers` - Get player information
- `getOpinions` - Get diplomatic opinions
- `getCities` - Get city information
- `getMetadata` - Get session metadata
- `summarizeUnits` - Summarize unit positions

### Action Tools
- `setStrategy` - Set AI strategy
- `setMetadata` - Update session metadata
- `pauseGame` - Pause game execution
- `resumeGame` - Resume game execution

## Quick Start

```bash
npm install
npm run build
npm start         # Production mode

# Development
npm run dev       # Hot reload with tsx
npm test          # Run test suite
```

## Configuration

Edit `config.json`:
```json
{
  "server": {
    "name": "vox-deorum-mcp-server",
    "version": "1.0.0"
  },
  "bridgeService": {
    "endpoint": {
      "host": "127.0.0.1",
      "port": 5000
    }
  },
  "logging": {
    "level": "info"
  }
}
```

Note: Other settings are hardcoded in the implementation:
- Knowledge auto-save interval: 30 seconds
- Bridge retry delay: 5 seconds
- Database paths are auto-detected from standard Civ5 installation

## Tool Development

Create new tools by extending `ToolBase`:

```typescript
// src/tools/my-tool.ts
import { ToolBase } from "../base.js";
import * as z from "zod";

class MyTool extends ToolBase {
  readonly name = "my-tool";
  readonly description = "Tool description";
  readonly category = "general";

  readonly inputSchema = z.object({
    param: z.string().describe("Parameter description")
  });

  readonly outputSchema = z.object({
    result: z.string()
  });

  async execute(args: z.infer<typeof this.inputSchema>) {
    // Access managers via this.server
    const lua = await this.server.bridgeManager.executeLuaScript(
      `return Game.GetGameTurn()`
    );

    // Database queries
    const db = this.server.databaseManager.getDatabase();
    const units = await db.selectFrom('Units').selectAll().execute();

    // Knowledge storage
    await this.server.knowledgeManager.getKnowledgeStore()
      .setKnowledge('my-data', args, { persistent: true });

    return { result: "processed" };
  }
}

export default new MyTool();
```

Add to `src/tools/index.ts` for auto-registration.

## Key Implementation Details

### Bridge Integration
- Queue-based request management with batching
- Automatic SSE reconnection with 5s retry
- Event consolidation and deduplication
- Overflow protection with error propagation

### Database Features
- Multi-database support (Gameplay, Localization, Units)
- Automatic TXT_KEY resolution with fallbacks
- Language detection and switching
- Schema introspection with column metadata
- Connection pooling and caching

### Knowledge System
- Persistent storage with JSON serialization
- Player visibility filtering
- Context switching (persistent/transient)
- Automatic 30s interval saves
- Event-based knowledge updates

### Error Handling
- MCP-compliant error responses
- Graceful Bridge Service disconnection
- Database connection recovery
- Tool execution isolation

## Testing

```bash
npm test                  # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

Tests include:
- Real MCP client integration
- Transport-agnostic execution
- Tool schema validation
- Bridge mock responses
- Database query verification

## Development Tips

### Debugging
- Set `logging.level: "debug"` in config
- Monitor Bridge Service connection in logs
- Use test client for tool validation
- Check knowledge persistence in `.knowledge/`

### Performance
- Tools are loaded lazily on first use
- Database connections cached per session
- Localization results cached in memory
- Bridge requests batched with 10ms delay

### Common Issues

**Bridge Connection Failed**
- Ensure Bridge Service running on port 5000
- Check firewall settings
- Verify config.json endpoint

**Database Not Found**
- Check Civ5 installation path
- Verify database files exist
- Update rootPath in config

**Knowledge Not Persisting**
- Check `.knowledge/` directory permissions
- Verify auto-save interval
- Monitor save errors in logs

## Integration Points

### With Bridge Service
- Primary communication channel to game
- Lua script execution gateway
- Real-time event streaming
- Game pause/resume control

### With Vox Agents
- MCP client connects via stdio/HTTP
- Tool execution for game queries
- Knowledge storage for AI memory
- Event notifications for turn updates

### With Game Database
- Direct SQLite access to game rules
- Localization for all text content
- Unit/building/tech specifications
- Map and terrain data

## Project Structure

```
mcp-server/
├── src/
│   ├── server.ts        # Main MCP server
│   ├── base.ts          # Tool framework
│   ├── bridge/          # Bridge integration
│   ├── database/        # Database access
│   ├── knowledge/       # State management
│   ├── tools/           # Tool implementations
│   └── utils/           # Helpers
├── tests/               # Vitest suite
├── lua/                 # Standalone scripts
├── config.json          # Configuration
└── .knowledge/          # Persistent storage
```