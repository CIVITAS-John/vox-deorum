# MCP Server

Model Context Protocol server exposing Civilization V game state as resources and tools for AI agents.

## Purpose

Bridges AI agents to live Civ V gameplay through:
- **Tools**: Game state queries and actions with Zod validation
- **Events**: Real-time updates via SSE from Bridge Service
- **Database**: Direct game rules access with automatic localization
- **Knowledge**: Persistent and transient state tracking

## Quick Start

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Production
npm run build && npm start

# Run tests
npm test
```

## Configuration

Edit `config.json`:
```json
{
  "server": { "name": "vox-deorum-mcp-server" },
  "bridgeService": {
    "endpoint": { "host": "127.0.0.1", "port": 5000 }
  },
  "logging": { "level": "info" }
}
```

## Architecture

### Core Components
- **Server** (`src/server.ts`) - MCP server with stdio/HTTP transports
- **Bridge** (`src/bridge/`) - Lua execution and SSE event handling
- **Database** (`src/database/`) - Kysely ORM with TXT_KEY localization
- **Knowledge** (`src/knowledge/`) - Persistent state with auto-save
- **Tools** (`src/tools/`) - ToolBase framework with auto-registration

### Communication Flow
```
Vox Agents ←→ MCP Server ←→ Bridge Service ←→ Civilization V
    (MCP)        (HTTP/SSE)      (Named Pipe)
```

## Development

### Creating Tools

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
    // Use database, bridge, or knowledge managers
    return { result: "output" };
  }
}

export default new MyTool();
```

Add to `src/tools/index.ts` for auto-registration.

### Key APIs

```typescript
// Database queries with localization
import { gameDatabase } from '../server.js';
const db = gameDatabase.getDatabase();
const techs = await db.selectFrom('Technologies')
  .select(['Type', 'Description'])
  .execute();
const localized = await gameDatabase.localizeObject(techs);

// Bridge Service communication
import { bridgeManager } from '../server.js';
const gold = await bridgeManager.executeLuaScript(
  `return Players[0]:GetGold()`
);

// Knowledge management
import { knowledgeManager } from '../server.js';
await knowledgeManager.getKnowledgeStore().setKnowledge(
  'diplomacy', data, { persistent: true }
);
```

### Testing

```bash
npm test             # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

Tests use Vitest with MCP client from `tests/setup.ts`.

## Project Structure

```
mcp-server/
├── src/
│   ├── server.ts           # Main server
│   ├── base.ts            # ToolBase abstract class
│   ├── bridge/            # Bridge Service integration
│   ├── database/          # Game database access
│   ├── knowledge/         # State management
│   ├── tools/             # Tool implementations
│   └── utils/             # Utilities
├── tests/                 # Vitest tests
├── config.json           # Configuration
└── package.json
```

## Notes

- Requires Bridge Service running
- Game databases must be in Documents folder
- SSE auto-reconnects with 5-second retry
- Knowledge auto-saves every 30 seconds
- Tools auto-register from exports