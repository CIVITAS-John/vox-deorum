# Bridge Service

A thin communication layer between Civilization V's Lua environment and external AI services. This service exposes Lua functions as HTTP endpoints and allows external services to register functions callable from Lua.

## Overview

The Bridge Service acts as a bidirectional gateway:
- **Lua → External**: Execute Lua functions and scripts via HTTP
- **External → Lua**: Register external HTTP endpoints as Lua-callable functions
- **Events**: Stream game events via Server-Sent Events (SSE)

The technology stack:
- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **Protocol**: HTTP/REST + SSE (using express)
- **Test**: Vitest
- **Communication**: Windows Socket to DLL (using node-ipc), as Client

## Getting Started

### Installation

```bash
# Install dependencies
npm install

# Development mode with hot reload
npm run dev

# Build TypeScript
npm run build

# Production mode
npm start

# Run tests
npm test

# Start with mock DLL (no Civilization V required)
npm run dev:with-mock
```

### Configuration

The service reads from the `config.json` for its configuration:

```json
{
  "rest": {
    "port": 8080,
    "host": "localhost"
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

### Docker Support

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

Run with Docker:
```bash
docker build -t bridge-service .
docker run -p 8080:8080 -e DLL_HOST=host.docker.internal bridge-service
```

## API Reference

### Core Endpoints

#### Health Check
```http
GET /health

Response:
{
  "status": "ok",
  "dll_connected": true,
  "uptime": 3600
}
```

### Lua Execution API

#### Execute Lua Function
```http
POST /lua/call
Content-Type: application/json

{
  "function": "GetUnitInfo",
  "args": [unitId]
}

Response: 
{
  "result": { /* Lua function return value */ },
  "success": true
}
```

Execute a registered Lua function with arguments.

#### Batch Lua Calls
```http
POST /lua/batch
Content-Type: application/json

[
  { "function": "GetUnit", "args": [1] },
  { "function": "GetCity", "args": [2] }
]

Response:
[
  { "result": { /* unit data */ }, "success": true },
  { "result": { /* city data */ }, "success": true }
]
```

Execute multiple Lua functions in sequence.

#### List Lua Functions
```http
GET /lua/functions

Response:
{
  "functions": ["GetGameState", "GetUnit", "MoveUnit", "GetCity", "GetPlayer", ...]
}
```

List all Lua functions available for calling via `/lua/call`.

#### Execute Raw Lua Script
```http
POST /lua/execute
Content-Type: application/json

{
  "script": "return Game.GetGameTurn() * 2 + 1"
}

Response:
{
  "result": 101,
  "success": true
}
```

Execute arbitrary Lua code in the game context. Useful for complex queries or debugging.

### External Function API

#### Register External Function
```http
POST /external/register
Content-Type: application/json

{
  "name": "AnalyzeThreat",
  "url": "http://localhost:3000/analyze",
  "async": true,
  "timeout": 5000,
  "description": "Analyzes military threats using AI"
}

Response:
{
  "registered": true,
  "luaFunction": "External.AnalyzeThreat"
}
```

Register an external HTTP endpoint as a Lua-callable function. The function will be available in Lua via `Game.CallExternal("AnalyzeThreat", Arguments, Callback)`. For synchronous functions, the callback parameter can be omitted: `Game.CallExternal("AnalyzeThreat", Arguments)`.

#### Unregister External Function
```http
DELETE /external/register/{functionName}

Response:
{
  "unregistered": true
}
```

#### List External Functions
```http
GET /external/functions

Response:
{
  "functions": [
    {
      "name": "AnalyzeThreat",
      "url": "http://localhost:3000/analyze",
      "async": true,
      "timeout": 5000,
      "description": "Analyzes military threats using AI"
    },
    {
      "name": "PlanCityProduction",
      "url": "http://localhost:3000/plan-production",
      "async": false,
      "timeout": 3000,
      "description": "Plans optimal city production queue"
    }
  ]
}
```

List all registered external functions callable from Lua.

### Event Stream API

```http
GET /events
Accept: text/event-stream

Response (SSE stream):
data: {"type": "turnStart", "player": 1, "turn": 50}
data: {"type": "unitMoved", "unit": 5, "x": 10, "y": 12}
...
```

Subscribe to real-time game events via Server-Sent Events.

## Usage Examples

### External Service Integration

```typescript
// Get current game state
const response = await fetch('http://localhost:8080/lua/call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    function: 'GetGameState',
    args: []
  })
});
const gameState = await response.json();

// Execute raw Lua for complex queries
const query = await fetch('http://localhost:8080/lua/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    script: `
      local units = {}
      for unit in Players[Game.GetActivePlayer()]:Units() do
        table.insert(units, {
          id = unit:GetID(),
          type = unit:GetUnitType(),
          x = unit:GetX(),
          y = unit:GetY()
        })
      end
      return units
    `
  })
});
const units = await query.json();

// Register an AI function for Lua to call
await fetch('http://localhost:8080/external/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'GetCityBuildRecommendation',
    url: 'http://localhost:3000/ai/recommend-build',
    async: false,
    timeout: 3000
  })
});

// List available external functions
const externalFuncs = await fetch('http://localhost:8080/external/functions');
const { functions } = await externalFuncs.json();

// Listen to game events
const events = new EventSource('http://localhost:8080/events');
events.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Game event:', data.type, data);
};
```

### Lua Integration (Game Mod)

```lua
-- Call external AI function registered via /external/register
local function onCityProduction(city)
  -- This calls the external HTTP endpoint registered as 'GetCityBuildRecommendation'
  local recommendation = Game.CallExternal("GetCityBuildRecommendation", {
    cityId = city:GetID(),
    owner = city:GetOwner()
  })
  
  if recommendation then
    print("AI recommends building: " .. recommendation.building)
    -- Apply recommendation
    city:PushOrder(recommendation.order, recommendation.data)
  end
end

-- Send events to external services
Events.ActivePlayerTurnStart.Add(function()
  Game.SendEvent("turnStart", {
    player = Game.GetActivePlayer(),
    turn = Game.GetGameTurn(),
    year = Game.GetGameTurnYear()
  })
end)

-- Register Lua functions for external calling
Game.RegisterFunction("GetGameState", function()
  return {
    turn = Game.GetGameTurn(),
    player = Game.GetActivePlayer(),
    players = GetPlayersData(),
    map = GetMapData()
  }
end)

Game.RegisterFunction("MoveUnit", function(unitId, x, y)
  local unit = GetUnitByID(unitId)
  if unit then
    unit:MoveToPlot(x, y)
    return { success = true }
  end
  return { success = false, error = "Unit not found" }
end)
```

## Development

### Project Structure

```
bridge-service/
├── src/
│   ├── index.ts           # Express app entry point
│   ├── service.ts         # The Bridge Service
│   ├── routes/
│   │   ├── lua.ts         # Lua execution endpoints
│   │   ├── external.ts    # External function registration
│   │   └── events.ts      # SSE event streaming
│   ├── services/
│   │   ├── dll-connector.ts     # Handles the Named Pipe connection to DLL
│   │   ├── lua-manager.ts       # Handles Lua execution/return/registry
│   │   ├── external-manager.ts  # Handles external function execution/return/registry
│   ├── types/
│   │   └── lua.ts         # Lua-related interfaces
│   │   └── external.ts    # External function-related interfaces
│   │   └── event.ts       # Event-related interfaces
│   │   └── api.ts         # API-related interfaces
│   └── utils/
│       ├── logger.ts      # Logging utility
│       └── config.ts      # Configuration loader
├── tests/
│   ├── lua.test.ts
│   ├── external.test.ts
│   ├── events.test.ts
│   └── mocks/
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
└── README.md
```

### Development Commands

```bash
# Install dependencies
npm install

# Run in development mode with hot reload
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Linting
npm run lint

# Start mock DLL server for testing
npm run mock

# Start both mock DLL and bridge service
npm run dev:with-mock
```

### Mock DLL Server

For development and testing without Civilization V, use the mock DLL server:

```bash
# Terminal 1: Start mock DLL server
npm run mock

# Terminal 2: Start bridge service (connects to mock)
npm run dev
```

The mock server:
- Implements the same IPC protocol as the real Community Patch DLL
- Simulates Lua function responses for common game queries
- Generates automatic game events for testing
- Supports external function registration/unregistration
- Provides realistic test data for development

**Available Mock Functions:**
- `GetPlayerName` → Returns "Mock Player"
- `GetCurrentTurn` → Returns simulated turn number
- `GetCityCount` → Returns 3
- `GetGameState` → Returns mock game state object

**Auto-Generated Events:**
- `turn_complete`
- `city_founded`  
- `unit_moved`
- `tech_researched`

## Security Considerations

- The `/lua/execute` endpoint allows arbitrary code execution - use with caution
- Consider adding authentication for production deployments
- Validate and sanitize external function URLs
- Implement rate limiting for expensive operations
- Run in isolated environment/container