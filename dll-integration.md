# Vox Deorum DLL Integration Strategy

## Executive Summary
This document outlines the minimal-change strategy for integrating Winsock-based IPC communication into the Community Patch DLL to enable bidirectional communication with the Bridge Service.

## Code Requirements
The C++ code must:
1. Work with 32-bit Windows C++ (Visual Studio 2008 SP1 toolset)
2. Make minimal changes to existing Community Patch DLL code
3. Be compatible with the existing logging infrastructure
4. Allow graceful degradation if external services are unavailable 

## Architecture Overview

### Communication Flow
```
Civ 5 Game → Community Patch DLL → IPC (Named Pipes/Sockets) → Bridge Service
                    ↑                                              ↓
                Lua Scripts                                  REST API + SSE
                                                                   ↓
                                                            External Services
```

### Protocol Requirements
Based on Bridge Service analysis (`bridge-service/src/services/dll-connector.ts`):
- **IPC Type**: Windows Named Pipes
- **Message Format**: UTF-8 JSON strings
- **Connection ID**: `"civ5"`
- **Message Types**:
  - From DLL: `lua_response`, `external_call`, `game_event`, `lua_register`
  - To DLL: `lua_call`, `lua_execute`, `external_register`, `external_unregister`, `external_response`

## Implementation Strategy - Staged Approach

### Stage 1: Proof of Concept - Basic Hook & Logging (1 day)
**Goal**: Minimal DLL modification to prove we can hook into the game with simple file logging

#### Implementation:
1. **Simple File Logging Approach**
   - Create minimal logging function to write to a dedicated file
   - No dependency on complex logging frameworks
   - Write to `Logs/VoxDeorum.log` file
   
2. **Hook Points**:
   ```cpp
   // Add to CvGame.cpp - simple file logging function
   void LogVoxDeorum(const char* format, ...) {
       static FILE* logFile = NULL;
       if (!logFile) {
           logFile = fopen("Logs/VoxDeorum.log", "a");
           if (!logFile) return;
       }
       
       va_list args;
       va_start(args, format);
       vfprintf(logFile, format, args);
       va_end(args);
       fprintf(logFile, "\n");
       fflush(logFile);
   }
   
   // In appropriate game loop method - add logging
   LogVoxDeorum("VoxDeorum: Turn %d, Active Player %d", 
                getGameTurn(), getActivePlayer());
   ```

3. **Success Criteria**:
   - DLL compiles with modifications
   - Game runs without crashes
   - "VoxDeorum.log" file created with game state entries
   - Verify we can read game state through logging

### Stage 2: Bridge Connection - Hello World (2 days)
**Goal**: Establish basic socket connection to Bridge Service

#### Implementation:
1. **Create Basic Connector**
   ```cpp
   // CvBridgeConnector.h - Simplified version
   class CvBridgeConnector {
   public:
       static CvBridgeConnector& GetInstance();
       bool Initialize();  // Just connect
       void Shutdown();    // Just disconnect
       bool SendHelloWorld();  // Send simple test message
   private:
       SOCKET m_socket;
       bool m_bConnected;
   };
   ```

2. **Integration Points**:
   - DLL initialization: Connect to Bridge
   - Game update: Send periodic "hello" messages
   - DLL cleanup: Disconnect

3. **Success Criteria**:
   - Socket connection established to Bridge Service
   - Bridge Service receives and logs "hello world" messages
   - Game continues to run normally

### Stage 3: Bidirectional Communication (2 days)
**Goal**: Send and receive JSON messages

#### Implementation:
1. **Add Message Queue**
   ```cpp
   class CvBridgeConnector {
       // ... previous methods ...
       void ProcessMessages();
       bool SendMessage(const std::string& type, const std::string& data);
   private:
       std::queue<std::string> m_messageQueue;
       std::thread m_receiveThread;
   };
   ```

2. **JSON Support**:
   - Add lightweight JSON library
   - Parse incoming messages
   - Format outgoing messages

3. **Success Criteria**:
   - Can send structured JSON messages
   - Can receive and process responses
   - Message queue operates without blocking game

### Stage 4: Game Event Reporting (2 days)
**Goal**: Send meaningful game events to Bridge Service

#### Implementation:
1. **Event Hooks**:
   ```cpp
   // Hook into existing game events
   void CvPlayer::doTurn() {
       // Existing code...
       CvBridgeConnector::GetInstance().SendGameEvent("player_turn", 
           FormatPlayerData(this));
   }
   ```

2. **Event Types**:
   - `game_start`
   - `player_turn`
   - `unit_moved`
   - `city_founded`
   - `tech_researched`

3. **Success Criteria**:
   - Bridge Service receives game events
   - Events contain correct game state data
   - No performance impact on game

### Stage 5: Lua Integration - Basic (2 days)
**Goal**: Expose simple functions to Lua scripts

#### Implementation:
1. **Add Lua Functions**:
   ```cpp
   // In CvLuaGame.cpp
   Method(IsVoxConnected);  // Game.IsVoxConnected()
   Method(SendVoxEvent);    // Game.SendVoxEvent(type, data)
   ```

2. **Lua Test Scripts**:
   ```lua
   if Game.IsVoxConnected() then
       Game.SendVoxEvent("test", "Hello from Lua")
   end
   ```

3. **Success Criteria**:
   - Lua scripts can check connection status
   - Lua scripts can send events
   - Bridge Service receives Lua-originated messages

### Stage 6: External Function Calls (3 days)
**Goal**: Allow Lua to call external functions and get responses

#### Implementation:
1. **Synchronous Calls**:
   ```cpp
   int CvLuaGame::lCallExternal(lua_State* L) {
       const char* function = lua_tostring(L, 1);
       const char* args = lua_tostring(L, 2);
       
       std::string result;
       if (CvBridgeConnector::GetInstance().CallExternal(function, args, result)) {
           lua_pushstring(L, result.c_str());
           return 1;
       }
       
       lua_pushnil(L);
       return 1;
   }
   ```

2. **Timeout Handling**:
   - Implement timeout mechanism
   - Graceful fallback if no response

3. **Success Criteria**:
   - Lua can call external functions
   - Responses are received and returned
   - Timeouts don't freeze game

### Stage 7: Full Protocol Implementation (2 days)
**Goal**: Support all message types defined in Bridge Service protocol

#### Implementation:
1. **Message Types**:
   - `lua_response`
   - `external_call`
   - `game_event`
   - `lua_register`
   - Handle incoming: `lua_call`, `lua_execute`, etc.

2. **Error Handling**:
   - Comprehensive error recovery
   - Logging for debugging
   - Graceful degradation

3. **Success Criteria**:
   - All protocol messages supported
   - Robust error handling
   - Full bidirectional communication

### Stage 8: Performance Optimization (2 days)
**Goal**: Ensure no impact on game performance

#### Implementation:
1. **Optimizations**:
   - Message batching
   - Async processing
   - Memory pooling
   - Connection retry logic

2. **Performance Testing**:
   - Measure game FPS impact
   - Memory usage monitoring
   - Stress testing with many messages

3. **Success Criteria**:
   - No noticeable FPS drop
   - Memory usage stable
   - Handles high message volume

### Stage 9: Production Hardening (2 days)
**Goal**: Production-ready code with full error handling

#### Implementation:
1. **Feature Toggles**:
   ```cpp
   #ifdef VOX_DEORUM_ENABLED
   CvBridgeConnector::GetInstance().Initialize();
   #endif
   ```

2. **Comprehensive Testing**:
   - Unit tests for all components
   - Integration tests with Bridge Service
   - Game stability testing
   - Memory leak detection

3. **Documentation**:
   - Code documentation
   - Integration guide
   - Troubleshooting guide

4. **Success Criteria**:
   - Can be disabled via compile flag
   - All edge cases handled
   - Production-ready quality

## Detailed Implementation Files

### Stage 1 Files: Proof of Concept

**No new files needed!** - We leverage existing Civ5 logging infrastructure

#### Direct Integration Using Existing Logging
```cpp
// CvGame.cpp - Add to existing update() method
void CvGame::update() {
    // Existing code...
    
    // Add single line using existing CUSTOMLOG macro
    CUSTOMLOG("VoxDeorum: Turn %d, Active Player %d, Game State %d", 
              getGameTurn(), getActivePlayer(), getGameState());
    
    // For more detailed logging in debug builds:
    #ifdef _DEBUG
    if (getGameTurn() % 10 == 0) {  // Log every 10 turns
        CUSTOMLOG("VoxDeorum: NumCities=%d, NumUnits=%d", 
                  GET_PLAYER(getActivePlayer()).getNumCities(),
                  GET_PLAYER(getActivePlayer()).getNumUnits());
    }
    #endif
    
    // Continue with existing code...
}

// CvPlayer.cpp - Hook into existing player turn processing
void CvPlayer::doTurn() {
    // Existing code...
    
    // Add logging using existing infrastructure
    if (isAlive() && !isBarbarian()) {
        CUSTOMLOG("VoxDeorum: Player %d turn start - Gold=%d, Science=%d", 
                  GetID(), GetTreasury()->GetGold(), 
                  GetScienceYieldFromMinorAllies());
    }
    
    // Continue with existing code...
}
```

### Stage 2-9 Progressive Implementation

Each stage builds upon the previous one, with the CvBridgeConnector class gradually expanding in functionality.

## Integration Points by Stage

### Stage 1: Integration Points (Minimal)
```cpp
// CvGame.cpp - In update() - Uses existing logging, no new includes needed
CUSTOMLOG("VoxDeorum: Turn %d, Active Player %d", getGameTurn(), getActivePlayer());

// CvPlayer.cpp - In doTurn() - Optional additional logging
if (isAlive() && !isBarbarian()) {
    CUSTOMLOG("VoxDeorum: Player %d turn", GetID());
}
```

### Stage 2-3: Integration Points (Connection)
```cpp
// CvGameCoreDLL.cpp - DllMain
case DLL_PROCESS_ATTACH:
    CvBridgeConnector::GetInstance().Initialize();
    break;
case DLL_PROCESS_DETACH:
    CvBridgeConnector::GetInstance().Shutdown();
    break;

// CvGame.cpp - In update()
CvBridgeConnector::GetInstance().ProcessMessages();
```

### Stage 5-6: Lua Integration Points
```cpp
// CvLuaGame.cpp - RegisterMembers()
Method(IsVoxConnected);   // Stage 5
Method(SendVoxEvent);      // Stage 5  
Method(CallExternal);      // Stage 6
```

## Testing Strategy by Stage

### Stage 1 Testing:
1. Compile DLL with minimal changes
2. Run game, check logs for "VoxDeorum" entries
3. Verify no crashes or performance impact

### Stage 2 Testing:
1. Start Bridge Service in test mode
2. Launch game with modified DLL
3. Check Bridge Service logs for connection
4. Verify "hello world" messages received

### Stage 3-4 Testing:
1. Send test JSON messages both directions
2. Monitor game event flow
3. Check message queue performance

### Stage 5-6 Testing:
1. Create Lua test scripts
2. Test synchronous external calls
3. Verify timeout handling

### Stage 7-9 Testing:
1. Full protocol compliance testing
2. Performance benchmarking
3. Memory leak detection
4. Production stress testing

## Technical Implementation Details

### IPC Communication Options

#### Windows Named Pipes Approach (Recommended)
```cpp
// CvBridgeConnector.cpp - Connection setup
void CvBridgeConnector::ConnectToBridge() {
    // Create named pipe client
    std::wstring pipeName = L"\\\\.\\pipe\\civ5";
    HANDLE hPipe = CreateFile(
        pipeName.c_str(),
        GENERIC_READ | GENERIC_WRITE,
        0,
        NULL,
        OPEN_EXISTING,
        FILE_FLAG_OVERLAPPED,
        NULL
    );
    
    if (hPipe != INVALID_HANDLE_VALUE) {
        m_bConnected = true;
        // Start receive thread
        m_receiveThread = std::thread(&CvBridgeConnector::ReceiveLoop, this);
    }
}
```

#### Alternative: TCP Socket Approach
```cpp
// CvBridgeConnector.cpp - TCP connection
void CvBridgeConnector::ConnectToBridge() {
    WSADATA wsaData;
    WSAStartup(MAKEWORD(2, 2), &wsaData);
    
    m_socket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    
    sockaddr_in serverAddr;
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_port = htons(8081);  // Bridge service IPC port
    serverAddr.sin_addr.s_addr = inet_addr("127.0.0.1");
    
    if (connect(m_socket, (sockaddr*)&serverAddr, sizeof(serverAddr)) == 0) {
        m_bConnected = true;
        // Start receive thread
        m_receiveThread = std::thread(&CvBridgeConnector::ReceiveLoop, this);
    }
}
```

### 4. Message Protocol

#### Message Structure
```json
{
    "type": "external_call",
    "id": "uuid-v4-string",
    "function": "AnalyzeThreat",
    "args": {
        "unitId": 5,
        "position": [10, 20]
    }
}
```

#### JSON Processing
Use lightweight JSON library (nlohmann/json):
```cpp
#include <nlohmann/json.hpp>
using json = nlohmann::json;

void CvBridgeConnector::HandleIncomingMessage(const std::string& message) {
    try {
        json msg = json::parse(message);
        std::string type = msg["type"];
        
        if (type == "lua_call") {
            HandleLuaCall(msg);
        } else if (type == "external_response") {
            HandleExternalResponse(msg);
        }
        // ... other message types
    } catch (const std::exception& e) {
        // Log error
    }
}
```

### 5. Error Handling & Graceful Degradation

```cpp
// Ensure game continues if Bridge Service unavailable
bool CvBridgeConnector::CallExternal(const std::string& function, 
                                      const std::string& args, 
                                      std::string& result) {
    if (!IsConnected()) {
        // Return error gracefully
        result = "Bridge Service not available";
        return false;
    }
    
    // Send message with timeout
    if (!SendMessageWithTimeout(message, 5000)) {
        result = "Call timeout";
        return false;
    }
    
    return true;
}
```

### 6. Build System Integration

#### Visual Studio Project Modifications
Add to `CvGameCoreDLL_Expansion2.vcxproj`:
```xml
<ItemGroup>
    <ClCompile Include="CvBridgeConnector.cpp" />
</ItemGroup>
<ItemGroup>
    <ClInclude Include="CvBridgeConnector.h" />
</ItemGroup>
```

#### Dependencies
- Windows: `ws2_32.lib` for Winsock
- JSON library: Include as header-only or link static library

### 7. Testing Strategy

1. **Unit Testing**: Test CvBridgeConnector independently
2. **Integration Testing**: Use `mock-dll-server.ts` from Bridge Service
3. **Game Testing**: 
   - Start Bridge Service
   - Launch Civ V with modified DLL
   - Execute Lua test scripts
   - Monitor Bridge Service logs

## Timeline Summary

### Total Duration: ~20 days

| Stage | Duration | Description |
|-------|----------|-------------|
| Stage 1 | 1 day | Proof of Concept - Basic logging |
| Stage 2 | 2 days | Bridge Connection - Hello World |
| Stage 3 | 2 days | Bidirectional Communication |
| Stage 4 | 2 days | Game Event Reporting |
| Stage 5 | 2 days | Lua Integration - Basic |
| Stage 6 | 3 days | External Function Calls |
| Stage 7 | 2 days | Full Protocol Implementation |
| Stage 8 | 2 days | Performance Optimization |
| Stage 9 | 2 days | Production Hardening |
| Buffer | 2 days | Testing & Bug Fixes |

### Milestones

1. **Week 1**: Stages 1-3 - Basic connectivity established
2. **Week 2**: Stages 4-6 - Core functionality working
3. **Week 3**: Stages 7-8 - Full features implemented
4. **Week 4**: Stage 9 + Testing - Production ready

## Risk Mitigation

1. **Staged Approach**: Each stage is independently testable
2. **Minimal Code Changes**: Start with <5 lines in Stage 1
3. **Graceful Degradation**: Game functions normally at every stage
4. **Feature Toggle**: Compile flag from Stage 9
5. **Backward Compatibility**: No changes to existing game logic
6. **Early Validation**: Proof of concept in Stage 1 validates approach

## File Impact Summary by Stage

### Stage 1 (Proof of Concept):
**New Files** (0):
- None - uses existing logging infrastructure

**Modified Files** (1-2):
- `CvGame.cpp` - 1-3 lines added (CUSTOMLOG statements)
- `CvPlayer.cpp` (optional) - 2-3 lines added for additional logging

### Stages 2-9 (Full Implementation):
**New Files** (2):
- `CvBridgeConnector.h` (~100-150 lines)
- `CvBridgeConnector.cpp` (~400-500 lines)

**Modified Files** (3-4):
- `CvGameCoreDLL.cpp` - 4-6 lines added
- `CvGame.cpp` - 1-2 lines added
- `CvLuaGame.cpp` - ~50-100 lines added
- Project files - build configuration

**Total Progressive Impact**: 
- Stage 1: ~3-6 lines total (only CUSTOMLOG statements in existing files)
- Stage 2: +100 lines (new CvBridgeConnector files)
- Stage 3-9: +500 lines progressively
- Final: ~600-700 lines of new code, <15 lines modified in existing files

## Stage Gating Criteria

Each stage must meet its success criteria before proceeding:

### Go/No-Go Decision Points:
- **After Stage 1**: Can we hook into DLL and log? If no, reconsider approach
- **After Stage 2**: Can we connect to Bridge? If no, debug IPC mechanism
- **After Stage 3**: Is bidirectional communication stable? If no, fix before adding features
- **After Stage 5**: Does Lua integration work? If no, resolve before external calls
- **After Stage 7**: Is full protocol working? If no, don't optimize yet

## Conclusion

This staged approach minimizes risk by:
1. Starting with the absolute minimum change (Stage 1)
2. Validating each component before building on it
3. Allowing early detection of integration issues
4. Providing multiple exit points if problems arise
5. Building complexity gradually rather than all at once

The strategy ensures that at any stage, we have a working system that can be tested and validated, reducing the risk of major integration failures late in development.