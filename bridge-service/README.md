# Bridge Service

Communication layer between Civilization V's Community Patch DLL and external AI services via HTTP/REST + SSE.

## Purpose

Enables bidirectional communication:
- **Lua → External**: Execute Lua functions via HTTP endpoints
- **External → Lua**: Register HTTP endpoints as Lua-callable functions
- **Events**: Stream game events via Server-Sent Events (SSE)

## Quick Start

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Production build & start
npm run build && npm start

# Run tests
npm test

# Development with mock DLL (no Civ V required)
npm run dev:with-mock
```

## API Endpoints

### Lua Execution
- `POST /lua/call` - Execute registered Lua function
- `POST /lua/batch` - Execute multiple Lua functions
- `POST /lua/execute` - Execute raw Lua script
- `GET /lua/functions` - List available Lua functions

### External Functions
- `POST /external/register` - Register HTTP endpoint as Lua function
- `DELETE /external/register/{name}` - Unregister function
- `GET /external/functions` - List registered functions

### Events
- `GET /events` - Subscribe to game events (SSE stream)

### Health
- `GET /health` - Service status and DLL connection

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

## Example Usage

### From External Service
```javascript
// Execute Lua function
const response = await fetch('http://127.0.0.1:5000/lua/call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    function: 'GetGameState',
    args: []
  })
});

// Register AI endpoint for Lua
await fetch('http://127.0.0.1:5000/external/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'AnalyzeThreat',
    url: 'http://127.0.0.1:4000/analyze',
    async: true,
    timeout: 5000
  })
});

// Listen to game events
const events = new EventSource('http://127.0.0.1:5000/events');
events.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Game event:', data);
};
```

### From Lua (Game Mod)
```lua
-- Call registered external function
local result = Game.CallExternal("AnalyzeThreat", {
  unitId = unit:GetID(),
  position = {x = unit:GetX(), y = unit:GetY()}
})

-- Register Lua function for external calling
Game.RegisterFunction("GetGameState", function()
  return {
    turn = Game.GetGameTurn(),
    player = Game.GetActivePlayer()
  }
end)
```

## Project Structure

```
bridge-service/
├── src/
│   ├── index.ts                 # Express app entry
│   ├── service.ts              # Main service
│   ├── routes/                # API endpoints
│   ├── services/              # Core services
│   │   ├── dll-connector.ts  # Named Pipe to DLL
│   │   ├── lua-manager.ts    # Lua execution
│   │   └── external-manager.ts # External functions
│   ├── types/                 # TypeScript interfaces
│   └── utils/                 # Utilities
├── tests/                     # Vitest tests
├── config.json               # Configuration
└── package.json
```

## Development

### Mock DLL Server
For development without Civilization V:
```bash
# Terminal 1: Start mock DLL
npm run mock

# Terminal 2: Start bridge service
npm run dev
```

The mock server simulates:
- Common Lua functions (`GetGameState`, `GetPlayerName`, etc.)
- Automatic game events (turn changes, unit movements)
- External function registration/execution

### Scripts
- `npm run dev` - Development with hot reload
- `npm run build` - Build TypeScript
- `npm test` - Run tests
- `npm run test:watch` - Watch mode testing
- `npm run type-check` - TypeScript checking
- `npm run lint` - ESLint

## DLL Integration

The service connects to the Community Patch DLL via Windows Named Pipes:
- Thread-safe message queuing
- JSON message protocol
- Automatic reconnection
- Graceful degradation when unavailable

## Notes

- `/lua/execute` allows arbitrary code execution - use with caution
- Consider authentication for production deployments
- External function URLs should be validated
- Run in isolated environment for security