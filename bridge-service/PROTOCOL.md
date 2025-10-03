# Communication Protocol

This document describes the complete communication protocol between the Community Patch DLL, Bridge Service, and external AI services in the Vox Deorum system.

## Overview

The Bridge Service acts as a communication hub using three primary channels:
- **Named Pipe**: Named pipe connection to the Community Patch DLL (using node-ipc)
- **HTTP REST API**: Endpoints for external services to call Lua functions and manage registrations
- **Server-Sent Events (SSE)**: Real-time event streaming to external clients

### Named Pipe Communication Details

- **Pipe Name**: `\\.\pipe\tmp-app.vox-deorum-bridge` (configurable via `VOX_DEORUM_PIPE_NAME` environment variable)
- **Message Format**: JSON messages delimited by `!@#$%^!`
- **Batching**: Multiple messages can be sent in a single pipe write, separated by the delimiter
- **Queue Management**: Outgoing messages are queued if the pipe is busy, with throttling at 5+ queued messages

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
     "url": "http://127.0.0.1:4000/analyze",
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

#### Game Pause/Resume

##### Manual Pause Game

1. **External service → POST /external/pause**
   ```json
   {}
   ```

2. **Bridge → External Service**
   ```json
   {"success": true}
   ```

##### Manual Resume Game

1. **External service → POST /external/resume**
   ```json
   {}
   ```

2. **Bridge → External Service**
   ```json
   {"success": true}
   ```

##### Register Player for Auto-Pause

1. **External service → POST /external/pause-player/:id**
   ```json
   {}
   ```

2. **Bridge → External Service**
   ```json
   {
     "success": true,
     "pausedPlayers": [0, 2, 5]
   }
   ```

3. **Bridge → DLL (Named Pipe)**
   ```json
   {"type": "pause_player", "playerID": 2}
   ```

4. **DLL updates internal pause state**
   - Adds player ID to m_pausedPlayers set
   - Message processing will pause when this player becomes active

##### Unregister Player from Auto-Pause

1. **External service → DELETE /external/pause-player/:id**
   ```json
   {}
   ```

2. **Bridge → External Service**
   ```json
   {
     "success": true,
     "pausedPlayers": [0, 5]
   }
   ```

3. **Bridge → DLL (Named Pipe)**
   ```json
   {"type": "unpause_player", "playerID": 2}
   ```

4. **DLL updates internal pause state**
   - Removes player ID from m_pausedPlayers set
   - Message processing resumes if this was the blocking player

##### Get Paused Players List

1. **External service → GET /external/paused-players**

2. **Bridge → External Service**
   ```json
   {
     "success": true,
     "pausedPlayers": [0, 2, 5],
     "isGamePaused": true
   }
   ```

##### Clear All Paused Players

1. **External service → DELETE /external/paused-players**

2. **Bridge → External Service**
   ```json
   {
     "success": true,
     "pausedPlayers": []
   }
   ```

3. **Bridge → DLL (Named Pipe)**
   ```json
   {"type": "clear_paused_players"}
   ```

4. **DLL clears internal pause state**
   - Clears entire m_pausedPlayers set
   - Message processing resumes immediately

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
   URL: http://127.0.0.1:4000/analyze
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

   Note: For error responses, the format is:
   ```json
   {
     "type": "external_response",
     "id": "uuid",
     "success": false,
     "error": {
       "code": "ERROR_CODE"
     }
   }
   ```

6. **DLL → Lua Environment**
   - For sync calls: Game.CallExternal() returns (result, error)
   - For async calls: Callback receives (result, error)

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
     "payload": {
       "playerID": 1,
       "turn": 50,
       "// other properties": "based on event schema"
     }
   }
   ```

   **Event ID Format**: Number with structure `(turn * 1000000) + eventSequence`
   - Turn number (no padding) followed by 6-digit event sequence
   - Event sequence is NOT zero-padded - just the actual sequence number
   - Example: `1000001` = Turn 1, Event 1
   - Example: `123004567` = Turn 123, Event 4567
   - The event counter resets to 1 at the beginning of each turn
   - The event counter is persisted between game saves/loads

   **Event Payload Structure**:
   - Events have property schemas defined in C++
   - The payload contains named properties based on the event's schema
   - Arrays in events are sent as: count property followed by array items
   - Boolean properties marked with `!` prefix in schema are converted from int to boolean
   - Events without schemas or arguments are skipped

   **Blacklisted Events**:
   The following high-frequency or less useful events are NOT forwarded:
   - GameCoreUpdateBegin, GameCoreUpdateEnd
   - GameCoreTestVictory
   - PlayerPreAIUnitUpdate
   - BattleStarted, BattleJoined, BattleFinished, CombatEnded
   - PlayerEndTurnInitiated, PlayerEndTurnCompleted
   - UnitPrekill
   - GatherPerTurnReplayStats
   - TerraformingPlot
   - GameSave
   - CityPrepared
   - UnitGetSpecialExploreTarget
   - PlayerCityFounded
   - TeamSetHasTech
   - BarbariansSpawnedUnit
   - TileRevealed (from non-major civs only)

4. **Bridge → All SSE Clients**
   ```
   event: turnStart
   data: {"id": 1000001, "type": "turnStart", "payload": ...}
   ```

#### Auto-Pause on Player Turn Events

The Bridge Service automatically handles game pausing based on registered paused players:

1. **PlayerDoTurn Event**
   - Bridge receives event with `PlayerID` in payload
   - Calls `gameMutexManager.setActivePlayer(PlayerID)`
   - If player is in paused list, game auto-pauses
   - If player is not in paused list and no manual pause, game auto-resumes

2. **PlayerDoneTurn Event**
   - Bridge receives event with `NextPlayerID` in payload
   - Calls `gameMutexManager.setActivePlayer(NextPlayerID)`
   - Same auto-pause/resume logic applies for the next player

3. **DLL Disconnection**
   - On disconnect, Bridge clears all paused players
   - Prevents stuck pauses when game restarts

#### DLL Message Processing Pause Behavior

When the DLL receives pause/unpause messages, it maintains an internal set of paused player IDs:

1. **Message Processing Loop**
   - The DLL's `ProcessMessages()` function checks if any active player is in the paused set
   - If paused: Blocks the game core thread, sleeping 20ms between checks, but still process messages

2. **Pause Check Logic**
   - For regular turns: Checks if current player (GetActivePlayer) is paused
   - For simultaneous turns: Checks if ANY turn-active player is paused
   - Uses `ShouldPauseGameCore()` utility function for centralized logic

3. **Auto-Clear on Disconnect**
   - When Named Pipe disconnects, DLL automatically clears m_pausedPlayers set
   - Ensures game doesn't remain paused if Bridge Service crashes

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
