# CLAUDE.md - Vox Agents Development Guide

This guide provides essential patterns and conventions for developing Vox Agents.

## LLM Integration

### Model Configuration
- Provider-agnostic configuration supporting multiple LLM providers
- Supported providers: openrouter, openai, google, and compatible services
- Model names and options configurable per provider
- Middleware support for provider-specific adaptations
- Apply middleware based on model characteristics (e.g., gemma-3 models)

### Prompt Engineering Conventions
- Use markdown-style structured prompts for clarity
- **Convention**: Use # headers for major sections (Expectation, Goals, Resources)
- Trim whitespace from prompt strings to avoid formatting issues
- Include clear context about game state and available tools
- Structure prompts to guide LLM behavior effectively

## State Management

### Dual Mode Architecture
The system supports standalone and component modes:

#### Standalone Mode
- Entry point: `src/strategist/index.ts`
- Configure with StrategistSessionConfig
- Specify LLM-controlled players via llmPlayers array
- Enable autoPlay for autonomous game progression
- Session loops with retry for crash recovery

#### Component Mode
- Integrates through VoxContext API for web UI usage
- Supports interactive control and monitoring
- Allows manual intervention during gameplay

### Parameter System
- `store` - Persistent state across agent executions
- `playerID` - Active player being controlled
- `gameID` - Current game session identifier
- `turn` - Current game turn number
- `after`/`before` - Event filtering timestamps
- `running` - Track currently executing agent
- `metadata` - Custom agent annotations for game metadata
- `gameStates` - Map of turn numbers to game state snapshots
- **Pattern**: `store` provides persistent state across executions
- **Pattern**: `gameStates` maintains historical game information for analysis

## Module System

### TypeScript & ESM
- Project uses ESM modules ("type": "module" in package.json)
- **Critical**: Always use `.js` extensions in imports even for `.ts` files
- Follow strict TypeScript configuration for type safety

### Code Structure
- Source code in `src/` directory
- Utilities in `src/utils/` subdirectory
- Tests mirror source structure in `tests/` directory
- Built output goes to `dist/` directory (gitignored)

## Error Handling & Resilience

### Exponential Retry with Jitter
- Implement exponential backoff with configurable parameters
- Default: 3 retries, 100ms initial delay, 10s max delay, 1.5x backoff
- Add jitter (10% random variation) to prevent thundering herd
- Log retry attempts with appropriate log levels
- Propagate final errors after exhausting retries

### Crash Recovery
- Track crash recovery attempts to prevent infinite loops
- Set maximum recovery attempts (configurable)
- Increment counter on each recovery attempt
- Load saved game state on recovery
- **Pattern**: Bounded retry with escalating recovery strategies

### AbortController Usage
- Create fresh AbortController for each operation sequence
- Abort current operations when needed
- **Critical**: Refresh AbortController after abort for future operations
- Pass abort signal to all async operations
- **Pattern**: Always refresh AbortController after abort for continued operation

## Testing with Vitest

### Framework
- **Use Vitest for all testing** (not Jest)
- Test files in `tests/` directory with `.test.ts` extension
- Commands:
  - `npm test` - Run tests
  - `npm run test:watch` - Watch mode
  - `npm run test:coverage` - Coverage report
- Test setup file: `tests/setup.ts` for global configuration

### Configuration
- Extended timeouts: 15 seconds for tests and hooks
- Retry on CI: 1 retry in CI environment, none locally
- Pool type: forks for process isolation
- Sequential execution: singleFork for IPC tests
- **Extended timeouts and sequential execution** for game integration

### Test Organization
- Use nested describe blocks for clear structure
- Group related tests under feature categories
- Use descriptive test names with "should" convention
- **Pattern**: Nested describe blocks for clear test organization
- Keep test files focused on single components or features

## MCP Integration

- **Always read `mcp-server/src/tools/index.ts`** to understand which tools actually exist
- Connect via MCP protocol (stdio or HTTP transport)
- Handle connection failures with retry logic

## Entry Points & Workflows

### Multiple Entry Points
- `npm run dev` - Development mode with hot reload (standalone.ts)
- `npm run strategist` - Run strategist workflow (strategist/index.ts)
- `npm run briefer` - Run briefer workflow (briefer/index.ts)
- **Each workflow has dedicated entry point** with shared instrumentation
- Instrumentation loaded via --import flag for telemetry

## Build & Development

### Commands
- `npm run dev` - Development with hot reload using tsx
- `npm run build` - TypeScript compilation to dist/
- `npm run type-check` - TypeScript type checking without emit
- `npm run lint` - ESLint code quality checks

## Type Safety

### Strong Typing for Game State
- **GameState** interface with typed reports from MCP server
- Import types directly from MCP server build output:
  ```typescript
  import type { CitiesReport } from "../../../mcp-server/dist/tools/knowledge/get-cities.js";
  import type { PlayersReport } from "../../../mcp-server/dist/tools/knowledge/get-players.js";
  ```
- Structured parameter storage with proper type definitions
- **Pattern**: Always use typed imports from MCP server for game data structures

### Zod Schema Integration
- Create agent tools with Zod input/output schemas
- Provide default schemas if not specified by agent
- Use dynamicTool wrapper for Vercel AI SDK integration
- Parse outputs through schema for validation
- **Zod schemas provide TypeScript types and runtime validation**

### Configuration Types
- Agent metadata: name and version information
- MCP server transport configuration (stdio/HTTP)
- LLM provider configurations with model mapping
- Support for environment variable overrides
- **Interface-driven configuration** with environment overrides

## Observability

### OpenTelemetry Integration
- Instrumentation setup in `instrumentation.ts`
- SQLite exporter for local trace storage
- Vox exporter for custom telemetry handling
- Automatic span creation for agent operations
- Resource attributes for game context

### Telemetry Patterns
- Wrap key operations with spans
- Include game state in span attributes
- Flush telemetry on shutdown
- Use appropriate span names and kinds

## Agent Architecture

### Agent Hierarchy
```
VoxAgent (Base)
├── Briefer (Game state analysis)
│   └── SimpleBriefer
├── Strategist (Strategic decisions)
│   ├── NoneStrategist (Baseline)
│   ├── SimpleStrategist (Direct)
│   └── SimpleStrategistBriefed (Two-stage)
└── Envoy (Diplomatic interactions)
    └── (In development)
```

### Creating New Agents
1. Choose base class (Briefer or Strategist)
2. Define parameter types (input, output, store)
3. Implement abstract methods:
   - `buildPrompt()` - Create LLM prompt
   - `stopCheck()` - Determine when to stop
   - `extractResult()` - Process agent output
4. Register in appropriate factory/registry
5. Add configuration support

## Development Guidelines

### Common Patterns
- **Use Map for registries** (players, handlers, etc.)
- **Implement graceful shutdown** with AbortController
- **Apply exponential retry** for external calls
- **Use winston logger** with appropriate context
- **Test with Vitest** using sequential execution for IPC
- **Separate concerns** between standalone and component modes

### Performance Considerations
- **Lazy load agents** when possible
- **Cache MCP tool wrappers**
- **Batch operations** when feasible
- **Use AbortController** for cancellation
- **Implement timeouts** for external calls

## Integration Points

### With Game Process
- VoxCivilization handles game launch
- Crash recovery with bounded retries
- Session loops for continuous play

### With LLM Providers
- Provider-agnostic model configuration
- Middleware for model compatibility
- Structured prompts with markdown sections

## UI Development

### Vue 3 + PrimeVue
- Use Vue 3 Composition API with `<script setup>` syntax
- PrimeVue 4 for UI components with Aura theme
- VirtualScroller for large data sets (logs, tables)
- Avoid external heavy dependencies when PrimeVue provides alternatives

### Style Reuse Guidelines
**IMPORTANT**: Always reuse existing styles `src/styles` rather than creating duplicate definitions.

#### Shared Style Files
- `src/styles/global.css` - Application-wide styles and section layouts
- `src/styles/data-table.css` - Common table styles for consistent appearance

#### Style Reuse Patterns
1. **Always check existing shared styles** before creating new ones

2. **Use shared CSS classes from global.css**:
   - `.section-container` - Container for multiple card sections with gap
   - `.section-header` - Card title header with icon and text alignment

3. **Use shared CSS classes from data-table.css**:
   - `.data-table` - Container for tables
   - `.table-header` - Table header row
   - `.table-body` - Table body container
   - `.table-row` - Individual table rows
   - `.table-empty` - Empty state for tables
   - `.col-fixed-*` - Fixed width columns (50, 60, 80, 100, 120, 150, 200, 250)
   - `.col-expand` - Expanding column that fills available space
   - Text utilities: `.text-truncate`, `.text-wrap`, `.text-muted`, `.text-small`

4. **Empty States**: Use `.table-empty` class for all empty states to maintain consistency
5. **Section Layouts**: Use `.section-container` for views with multiple card sections
6. **If you must create a new style**:
   - First check if it can be added to shared styles
   - Ensure all similar components use the new style
   - Avoid creating splintered/duplicate styles across components

### Font Conventions
**IMPORTANT**: Never use monospace fonts in the UI. All text should use the default system fonts provided by PrimeVue. Code display is an exception where monospace may be appropriate.

### PrimeVue 4 Color System
**IMPORTANT**: Always use PrimeVue 4's actual CSS variables, not guessed color names.

#### Core Color Variables
- `var(--p-text-color)` - Primary text color (#334155)
- `var(--p-text-muted-color)` - Muted/secondary text color (#64748b)
- `var(--p-text-hover-color)` - Text hover color (#1e293b)
- `var(--p-primary-color)` - Theme's primary color (#f59e0b - amber)
- `var(--p-primary-contrast-color)` - Text color on primary background (#ffffff)
- `var(--p-highlight-background)` - Background for highlighted elements (#fffbeb)
- `var(--p-highlight-color)` - Text color for highlighted elements (#b45309)

#### Surface Color System
Surface colors for different UI layers (0-950 scale):
- `var(--p-surface-0)` through `var(--p-surface-950)` - Full surface scale
- `var(--p-surface-0)` - Pure white (#ffffff)
- `var(--p-surface-50)` - Lightest gray (#f8fafc)
- `var(--p-surface-100)` - Very light gray (#f1f5f9)
- `var(--p-surface-200)` - Light gray (#e2e8f0)
- `var(--p-surface-900)` - Dark gray (#0f172a)
- `var(--p-content-background)` - Content background (#ffffff)
- `var(--p-content-border-color)` - Content borders (#e2e8f0)

#### Complete Color Palette
PrimeVue includes full color scales (50-950) for all colors:

**Primary Colors:**
- Amber (primary): `var(--p-amber-50)` to `var(--p-amber-950)`
- Blue: `var(--p-blue-50)` to `var(--p-blue-950)`
- Red: `var(--p-red-50)` to `var(--p-red-950)`
- Green: `var(--p-green-50)` to `var(--p-green-950)`
- Yellow: `var(--p-yellow-50)` to `var(--p-yellow-950)`
- Orange: `var(--p-orange-50)` to `var(--p-orange-950)`

**Extended Palette:**
- Slate: `var(--p-slate-50)` to `var(--p-slate-950)`
- Gray: `var(--p-gray-50)` to `var(--p-gray-950)`
- Zinc: `var(--p-zinc-50)` to `var(--p-zinc-950)`
- Neutral: `var(--p-neutral-50)` to `var(--p-neutral-950)`
- Stone: `var(--p-stone-50)` to `var(--p-stone-950)`
- Cyan: `var(--p-cyan-50)` to `var(--p-cyan-950)`
- Teal: `var(--p-teal-50)` to `var(--p-teal-950)`
- Emerald: `var(--p-emerald-50)` to `var(--p-emerald-950)`
- Lime: `var(--p-lime-50)` to `var(--p-lime-950)`
- Purple: `var(--p-purple-50)` to `var(--p-purple-950)`
- Violet: `var(--p-violet-50)` to `var(--p-violet-950)`
- Indigo: `var(--p-indigo-50)` to `var(--p-indigo-950)`
- Sky: `var(--p-sky-50)` to `var(--p-sky-950)`
- Pink: `var(--p-pink-50)` to `var(--p-pink-950)`
- Rose: `var(--p-rose-50)` to `var(--p-rose-950)`
- Fuchsia: `var(--p-fuchsia-50)` to `var(--p-fuchsia-950)`

#### Usage Examples
```css
/* Correct - using actual PrimeVue variables */
.log-header {
  background: var(--p-surface-100);
  color: var(--p-text-color);
  border: 1px solid var(--p-surface-200);
}

.log-row:hover {
  background: var(--p-surface-50);
}

.log-error {
  color: var(--p-red-700);
  background: var(--p-red-50);
}

/* Dark mode adjustments - use data-theme attribute */
:root[data-theme="dark"] .message {
  background: var(--p-surface-900);
}

/* Common component-specific colors */
.message--system {
  border-left: 3px solid var(--p-gray-500);
}

.message--user {
  border-left: 3px solid var(--p-blue-500);
}

.message--assistant {
  border-left: 3px solid var(--p-green-500);
}

.tool-label {
  color: var(--p-purple-500);
}

/* Incorrect - these don't exist in PrimeVue 4 */
/* var(--p-surface-hover) ❌ - use specific surface values */
/* var(--p-surface-border) ❌ - use var(--p-surface-200) or var(--p-content-border-color) */
/* var(--vp-c-*) ❌ - VitePress variables, not available in PrimeVue */
/* var(--vp-font-family-mono) ❌ - use 'Courier New', Courier, monospace */
```

### Web UI Components
- **SSE Manager** for real-time log streaming
- **Express Server** with CORS and static file serving
- **API Routes** organized by feature (telemetry, config, chat)
- **Vue Components** with PrimeVue for rich UI elements
- **Pattern**: Use SSE for server-to-client streaming data

### Development Server
- Vite for fast development and bundling
- Configure cache headers to prevent stale content:
  ```typescript
  headers: {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
  ```
- **Hot Module Replacement** for rapid UI development
- **Proxy configuration** for API endpoints during development

## Common Pitfalls

1. **Not refreshing AbortController** after abort
2. **Missing observability wrapping** for key operations
3. **Forgetting sequential test execution** for IPC tests
4. **Not handling crash recovery** in standalone mode
5. **Ignoring parameter injection** for MCP tools
6. **Not using proper shutdown handlers**
7. **Missing telemetry flushing** on exit
8. **Forgetting `.js` extensions** in imports
9. **Using hardcoded colors** instead of PrimeVue theme variables