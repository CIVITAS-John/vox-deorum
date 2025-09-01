# GameCoreUpdateEnd Event

## Overview
The `GameCoreUpdateEnd` event is triggered at the end of the game core update cycle in Civilization V. This event provides a hook point for Lua scripts to perform actions after the core game logic has completed its update processing.

## Event Trigger
This event is fired at the conclusion of the game's core update loop, specifically after all game mechanics, AI processing, and state updates have been completed for the current game tick. It serves as a cleanup or post-processing hook.

**Trigger Location**: `CvGame.cpp` line 1619  
**Source File**: `F:\Minor Solutions\vox-deorum\civ5-dll\CvGameCoreDLL_Expansion2\CvGame.cpp`

## Event Parameters
This event takes no parameters (`args: []`).

| Parameter | Type | Description |
|-----------|------|-------------|
| *None* | - | This event is called without any arguments |

## Usage Examples

### Basic Event Handler
```lua
-- Register the event handler
Events.GameCoreUpdateEnd.Add(OnGameCoreUpdateEnd)

function OnGameCoreUpdateEnd()
    -- Perform post-update processing
    print("Game core update cycle completed")
    
    -- Example: Update UI elements that depend on game state
    UpdateCustomUI()
    
    -- Example: Process queued actions
    ProcessPendingActions()
end
```

### Performance Monitoring
```lua
local updateStartTime = 0

-- Track update performance
Events.GameCoreUpdateStart.Add(function()
    updateStartTime = os.clock()
end)

Events.GameCoreUpdateEnd.Add(function()
    local updateDuration = os.clock() - updateStartTime
    if updateDuration > 0.1 then -- Log slow updates
        print(string.format("Slow game update: %.3f seconds", updateDuration))
    end
end)
```

### State Synchronization
```lua
Events.GameCoreUpdateEnd.Add(function()
    -- Ensure custom game state is synchronized
    SynchronizeCustomGameState()
    
    -- Update cached values that depend on game state
    RefreshGameStateCache()
    
    -- Send updates to external systems if needed
    NotifyExternalSystems()
end)
```

## Related Events

- **GameCoreUpdateStart**: Fired at the beginning of the core update cycle (companion event)
- **GameDataDirty**: Fired when game data has been modified and needs processing
- **EndTurnTimerUpdate**: Fired during turn timer updates
- **ActivePlayerTurnEnd**: Fired when the active player's turn ends

## Important Considerations

### Performance Impact
- This event fires frequently (once per game update cycle)
- Keep event handlers lightweight to avoid impacting game performance
- Consider using timers or counters to limit expensive operations

### Timing
- This event occurs after all core game logic has been processed
- Safe to read game state, but changes may not take effect until the next update cycle
- Ideal for post-processing operations and cleanup tasks

### Thread Safety
- This event is called from the main game thread
- No special synchronization is required for game state access
- Avoid long-running operations that could block the game loop

## Implementation Notes

The event is implemented using the LuaSupport hook system:
```cpp
LuaSupport::CallHook(pkScriptSystem, "GameCoreUpdateEnd", args.get(), bResult);
```

This ensures that all registered Lua event handlers are called when the game core update cycle completes.

## Best Practices

1. **Keep Handlers Fast**: Minimize processing time in event handlers
2. **Batch Operations**: Group related operations together rather than spreading across multiple events
3. **Error Handling**: Implement proper error handling to prevent crashes
4. **Resource Cleanup**: Use this event for cleaning up temporary resources or state
5. **Conditional Processing**: Use flags or timers to avoid unnecessary processing on every call

## Example Use Cases

- Updating custom UI elements that display game statistics
- Processing queued player actions or AI decisions
- Synchronizing game state with external systems
- Performing cleanup operations after game logic updates
- Logging or debugging game state changes
- Updating cached calculations that depend on multiple game systems