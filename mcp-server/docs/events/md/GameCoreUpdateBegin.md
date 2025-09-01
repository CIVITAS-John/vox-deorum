# GameCoreUpdateBegin Event

## Overview
The `GameCoreUpdateBegin` event is a core system hook that marks the beginning of the game's main update cycle in Civilization V. This event provides an entry point for custom scripts to execute logic at the very start of each game update iteration, before any core game systems are processed.

## When This Event is Triggered
This event fires at the beginning of every game update cycle when:
- The `CvGame::update()` function is called during the main game loop
- The game is not waiting for blocking diplomatic input
- After connection service messages have been processed
- Before any game state checks, turn processing, or other update operations begin

The event occurs immediately after the initial update setup and represents the earliest possible intervention point in the game's update cycle.

## Event Parameters

The `GameCoreUpdateBegin` event provides no parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| *None* | - | This event takes no parameters and passes an empty argument list to Lua scripts |

## Usage Examples

### Lua Script Example
```lua
function OnGameCoreUpdateBegin()
    -- Core update initialization logic
    print("Game core update cycle beginning...")
    
    -- Example: Performance monitoring
    local startTime = os.clock()
    
    -- Example: Custom system initialization each update
    if Game.GetGameTurn() > 0 then
        -- Initialize turn-based systems
        InitializeCustomSystems()
    end
    
    -- Example: Check for critical game state changes
    local currentPlayer = Game.GetActivePlayer()
    local player = Players[currentPlayer]
    
    if player and player:IsHuman() then
        -- Human player update logic
        CheckPlayerStatus()
        UpdateCustomUI()
    end
    
    -- Example: High-frequency monitoring (use sparingly)
    MonitorGameState()
    
    -- Example: Coordination with external systems
    NotifyExternalSystems("update_begin")
end

Events.GameCoreUpdateBegin.Add(OnGameCoreUpdateBegin)
```

### Bridge Service Integration
This event can be captured by the Bridge Service for:
- Synchronizing external AI systems with game update cycles
- Implementing high-frequency monitoring of game state changes
- Coordinating timing between the DLL and external services
- Triggering periodic analysis tasks in MCP Server
- Maintaining real-time game state consistency

**Note**: This event is blacklisted in the Connection Service due to its high frequency to prevent performance issues with external system communication.

## Related Events and Considerations

### Related Events
- **GameCoreUpdateEnd** - Marks the completion of the game update cycle
- **PlayerTurnStart** - Player-specific turn beginning events  
- **GameCoreTestVictory** - Victory condition checking during updates
- **ActivePlayerTurnStart** - When the active player's turn begins

### Important Considerations

1. **High Frequency**: This event fires with every game update cycle, potentially multiple times per second
2. **Performance Critical**: Since this occurs at the start of every update, expensive operations should be avoided
3. **No Parameters**: Scripts must query game state directly rather than relying on event parameters  
4. **Early Timing**: This fires before most other game systems are updated, providing the earliest intervention point
5. **Connection Service**: This event is blacklisted from external communication due to its frequency

### Special Notes

- This event is part of a paired system with `GameCoreUpdateEnd` to bracket the main game update cycle
- The event passes an empty argument list, requiring scripts to access game state through global game objects
- High-frequency execution makes this suitable for monitoring tasks but inappropriate for expensive operations
- Blacklisted in the Bridge Service connection system to prevent overwhelming external systems with events
- Particularly useful for:
  - Performance profiling and monitoring
  - Real-time game state synchronization  
  - High-frequency custom system updates
  - Coordinating timing-sensitive operations
- Should be used judiciously to avoid impacting game performance
- The paired `GameCoreUpdateBegin`/`GameCoreUpdateEnd` events provide precise timing boundaries for the main update cycle

## Source Code Reference

**File**: `CvGameCoreDLL_Expansion2/CvGame.cpp`  
**Line**: 1528  
**Function**: `CvGame::update()`  
**Hook Call**: `LuaSupport::CallHook(pkScriptSystem, "GameCoreUpdateBegin", args.get(), bResult);`

The event is triggered within the main `update()` function and occurs:
- After processing Connection Service messages (line 1506)
- After handling blocking diplomatic input (lines 1508-1519)
- Before game state checks and turn processing (lines 1532+)
- At the very beginning of the core update logic (line 1521 comment: "Send a Lua event at the start of the update")

The empty argument list is created at line 1526 with `CvLuaArgsHandle args;` and no parameters are pushed to it.

## Connection Service Blacklisting

This event is explicitly blacklisted in `CvConnectionService.cpp` (line 1341) along with `GameCoreUpdateEnd` to prevent high-frequency event flooding to external systems:

```cpp
static const char* eventBlacklist[] = {
    "GameCoreUpdateBegin",
    "GameCoreUpdateEnd", 
    NULL  // Null terminator
};
```

This blacklisting ensures that the Bridge Service and connected external systems are not overwhelmed by the high frequency of core update events, maintaining overall system performance and stability.