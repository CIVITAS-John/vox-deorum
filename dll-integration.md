# Vox Deorum DLL Integration Plan

## Executive Summary
This document outlines the strategy for integrating Named Pipe IPC communication into the Community Patch DLL, enabling bidirectional communication between Civilization V and the Bridge Service. The implementation follows a minimal-change approach with staged development to ensure stability and maintainability.

## Architecture Overview
The integration establishes a Named Pipe server within the game DLL that communicates with the Bridge Service using JSON messages. The system operates asynchronously, with a dedicated thread handling network communication while the main game thread processes messages through a thread-safe queue system.

## Implementation Stages

### Stage 1: Connection Service Foundation ✓
Established the core ConnectionService singleton with lifecycle management integrated into the game's initialization and shutdown sequences. The service provides centralized logging through the game's existing infrastructure and gracefully handles scenarios where external services are unavailable.

### Stage 2: Named Pipe Server ✓
Implemented a Windows Named Pipe server that spawns a dedicated thread to handle client connections. The server maintains a single connection to the Bridge Service, managing the connection lifecycle with appropriate logging and error handling. Initial implementation focuses on echo functionality to validate the communication channel.

### Stage 3: Thread-Safe Message Queue System ✓
Developed a bidirectional message queue architecture that separates network I/O from game logic processing. The system uses Windows critical sections to ensure thread safety, with the network thread handling incoming messages and the game thread processing them during its update cycle. This design prevents blocking operations from affecting game performance.

### Stage 4: JSON Message Processing ✓
Integrated ArduinoJson library for robust JSON parsing and generation. The implementation strips Node-IPC wrapper format to maintain protocol compatibility with the Bridge Service. Messages are validated and processed as structured JSON objects rather than raw strings, enabling type-safe communication.

### Stage 5: Lua Script Execution ✓
Implemented support for executing arbitrary Lua scripts sent from the Bridge Service. The system leverages the game's existing Lua infrastructure through the ICvEngineScriptSystem1 interface, maintaining a dedicated Lua state registered with game bindings. Execution results are captured and returned as structured JSON responses, with proper error handling for script failures.

Key achievements:
- Direct integration with game's Lua environment
- Thread-safe execution with game core locking
- Structured response format for both success and error cases
- Proper Lua state lifecycle management

### Stage 6: Lua Function Registration System ✓
Created a comprehensive system for Lua code to register callable functions with the Bridge Service through Game.RegisterFunction(). The implementation provides:

**Core Functionality:**
- Dynamic function registration from Lua scripts
- Automatic duplicate handling with safe overwriting
- Lua registry references for function persistence
- Thread-safe storage and retrieval mechanisms

**Integration Points:**
- CvLuaGame exposes RegisterFunction, UnregisterFunction, and ClearRegisteredFunctions to Lua
- CvConnectionService manages function storage and execution
- Bridge Service receives notifications about available functions
- Clean shutdown process prevents memory leaks

**Usage Pattern:**
Lua scripts can register functions that external services can invoke, enabling dynamic gameplay extensions without modifying core game code. The system handles parameter passing and return value conversion between Lua and JSON formats.

### Stage 7: Lua Function Calling Implementation ✓
Implemented the ability for the Bridge Service to call registered Lua functions through the Named Pipe connection, following the protocol specifications in PROTOCOL.md.

**Achievements:**
- Process incoming lua_call messages from the Bridge Service
- Retrieve and execute registered Lua functions by name
- Marshal JSON parameters to Lua and convert Lua return values to JSON
- Send structured lua_response messages back with results or errors
- Thread-safe execution within game's Lua context

**Implementation Details:**
- CvConnectionService::ProcessLuaCall() method handles lua_call message type
- Parameter conversion from JSON array to Lua stack arguments
- Support for multiple return values from Lua functions
- Comprehensive error handling for missing functions or execution failures
- Proper synchronization with game's Lua execution context

**Protocol Compliance:**
- Incoming: `{"type": "lua_call", "id": "...", "payload": {"function": "name", "args": [...]}}`
- Outgoing: `{"type": "lua_response", "id": "...", "payload": {"success": true/false, "result": value/error}}`

This stage completes the bidirectional Lua integration, allowing external services to invoke game logic dynamically through registered functions.

### Stage 8: Game Event Forwarding via LuaSupport::CallHook ✓
Implemented automatic forwarding of game events from the DLL to the Bridge Service by intercepting LuaSupport::CallHook. External services can now monitor game events in real-time via Server-Sent Events (SSE).

**Achievements:**
- Intercept and forward all game events through CallHook
- Non-blocking event forwarding with minimal performance impact
- Event filtering system to exclude high-frequency events
- Structured game_event messages with timestamps and payloads
- Fixed-size event buffers (2KB) for memory efficiency

**Protocol Compliance:**
- Outgoing: `{"type": "game_event", "event": "name", "timestamp": "...", "payload": {...}}`

### Stage 9: External Function Call System ✓
Enable Lua scripts to call external functions registered through the Bridge Service, allowing the game to invoke AI services, external analytics, or other HTTP endpoints directly from Lua code.

**Achievements:**
- Implemented Game.CallExternal() and Game.IsExternalRegistered() Lua APIs
- Process external_register/external_unregister messages from Bridge Service
- Support for both synchronous and asynchronous call patterns with callbacks
- Full JSON marshaling between Lua arguments and external service responses
- Thread-safe external function registry with proper lifecycle management

**Implementation Details:**

**External Function Registry:**
- CvConnectionService maintains std::map of registered external functions
- EnterCriticalSection/LeaveCriticalSection ensures thread safety
- RegisterExternalFunction/UnregisterExternalFunction handle Bridge notifications
- IsExternalFunctionRegistered provides safe registry queries

**Lua API Implementation:**
- `Game.CallExternal(name, args, [callback])` - Call external function with optional async callback
- `Game.IsExternalRegistered(name)` - Check if external function is available
- Automatic detection of async calls based on callback presence
- Lua registry references maintain callback persistence across async operations

**Message Processing:**
- Unique call IDs generated using thread ID, tick count, and counter
- PendingExternalCall structure tracks in-flight async calls
- external_call messages sent with proper JSON serialization of Lua arguments
- external_response messages parsed and results converted back to Lua values

**Protocol Compliance:**
- Incoming: `{"type": "external_register", "name": "...", "async": true/false}`
- Outgoing: `{"type": "external_call", "id": "...", "function": "...", "args": {...}}`
- Incoming: `{"type": "external_response", "id": "...", "success": true/false, "result": {...}}`

**Error Handling:**
- Validation ensures function is registered before calling
- Graceful degradation when Bridge Service unavailable
- Clear error messages propagated to Lua callbacks
- Memory-safe callback cleanup with proper reference management

**Usage Example:**
```lua
-- Check if external function is registered
if Game.IsExternalRegistered("AnalyzeThreat") then
    -- Async call with callback
    Game.CallExternal("AnalyzeThreat", 
        {unitId = 5, playerId = 1}, 
        function(success, result)
            if success then
                print("Threat level: " .. result.threatLevel)
            else
                print("Analysis failed: " .. result)
            end
        end
    )
end
```

This stage completes the bidirectional external service integration, enabling Lua scripts to leverage AI capabilities and external processing through a clean, type-safe API.

## Technical Constraints & Solutions

### Platform Requirements
- 32-bit Windows compatibility maintained throughout
- Visual Studio 2008 SP1 toolset constraints respected
- No external dependencies beyond single-header libraries

### Thread Safety Strategy
- Separate critical sections for different data structures to prevent deadlocks
- Minimal lock duration with no blocking operations inside critical sections
- Clear ownership model: network thread writes incoming, game thread writes outgoing

### Error Handling Philosophy
- Graceful degradation when Bridge Service unavailable
- Comprehensive logging without affecting game stability
- Structured error responses maintaining protocol compliance

## Communication Protocol
The implementation strictly follows bridge-service/PROTOCOL.md specifications:
- Message types: lua_execute, lua_call, lua_response, lua_register, lua_unregister, lua_clear
- Consistent JSON structure with type, id, and payload fields
- Asynchronous response pattern with correlation IDs

## Integration Points
The system integrates minimally with existing game code:
- CvGame::InitGame() calls Setup()
- CvGame::uninit() calls Shutdown()  
- CvGame update loop calls ProcessMessages()
- CvLuaGame namespace extended with registration methods

## Future Considerations
The architecture supports future enhancements without major refactoring:
- Additional message types for game state queries
- Performance metrics and monitoring
- Extended Lua API surface for external control
- Potential migration to more modern IPC mechanisms

## Summary
The implementation successfully establishes a robust communication channel between Civilization V and external services while maintaining code quality, performance, and stability. The staged approach allowed for incremental validation and testing, resulting in a production-ready integration that enables AI-enhanced gameplay through the Vox Deorum system.