# CLAUDE.md - Bridge Service Development Guide

This guide provides essential patterns and conventions for the Bridge Service that aren't covered in the README.

## Architecture Patterns

### Singleton Services with Event Emitters
All major components follow this pattern:
```typescript
export class ServiceName extends EventEmitter {
  // implementation
}
export const serviceName = new ServiceName();
```
**Always export singleton instances** for consistent state management.

### Layered Architecture
```
src/
  index.ts        # Express setup and middleware
  service.ts      # Main orchestration (BridgeService class)
  routes/         # HTTP endpoints
  services/       # Core business logic (singletons)
  utils/          # Shared utilities
```

## Error Handling Patterns

### Standardized API Responses
```typescript
// Always use these helpers
respondSuccess(result)
respondError(ErrorCode.SPECIFIC_ERROR, message, details)

// Wrap all route handlers
await handleAPIError(res, url, async () => {
  // route logic
  return respondSuccess(data);
});
```

## SSE Implementation

### Client Management Pattern
```typescript
// Use Map for client registry
const sseClients: Map<string, SSEClient> = new Map();

// Auto-cleanup on disconnect
req.on('close', () => {
  sseClients.delete(clientId);
  clearInterval(keepAlive);
});
```

### Resilient Broadcasting
```typescript
function broadcastEvent(event: GameEvent): void {
  const disconnectedClients: string[] = [];

  for (const [clientId, client] of sseClients) {
    try {
      if (client.response.destroyed) {
        disconnectedClients.push(clientId);
      } else {
        sendSSEMessage(client.response, "message", event);
      }
    } catch (error) {
      disconnectedClients.push(clientId);
    }
  }

  // Cleanup after iteration
  disconnectedClients.forEach(id => sseClients.delete(id));
}
```

### Keep-Alive Pattern
Always implement 30-second keep-alive pings for SSE connections.

## IPC Communication

### Message Batching Protocol
```typescript
// Batch delimiter: !@#$%^!
const batch = messages.map(m => JSON.stringify(m)).join("!@#$%^!");
ipc.emit(batch + "!@#$%^!");

// Parsing
const messages = data.toString().split("!@#$%^!")
  .filter(m => m.trim() !== "")
  .map(m => JSON.parse(m));
```

### Reconnection Strategy
```typescript
// Exponential backoff with cap
const delay = Math.min(200 * Math.pow(1.5, attempts), 5000);

// Always check shutdown state
if (this.shuttingDown) return;
```

## State Management

### Game Mutex Pattern
```typescript
class GameMutexManager {
  private pausedPlayerIds: Set<number> = new Set();
  private externalPause = false; // Track manual vs auto

  setActivePlayer(playerId: number): void {
    // Auto-pause for registered players
    // Auto-resume for unregistered players
  }
}
```
**Distinguish manual from automatic state changes** to prevent conflicts.

### Function Registry Pattern
```typescript
// Use Map for dynamic function management
private functions: Map<string, Function> = new Map();

// Listen to connector events for updates
dllConnector.on('function_register', (msg) => {
  this.functions.set(msg.name, msg.metadata);
});
```

## Performance Optimizations

### Batch Operations
Always provide batch endpoints to reduce IPC overhead:
```typescript
// Single call
POST /lua/call

// Batch call (preferred for multiple operations)
POST /lua/batch
```

### Connection Pooling
```typescript
// Separate pools for different priorities
this.standardPool = new Pool(url, { connections: 50 });
this.fastPool = new Pool(url, { connections: 5 }); // For pause/resume
```

### Queue Management
```typescript
// Auto-pause on overflow
if (queue.length >= 50) {
  await this.pauseGame();
  this.queueOverflowing = true;
}
```

## Module System
- **ESM imports**: When you see `import from '*.js'`, read the corresponding .ts file instead

## Testing Patterns

### Framework
- Use **Vitest**, not Jest, for testing
- Test files in `tests/` directory with `.test.ts` extension
- Commands: `npm test`, `npm run test:watch`, `npm run test:coverage`
- Test setup: `tests/setup.ts` for global configuration

### Mock DLL Server
Create comprehensive mocks that implement the full protocol:
```typescript
export class MockDLLServer extends EventEmitter {
  // Implement same IPC protocol
  addLuaFunction(name: string, handler: Function)
  simulateGameEvent(type: string, payload: any)
}
```

### Test Configuration
```typescript
const mockDLL = await createMockDLLServer({
  simulateDelay: true,
  responseDelay: 50,  // Fast for tests
  autoEvents: false    // Manual control
});
```

## Common Pitfalls

1. **Don't forget request cleanup** - Always clear timeouts on response
2. **Check connection state** - Verify `res.destroyed` before SSE writes
3. **Handle batch parsing errors** - Individual message failures shouldn't crash batch processing
4. **Distinguish pause types** - Manual vs automatic pauses need different handling
5. **Clean up on shutdown** - Implement graceful cleanup in all services

## Development Workflow

### Adding New Endpoints
1. Define route in appropriate domain file
2. Wrap with `handleAPIError`
3. Use standard response format
4. Add to OpenAPI documentation if public
5. Create batch variant if applicable

### Adding New Services
1. Extend EventEmitter
2. Export singleton instance
3. Implement shutdown() method
4. Register with BridgeService
5. Add error recovery logic

### Debugging
- Enable debug logs: `DEBUG=bridge:*`
- Monitor IPC traffic in console
- Check SSE connections via `/events` endpoint
- Use mock DLL server for isolated testing

## Integration Guidelines

### With DLL
- All communication through DLLConnector singleton
- Handle disconnections gracefully
- Implement reconnection logic

### With MCP Server
- MCP connects as SSE client
- Bridge broadcasts all game events
- No direct Bridge → MCP calls

### With External Services
- Register functions via `/external/register`
- Include timeout configuration
- Handle network errors specifically