# CLAUDE.md - Vox Agents Development Guide

This guide provides essential patterns and conventions for Vox Agents that aren't covered in the README.

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
- **Pattern**: `store` provides persistent state across executions

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
- `npm run dev` - Development mode with hot reload
- `npm run strategist` - Run strategist workflow
- `npm run briefer` - Run briefing workflow
- **Each workflow has dedicated entry point** with shared instrumentation
- Instrumentation loaded via --import flag for telemetry

## Build & Development

### Commands
- `npm run dev` - Development with hot reload using tsx
- `npm run build` - TypeScript compilation to dist/
- `npm run type-check` - TypeScript type checking without emit
- `npm run lint` - ESLint code quality checks

## Type Safety

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

## Development Guidelines

### Creating New Agents
1. **Extend `VoxAgent`** with appropriate generics
2. **Implement all abstract methods**
3. **Use Zod schemas** for input/output validation
4. **Add to agent registry** in VoxContext
5. **Provide factory function** if needed
6. **Include observability** wrapping
7. **Handle abort signals** properly

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

## Common Pitfalls

1. **Not refreshing AbortController** after abort
2. **Missing observability wrapping** for key operations
3. **Forgetting sequential test execution** for IPC tests
4. **Not handling crash recovery** in standalone mode
5. **Ignoring parameter injection** for MCP tools
6. **Not using proper shutdown handlers**
7. **Missing telemetry flushing** on exit
8. **Forgetting `.js` extensions** in imports