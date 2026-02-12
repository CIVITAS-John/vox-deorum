# Development Guide

Guide for developing and debugging the MCP Server.

## Quick Start

```bash
cd mcp-server
npm install          # Or from root: npm install (workspace)
npm run dev          # Development with hot reload (tsx)
npm test             # Run tests
npm run build        # Compile TypeScript
npm start            # Build + run production
```

## Testing

### Running Tests

```bash
npm test                 # All tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage
npx vitest run <file>    # Specific test
```

### Test Structure

- **Framework**: Vitest (not Jest)
- **Location**: `tests/**/*.test.ts`
- **Setup**: `tests/setup.ts` for per-file config, `tests/global.setup.ts` for global lifecycle
- **Sequential execution**: `singleFork: true` (mock DLL hosts one connection at a time)
- **Extended timeout**: 15 seconds for IPC operations

### Transport-Agnostic Testing

Tests should pass with both stdio and HTTP transports:

```bash
npm test                              # Default: HTTP transport
npm run test:stdio                    # Stdio transport
cross-env TEST_TRANSPORT=stdio npm test  # Manual override
```

### Tool Testing Pattern

Use `tests/tools/general/calculator.test.ts` as a template for new tool tests.

- Always test through MCP client calls, not direct method invocation
- Use `mcpClient` from `tests/setup.ts`
- Test input validation, error handling, and expected outputs
- Verify both successful operations and error cases

## Debugging

### Enable Debug Logs

Set `logging.level` to `"debug"` in `config.json`.

### Key Diagnostics

- Monitor Bridge Service connection in logs (SSE reconnection, queue state)
- Knowledge databases in `data/{gameId}.db` -- inspect with any SQLite browser
- Winston logger only (never `console.log` in production code)

### Node.js Inspector

```bash
node --inspect=7000 dist/index.js
# Open chrome://inspect
```

### MCP Inspector

```bash
npm run inspect   # Launch @modelcontextprotocol/inspector
```

## Adding New Tools

### Step 1: Choose Base Class

| Base Class | Use When | Key Methods |
|---|---|---|
| `DatabaseQueryTool` | Querying Civ5 game database (techs, policies, etc.) | `fetchSummaries()`, `fetchFullInfo()` |
| `LuaFunctionTool` | Executing Lua scripts in the game | Inline scripts or `.lua` files in `lua/` |
| `DynamicEventTool` | Creating custom game events | Event schema + trigger logic |
| `ToolBase` | Nothing else fits | `execute()` directly |

Prefer abstract classes over extending `ToolBase` directly.

### Step 2: Create Tool File

Place in the appropriate subdirectory: `tools/general/`, `tools/databases/`, `tools/knowledge/`, or `tools/actions/`.

- Use factory function pattern (export default function returning `ToolBase` instance)
- Define Zod input/output schemas with `.describe()` on every field
- Implement `execute()` method

### Step 3: Register Tool

Add import and entry in `src/tools/index.ts` `toolFactories` object.

### Step 4: Test

Create test file in `tests/tools/`, following `calculator.test.ts` pattern.

## Adding Knowledge Fields

When adding a new field to an existing knowledge table (e.g., PlayerSummary):

1. Update TypeScript interface in `schema/timed.ts` (add field with proper type and JSDoc)
2. Update Lua data collection script in `lua/` directory
3. Update database schema in `schema/setup.ts` (add column -- no migration needed, data is ephemeral)
4. Update related tool Zod schemas in tools that expose the data
5. Run `npm run type-check` to verify

## Adding New Events

1. Create Zod schema file in `src/knowledge/schema/events/`
2. Export the schema with PascalCase name matching event name
3. Add event to `docs/strategies/event-categories.json` with category tags
4. Document event in `docs/events/md/` following existing format (Overview, Event Triggers, Parameters, Event Details, Technical Details)

## Common Pitfalls

1. Forgetting `.js` extensions in ESM imports (even for `.ts` files)
2. Using direct HTTP calls instead of BridgeManager
3. Not testing both stdio and HTTP transports
4. Ignoring player visibility in knowledge storage
5. Not batching operations for multiple Lua calls
6. Using `=` or `!=` for SQLite null checks (must use `is`/`is not`)
7. Using `console.log` instead of Winston logger

## Performance Tips

- Tools are loaded lazily on first init
- Database connections cached per session
- Localization results cached in memory
- Bridge requests batched with 10ms delay
- Summary data cached at tool level
- Use `fast: true` for low-latency operations (pause/resume)
- Batch Lua calls: up to 50 per batch
- Knowledge writes serialized via PQueue (concurrency: 1)

## Project Structure

```
mcp-server/
├── src/
│   ├── bridge/         # Bridge Service integration (BridgeManager, SSE)
│   ├── database/       # SQLite/Kysely database access, localization
│   ├── knowledge/      # Knowledge persistence, schemas, event processing
│   ├── tools/
│   │   ├── abstract/   # Base classes (DatabaseQueryTool, LuaFunctionTool, DynamicEventTool)
│   │   ├── actions/    # Game action tools
│   │   ├── databases/  # Civ5 database query tools
│   │   ├── general/    # General-purpose tools (calculator, etc.)
│   │   ├── knowledge/  # Knowledge retrieval tools
│   │   ├── base.ts     # ToolBase abstract class
│   │   └── index.ts    # Tool registry (toolFactories)
│   └── utils/          # Logger, config, helpers
├── tests/
│   ├── tools/          # Tool tests (mirrors src/tools/ structure)
│   ├── database/       # Database tests
│   ├── knowledge/      # Knowledge tests
│   ├── setup.ts        # Test setup, mcpClient export
│   └── global.setup.ts # Global test lifecycle
├── lua/                # Lua scripts executed in-game
├── data/               # Runtime knowledge databases ({gameId}.db)
├── docs/               # Documentation
├── config.json         # Runtime configuration
└── vitest.config.ts    # Test framework setup
```

## Available Scripts

```bash
npm run dev              # Watch mode with tsx
npm run build            # TypeScript compilation to dist/
npm start                # Build + start server
npm test                 # Run Vitest suite
npm run test:watch       # Watch mode testing
npm run test:stdio       # Tests with stdio transport
npm run test:coverage    # Coverage report
npm run type-check       # Type checking without emit
npm run codegen          # Kysely schema code generation
npm run docs             # Generate TypeDoc API docs
npm run inspect          # Launch MCP Inspector
```
