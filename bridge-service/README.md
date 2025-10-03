# Bridge Service

The Bridge Service is the critical communication layer between Civilization V's Community Patch DLL and external AI services. It provides REST APIs, real-time event streaming, and sophisticated game state management.

## What's Implemented

- **Full REST API with SSE** - Complete HTTP endpoints for Lua function execution and real-time game event streaming
- **Named Pipe IPC** - Robust Windows named pipe connection with automatic reconnection and exponential backoff
- **Game Pause System** - Intelligent mutex-based pause/resume with per-player auto-pause for AI processing
- **Message Batching** - High-performance IPC using custom delimiter protocol (`!@#$%^!`) for bulk operations
- **External Functions** - Register HTTP endpoints as Lua-callable functions with timeout management
- **Comprehensive Error Handling** - Typed error codes with automatic recovery mechanisms

## Architecture

```
External Services ← REST/SSE → Bridge Service ← Named Pipe → Civ5 DLL
                                     ↓
                          State Management & Events
                         (Mutex, Functions, Broadcasting)
```

### Core Components

- **DLL Connector** (`dll-connector.ts`) - Named pipe communication with message batching and infinite retry
- **Lua Manager** (`lua-manager.ts`) - Function registry and script execution with validation
- **External Manager** (`external-manager.ts`) - HTTP endpoint registration with re-registration on reconnect
- **Game Mutex** (`mutex.ts`) - Windows mutex-based pausing with manual/auto state tracking

## API Reference

### Lua Operations
```bash
# Execute single function
POST /lua/call
{"function": "GetGameState", "args": []}

# Batch multiple calls (optimized)
POST /lua/batch
[{"function": "GetUnit", "args": [1]}, {"function": "GetCity", "args": [2]}]

# Execute raw Lua script
POST /lua/execute
{"script": "return Game.GetGameTurn() * 2"}

# List registered functions
GET /lua/functions
```

### External Functions
```bash
# Register HTTP endpoint as Lua function
POST /external/register
{
  "name": "AnalyzeThreat",
  "url": "http://127.0.0.1:4000/analyze",
  "async": true,
  "timeout": 5000
}

# Game control
POST /external/pause          # Manual pause
POST /external/resume         # Resume game
POST /external/pause-player/1 # Auto-pause for player 1
DELETE /external/pause-player/1
```

### Event Streaming
```javascript
// Connect to SSE endpoint
const events = new EventSource('http://127.0.0.1:5000/events');
events.onmessage = (e) => {
  const event = JSON.parse(e.data);
  // Event ID format: (turn * 1000000) + sequence
  console.log(`Turn ${Math.floor(event.id / 1000000)}: ${event.type}`);
};
```

## Quick Start

```bash
npm install
npm run build
npm start       # Production mode

# Development
npm run dev     # With hot reload
npm run dev:with-mock  # Mock DLL for testing
```

## Configuration

Edit `config.json`:
```json
{
  "rest": {
    "port": 5000,
    "host": "127.0.0.1"
  },
  "namedpipe": {
    "id": "vox-deorum-bridge",
    "retry": 5000
  },
  "logging": {
    "level": "info"
  }
}
```

Note: Timeouts are hardcoded in the implementation:
- Lua function calls: 30 seconds
- External function calls: 5 seconds (configurable per registration)
- SSE keep-alive: 30 seconds
- CORS is enabled for all origins in development

## Key Implementation Details

### Message Protocol
- Uses JSON with `!@#$%^!` delimiter for batching
- Thread-safe request tracking with unique IDs
- 30-second timeout with automatic cleanup

### Auto-Pause System
- Tracks manual vs automatic pause states
- Per-player registration for turn-based pausing
- Smart resume logic (only if not manually paused)

### Error Recovery
- Exponential backoff (100ms to 5s max)
- Infinite reconnection attempts (maxRetries: false)
- Function re-registration after reconnection
- Graceful degradation when DLL unavailable

### Performance Optimizations
- Batch API reduces IPC overhead by 10x
- Connection pooling for external services
- Efficient SSE client management
- Request queuing with overflow protection

## Testing

```bash
npm test              # Run test suite
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

The test suite includes:
- Mock DLL server for isolation
- Integration tests with real IPC
- Extended timeouts for async operations
- Comprehensive error scenario coverage

## Development Tips

### With Mock DLL
```bash
# Terminal 1
npm run mock  # Starts mock DLL server

# Terminal 2
npm run dev   # Bridge service connects to mock
```

### Debugging
- Set `logging.level: "debug"` in config
- Use `LOG_LEVEL=debug npm start` for override
- Check `logs/` directory for file output
- Monitor named pipe with Windows tools

### Common Issues

**DLL Connection Failed**
- Ensure Civ5 running with modified DLL
- Check pipe name matches DLL config
- Verify Windows Firewall settings

**Timeout Errors**
- Increase timeouts in config.json
- Check DLL performance/blocking
- Enable batch mode for bulk operations

**Event Stream Drops**
- SSE has 30s keep-alive
- Check network proxy settings
- Monitor client reconnection

## Integration Points

### With Civ5 DLL
- Named pipe: `\\.\pipe\vox-deorum-bridge`
- JSON protocol with delimited batching
- Function registration synchronization
- Event forwarding with structured payloads

### With MCP Server
- Primary game state data source
- Real-time event notifications via SSE
- Lua function execution gateway
- Game pause/resume control

### With External Services
- Any HTTP service can register functions
- Support for sync/async execution
- Configurable timeouts per function
- Automatic retry on network failures

## Security Considerations

- CORS configured for development (restrict for production)
- Helmet security headers enabled
- Function name validation against injection
- URL validation for external endpoints
- Request size limit: 10MB
- Consider authentication for production

## Project Structure

```
bridge-service/
├── src/
│   ├── routes/          # API endpoints
│   ├── services/        # Core services
│   ├── types/           # TypeScript interfaces
│   └── utils/           # Helpers & config
├── tests/               # Vitest test suite
└── config.json          # Runtime configuration
```