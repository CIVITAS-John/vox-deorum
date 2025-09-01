# PlayerDoTurn Event

## Overview

The `PlayerDoTurn` event is triggered during a player's turn processing in Civilization V, specifically after the AI turn post-processing has completed but before unit processing begins.

## Event Details

- **Event Name**: `PlayerDoTurn`
- **Source File**: `CvGameCoreDLL_Expansion2/CvPlayer.cpp` (line 10484)
- **Frequency**: Once per player per turn

## When Triggered

This event is fired during the `CvPlayer::doTurn()` method execution sequence:

1. AI turn post-processing (`AI_doTurnPost()`) completes
2. **PlayerDoTurn event is triggered** ← You are here
3. Military rating decay processing (for major civilizations)
4. Player achievements start turn processing
5. Unit turn processing begins (`doTurnUnits()`)

The event occurs for all active players (both human and AI) during their respective turns.

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerID` | `int` | The unique identifier of the player whose turn is being processed. Retrieved via `GetID()` method. |

### Parameter Details

- **playerID**: 
  - Range: 0 to maximum number of players in the game
  - Represents both major civilizations and city-states
  - Used to identify which specific player is currently processing their turn

## Usage Examples

### Lua Event Handler
```lua
-- Register event handler for PlayerDoTurn
Events.PlayerDoTurn.Add(function(playerID)
    local player = Players[playerID]
    if player and player:IsAlive() then
        print("Player " .. playerID .. " (" .. player:GetName() .. ") is processing their turn")
        
        -- Example: Custom turn processing logic
        if player:IsHuman() then
            -- Handle human player turn events
            HandleHumanPlayerTurn(playerID)
        else
            -- Handle AI player turn events
            HandleAIPlayerTurn(playerID)
        end
    end
end)
```

### Event Processing Pattern
```lua
function OnPlayerDoTurn(playerID)
    local player = Players[playerID]
    if not player or not player:IsAlive() then
        return
    end
    
    -- Safe to perform player-specific operations here
    -- This runs after AI processing but before unit moves
    
    -- Example uses:
    -- - Update custom UI elements
    -- - Process custom per-turn mechanics
    -- - Log turn statistics
    -- - Trigger custom notifications
end
Events.PlayerDoTurn.Add(OnPlayerDoTurn)
```

## Related Events

- **PlayerTurnStart**: Triggered at the very beginning of a player's turn
- **PlayerTurnEnd**: Triggered when a player's turn is completely finished
- **UnitTurnStart**: Triggered when unit processing begins (occurs after PlayerDoTurn)

## Implementation Context

The event is called through the Lua scripting system using the `LuaSupport::CallHook` mechanism:

```cpp
ICvEngineScriptSystem1* pkScriptSystem = gDLL->GetScriptSystem();
if (pkScriptSystem)
{
    CvLuaArgsHandle args;
    args->Push(GetID());  // Push player ID as parameter
    
    bool bResult = false;
    LuaSupport::CallHook(pkScriptSystem, "PlayerDoTurn", args.get(), bResult);
}
```

## Special Considerations

1. **Turn Sequence**: This event occurs in the middle of turn processing, making it ideal for operations that need to happen after AI decision-making but before unit execution.

2. **Player State**: The player object is fully initialized and all turn-start processing has completed, making it safe to query player statistics and properties.

3. **Performance**: Since this event fires once per player per turn, consider the performance impact of any operations performed in event handlers, especially in games with many players.

4. **Mod Compatibility**: This event is part of the Community Patch framework and may not be available in the base game without the appropriate DLL modifications.

## Use Cases

- **Custom Turn Mechanics**: Implement mod-specific per-turn processing
- **Statistics Tracking**: Log player actions and statistics each turn
- **UI Updates**: Refresh custom interface elements with current turn data
- **Notification Systems**: Trigger turn-based alerts or reminders
- **Balance Modifications**: Apply custom balance changes each turn

## Notes

- This event is only available when using the modified Community Patch DLL
- The event fires for all players (human and AI) during their respective turns
- Event handlers should perform minimal processing to avoid impacting turn time
- Always validate that the player exists and is alive before performing operations