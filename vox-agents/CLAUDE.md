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
- Test setup file: `tests/setup.ts` for global configuration and Civ5 guard

### Commands
- `npm test` - Run all tests once
- `npm run test:watch` - Watch mode for development
- `npm run test:unit` - Unit tests only (excludes game tests)
- `npm run test:game` - Game tests only (requires Civilization V)
- `npm run test:coverage` - Coverage report
- `npm run test:ui` - Vitest browser UI

### Test Pathways

Different features require different testing infrastructure:

#### Unit Tests (`tests/utils/`, agent logic with mocks)
- No external dependencies required
- Pure function testing, data transformations, mocked agent logic
- Fast execution, safe to run anywhere

#### Game Tests (`tests/infra/`)
- **Requires Windows** with Civilization V installed
- Actually launches and manages CivilizationV.exe
- Extended per-test timeouts (90-180 seconds)
- Sequential execution enforced via `singleFork: true`

### Global Civ5 Guard
The test setup detects if CivilizationV.exe is already running and **aborts all tests immediately**. Only one Civ5 instance can run at a time. The guard will not kill an existing process — it may be an active game session.

### Configuration
- Extended timeouts: 15 seconds for tests and hooks
- Retry on CI: 1 retry in CI environment, none locally
- Pool type: forks with `singleFork: true` for sequential execution

### Test Organization
- Use nested describe blocks for clear structure
- Group related tests under feature categories
- Use descriptive test names with "should" convention
- Keep test files focused on single components or features

## MCP Integration

- **Always read `mcp-server/src/tools/index.ts`** to understand which tools actually exist
- Connect via MCP protocol (stdio or HTTP transport)
- Handle connection failures with retry logic

## Entry Points & Workflows

### Multiple Entry Points
- `npm run dev` - Development mode with hot reload (index.ts)
- `npm run strategist` - Run strategist workflow (strategist/index.ts)
- `npm run briefer` - Run briefer workflow (briefer/index.ts)
- `npm run telepathist` - Run telepathist console (telepathist/console.ts)
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
│   ├── SimpleBriefer (General briefing)
│   └── SpecializedBriefer (Military, Economy, Diplomacy)
├── Strategist (Strategic decisions)
│   ├── NoneStrategist (Baseline)
│   ├── SimpleStrategist (Direct)
│   ├── SimpleStrategistBriefed (Single-briefer)
│   └── SimpleStrategistStaffed (Multi-briefer collaborative)
├── Analyst (Fire-and-forget analysis)
│   └── DiplomaticAnalyst (Intelligence gatekeeping)
├── Librarian (Database research)
│   └── KeywordLibrarian (Keyword-based search)
└── Envoy (Chat-based interactions)
    ├── LiveEnvoy (Game-specific chat)
    │   ├── Diplomat (Intelligence gathering)
    │   └── Spokesperson (Official representative)
    └── Telepathist (Database-backed conversations)
        └── TalkativeTelepathist (Post-game analysis)
```

### Creating New Agents
1. Choose base class (Briefer, Strategist, Analyst, Librarian, or Envoy)
2. Define parameter types (input, output, store)
3. Implement lifecycle hooks as needed:
   - `getModel()` - Select LLM model for execution
   - `getSystem()` - Build system prompt
   - `getActiveTools()` - Specify available MCP tools
   - `getExtraTools()` - Provide internal agent-tools
   - `getInitialMessages()` - Construct initial message context
   - `prepareStep()` - Configure step execution
   - `stopCheck()` - Determine when to stop execution
   - `getOutput()` - Extract and format final output
   - `postprocessOutput()` - Transform output before return
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

### Advanced Patterns

#### Fire-and-Forget Agents
- Set `fireAndForget: true` on agents that run asynchronously in the background
- Agent runs in a detached trace context (new root span)
- Calling agent continues immediately without waiting for results
- Used by Analyst agents for background intelligence processing

#### Special Messages (Triple-Brace Tokens)
- Use `{{{MessageType}}}` tokens to trigger special agent behaviors
- Handled by `getSpecialMessages()` mapping in Envoy subclasses
- Custom prompts injected without appearing as user messages
- Common tokens: `{{{Initialize}}}`, `{{{Greeting}}}`

#### Dual-Database Pattern
- Used by Telepathist agents for post-game analysis
- Factory creates connections to read-only telemetry DB + read-write analysis DB
- Enables cross-database queries and persistent summaries
- Pattern: `createTelepathistParameters()` manages both connections

#### Tool Rescue Middleware
- Extracts JSON tool calls from malformed LLM text responses
- Handles models without native tool calling support
- Operates in prompt mode (instructs model) and rescue mode (extracts from text)
- Applied via `toolRescueMiddleware()` in model configuration

#### Concurrency Management
- Per-model rate limiting via `streamTextWithConcurrency()`
- Configurable concurrent request limits per LLM provider
- Integrated with exponential retry and timeout refresh
- Prevents API overload with semaphore-like request tracking

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
- `src/styles/chat.css` - Chat-specific styles for messages and chat interfaces
- `src/styles/states.css` - Empty states and loading states

#### Style Reuse Patterns
1. **Always check existing stylesheet before creating any new styles or pages** - Review all shared stylesheets to avoid duplicating existing styles

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
- `var(--p-text-secondary-color)` - Secondary text color for less emphasis
- `var(--p-primary-color)` - Theme's primary color (#f59e0b - amber)
- `var(--p-primary-contrast-color)` - Text color on primary background (#ffffff)
- `var(--p-highlight-background)` - Background for highlighted elements (#fffbeb)
- `var(--p-highlight-color)` - Text color for highlighted elements (#b45309)

#### Content Background System
**IMPORTANT**: Use content-specific variables for adaptive dark mode support:
- `var(--p-content-background)` - Main content area background (adapts to theme)
- `var(--p-content-hover-background)` - Hovered content background (subtle highlight)
- `var(--p-content-border-color)` - Content area borders
- `var(--p-hover-background)` - General hover state background

**DO NOT USE** `var(--p-surface-0)` for content backgrounds - it stays white in dark mode!

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
  background: var(--p-content-hover-background);
  color: var(--p-text-color);
  border: 1px solid var(--p-content-border-color);
}

.log-row:hover {
  background: var(--p-content-hover-background);
}

/* Content areas that need dark mode adaptation */
.content-panel {
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
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

### Chat Interface Styling
**IMPORTANT**: Follow these conventions for chat-related styles:

#### Color Usage
- **Always use PrimeVue theme variables** - Never hardcode colors like `rgba(0,0,0,0.15)`
- **Use semantic color variables** for consistent theming:
  - Text: `var(--p-text-color)`, `var(--p-text-muted-color)`, `var(--p-text-secondary-color)`
  - Content backgrounds: `var(--p-content-background)`, `var(--p-content-hover-background)`
  - UI layers: `var(--p-surface-50)` through `var(--p-surface-950)` (for non-content areas)
  - Borders: `var(--p-content-border-color)` for content, `var(--p-surface-200/300)` for UI
  - Primary: `var(--p-primary-50)` through `var(--p-primary-950)`
  - Status indicators: `var(--p-green-500)`, `var(--p-red-500)`, etc.

#### Dark Mode Support
- **For backgrounds and content areas**: Provide dark mode alternatives
  ```css
  .element {
    background: var(--p-surface-100);
  }
  /* Dark mode adjustments if the theme variables don't auto-adapt */
  .dark-mode .element {
    background: var(--p-surface-800);
  }
  ```
- **For shadows**: Use darker shadows in dark mode
  ```css
  .element {
    box-shadow: 0 2px 8px var(--p-shadow-color);
  }
  .dark-mode .element {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }
  ```
- **For indicator colors** (borders, icons): Usually no dark mode alternative needed as they're meant to stand out

#### Message Type Styling
- User messages: Primary theme colors (`var(--p-primary-50)`, `var(--p-primary-500)`)
- Assistant messages: Default surface colors
- System messages: Muted colors with italic text
- Tool messages: Subtle surface variations with colored borders

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
10. **Using `var(--p-surface-0)` for content** - Use `var(--p-content-background)` instead
11. **Not providing dark mode alternatives** for backgrounds and shadows