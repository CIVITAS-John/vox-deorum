# PlayerEndTurnCompleted Event

## Overview

The `PlayerEndTurnCompleted` event is triggered when a player has fully completed their turn in Civilization V. This event is part of the RED (Really Extended Diplomacy) event system and provides a crucial signal that a player has finished all their turn-based actions and the game state is ready to transition to the next phase of the turn sequence.

## Event Trigger

This event is fired when:
- A player calls `setTurnActive(false)` to end their active turn
- All player actions for the current turn have been processed and completed
- The player's turn state transitions from active to inactive
- The game is ready to proceed with turn sequence management
- The `MOD_EVENTS_RED_TURN` configuration option is enabled

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerID` | Integer | The unique identifier of the player who has completed their turn. Corresponds to the player's ID in the game session. |

### Parameter Details

- **playerID**: Ranges from 0 to the maximum number of players in the game (typically 0-21 for standard games, including major civilizations, city-states, and barbarians)

## Usage Examples

### Basic Event Handling
```lua
-- Example Lua event handler
function OnPlayerEndTurnCompleted(playerID)
    local player = Players[playerID]
    
    if player and player:IsAlive() then
        print(string.format("Player %s (ID: %d) has completed their turn", 
              player:GetName(), 
              playerID))
    end
end

Events.PlayerEndTurnCompleted.Add(OnPlayerEndTurnCompleted)
```

### Turn Sequence Management
```lua
-- Track turn completion for game flow analysis
function TrackTurnCompletion(playerID)
    local player = Players[playerID]
    local currentTurn = Game.GetGameTurn()
    
    if player then
        if player:IsHuman() then
            print(string.format("Human player %s completed turn %d", 
                  player:GetName(), currentTurn))
        else
            print(string.format("AI player %s (ID: %d) completed turn %d", 
                  player:GetName(), playerID, currentTurn))
        end
        
        -- Check if all players have completed their turns
        local allPlayersComplete = true
        for i = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
            local checkPlayer = Players[i]
            if checkPlayer and checkPlayer:IsAlive() and checkPlayer:IsTurnActive() then
                allPlayersComplete = false
                break
            end
        end
        
        if allPlayersComplete then
            print("All players have completed their turns - ready for next turn")
        end
    end
end

Events.PlayerEndTurnCompleted.Add(TrackTurnCompletion)
```

### Strategic Analysis Integration
```lua
-- Capture turn completion for AI analysis
function AnalyzeTurnCompletion(playerID)
    local player = Players[playerID]
    local gameCore = Game.GetGameCore()
    
    if player and gameCore then
        -- Log turn completion timing
        local turnData = {
            playerID = playerID,
            playerName = player:GetName(),
            turn = Game.GetGameTurn(),
            isHuman = player:IsHuman(),
            isAlive = player:IsAlive(),
            timestamp = os.time()
        }
        
        -- Send to bridge service for MCP analysis
        -- (This would integrate with the Vox Deorum bridge service)
        print("Turn completion data ready for strategic analysis")
    end
end

Events.PlayerEndTurnCompleted.Add(AnalyzeTurnCompletion)
```

## Implementation Details

**Source Location**: `CvPlayer.cpp:32810`

The event is triggered from the `setTurnActive()` function in the C++ DLL layer when a player's turn becomes inactive. The event is fired using the Lua support system:

```cpp
if (MOD_EVENTS_RED_TURN)
{
    ICvEngineScriptSystem1* pkScriptSystem = gDLL->GetScriptSystem();
    if(pkScriptSystem)
    {
        CvLuaArgsHandle args;
        args->Push(GetID());    // Player ID
        
        bool bResult = false;
        LuaSupport::CallHook(pkScriptSystem, "PlayerEndTurnCompleted", args.get(), bResult);
    }
}
```

**Context**: This event is fired within the `setTurnActive(bool bNewValue, bool bDoTurn)` function when `bNewValue` is `false`, indicating the player is ending their turn.

## Related Events

- **PlayerEndTurnInitiated**: Triggered when a player begins the process of ending their turn (counterpart to this event)
- **TurnComplete**: Fired when the overall game turn is complete for all players
- **GameCoreUpdateEnd**: Occurs at the end of each game update cycle
- **GameCoreUpdateBegin**: Occurs at the beginning of each game update cycle

## Event Sequence

The typical turn-related event sequence is:
1. `PlayerEndTurnInitiated` - Player begins ending turn
2. `PlayerEndTurnCompleted` - Player has finished all turn actions *(this event)*
3. `TurnComplete` - All players have completed their turns
4. Next player's turn begins

## Strategic Considerations

### For AI Analysis
- Indicates completion of all player actions for strategic evaluation
- Marks the endpoint for analyzing a player's turn decisions
- Provides timing data for turn management and player behavior analysis
- Essential for understanding game pacing and player efficiency

### For Turn Management
- Signals when a player's state is stable for analysis
- Critical for multiplayer synchronization
- Useful for implementing turn timers and automation
- Enables detection of turn completion patterns

### For Game Flow
- Marks transition points in the game's turn-based structure
- Enables tracking of game progression and player engagement
- Supports implementation of turn-based features and modifications

## Special Notes

- **Configuration Dependency**: This event only fires when `MOD_EVENTS_RED_TURN` is enabled in the game's custom mod configuration
- **Turn State**: The event occurs after all turn-related state changes have been completed
- **Multiplayer Compatibility**: In multiplayer games, this event fires for each player as they complete their individual turns
- **AI Integration**: Both human and AI players trigger this event, making it suitable for comprehensive game analysis
- **Timing**: The event is fired synchronously during the turn state transition process

## Technical Integration

When integrating with the Vox Deorum Bridge Service and MCP system:
- **Turn Completion Tracking**: Essential for monitoring game flow and turn progression
- **State Synchronization**: Provides reliable markers for when player state is stable for analysis
- **Strategic Analysis**: Turn completion marks the end of decision-making periods for evaluation
- **AI Training**: Historical turn completion data can inform AI behavior models
- **Game Automation**: Can trigger automated analysis or decision-making processes

## Bridge Service Integration

This event is particularly valuable for the Vox Deorum architecture:
```
PlayerEndTurnCompleted Event → Bridge Service → MCP Server → AI Analysis
```

The event data should be:
1. Captured by the Civ5 mod Lua scripts
2. Transmitted to the Bridge Service via JSON API
3. Processed by the MCP Server for game state analysis
4. Used by MCP Clients to inform AI strategic decisions

## Version Information

- **Generated**: 2025-09-01T01:20:46.712Z
- **Occurrences Analyzed**: 1
- **Source**: Community Patch DLL Integration with RED Events
- **Configuration**: Requires `MOD_EVENTS_RED_TURN` enabled
- **DLL Integration**: Part of the Community Patch framework modifications