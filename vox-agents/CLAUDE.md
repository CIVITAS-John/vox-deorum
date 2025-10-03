# CLAUDE.md - Vox Agents Development Guide

This guide provides essential patterns and conventions for Vox Agents that aren't covered in the README.

## Agent Architecture

### Core Agent Pattern
All agents extend the abstract `VoxAgent` base class:
```typescript
export abstract class VoxAgent<T, TParameters extends AgentParameters, TInput = unknown, TOutput = unknown> {
  abstract readonly name: string;
  abstract getSystem(parameters: TParameters, context: VoxContext<TParameters>): Promise<string>;
  abstract getActiveTools(parameters: TParameters): string[] | undefined;

  // Lifecycle hooks
  public stopCheck(parameters: TParameters, lastStep: StepResult, allSteps: StepResult[]): boolean
  public async prepareStep(...): Promise<{model?: LanguageModel; toolChoice?: any; activeTools?: string[]; messages?: ModelMessage[]}>
}
```
**Pattern**: Agents are self-contained units with well-defined interfaces for system prompts, tool selection, and execution control.

### Generic Type System
```typescript
export abstract class VoxAgent<
  T,                                    // Implementation-specific data
  TParameters extends AgentParameters,  // Execution context
  TInput = unknown,                     // Tool input type
  TOutput = unknown                     // Tool output type
>
```
**Four-level generic typing** for maximum flexibility and type safety.

### Session Management
```typescript
export class StrategistSession {
  private activePlayers = new Map<number, VoxPlayer>();
  private abortController = new AbortController();
  private crashRecoveryAttempts = 0;
  private readonly MAX_RECOVERY_ATTEMPTS = 3;
}
```
**Pattern**: Map-based player management, AbortController for shutdown, bounded crash recovery.

## LLM Integration

### Model Configuration
Provider-agnostic configuration with middleware support:
```typescript
export interface Model {
  provider: string;  // "openrouter" | "openai" | "google"
  name: string;
  options?: Record<string, any>;
}

// Provider-specific middleware
if (config.name.indexOf("gemma-3") !== -1) {
  result = wrapLanguageModel({
    model: result,
    middleware: gemmaToolMiddleware
  });
}
```

### Prompt Engineering Conventions
Use markdown-style structured prompts:
```typescript
public async getSystem(): Promise<string> {
  return `
# Expectation
Due to the complexity of the game...

# Goals
Your goal is to...

# Resources
You will receive the following:
- Players: summary reports
- Cities: summary reports
`.trim()
}
```
**Convention**: Use # headers for Expectation, Goals, Resources sections.

## State Management

### Dual Mode Architecture
The system supports standalone and component modes:

#### Standalone Mode
```typescript
// Entry point: src/strategist/index.ts
const config: StrategistSessionConfig = {
  llmPlayers: [0],
  autoPlay: true,
  strategist: "simple-strategist"
};

// Session loop with retry
for (var I = 0; I < 10; I++) {
  session = new StrategistSession(config);
  await session.start();
}
```

#### Component Mode
Would integrate through VoxContext API for web UI usage.

### Parameter System
```typescript
export interface AgentParameters {
  store?: Record<string, unknown>;  // Persistent state
  playerID?: number;
  gameID?: string;
  turn?: number;
  after?: number;   // Event filtering
  before?: number;
  running?: string; // Currently executing agent
}
```
**Pattern**: `store` provides persistent state across executions.

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
```typescript
export async function exponentialRetry<T>(
  fn: () => Promise<T>,
  logger: Logger,
  maxRetries: number = 3,
  initialDelay: number = 100,
  maxDelay: number = 10000,
  backoffFactor: number = 1.5
): Promise<T> {
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * currentDelay;
  const totalDelay = currentDelay + jitter;
}
```

### Crash Recovery
```typescript
private async handleGameExit(exitCode: number | null): Promise<void> {
  if (this.crashRecoveryAttempts >= this.MAX_RECOVERY_ATTEMPTS) {
    logger.error(`Maximum recovery attempts exceeded`);
    return;
  }

  this.crashRecoveryAttempts++;
  await voxCivilization.startGame('LoadGame.lua');
}
```
**Pattern**: Bounded retry with escalating recovery strategies.

### AbortController Usage
```typescript
export class VoxContext<TParameters extends AgentParameters> {
  private abortController: AbortController;

  public abort(): void {
    this.abortController.abort();
    // Fresh controller for future operations
    this.abortController = new AbortController();
  }
}
```
**Pattern**: Refresh AbortController after abort for continued operation.

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
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 15000,
    hookTimeout: 15000,
    retry: process.env.CI ? 1 : 0,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true  // Sequential for IPC tests
      }
    }
  }
})
```
**Extended timeouts and sequential execution** for game integration.

### Test Organization
```typescript
describe('Feature Category', () => {
  describe('sub-feature', () => {
    it('should handle edge case', () => {
      // Test implementation
    });
  });
});
```
**Pattern**: Nested describe blocks for clear test organization.

## MCP Integration

### Connection to MCP Server
- **Always read `mcp-server/src/tools/index.ts`** to understand which tools actually exist
- Connect via MCP protocol (stdio or HTTP transport)
- Handle connection failures with retry logic

### Event-Driven Communication
```typescript
export class MCPClient {
  private notificationHandlers: Map<string, (data: any) => any> = new Map();

  onElicitInput(handler: (params: any) => Promise<any> | any): void {
    this.notificationHandlers.set('elicitInput', handler);
  }
}
```

### Tool Wrapping for AI SDK
```typescript
export function wrapMCPTool(tool: Tool): VercelTool {
  // Filter autoComplete fields from schema
  const filteredSchema = { ...tool.inputSchema };
  if (tool.annotations?.autoComplete) {
    autoCompleteFields.forEach(field =>
      delete filteredProperties[field]
    );
  }

  return dynamicTool({
    inputSchema: jsonSchema(filteredSchema),
    execute: async (args: any, options) => {
      // Re-inject autoComplete fields at runtime
      autoCompleteFields.forEach(key => {
        args[key] = (options.experimental_context as any)[camelKey];
      });
    }
  });
}
```
**Pattern**: Schema transformation with runtime parameter injection.

## Entry Points & Workflows

### Multiple Entry Points
```json
{
  "scripts": {
    "dev": "tsx watch --import ./src/instrumentation.ts src/standalone.ts",
    "strategist": "node --import ./dist/instrumentation.js dist/strategist/index.js",
    "briefer": "node --import ./dist/instrumentation.js dist/briefer/index.js"
  }
}
```
**Each workflow has dedicated entry point** with shared instrumentation.

### Signal Handling
```typescript
async function shutdown(signal: string) {
  if (shuttingdown) return;
  shuttingdown = true;

  if (session) await session.shutdown();
  await langfuseSpanProcessor.forceFlush();
  await setTimeout(1000);
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  shutdown('uncaughtException');
});
```
**Centralized shutdown** with telemetry flushing.

## Build & Development

### Commands
- `npm run dev` - Development with hot reload using tsx
- `npm run build` - TypeScript compilation to dist/
- `npm run type-check` - TypeScript type checking without emit
- `npm run lint` - ESLint code quality checks

## Type Safety

### Zod Schema Integration
```typescript
export function createAgentTool(agent: VoxAgent): VercelTool {
  const inputSchema = agent.inputSchema || z.object({
    Prompt: z.string().describe("The prompt or task")
  });

  return dynamicTool({
    inputSchema: inputSchema as any,
    execute: async (input) => {
      if (agent.outputSchema) {
        return agent.outputSchema.parse(result);
      }
    }
  });
}
```
**Zod schemas provide TypeScript types and runtime validation**.

### Configuration Types
```typescript
export interface VoxAgentsConfig {
  agent: { name: string; version: string; };
  mcpServer: {
    transport: {
      type: TransportType;
      endpoint?: string;
      command?: string;
      args?: string[];
    };
  };
  llms: Record<string, Model | string>;
}
```
**Interface-driven configuration** with environment overrides.

## Observability

### Langfuse Integration
```typescript
import { startActiveObservation } from "./utils/observation.js";

// Wrap operations with tracing
const observation = startActiveObservation({
  name: "agent-execution",
  input: parameters
});

try {
  // Operation code
  observation.end({ output: result });
} catch (error) {
  observation.end({ error });
}
```
**Always wrap key operations** with observability for tracing.

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