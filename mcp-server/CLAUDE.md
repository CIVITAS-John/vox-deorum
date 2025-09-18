# CLAUDE.md - MCP Server Development Guide

This guide provides essential patterns and conventions for the MCP Server that aren't covered in the README.

## MCP Protocol Implementation

### Singleton Server Architecture
```typescript
export class MCPServer {
  private static instance: MCPServer;
  private servers: Map<string, McpServer> = new Map();

  public createServer(id: string): McpServer {
    // One singleton manages multiple McpServer instances
  }
}
```
**Pattern**: Singleton manages concurrent client connections while sharing tools/managers.

### Transport Support
The server supports both stdio and HTTP:
```typescript
switch (config.transport.type) {
  case 'stdio': await startStdioServer(); break;
  case 'http': await startHttpServer(); break;
}
```
**Always test with both transports** using `TEST_TRANSPORT` environment variable.

### Event Notifications
Use `elicitInput` for client notifications:
```typescript
rawServer.elicitInput({
  message: event,
  playerID: playerID,
  turn: turn,
  latestID: latestID,
  requestedSchema: { type: "object", properties: {} }
}, { timeout: 100 })
```

## Tool Development Patterns

### Tool Base Architecture
All tools inherit from `ToolBase`:
```typescript
export abstract class ToolBase {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly inputSchema: z.ZodObject<any>;
  abstract readonly outputSchema: z.ZodObject<any> | z.ZodTypeAny;
  abstract execute(args: z.infer<typeof this.inputSchema>): Promise<any>;
}
```
**Resources and tools are both defined as "ToolBase"** to share the same infrastructure.

### Factory Pattern with Lazy Loading
```typescript
const toolFactories = {
  calculator: createCalculatorTool,
  luaExecutor: createLuaExecutorTool,
};

export const getTools = (): Tools => {
  if (!toolsCache) {
    toolsCache = Object.fromEntries(
      Object.entries(toolFactories).map(([key, factory]) =>
        [key, factory()]
      )
    ) as Tools;
  }
  return toolsCache;
};
```
**Tools are instantiated lazily** on first server init, then shared across connections.

### Abstract Classes for Common Patterns

#### Database Query Tools
```typescript
export abstract class DatabaseQueryTool<TSummary, TFull> extends ToolBase {
  protected cachedSummaries: TSummary[] | null = null;
  protected abstract fetchSummaries(): Promise<TSummary[]>;
  protected abstract fetchFullInfo(identifier: string): Promise<TFull>;
}
```
**Pattern**: Cache summaries, fetch full details only when needed.

#### Lua Function Tools
```typescript
export abstract class LuaFunctionTool extends ToolBase {
  protected readonly script?: string;      // Inline script
  protected readonly scriptFile?: string;  // Or external file in lua/
}
```

### Zod Schema Validation
```typescript
readonly inputSchema = z.object({
  Search: z.string().optional()
    .describe("Fuzzy-matching search term"),
  MaxResults: z.number().optional().default(20)
});
```
**Always use `.describe()`** for MCP protocol documentation.

## Module System

### TypeScript & ESM
- Project uses ESM modules ("type": "module" in package.json)
- **Critical**: Always use `.js` extensions in imports, even for `.ts` files:
```typescript
import { ToolBase } from "../base.js";
import { gameDatabase } from "../../server.js";
```
- Follow strict TypeScript configuration for type safety

### Code Structure
- Source code in `src/` directory
- Utilities in `src/utils/` subdirectory
- Tools in `src/tools/` subdirectory
- Tests mirror source structure in `tests/` directory
- Built output goes to `dist/` directory (gitignored)

## Testing

### Framework
- **Use Vitest for all testing** (not Jest)
- Test files in `tests/` directory with `.test.ts` extension
- Commands:
  - `npm test` - Run tests
  - `npm run test:watch` - Watch mode
  - `npm run test:coverage` - Coverage report
- Test setup file: `tests/setup.ts` for global configuration

### Real MCP Client Integration
```typescript
let mcpClient: Client;

beforeAll(async () => {
  mcpClient = new Client({ name: "test-client", version: "1.0.0" });
  await mcpClient.connect(transport);
}, 15000);
```

### Transport-Agnostic Testing
```bash
TEST_TRANSPORT=stdio npm test    # Test via stdio
TEST_TRANSPORT=http npm test     # Test via HTTP (default)
```

### Tool Testing Pattern
- Use `calculator.ts` tool as template
- Use `calculator.test.ts` as test template
- **Always test through MCP client calls**, not direct method invocation:
```typescript
const result = await mcpClient.callTool({
  name: "calculator",
  arguments: { Expression: "2 + 3" }
});
```
- Tool/resource tests should use the mcpClient object exported by setup.ts

## Game State Management

### Multi-Level Caching
1. **Tool-Level**: Database tools cache summaries
2. **Manager-Level**: DatabaseManager caches connections and localization
3. **Knowledge Store**: SQLite databases per game in `data/{gameId}.db`

### Game Context Switching
```typescript
private async checkGameContext(): Promise<boolean> {
  const gameIdentity = await syncGameIdentity();
  if (gameIdentity?.gameId !== this.gameIdentity?.gameId) {
    await this.switchGameContext(gameIdentity);
    return true;
  }
}
```
**Each game gets its own SQLite database** with automatic migration.

### Knowledge Persistence
```typescript
export interface MutableKnowledge extends TimedKnowledge {
  Key: number;
  Version: number;
  IsLatest: number;
  Changes: JSONColumnType<string[]>;
}
```
**Pattern**: Version tracking with player visibility and change detection.

## Database Development

### SQLite Queries
- **Always use `is` and `is not`** for SQLite null checking (not `=` or `!=`)
- Before implementing a database-related tool, always check the schema
- When you need a database table that's commented, uncomment it

### Type Patterns with Kysely
```typescript
export interface Knowledge {
  ID: Generated<number>;  // Auto-managed fields
}

export interface PublicKnowledge extends Knowledge {
  Data: JSONColumnType<Record<string, unknown>>;  // Complex data
}
```

### Player Visibility
```typescript
export interface PlayerVisibility {
  Player0: Generated<number>;
  Player1: Generated<number>;
  // ... up to Player21
}
```

## Lua Script Development

### Script Organization
- Standalone Lua scripts must be placed in the `lua/` directory
- Follow existing patterns (e.g., `event-visibility.lua`, `game-identity.lua`)

### API Usage
**IMPORTANT**: Always check `civ5-dll/CvGameCoreDLL_Expansion2/Lua/` for existing Civ5 Lua APIs:
- Check wrapper classes: CvLuaGame, CvLuaPlayer, CvLuaUnit, CvLuaCity, etc.
- Use existing patterns like `LuaFunction` for callbacks
- **Never invent non-existent APIs**
- Scripts executed in-game have access to all Civ5's exposed Lua APIs

### Execution Context
Scripts are executed within the game context via BridgeManager

## Bridge Service Integration

### BridgeManager Usage
**Always use BridgeManager** (`src/bridge/manager.ts`) for all Bridge Service communication:
```typescript
import { bridgeManager } from '../server.js';
```
- **Do NOT use direct fetch/HTTP calls** to the Bridge Service
- BridgeManager provides methods for Lua script execution, function calls, and SSE handling
- Follow PROTOCOL.md specifications

### Queue-Based Request Management
```typescript
private async processBatch(): Promise<void> {
  const batch = this.luaCallQueue.splice(0,
    Math.min(50, this.luaCallQueue.length));

  if (this.luaCallQueue.length >= 50) {
    await this.pauseGame(); // Auto-pause on overflow
    this.queueOverflowing = true;
  }
}
```
**Performance**: Batch up to 50 Lua calls, auto-pause during overflow.

### Connection Pools
```typescript
constructor(baseUrl: string) {
  this.standardPool = new Pool(baseUrl, { connections: 50 });
  this.fastPool = new Pool(baseUrl, { connections: 5 });
}
```
**Use `fast: true`** for low-latency operations (pause/resume).

### SSE Event Processing
```typescript
this.sseConnection.onmessage = (event) => {
  const data = JSON.parse(event.data) as GameEvent;
  if (data.type == "dll_status") {
    this.isDllConnected = data.payload.connected;
    if (!this.dllConnected) this.resetFunctions();
  }
  this.emit('gameEvent', data);
};
```
- Handle connection failures and retry logic gracefully

## Build & Development

### Commands
- `npm run dev` - Development with hot reload using tsx
- `npm run build` - TypeScript compilation to dist/
- `npm run type-check` - TypeScript type checking without emit
- `npm run lint` - ESLint code quality checks

## Performance Considerations

### Lazy Loading
- Tools loaded on first init
- Database connections cached per session
- Localization results cached in memory
- Summary data cached at tool level

### Batch Processing
- Lua calls: Up to 50 per batch
- Knowledge storage: Batched writes
- Event processing: Async with queue management

### Auto-Pause Management
```typescript
if (this.luaCallQueue.length >= 50) {
  await this.pauseGame();
} else if (this.queueOverflowing) {
  await this.resumeGame();
}
```

### Memory Management
- Auto-save every 30 seconds
- HTTP connection pooling via undici
- Proper SQLite cleanup on shutdown

## Development Guidelines

### Creating New Tools
1. **Extend abstract base classes** (`DatabaseQueryTool`, `LuaFunctionTool`) not `ToolBase` directly
2. **Use factory functions** for proper caching
3. **Add to toolFactories** in `tools/index.ts`
4. **Use Zod schemas** for validation
5. **Implement MCP-compliant error handling**
6. **Cache appropriately** for performance
7. **Consider player visibility** for game data

### Adding New Fields to Knowledge Tables
When adding a new field to an existing knowledge table (e.g., PlayerSummary), follow these steps:

1. **Update TypeScript Schema** (`src/knowledge/schema/timed.ts` or appropriate schema file):
   - Add the field to the interface with proper type and documentation
   - Example: `Territory: number | null; // Number of plots owned (major civs only)`

2. **Update Lua Data Collection** (`lua/` directory):
   - Modify the corresponding Lua script to collect the new field
   - Example: In `get-player-summary.lua`, add `Territory = player:GetNumPlots()`

3. **Update Database Schema** (`src/knowledge/schema/setup.ts`):
   - Add the column to the table creation in `setupKnowledgeDatabase()`
   - Example: `.addColumn('Territory', 'integer')`
   - **Note: No migration needed** - Tables use `ifNotExists`, and data is ephemeral per game session

4. **Update Related Tools** (`src/tools/knowledge/` directory):
   - Add the field to any Zod schemas in tools that expose this data
   - Example: In `get-players.ts`, add `Territory: z.number().optional()` to PlayerDataSchema

5. **Test the Changes**:
   - Run `npm run type-check` to ensure TypeScript compilation
   - The changes will take effect when a new game session starts

### Common Pitfalls
1. **Forgetting `.js` extensions** in imports
2. **Direct HTTP calls** instead of using BridgeManager
3. **Not testing both transports**
4. **Ignoring player visibility** in knowledge storage
5. **Not batching operations** for multiple Lua calls
6. **Using `=` or `!=`** for SQLite null checks (use `is`/`is not`)

### MCP Protocol Compliance
- Always follow Model Context Protocol specifications
- Use the official @modelcontextprotocol/sdk package
- Implement proper resource and tool registration
- Handle errors gracefully with proper MCP error responses
- Support multiple transport methods (stdio, HTTP)

## Integration Points

### With Bridge Service
- Connect as SSE client to `/events`
- Use BridgeManager for all communication
- Handle connection loss gracefully

### With Vox Agents
- Agents connect via MCP protocol
- Tools exposed automatically on connection
- Event notifications via `elicitInput`

### Event System
Each event has typed schema:
```typescript
export const GameSaveSchema = z.object({
  GameName: z.string(),
  Turn: z.number(),
  Player: z.number()
});
```

Events undergo visibility analysis:
```typescript
const visibility = await analyzeEventVisibility(eventType, args);
// Results in PlayerVisibility flags
```