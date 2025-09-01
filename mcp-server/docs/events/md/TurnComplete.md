# TurnComplete Event

## Overview

The `TurnComplete` event is a core game event in Civilization V that signals the completion of a player's turn. This event is essential for tracking game progression and implementing turn-based AI behaviors or monitoring systems.

## Event Trigger

This event is triggered when a player completes their turn in the game. Based on the code analysis, the event is fired from multiple locations within the game's turn processing logic in `CvGame.cpp`.

### Trigger Locations

The event is triggered from the following locations in the codebase:
- Line 2057: During standard turn completion processing
- Line 2127: During alternative turn completion flow
- Line 2230: During extended turn completion processing
- Line 3631: During late-game turn completion logic
- Line 3670: During final turn completion validation

## Event Parameters

### activePlayer
- **Type**: `number` (Player ID)
- **Description**: The ID of the player whose turn has just completed
- **Source**: Retrieved via `getActivePlayer()` method
- **Usage**: Identifies which player has finished their turn, allowing event handlers to perform player-specific actions or analysis

## Event Structure

```json
{
  "eventName": "TurnComplete",
  "parameters": {
    "activePlayer": "<number>"
  }
}
```

## Usage Examples

### Lua Event Handler Registration

```lua
-- Register for the TurnComplete event
GameEvents.TurnComplete.Add(OnTurnComplete)

function OnTurnComplete(activePlayerID)
    print("Turn completed for player: " .. tostring(activePlayerID))
    
    -- Perform turn-end processing for the active player
    local pPlayer = Players[activePlayerID]
    if pPlayer then
        -- Example: Log player statistics
        local playerName = pPlayer:GetName()
        local turnNumber = Game.GetGameTurn()
        
        print("Player " .. playerName .. " completed turn " .. turnNumber)
        
        -- Example: Trigger AI analysis for this player
        if pPlayer:IsHuman() then
            -- Human player turn completed
            AnalyzeHumanPlayerActions(activePlayerID)
        else
            -- AI player turn completed
            AnalyzeAIPlayerActions(activePlayerID)
        end
    end
end
```

### Bridge Service Integration

```lua
-- Example of sending turn completion data to external services
function OnTurnComplete(activePlayerID)
    local turnData = {
        eventType = "TurnComplete",
        activePlayer = activePlayerID,
        gameTime = Game.GetGameTurn(),
        timestamp = os.time()
    }
    
    -- Send to bridge service for external processing
    BridgeService.SendEvent("TurnComplete", turnData)
end
```

## Related Events

### Sequential Events
- **TurnStart**: Fired at the beginning of a player's turn (opposite of TurnComplete)
- **GameTurnComplete**: Fired when all players have completed their turns for a game round

### Associated Events
- **PlayerTurnActivated**: Fired when a specific player's turn begins
- **GameUpdate**: General game state update events that may follow turn completion

## Implementation Considerations

### Performance Notes
- The event is triggered multiple times per turn cycle across different game processing phases
- Event handlers should be optimized to avoid performance bottlenecks during turn transitions
- Consider batching operations that don't need immediate execution

### Timing Considerations
- The event fires after all turn-specific processing has been completed for the active player
- Game state is stable when this event is triggered, making it safe for analysis and external communication
- Multiple event firings may occur during complex turn transitions - handlers should be idempotent

### Error Handling
- Always validate that the `activePlayer` parameter is valid before processing
- Handle cases where player data might not be immediately available
- Implement proper error handling for external service communication

## Special Notes

- **Multi-firing**: This event may fire multiple times during a single turn completion due to the game's complex turn processing logic
- **Player Validation**: Always verify that the active player ID corresponds to a valid player object before performing operations
- **Game State**: The game state is fully updated when this event fires, making it an ideal point for comprehensive analysis
- **Bridge Service**: This event is particularly important for the Vox Deorum system as it provides key synchronization points for external AI analysis

## Event Statistics

- **Total Occurrences**: 5 trigger points identified in the codebase
- **Source File**: `CvGameCoreDLL_Expansion2/CvGame.cpp`
- **Parameter Count**: 1 (activePlayer)
- **Event Frequency**: Once per player per turn

## Version Information

- **Generated**: 2025-09-01T01:20:46.712Z
- **Documentation Version**: 1.0
- **Compatibility**: Community Patch DLL compatible