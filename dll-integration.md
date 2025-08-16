# Vox Deorum DLL Integration Plan

## Executive Summary
This document outlines the minimal-change strategy for integrating Named Pipe IPC communication into the Community Patch DLL to enable bidirectional communication with the Bridge Service.

The implementation is separate into several stages. In each stage, focus on faithfully carring out the plan without over thinking. Then, plan the additional features for the next stage. 

## Code Requirements
The C++ code must:
1. Work with 32-bit Windows C++ (Visual Studio 2008 SP1 toolset)
2. Make minimal changes to existing Community Patch DLL code
3. Utilize existing logging infrastructure
4. Allow graceful degradation if external services are unavailable
5. Since Civilization only works on Windows, no need for other platform support

## Protocol Requirements
Follow the `bridge-service/PROTOCOL.md`.

## Stage 1: Initialize the Connection Service
In this stage, initialize the ConnectionService with the bare minimum of structures:
- Setup()
- Shutdown()
- Log(Level, Message)

### Log Example
```
FILogFile* pLog = LOGFILEMGR.GetLog("connection.log", FILogFile::kDontTimeStamp);
if (pLog)
{
    pLog->Msg(Message);
}
```

Then, inject the two functions into relevant entry points within existing game lifecycle.

## Stage 2: Initialize the Minimal Named Pipe Server
The NAMED PIPE server should only listen to message and write into logs, then send the same message back.
- The server should spawn a child thread to wait for the client (Bridge Service) to connect
- The server only intends to serve one client (Bridge Service), hence the listening/responding loop should happen in the same child thread.
- The server should keep track of whether the client is connected and write logs accordingly.

## Stage 3: Event Loop Implementation
Implement a thread-safe message queue system where the SSE thread receives JSON messages, queues them, and the game loop processes them during its update cycle.

### Key Components

#### Thread-Safe Message Queue Structure
Add to CvConnectionService.h:
- GameMessage struct with jsonData and timestamp
- Two message queues: m_incomingQueue (Bridge -> Game) and m_outgoingQueue (Game -> Bridge)
- Two CRITICAL_SECTION objects for thread safety: m_csIncoming and m_csOutgoing
- Public method ProcessMessages() for game loop to call
- Private helper methods: QueueIncomingMessage() and DequeueOutgoingMessage()

#### Initialization Changes
- Setup(): Initialize critical sections with InitializeCriticalSection()
- Shutdown(): Delete critical sections with DeleteCriticalSection()

#### Modified HandleClientConnection
Instead of just logging and echoing:
1. Parse received data as JSON (validate format)
2. Queue message using QueueIncomingMessage()
3. Check outgoing queue for responses using DequeueOutgoingMessage()
4. Send any pending outgoing messages back to Bridge

#### ProcessMessages Implementation
Called from main game thread:
1. Lock incoming queue with critical section
2. Process all queued messages
3. For each message: log it and queue echo response
4. Release locks promptly to avoid blocking SSE thread

#### CvGame Integration
Add call to CvConnectionService::GetInstance().ProcessMessages() in CvGame::update() or similar periodic method

### Thread Safety Strategy
- Two separate critical sections to avoid deadlocks
- Minimal lock duration - quickly enter, operate, exit
- No blocking operations inside critical sections
- SSE thread writes to incoming queue, reads from outgoing queue
- Game thread reads from incoming queue, writes to outgoing queue

### Implementation Steps
1. Add queue structures and critical sections to header
2. Initialize/cleanup critical sections in Setup/Shutdown
3. Implement QueueIncomingMessage and DequeueOutgoingMessage
4. Modify HandleClientConnection to use queues
5. Implement ProcessMessages with logging/echo logic
6. Add ProcessMessages call to CvGame update loop

## Stage 4: JSON Object-Based Message Queue
Convert from string-based to JSON object-based message handling using nlohmann/json library.

### Use ArduinoJson Library
- Use single-header `ArduinoJson.hpp` existed in ThirdPartyLibs directory
- Strip the Node-IPC data packet format {type:"message",data:...} to have parity with the stated protocol.

## Stage 5: Lua Execute Support
Implement the most straightforward Lua execution case - handle `lua_execute` messages from Bridge Service to run arbitrary Lua scripts in the game environment.

### Key Discovery: Game's Lua Integration
The game uses `ICvEngineScriptSystem1` interface (accessed via `gDLL->GetScriptSystem()`) for all Lua operations. We should reuse the game's existing Lua state rather than creating a new one.

### Implementation Components

#### 1. Access Game's Lua State
- Get script system: `ICvEngineScriptSystem1* pkScriptSystem = gDLL->GetScriptSystem()`
- Reuse the game's main Lua thread/state (no need to create new thread)
- The game already manages the Lua state lifecycle

#### 2. Message Type Recognition and Parameter Extraction
In ProcessMessages():
```cpp
if (messageType == "lua_execute") {
    // Extract parameters from JSON message
    const char* script = message["script"];
    const char* id = message["id"];
    
    // Call handler with extracted parameters
    HandleLuaExecute(script, id);
}
```

#### 3. Decoupled Lua Execution Methods
Add to CvConnectionService:
```cpp
// Main handler - receives extracted parameters, not JSON
void HandleLuaExecute(const char* script, const char* id) {
    // Get the game's script system
    ICvEngineScriptSystem1* pkScriptSystem = gDLL->GetScriptSystem();
    
    // Execute using luaL_dostring (defined in lauxlib.h as luaL_loadstring + lua_pcall)
    // This requires getting the raw lua_State pointer
    
    // Call success or error response based on execution result
    if (executionSucceeded) {
        SendLuaSuccessResponse(id, resultValue);
    } else {
        SendLuaErrorResponse(id, errorMessage);
    }
}

// Response builders - reusable for other Lua function calls
void SendLuaSuccessResponse(const char* id, const char* result) {
    // Build success response JSON following PROTOCOL.md
    JsonDocument response;
    response["type"] = "lua_response";
    response["id"] = id;
    response["success"] = true;
    response["result"] = result;
    
    // Queue the response
    QueueOutgoingMessage(response);
}

void SendLuaErrorResponse(const char* id, const char* error) {
    // Build error response JSON following PROTOCOL.md
    JsonDocument response;
    response["type"] = "lua_response";
    response["id"] = id;
    response["success"] = false;
    response["error"] = error;
    
    // Queue the response
    QueueOutgoingMessage(response);
}
```

#### 4. Initialize Lua State
Since ICvEngineScriptSystem1 doesn't expose raw script execution, at thewe need to:
1. At the service scope, create a Lua state through gDLL->GetScriptSystem()->CreateLuaThread()
2. Register related game features via `LuaSupport::RegisterScriptData`
3. Release the state during shutdown

#### 5. Thread Safety Considerations
Follow the game's locking pattern (from LuaSupport):
```cpp
bool bHadLock = gDLL->HasGameCoreLock();
if(bHadLock)
    gDLL->ReleaseGameCoreLock();
// Execute Lua code
if(bHadLock)
    gDLL->GetGameCoreLock();
```

### Response Format
Queue lua_response messages:
```json
{
    "type": "lua_response",
    "id": "original-request-id",
    "success": true,
    "result": "converted-lua-return-value"
}
```

### Error Handling
- Capture Lua error messages
- Return structured error response:
```json
{
    "type": "lua_response",
    "id": "original-request-id",
    "success": false,
    "error": "Lua execution error details"
}
```

### Implementation Steps
1. Add HandleLuaExecute method to CvConnectionService
2. Update ProcessMessages to recognize "lua_execute" message type
3. Initialize service-wide Lua state
4. Run the input lua script in the Lua state
5. Convert Lua return values to JSON
6. Queue response for Bridge Service

## Stage 6: Lua Function Registration System
Implement Game.RegisterFunction() to allow Lua code to register callable functions with the Bridge Service.

### Design Overview
The registration system allows Lua functions to be exposed to external services through the Bridge. When a Lua function is registered, it:
1. Stores the function reference with its lua_State in CvConnectionService
2. Notifies the Bridge Service about the available function
3. Handles duplicates by clearing and overwriting previous registrations
4. Cleans up all registrations on shutdown

### Key Components

#### 1. CvLuaGame Method Addition
Add to CvLuaGame.h:
```cpp
protected:
    static int lRegisterFunction(lua_State* L);
```

Add to CvLuaGame.cpp:
```cpp
// In RegisterMembers()
Method(RegisterFunction);

// Method implementation
int CvLuaGame::lRegisterFunction(lua_State* L) {
    // Get function name from first argument
    const char* functionName = luaL_checkstring(L, 1);
    
    // Verify second argument is a function
    luaL_checktype(L, 2, LUA_TFUNCTION);
    
    // Forward to ConnectionService with lua_State
    CvConnectionService::GetInstance().RegisterLuaFunction(functionName, L, 2);
    
    return 0;  // No return values
}
```

#### 2. CvConnectionService Storage Structure
Add to CvConnectionService.h:
```cpp
private:
    // Structure to store registered Lua functions
    struct LuaFunctionInfo {
        lua_State* pLuaState;      // The Lua state that registered this function
        int iRegistryRef;          // Reference in the Lua registry (LUA_REGISTRYINDEX)
        std::string strDescription; // Optional description for documentation
    };
    
    // Map of function name to function info
    std::map<std::string, LuaFunctionInfo> m_registeredFunctions;
    
    // Critical section for function registry thread safety
    CRITICAL_SECTION m_csFunctions;

public:
    // Register a Lua function for external calling
    void RegisterLuaFunction(const char* name, lua_State* L, int stackIndex);
    
    // Unregister a specific function
    void UnregisterLuaFunction(const char* name);
    
    // Clear all registered functions (called on shutdown)
    void ClearLuaFunctions();
    
private:
    // Send registration notification to Bridge
    void NotifyBridgeOfRegistration(const char* name, const char* description);
```

#### 3. Registration Implementation
```cpp
void CvConnectionService::RegisterLuaFunction(const char* name, lua_State* L, int stackIndex) {
    EnterCriticalSection(&m_csFunctions);
    
    // Check for existing registration and clear it
    auto it = m_registeredFunctions.find(name);
    if (it != m_registeredFunctions.end()) {
        // Clear the old reference from the Lua registry
        luaL_unref(it->second.pLuaState, LUA_REGISTRYINDEX, it->second.iRegistryRef);
        Log(LOG_INFO, "Overwriting existing registration for function: %s", name);
    }
    
    // Create registry reference for the function
    lua_pushvalue(L, stackIndex);  // Push function to top of stack
    int ref = luaL_ref(L, LUA_REGISTRYINDEX);  // Store in registry and get reference
    
    // Store the function info
    LuaFunctionInfo info;
    info.pLuaState = L;
    info.iRegistryRef = ref;
    info.strDescription = "Registered from Lua";  // Could be enhanced with optional description parameter
    
    m_registeredFunctions[name] = info;
    
    LeaveCriticalSection(&m_csFunctions);
    
    // Notify Bridge Service about the new registration
    NotifyBridgeOfRegistration(name, info.strDescription.c_str());
    
    Log(LOG_INFO, "Registered Lua function: %s", name);
}
```

#### 4. Notification to Bridge
```cpp
void CvConnectionService::NotifyBridgeOfRegistration(const char* name, const char* description) {
    // Create notification message following PROTOCOL.md
    DynamicJsonDocument message(512);
    message["type"] = "lua_register";
    message["function"] = name;
    message["description"] = description;
    
    // Queue the message for Bridge
    QueueOutgoingMessage(message);
}
```

#### 5. Cleanup Implementation
```cpp
void CvConnectionService::UnregisterLuaFunction(const char* name) {
    EnterCriticalSection(&m_csFunctions);
    
    auto it = m_registeredFunctions.find(name);
    if (it != m_registeredFunctions.end()) {
        // Clear the Lua registry reference
        luaL_unref(it->second.pLuaState, LUA_REGISTRYINDEX, it->second.iRegistryRef);
        
        // Remove from map
        m_registeredFunctions.erase(it);
        
        Log(LOG_INFO, "Unregistered Lua function: %s", name);
    }
    
    LeaveCriticalSection(&m_csFunctions);
}

void CvConnectionService::ClearLuaFunctions() {
    EnterCriticalSection(&m_csFunctions);
    
    // Clear all Lua registry references
    for (auto& pair : m_registeredFunctions) {
        luaL_unref(pair.second.pLuaState, LUA_REGISTRYINDEX, pair.second.iRegistryRef);
    }
    
    // Clear the map
    m_registeredFunctions.clear();
    
    Log(LOG_INFO, "Cleared all registered Lua functions");
    
    LeaveCriticalSection(&m_csFunctions);
}
```

#### 6. Integration Points
- **Setup()**: Initialize m_csFunctions critical section
- **Shutdown()**: Call ClearLuaFunctions() and delete critical section
- **ProcessMessages()**: Handle "lua_call" messages by looking up registered functions

### Usage from Lua
```lua
-- Register a function for external services to call
Game.RegisterFunction("GetCityInfo", function(cityId)
    local city = Players[Game.GetActivePlayer()]:GetCityByID(cityId)
    if city then
        return {
            name = city:GetName(),
            population = city:GetPopulation(),
            production = city:GetProduction()
        }
    end
    return nil
end)

-- Overwrite with new implementation
Game.RegisterFunction("GetCityInfo", function(cityId)
    -- New implementation automatically replaces the old one
    return GetDetailedCityInfo(cityId)
end)
```

### Thread Safety Guarantees
1. Registration/unregistration protected by critical section
2. Lua registry references ensure function persistence
3. No memory leaks as all references are properly cleared
4. Safe to call from any Lua thread that has access to Game namespace

### Error Handling
1. Invalid function type results in Lua error (luaL_checktype)
2. Missing function name results in Lua error (luaL_checkstring)
3. Duplicate registrations are logged and safely overwritten
4. Bridge communication failures are logged but don't affect registration

### Implementation Steps
1. Add lRegisterFunction to CvLuaGame class
2. Add function storage structures to CvConnectionService
3. Implement RegisterLuaFunction with duplicate handling
4. Add notification system to Bridge
5. Implement cleanup methods
6. Integrate cleanup with shutdown sequence