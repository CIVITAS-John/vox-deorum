# MCP Server

A Model Context Protocol (MCP) server that exposes Civilization V game state as structured resources and tools for AI agents. Each server serves a single game session and connects with a single bridge service/MCP client. 

## Overview

Connects AI agents to live Civilization V game data through:
- **Tools**: Game state queries and actions (unified ToolBase architecture)
- **Events**: Real-time updates via SSE from Bridge Service
- **Database**: Direct Civ 5 game rules with automatic localization
- **Bridge**: Lua script execution and function calls
- **Knowledge**: Persistent and transient game state tracking

**Stack**: Node.js 20+, TypeScript ESM, MCP SDK, Vitest, Kysely ORM, Zod validation

## Architecture

### Core Components

1. **Server Core** (`src/server.ts`) - Lifecycle, tool registration, multi-transport
2. **Transport** - Stdio and HTTP/SSE transports  
3. **Bridge** (`src/bridge/`) - BridgeManager for Lua execution and SSE events
4. **Database** (`src/database/`) - Kysely ORM with TXT_KEY localization
5. **Knowledge** (`src/knowledge/`) - Persistent state with 30-second auto-save
6. **Tools** (`src/tools/`) - ToolBase framework with Zod validation, auto-registration
7. **Utils** (`src/utils/`) - Config, logging, MCP helpers, Lua utilities

### Design Principles

- **Unified Architecture**: Resources and tools share ToolBase
- **Type-Safe**: Zod validation, Kysely typed queries
- **Event-Driven**: Real-time SSE with auto-reconnection
- **Singleton Pattern**: Consistent state management
- **Idempotent**: Safe retry logic
- **Modular**: Clear separation of concerns

## Communication Flow

```
Vox Agents ←→ MCP Server ←→ Bridge Service ←→ Civilization V
     (stdio/HTTP)           (HTTP/SSE)
```

**Tool Execution**: Client → MCP validates → executes (DB/Lua) → returns localized result

**Game Events**: Game → DLL → Bridge → SSE → MCP → Client notifications

**Database**: Tool → Kysely query → SQLite → auto-localization → response

**SSE**: Auto-reconnecting event stream with 5-second retry delay

## Getting Started

### Prerequisites
1. Node.js >=20.0.0
2. Civilization V with Community Patch installed
3. Bridge Service running (see `../bridge-service/`)
4. Game databases in Documents folder (`My Games/Sid Meier's Civilization 5/cache/`)

### Quick Start

```bash
npm install          # Install dependencies
npm run dev          # Development mode
npm start            # Production mode
npm test             # Run tests
```

### Configuration

Edit `config.json` for server settings:
```json
{
  "server": { "name": "vox-deorum-mcp-server" },
  "bridgeService": { "endpoint": { "host": "localhost", "port": 8080 } },
  "logging": { "level": "info" }
}
```

Key environment variables:
- `LOG_LEVEL`: debug, info, warn, error
- `NODE_ENV`: production for prod builds
- `TEST_TRANSPORT`: stdio for transport tests

## Development Guide

### Creating New Tools

```typescript
// src/tools/my-tool.ts
import { ToolBase } from "../base.js";
import * as z from "zod";

class MyTool extends ToolBase {
  readonly name = "my-tool";
  readonly description = "Tool description";
  
  readonly inputSchema = z.object({
    param: z.string()
  });
  
  readonly outputSchema = z.object({
    result: z.string()
  });
  
  async execute(args: z.infer<typeof this.inputSchema>) {
    return { result: "output" };
  }
}

export default new MyTool();
```

Add to `src/tools/index.ts` for auto-registration.

### Testing

```bash
npm test             # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

Tests use Vitest with MCP client from `tests/setup.ts`.

### Key APIs

```typescript
// Database queries with auto-localization
import { gameDatabase } from '../server.js';
const db = gameDatabase.getDatabase();
const techs = await db.selectFrom('Technologies')
  .select(['Type', 'Description', 'Cost'])
  .where('Era', '=', 'ERA_ANCIENT')
  .execute();
const localized = await gameDatabase.localizeObject(techs);

// Bridge Service communication
import { bridgeManager } from '../server.js';
const gold = await bridgeManager.executeLuaScript(
  `return Players[Game.GetActivePlayer()]:GetGold()`
);
bridgeManager.on('gameEvent', (event) => console.log(event));
```

### Knowledge Management

```typescript
import { knowledgeManager } from '../server.js';

const store = knowledgeManager.getKnowledgeStore();

// Store persistent knowledge
await store.setKnowledge('diplomacy', data, {
  persistent: true,
  category: 'game_state'
});

// Store transient knowledge
await store.setKnowledge('temp', data, {
  persistent: false,
  category: 'temp'
});

// Auto-saves every 30 seconds and on context changes
knowledgeManager.on('contextChanged', (ctx) => {
  console.log('Game switched:', ctx.saveGameId);
});
```

## Best Practices

### Tools
- Extend abstract base classes when available
- Use strict Zod schemas for validation
- Let ToolBase handle errors
- Add annotations for client hints

### Database
- Use Kysely's type-safe queries
- Always localize TXT_KEY_* strings
- Cache static content when appropriate

### Bridge Service
- Always use BridgeManager singleton
- Handle SSE disconnections gracefully
- Prefer Lua functions over raw scripts

### Knowledge
- Use meaningful categories
- Choose appropriate persistence level
- Keep entries reasonably sized

## Troubleshooting

**Server won't start**: Check Bridge Service is running, verify database files exist, ensure Node.js >= 20.0.0

**Tools not appearing**: Verify export in `src/tools/index.ts`, check server logs

**Database errors**: Confirm Civ 5 with Community Patch installed, check cache directory

**SSE drops**: Check Bridge Service health, review firewall settings

**Knowledge issues**: Verify write permissions, check disk space

## Contributing

- Follow existing patterns and code structure
- Add tests for new functionality
- Use conventional commits
- Document tools with annotations
- Include error handling and debug logging