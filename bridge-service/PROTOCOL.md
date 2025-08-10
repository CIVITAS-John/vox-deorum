
# Communication Protocol Documentation

This document describes the complete communication protocol between the Community Patch DLL, Bridge Service, and external AI services in the Vox Populi AI system.

## Overview

The Bridge Service acts as a communication hub using three primary channels:
- **Winsock/IPC**: Direct socket connection to the Community Patch DLL (using node-ipc)
- **HTTP REST API**: Endpoints for external services to call Lua functions and manage registrations
- **Server-Sent Events (SSE)**: Real-time event streaming to external clients

## Protocol Flows

### 1. External Service → Lua Function Call

**Single Function Call**
```
1. External service → POST /lua/call
   Headers: Content-Type: application/json
   Body: {"function": "MoveUnit", "args": [5, 10, 12]}

2. Bridge → DLL (Winsock IPC)
   Message: {type: "lua_call", function: "MoveUnit", args: [5, 10, 12], id: "uuid"}

3. DLL → Lua Environment
   Execution: MoveUnit(5, 10, 12)

4. Lua → DLL → Bridge (Winsock IPC)
   Response: {type: "lua_response", id: "uuid", success: true, result: {...}}

5. Bridge → External Service (HTTP Response)
   Body: {"success": true, "result": {...}}
```

**Batch Function Calls**
```
1. External service → POST /lua/batch
   Body: [
     {"function": "GetUnit", "args": [1]},
     {"function": "GetCity", "args": [2]}
   ]

2. Bridge → DLL (Sequential Winsock IPC calls)
   Messages: 
   - {type: "lua_call", function: "GetUnit", args: [1], id: "uuid1"}
   - {type: "lua_call", function: "GetCity", args: [2], id: "uuid2"}

3. DLL → Lua → DLL → Bridge (Multiple responses)
   Responses:
   - {type: "lua_response", id: "uuid1", success: true, result: {...}}
   - {type: "lua_response", id: "uuid2", success: true, result: {...}}

4. Bridge → External Service (Aggregated response)
   Body: [
     {"success": true, "result": {...}},
     {"success": true, "result": {...}}
   ]
```

**Raw Lua Script Execution**
```
1. External service → POST /lua/execute
   Body: {"script": "return Game.GetGameTurn() * 2 + 1"}

2. Bridge → DLL (Winsock IPC)
   Message: {type: "lua_execute", script: "return Game.GetGameTurn() * 2 + 1", id: "uuid"}

3. DLL → Lua Environment
   Execution: Direct script evaluation

4. Lua → DLL → Bridge
   Response: {type: "lua_response", id: "uuid", success: true, result: 101}

5. Bridge → External Service
   Body: {"success": true, "result": 101}
```

### 2. Lua → External Service Function Call

**Function Registration**
```
1. External service → POST /external/register
   Body: {
     "name": "AnalyzeThreat",
     "url": "http://localhost:3000/analyze",
     "async": true,
     "timeout": 5000,
     "description": "Analyzes military threats using AI"
   }

2. Bridge stores registration internally and responds
   Response: {"registered": true, "luaFunction": "AnalyzeThreat"}

3. Bridge → DLL (Winsock IPC)
   Message: {type: "external_register", name: "AnalyzeThreat", async: true}

4. DLL creates Lua binding
   Lua Function: callable via Game.CallExternal("AnalyzeThreat", args, callback)
```

**Function Invocation**
```
1. Lua Environment → Game.CallExternal("AnalyzeThreat", {unitId, playerId})
   (Called from game mod scripts)

2. DLL → Bridge (Winsock IPC)
   Message: {
     type: "external_call",
     function: "AnalyzeThreat",
     args: [unitId, playerId],
     id: "uuid",
     async: true
   }

3. Bridge → External Service (HTTP POST)
   URL: http://localhost:3000/analyze
   Headers: Content-Type: application/json
   Body: {"args": [unitId, playerId], "id": "uuid"}

4. External Service → Bridge (HTTP Response)
   Body: {"result": {"threatLevel": "high", "recommendation": "retreat"}}

5. Bridge → DLL (Winsock IPC)
   Message: {
     type: "external_response",
     id: "uuid",
     success: true,
     result: {"threatLevel": "high", "recommendation": "retreat"}
   }

6. DLL → Lua Environment
   Return: Game.CallExternal() callback receives the result object or returns it (if synchronous)
```

### 3. Game Events Streaming

**Event Registration & Broadcasting**
```
1. External Service → GET /events
   Headers: Accept: text/event-stream
   (Establishes SSE connection)

2. Lua Environment → Bridge.SendEvent("turnStart", {...})
   (Called from game event handlers)

3. DLL → Bridge (Winsock IPC)
   Message: {
     type: "game_event",
     event: "turnStart",
     payload: {
       player: 1,
       turn: 50,
       year: "500 AD"
     },
     timestamp: "2024-01-01T12:00:00Z"
   }

4. Bridge → All SSE Clients
   SSE Stream:
   event: turnStart
   data: {"type": "turnStart", "player": 1, "turn": 50, "year": "500 AD", "timestamp": "2024-01-01T12:00:00Z"}
```

## Message Format Specifications

### Winsock IPC Messages (Bridge ↔ DLL)

**Lua Function Call Request**
```json
{
  "type": "lua_call",
  "function": "string",
  "args": ["array", "of", "arguments"],
  "id": "uuid-string"
}
```

**Lua Script Execute Request**
```json
{
  "type": "lua_execute",
  "script": "lua-code-string",
  "id": "uuid-string"
}
```

**Lua Response**
```json
{
  "type": "lua_response",
  "id": "uuid-string",
  "success": boolean,
  "result": "any-value",
  "error": {
    "code": "ERROR_CODE",
    "message": "string",
    "details": "string"
  }
}
```

**External Function Call**
```json
{
  "type": "external_call",
  "function": "string",
  "args": ["array"],
  "id": "uuid-string",
  "async": boolean
}
```

**External Function Response**
```json
{
  "type": "external_response",
  "id": "uuid-string",
  "success": boolean,
  "result": "any-value",
  "error": {
    "code": "string",
    "message": "string"
  }
}
```

**Game Event**
```json
{
  "type": "game_event",
  "event": "event-name",
  "payload": {"event": "data"},
  "timestamp": "ISO-8601-timestamp"
}
```

**External Function Registration**
```json
{
  "type": "external_register",
  "name": "string",
  "async": boolean
}
```

### HTTP API Responses

**Success Response**
```json
{
  "success": true,
  "result": "any-value"
}
```

**Error Response**
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

## Error Handling

### Error Codes

- **DLL_DISCONNECTED**: Bridge service lost connection to game DLL
- **LUA_EXECUTION_ERROR**: Lua script or function execution failed
- **EXTERNAL_CALL_TIMEOUT**: External service call exceeded timeout limit
- **EXTERNAL_CALL_FAILED**: External service returned error or non-200 status
- **INVALID_FUNCTION**: Requested function not registered or available
- **INVALID_SCRIPT**: Malformed or invalid Lua script
- **INVALID_ARGUMENTS**: Function called with wrong number or type of arguments
- **NETWORK_ERROR**: Network connectivity issues
- **SERIALIZATION_ERROR**: Failed to serialize/deserialize data

### Timeout Behavior

- **Lua Function Calls**: Default 10 second timeout
- **External Function Calls**: Configurable per function (default 5 seconds)
- **DLL Communication**: 30 second timeout for socket operations
- **SSE Connections**: Keep-alive every 30 seconds

### Connection Recovery

**DLL Connection Loss**
```
1. Bridge detects Winsock/IPC disconnection
2. Bridge enters retry mode with exponential backoff
3. All pending requests fail with DLL_DISCONNECTED
4. Health check endpoint reports dll_connected: false
5. Upon reconnection, Bridge re-registers all external functions
```

**External Service Unavailable**
```
1. HTTP call to external service fails
2. Bridge returns error to Lua via DLL
3. Service remains registered for future calls
4. No automatic retry (handled by calling Lua code)
```

## Security Considerations

- **Lua Script Execution**: `/lua/execute` endpoint allows arbitrary code execution
- **External Function Registration**: URLs should be validated and sanitized
- **Timeout Management**: Prevents resource exhaustion from hanging calls
- **Connection Validation**: IPC connection authenticated by process ownership
- **Request Size Limits**: HTTP requests limited to prevent DoS attacks
