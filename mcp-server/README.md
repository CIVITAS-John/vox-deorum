# MCP Server

A Model Context Protocol (MCP) server that exposes Civilization V game state as structured resources and tools for AI agents. Each server serves a single game session and connects with a single bridge service/MCP client. 

## Overview

The MCP Server connects AI agents to live Civilization V game data through a standardized protocol:
- **Tools**: Both game state queries and action capabilities (unified as ToolBase)
- **Events**: Real-time game updates from Bridge Service via SSE
- **Database Access**: Direct access to Civ 5 game rules and localized text
- **Bridge Integration**: Lua script execution and function calls
- **Knowledge Management**: Persistent and transient game state tracking

## Technology Stack

- **Runtime**: Node.js >=20.0.0 + TypeScript (ESM modules)
- **Protocol**: Model Context Protocol (MCP) via official TypeScript SDK
- **SDK**: @modelcontextprotocol/sdk
- **Testing**: Vitest with coverage reporting
- **Transport**: stdio (direct), HTTP with SSE (Express server)
- **Bridge Communication**: REST API client + SSE event stream
- **Database**: Better-SQLite3 + Kysely ORM for Civ 5 databases
- **Logging**: Winston with module contexts
- **Validation**: Zod for schema validation
- **Search**: Fast-fuzzy for intelligent text matching

## Architecture

### Core Components

1. **MCP Server Core** (`src/server.ts`)
   - MCPServer singleton managing server lifecycle
   - Tool registration and discovery system
   - Integration with BridgeManager, DatabaseManager, and KnowledgeManager
   - Multi-transport support (stdio/HTTP)
   - Automatic tool registration on startup

2. **Transport Layer**
   - **Stdio Transport** (`src/stdio.ts`): Direct client connections for CLI usage
   - **HTTP Transport** (`src/http.ts`): Express server with CORS and Streamable HTTP support
   - Config-based transport selection via entry point
   - Graceful shutdown handling

3. **Bridge Service Integration** (`src/bridge/`)
   - **BridgeManager** (`manager.ts`): Central communication hub
     - Health checking for Bridge Service and DLL status
     - Lua script execution with proper sanitization
     - Lua function calls with parameter passing
     - SSE connection with automatic reconnection
     - Event emitter pattern for game events
   - **LuaFunction** (`lua-function.ts`): Encapsulated Lua function definitions
     - Type-safe function signatures
     - Parameter validation and serialization

4. **Database Integration** (`src/database/`)
   - **DatabaseManager** (`manager.ts`): Kysely-based database access
     - Readonly connections to Civ 5 SQLite databases
     - Automatic localization of TXT_KEY_* strings
     - Batch localization for query results
     - Type-safe queries with generated types
     - Support for main game database and localization database
   - **Enum Mappings**: Auto-generated enums from game constants
   - **Schema Types**: Generated TypeScript types from database schema

5. **Knowledge System** (`src/knowledge/`)
   - **KnowledgeManager** (`manager.ts`): Central knowledge orchestrator
     - Game context detection and switching
     - Auto-save functionality (30-second intervals)
     - Event-driven knowledge updates
     - Game identity tracking (save game ID, player ID)
   - **KnowledgeStore** (`store.ts`): Persistent storage layer
     - SQLite-based knowledge persistence
     - Event sourcing for game state changes
     - Schema-based data validation
     - Transient and permanent knowledge separation

6. **Tool System** (`src/tools/`)
   - **ToolBase** (`base.ts`): Abstract base class with Zod validation
     - Standardized input/output schemas
     - MCP protocol compliance
     - Error handling and logging
   - **Implemented Tools**:
     - **Calculator** (`general/calculator.ts`): Example arithmetic operations
     - **LuaExecutor** (`general/lua-executor.ts`): Execute arbitrary Lua scripts
     - **GetTechnology** (`general/get-technology.ts`): Query technology information with fuzzy search
   - **Abstract Tools**:
     - **LuaFunction** (`abstract/lua-function.ts`): Base for Lua-based tools
   - Self-registration pattern with automatic discovery

7. **Utilities** (`src/utils/`)
   - **Config** (`config.js`): Centralized configuration management
   - **Logger** (`logger.js`): Module-scoped logging with Winston
   - **MCP Helpers** (`mcp.js`): Protocol helpers and result wrapping
   - **Lua Utilities** (`lua/`): Game-specific Lua helpers
     - Game identity synchronization
     - Player information retrieval
     - Unit and city queries

### Design Principles
- **Unified Tool Architecture**: Resources and tools share the same ToolBase infrastructure
- **Flexible Transport**: Support both stdio and HTTP/SSE transports
- **Event-Driven**: Real-time game events via SSE stream
- **Type-Safe**: Zod validation for tools, Kysely types for database
- **Singleton Pattern**: Single instances of Server, Bridge, and Database managers
- **Idempotent Operations**: Safe retry logic for all operations
- **Modular Design**: Clear separation of concerns across modules

## Communication Flow

### High-Level Flow
```
MCP Client ←→ MCP Server ←→ Bridge Service ←→ Civilization V
       (Streamable HTTP/stdio)        (HTTP/SSE)
```

### Detailed Communication Patterns

#### 1. Tool Execution (MCP Client → Game Action)
```
1. MCP Client → tools/call → MCP Server
2. MCP Server validates input with Zod schema
3. Tool implementation executes:
   - Direct database queries via DatabaseManager
   - Lua execution via BridgeManager.executeLuaScript()
   - Function calls via BridgeManager.callLuaFunction()
4. Tool result with localized text → MCP Client
```

#### 2. Game Events (Game → MCP Server)
```
1. Game event → DLL → Bridge Service
2. Bridge Service → SSE stream → MCP Server
3. BridgeManager emits 'gameEvent' with payload
4. Event handlers process and update state
5. MCP Server → notification → MCP Client (if configured)
```

#### 3. Database Access Pattern
```
1. Tool requests game data
2. DatabaseManager.getDatabase() returns Kysely instance
3. Type-safe query built with Kysely query builder
4. Results fetched from Civ5DebugDatabase.db
5. DatabaseManager.localizeObject() translates TXT_KEY_* strings
6. Localized results returned to tool
```

#### 4. SSE Connection Management
```
1. Server startup → BridgeManager.connectToEventStream()
2. SSE connection established to Bridge Service /events
3. Automatic reconnection on disconnect (5-second delay)
4. Events parsed and emitted via EventEmitter
5. Connection status tracked ('connected'/'disconnected' events)
```

## Getting Started

### Prerequisites
1. Node.js >=20.0.0
2. Civilization V with Community Patch installed
3. Bridge Service running (see `../bridge-service/`)
4. Game databases in Documents folder (`My Games/Sid Meier's Civilization 5/cache/`)

### Installation
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Development mode with hot reload
npm run dev

# Run tests
npm test

# Test with coverage
npm run test:coverage

# Type checking
npm run type-check

# Linting
npm run lint

# Clean build artifacts
npm run clean
```

### Configuration

The server uses a configuration file at `config.json`:

```json
{
  "server": {
    "name": "vox-deorum-mcp-server",
    "version": "1.0.0"
  },
  "bridgeService": {
    "endpoint": {
      "host": "localhost",
      "port": 8080
    }
  },
  "logging": {
    "level": "info"  // debug, info, warn, error
  }
}
```

Environment variables:
- `TEST_TRANSPORT`: Set to 'stdio' for stdio transport tests
- `NODE_ENV`: Set to 'production' for production builds
- `LOG_LEVEL`: Override logging level

### Running the Server

#### Stdio Mode (for MCP CLI clients)
```bash
npm start
```

#### HTTP Mode (for web clients)
```bash
# Set transport mode to HTTP in config or environment
npm start
```

#### With MCP Inspector
```bash
npm run inspect
```

## Development Guide

### Creating New Tools

1. Create a new file in `src/tools/general/` or appropriate subdirectory
2. Extend the `ToolBase` class
3. Define input and output schemas using Zod
4. Implement the `execute` method
5. Export a singleton instance
6. Add to `src/tools/index.ts` for auto-registration

Example tool implementation:

```typescript
import { ToolBase } from "../base.js";
import * as z from "zod";

class MyTool extends ToolBase {
  readonly name = "my-tool";
  readonly description = "Description of what the tool does";
  
  readonly inputSchema = z.object({
    param: z.string().describe("Parameter description")
  });
  
  readonly outputSchema = z.object({
    result: z.string()
  });
  
  async execute(args: z.infer<typeof this.inputSchema>) {
    // Tool implementation
    return { result: "output" };
  }
}

export default new MyTool();
```

### Testing

Tests are written using Vitest and located in the `tests/` directory:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run stdio transport tests
npm run test:stdio
```

Test files should:
- Use `.test.ts` extension
- Mirror source structure in `tests/` directory
- Use the MCP client from `tests/setup.ts`
- Focus on MCP protocol compliance

### Database Access

The server provides type-safe database access through Kysely:

```typescript
import { gameDatabase } from '../server.js';

// Get database instance
const db = gameDatabase.getDatabase();

// Query with type safety
const technologies = await db
  .selectFrom('Technologies')
  .selectAll()
  .execute();

// Automatic localization
const localized = await gameDatabase.localizeObject(technologies);
```

### Bridge Service Communication

Always use the BridgeManager singleton:

```typescript
import { bridgeManager } from '../server.js';

// Execute Lua script
const result = await bridgeManager.executeLuaScript(`
  return Game.GetActivePlayer()
`);

// Call Lua function
const unitInfo = await bridgeManager.callLuaFunction(
  'GetUnitInfo', 
  [unitId]
);

// Listen for game events
bridgeManager.on('gameEvent', (event) => {
  console.log('Game event:', event);
});
```

### Knowledge Management

The KnowledgeManager handles persistent game state:

```typescript
import { knowledgeManager } from '../server.js';

// Access current game context
const store = knowledgeManager.getKnowledgeStore();

// Store knowledge
await store?.setKnowledge('key', value, {
  persistent: true,
  category: 'game_state'
});

// Retrieve knowledge
const data = await store?.getKnowledge('key');
```

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm run dev
```

## Contributing

1. Follow the existing code structure and patterns
2. Add tests for new functionality
3. Update this README for significant changes
4. Use conventional commits for clear history
5. Ensure all tests pass before submitting PRs