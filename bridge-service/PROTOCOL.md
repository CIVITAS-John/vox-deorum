# Communication Protocol

This document describes the complete communication protocol between the Community Patch DLL, Bridge Service, and external AI services in the Vox Deorum system.

## Overview

The Bridge Service acts as a communication hub using three primary channels:
- **Named Pipe**: Named pipe connection to the Community Patch DLL (using node-ipc)
- **HTTP REST API**: Endpoints for external services to call Lua functions and manage registrations
- **Server-Sent Events (SSE)**: Real-time event streaming to external clients

## Protocol Flows

### 1. External Service → Lua Function Call

#### Single Function Call

1. **External service → POST /lua/call**
   ```http
   Headers: Content-Type: application/json
   Body: {"function": "MoveUnit", "args": [5, 10, 12]}
   ```

2. **Bridge → DLL (Named Pipe)**
   ```json
   {"type": "lua_call", "function": "MoveUnit", "args": [5, 10, 12], "id": "uuid"}
   ```

3. **DLL → Lua Environment**
   ```lua
   MoveUnit([5, 10, 12])
   ```

4. **Lua → DLL → Bridge (Named Pipe)**
   ```json
   {"type": "lua_response", "id": "uuid", "success": true, "result": {...}}
   ```

5. **Bridge → External Service (HTTP Response)**
   ```json
   {"success": true, "result": {...}}
   ```

#### Batch Function Calls

1. **External service → POST /lua/batch**
   ```json
   [
     {"function": "GetUnit", "args": 1},
     {"function": "GetCity", "args": 2}
   ]
   ```

2. **Bridge → DLL (Sequential Named Pipe calls)**
   ```json
   {"type": "lua_call", "function": "GetUnit", "args": 1, "id": "uuid1"}
   {"type": "lua_call", "function": "GetCity", "args": 2, "id": "uuid2"}
   ```

3. **DLL → Lua → DLL → Bridge (Multiple responses)**
   ```json
   {"type": "lua_response", "id": "uuid1", "success": true, "result": {...}}
   {"type": "lua_response", "id": "uuid2", "success": true, "result": {...}}
   ```

4. **Bridge → External Service (Aggregated response)**
   ```json
   [
     {"success": true, "result": {...}},
     {"success": true, "result": {...}}
   ]
   ```

#### Function Registry Update (Internal Communication)

##### Function Registration

1. **Lua Environment → DLL**
   ```
   Game.RegisterFunction("GetCity", GetCityByID);
   ```

2. **DLL → Bridge (Named Pipe)**
   ```json
   {
     "type": "lua_register",
     "function": "GetCity",
     "description": "Gets a city by its ID"
   }
   ```

3. **Bridge updates internal function cache**  
   Used for /lua/functions endpoint responses

##### Function Unregistration

1. **Lua Environment → DLL**
   ```
   Game.UnregisterFunction("GetCity");
   ```

2. **DLL → Bridge (Named Pipe)**
   ```json
   {
     "type": "lua_unregister",
     "function": "GetCity"
   }
   ```

3. **Bridge removes function from internal cache**

##### Clear All Functions

1. **Lua Environment → DLL**
   ```
   Game.ClearFunctions();
   ```

2. **DLL → Bridge (Named Pipe)**
   ```json
   {
     "type": "lua_clear"
   }
   ```

3. **Bridge clears entire function cache**

#### Raw Lua Script Execution

1. **External service → POST /lua/execute**
   ```json
   {"script": "return Game.GetGameTurn() * 2 + 1"}
   ```

2. **Bridge → DLL (Named Pipe)**
   ```json
   {"type": "lua_execute", "script": "return Game.GetGameTurn() * 2 + 1", "id": "uuid"}
   ```

3. **DLL → Lua Environment**
   Direct script evaluation

4. **Lua → DLL → Bridge**
   ```json
   {"type": "lua_response", "id": "uuid", "success": true, "result": 101}
   ```

5. **Bridge → External Service**
   ```json
   {"success": true, "result": 101}
   ```

### 2. Lua → External Service Function Call

#### Function Registration

1. **External service → POST /external/register**
   ```json
   {
     "name": "AnalyzeThreat",
     "url": "http://localhost:4000/analyze",
     "async": true,
     "timeout": 5000,
     "description": "Analyzes military threats using AI"
   }
   ```

2. **Bridge stores registration internally and responds**
   ```json
   {"success": true}
   ```

3. **Bridge → DLL (Named Pipe)**
   ```json
   {"type": "external_register", "name": "AnalyzeThreat"}
   ```

4. **DLL creates Lua binding**
   ```lua
   if Game.IsExternalRegistered("AnalyzeThreat") then
      Game.CallExternal("AnalyzeThreat", args, callback)
   ```
   Or, for sync mode:
   ```lua
   if Game.IsExternalRegistered("AnalyzeThreat") then
      print(Game.CallExternal("AnalyzeThreat", args))
   ```

#### Function Unregistration

1. **External service → POST /external/unregister**
   ```json
   {"name": "AnalyzeThreat"}
   ```

2. **Bridge removes registration and responds**
   ```json
   {"success": true}
   ```

3. **Bridge → DLL (Named Pipe)**
   ```json
   {"type": "external_unregister", "name": "AnalyzeThreat"}
   ```

4. **DLL removes Lua binding**

#### Function Invocation

1. **Lua Environment → DLL**
   ```lua
   Game.CallExternal("AnalyzeThreat", {unitId = 5, playerId = 1})
   ```
   (Called from game mod scripts - args can be any JSON-compatible data)

2. **DLL → Bridge (Named Pipe)**
   ```json
   {
     "type": "external_call",
     "function": "AnalyzeThreat",
     "args": {"unitId": 5, "playerId": 1},
     "id": "uuid",
     "async": true
   }
   ```

3. **Bridge → External Service (HTTP POST)**
   ```http
   URL: http://localhost:4000/analyze
   Headers: Content-Type: application/json
   Body: {"args": {"unitId": 5, "playerId": 1}, "id": "uuid"}
   ```

4. **External Service → Bridge (HTTP Response)**
   ```json
   {"success": true, "result": {"threatLevel": "high", "recommendation": "retreat"}}
   ```

5. **Bridge → DLL (Named Pipe)**
   ```json
   {
     "type": "external_response",
     "id": "uuid",
     "success": true,
     "result": {"threatLevel": "high", "recommendation": "retreat"}
   }
   ```

6. **DLL → Lua Environment**
   Game.CallExternal() callback receives the result object

### 3. Game Events Streaming

#### Event Registration & Broadcasting

1. **External Service → GET /events**
   ```http
   Headers: Accept: text/event-stream
   ```
   (Establishes SSE connection)

2. **Lua Environment → DLL**
   ```lua
   Game.SendEvent("turnStart", {...})
   ```
   (Called from game event handlers)

3. **DLL → Bridge (Named Pipe)**
   ```json
   {
     "id": 1000001,
     "type": "game_event",
     "event": "turnStart",
     "payload": { "args": [1, 50, 20] }
   }
   ```
   
   **Event ID Format**: Number with structure `(turn * 1000000) + eventSequence`
   - Turn number (no padding) followed by 6-digit event sequence
   - Event sequence is zero-padded to 6 digits
   - Example: `1000001` = Turn 1, Event 1
   - Example: `123004567` = Turn 123, Event 4567
   - The event counter resets to 1 at the beginning of each turn

4. **Bridge → All SSE Clients**
   ```
   event: turnStart
   data: {"id": 1000001, "type": "turnStart", "payload": ...}
   ```

## HTTP API Responses

All response types follow the interfaces defined in `src/types/api.ts`.

### Success Response
```json
{
  "success": true,
  "result": "any-value"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": "Additional error details"
  }
}
```

### Health Check Response
```json
{
  "success": true,
  "dll_connected": true,
  "uptime": 3600,
  "version": "1.0.0"
}
```

## Error Handling

### Error Codes

All error codes are defined in the `ErrorCode` enum in `src/types/api.ts`:

- **DLL_DISCONNECTED**: Bridge service lost connection to game DLL
- **LUA_EXECUTION_ERROR**: Lua script or function execution failed
- **CALL_TIMEOUT**: Function call exceeded timeout limit
- **CALL_FAILED**: Function call returned error or non-200 status
- **INVALID_FUNCTION**: Requested function not registered or available
- **INVALID_SCRIPT**: Malformed or invalid Lua script
- **INVALID_ARGUMENTS**: Function called with wrong number or type of arguments
- **NETWORK_ERROR**: Network connectivity issues
- **SERIALIZATION_ERROR**: Failed to serialize/deserialize data
- **INTERNAL_ERROR**: Internal bridge service error
- **NOT_FOUND**: Requested resource or endpoint not found

### Timeout Behavior

- **Lua Function Calls**: Default 10 second timeout
- **External Function Calls**: Configurable per function (default 5 seconds)
- **DLL Communication**: 30 second timeout for socket operations
- **SSE Connections**: Keep-alive every 30 seconds

### Connection Recovery

#### DLL Connection Loss

1. Bridge detects namedpipe/IPC disconnection
2. Bridge enters retry mode with exponential backoff
3. All pending requests fail with DLL_DISCONNECTED
4. Health check endpoint reports dll_connected: false
5. Upon reconnection, Bridge re-registers all external functions

#### External Service Unavailable

1. HTTP call to external service fails
2. Bridge returns error to Lua via DLL
3. Service remains registered for future calls
4. No automatic retry (handled by calling Lua code)
