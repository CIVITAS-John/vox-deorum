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
     - Optional annotations for tool hints
   - **Implemented Tools**:
     - **General Tools**:
       - **Calculator** (`general/calculator.ts`): Mathematical expression evaluation using mathjs
       - **LuaExecutor** (`general/lua-executor.ts`): Execute arbitrary Lua scripts in game context
     - **Database Query Tools**:
       - **GetTechnology** (`databases/get-technology.ts`): Query technology information with fuzzy search
       - **GetPolicy** (`databases/get-policy.ts`): Query social policy information from game database
       - **GetBuilding** (`databases/get-building.ts`): Query building information including wonders
     - **Knowledge Tools**:
       - **GetEvents** (`knowledge/get-events.ts`): Retrieve game events from knowledge store
   - **Abstract Base Classes**:
     - **LuaFunction** (`abstract/lua-function.ts`): Base for Lua-based tool implementations
     - **DatabaseQuery** (`abstract/database-query.ts`): Base for database query tools with common search patterns
   - Self-registration pattern with automatic discovery via `src/tools/index.ts`

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
  - Simplifies implementation and maintenance
  - Consistent validation and error handling
  - Resources are simply read-only tools
- **Flexible Transport**: Support both stdio and HTTP/SSE transports
  - stdio for CLI/desktop MCP clients
  - HTTP for web-based clients with CORS support
- **Event-Driven**: Real-time game events via SSE stream
  - Automatic reconnection on disconnection
  - Event-based knowledge updates
- **Type-Safe**: Zod validation for tools, Kysely types for database
  - Runtime validation of all inputs/outputs
  - Compile-time type checking for database queries
- **Singleton Pattern**: Single instances of Server, Bridge, and Database managers
  - Ensures consistent state across modules
  - Simplifies dependency injection
- **Idempotent Operations**: Safe retry logic for all operations
  - Bridge Service calls can be safely retried
  - Database queries are read-only
- **Modular Design**: Clear separation of concerns across modules
  - Each module has a single responsibility
  - Easy to extend and maintain

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
- `LOG_LEVEL`: Override logging level (debug, info, warn, error)
- Additional environment variables can override config.json settings

### Running the Server

#### Development Mode (with hot reload)
```bash
npm run dev
```

#### Production Mode
```bash
npm start  # Builds and runs the server
```

#### Stdio Mode (for MCP CLI clients)
```bash
# Default mode - server communicates via stdin/stdout
node dist/index.js
```

#### HTTP Mode (for web clients)
```bash
# Set transport mode to HTTP in config or environment
# Server will start on configured port (default: 3000)
node dist/index.js
```

#### With MCP Inspector
```bash
npm run inspect
```

#### Additional Commands
```bash
# Type checking without compilation
npm run type-check

# Linting
npm run lint

# Clean build artifacts
npm run clean

# Generate database types (after database schema changes)
npm run codegen
```

## Development Guide

### Creating New Tools

1. Create a new file in `src/tools/general/` or appropriate subdirectory
2. Extend the `ToolBase` class
3. Define input and output schemas using Zod
4. Implement the `execute` method
5. Optionally define annotations for tool hints
6. Export a singleton instance
7. Add to `src/tools/index.ts` for auto-registration

Example tool implementation:

```typescript
import { ToolBase } from "../base.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types";
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
  
  // Optional: Define tool annotations
  readonly annotations: ToolAnnotations = {
    audience: ["user", "assistant"],  // Custom property for access control
    autoComplete: ["param"]           // Custom property for UI hints
  };
  
  async execute(args: z.infer<typeof this.inputSchema>) {
    // Tool implementation
    return { result: "output" };
  }
}

export default new MyTool();
```

#### Tool Annotation Schema

Tool annotations provide hints to MCP clients about tool behavior and capabilities. The `ToolAnnotations` interface supports both standard MCP properties and custom extensions:

**Standard MCP Properties** (from MCP specification):
- `readOnlyHint?: boolean` - If true, tool doesn't modify its environment (default: false)
- `destructiveHint?: boolean` - If true, tool may perform destructive updates (default: true, meaningful only when readOnlyHint=false)
- `idempotentHint?: boolean` - If true, repeated calls with same arguments have no additional effect

**Custom Properties** (Vox Deorum extensions):
- `audience?: string[]` - Specifies which agents/roles can access this tool
  - `"user"` - Tool available to human users
  - `"assistant"` - Tool available to AI assistants
  - `"strategist"` - Tool available to strategy agents
  - `"briefer"` - Tool available to briefing agents
- `autoComplete?: string[]` - Lists parameter names that should be autocompleted by the tool caller and hidden from the LLM agent, usually as contexts (e.g. PlayerID)

### Testing

Tests are written using Vitest and located in the `tests/` directory:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run stdio transport tests specifically
npm run test:stdio
```

**Test Structure**:
- Test files use `.test.ts` extension
- Tests mirror source structure in `tests/` directory
- Global setup in `tests/setup.ts` provides MCP client instance
- Tests focus on MCP protocol compliance and tool functionality

**Writing Tests**:
```typescript
import { describe, it, expect } from 'vitest';
import { mcpClient } from '../setup.js';

describe('MyTool', () => {
  it('should execute successfully', async () => {
    const result = await mcpClient.callTool({
      name: 'my-tool',
      arguments: { param: 'value' }
    });
    
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('expected');
  });
});
```

**Test Coverage**:
- Unit tests for individual tools
- Integration tests for Bridge Service communication
- Database query tests with mock data
- MCP protocol compliance tests

### Database Access

The server provides type-safe database access through Kysely with automatic localization:

```typescript
import { gameDatabase } from '../server.js';

// Get database instance
const db = gameDatabase.getDatabase();

// Query with type safety
const technologies = await db
  .selectFrom('Technologies')
  .select(['Type', 'Description', 'Cost', 'Era'])
  .where('Era', '=', 'ERA_ANCIENT')
  .execute();

// Automatic localization of TXT_KEY_* strings
const localized = await gameDatabase.localizeObject(technologies);
// Result: Description field changes from "TXT_KEY_TECH_AGRICULTURE_DESC" to actual text

// Query with joins
const buildings = await db
  .selectFrom('Buildings')
  .leftJoin('Technologies', 'Buildings.PrereqTech', 'Technologies.Type')
  .select([
    'Buildings.Type',
    'Buildings.Description',
    'Buildings.Cost',
    'Technologies.Description as TechDescription'
  ])
  .where('Buildings.IsWorldWonder', '=', 1)
  .execute();
```

### Bridge Service Communication

Always use the BridgeManager singleton for Bridge Service interactions:

```typescript
import { bridgeManager } from '../server.js';

// Execute Lua script with proper error handling
try {
  const result = await bridgeManager.executeLuaScript(`
    local player = Players[Game.GetActivePlayer()]
    return {
      name = player:GetName(),
      civ = player:GetCivilizationType(),
      gold = player:GetGold()
    }
  `);
  console.log('Player info:', result);
} catch (error) {
  console.error('Lua execution failed:', error);
}

// Call predefined Lua function
const unitInfo = await bridgeManager.callLuaFunction(
  'GetUnitInfo', 
  [unitId]
);

// Listen for game events via SSE
bridgeManager.on('gameEvent', (event) => {
  console.log('Game event:', event.type, event.payload);
});

// Check Bridge Service health
const health = await bridgeManager.checkHealth();
console.log('Bridge status:', health.bridge, 'DLL status:', health.dll);

// SSE connection status
bridgeManager.on('connected', () => {
  console.log('Connected to Bridge Service event stream');
});

bridgeManager.on('disconnected', () => {
  console.log('Disconnected from Bridge Service');
});
```

### Knowledge Management

The KnowledgeManager handles persistent game state with automatic context switching:

```typescript
import { knowledgeManager } from '../server.js';

// Access current game context store
const store = knowledgeManager.getKnowledgeStore();
if (!store) {
  console.log('No active game context');
  return;
}

// Store persistent knowledge
await store.setKnowledge('diplomacy_status', {
  allies: ['Rome', 'Greece'],
  enemies: ['Babylon'],
  neutral: ['Egypt']
}, {
  persistent: true,
  category: 'game_state'
});

// Store transient knowledge (not saved to disk)
await store.setKnowledge('temp_calculation', result, {
  persistent: false,
  category: 'temp'
});

// Retrieve knowledge
const diplomacy = await store.getKnowledge('diplomacy_status');

// Query knowledge by category
const allGameState = await store.getKnowledgeByCategory('game_state');

// Knowledge is automatically saved every 30 seconds
// and on game context changes

// Listen for game context changes
knowledgeManager.on('contextChanged', (newContext) => {
  console.log('Switched to game:', newContext.saveGameId);
});
```

### Debug Mode

Enable debug logging for troubleshooting:

```bash
# Set via environment variable
LOG_LEVEL=debug npm run dev

# Or modify config.json
{
  "logging": {
    "level": "debug"
  }
}
```

**Debug Output Includes**:
- Detailed Bridge Service communication logs
- Database query execution details
- Tool execution traces
- SSE event stream messages
- Knowledge store operations
- MCP protocol messages (when using stdio transport)

## Error Handling

The server implements comprehensive error handling:

### Tool Errors
- Tools automatically catch and wrap errors in MCP-compliant error responses
- Input validation errors return detailed schema violation messages
- Execution errors include context and stack traces in debug mode

### Bridge Service Errors
- Automatic reconnection on SSE stream disconnection (5-second delay)
- Graceful degradation when Bridge Service is unavailable
- Health check endpoints for monitoring

### Database Errors
- Readonly access prevents accidental modifications
- Missing database files handled with clear error messages
- Localization failures fall back to TXT_KEY_* strings

## Best Practices

### Tool Development
1. **Use Abstract Base Classes**: Extend `DatabaseQueryTool` or `LuaFunction` when appropriate
2. **Validate Inputs**: Define strict Zod schemas for input validation
3. **Document Outputs**: Provide clear output schemas with descriptions
4. **Add Annotations**: Use tool annotations to guide client behavior
5. **Handle Errors**: Let ToolBase handle errors, focus on business logic

### Database Queries
1. **Use Type-Safe Queries**: Leverage Kysely's type system
2. **Localize Results**: Always call `localizeObject()` for user-facing text
3. **Optimize Queries**: Use selective column selection and proper joins
4. **Cache When Appropriate**: Database content is static during gameplay

### Bridge Communication
1. **Use BridgeManager**: Never make direct HTTP calls to Bridge Service
2. **Handle Disconnections**: Listen for connection events
3. **Validate Lua Scripts**: Sanitize and validate Lua code before execution
4. **Use Lua Functions**: Prefer predefined functions over arbitrary scripts

### Knowledge Management
1. **Categorize Knowledge**: Use meaningful categories for organization
2. **Choose Persistence**: Decide between persistent and transient storage
3. **Handle Context Switches**: React to game context changes
4. **Avoid Large Objects**: Keep knowledge entries reasonably sized

## Troubleshooting

### Common Issues

**Server won't start**:
- Check Bridge Service is running on configured port
- Verify database files exist in Civ 5 cache directory
- Ensure Node.js version >= 20.0.0

**Tools not appearing**:
- Verify tool is exported in `src/tools/index.ts`
- Check tool extends ToolBase properly
- Review server startup logs for registration errors

**Database queries fail**:
- Confirm Civ 5 is installed with Community Patch
- Check database path in Windows Documents folder
- Verify localization database exists

**SSE connection drops**:
- Check Bridge Service health endpoint
- Review firewall/antivirus settings
- Monitor network stability

**Knowledge not persisting**:
- Verify write permissions in knowledge directory
- Check disk space availability
- Review auto-save logs

## Contributing

1. Follow the existing code structure and patterns
2. Add tests for new functionality
3. Update this README for significant changes
4. Use conventional commits for clear history
5. Ensure all tests pass before submitting PRs
6. Document new tools with proper annotations
7. Add error handling for edge cases
8. Include debug logging for troubleshooting