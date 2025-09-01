# PlayerEndTurnInitiated Event

## Overview

The `PlayerEndTurnInitiated` event is triggered when a player begins the process of ending their turn in Civilization V. This event is part of the RED (Really Extended Diplomacy) event system and serves as the opening signal in the turn-ending sequence, occurring just before the game performs end-of-turn cleanup and processing.

## Event Trigger

This event is fired when:
- A player calls `setTurnActive(false)` to begin ending their active turn
- The turn state transitions from active (`isTurnActive() == true`) to inactive (`isTurnActive() == false`)
- The game enters the "TURN IS ENDING" phase of turn processing
- The `MOD_EVENTS_RED_TURN` configuration option is enabled
- End-of-turn cleanup and processing is about to begin

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerID` | Integer | The unique identifier of the player who is initiating the end of their turn. Retrieved via the player's `GetID()` method. |

### Parameter Details

- **playerID**: Ranges from 0 to the maximum number of players in the game (typically 0-21 for standard games, including major civilizations, city-states, and barbarians)

## Usage Examples

### Basic Event Handling
```lua
-- Example Lua event handler
function OnPlayerEndTurnInitiated(playerID)
    local player = Players[playerID]
    
    if player and player:IsAlive() then
        print(string.format("Player %s (ID: %d) is beginning to end their turn", 
              player:GetName(), 
              playerID))
    end
end

Events.PlayerEndTurnInitiated.Add(OnPlayerEndTurnInitiated)
```

### Turn Sequence Monitoring
```lua
-- Track the beginning of turn ending process
function OnTurnEndingStarted(playerID)
    local player = Players[playerID]
    local currentTurn = Game.GetGameTurn()
    
    if player then
        local playerType = player:IsHuman() and "Human" or "AI"
        print(string.format("%s player %s (ID: %d) initiated turn end for turn %d", 
              playerType, 
              player:GetName(), 
              playerID, 
              currentTurn))
        
        -- Log turn timing data
        local turnStartTime = os.time()
        print(string.format("Turn end initiated at: %s", os.date("%H:%M:%S", turnStartTime)))
        
        -- Prepare for end-of-turn processing
        if player:IsHuman() then
            -- Notify UI that human player is ending turn
            print("Preparing UI for turn transition...")
        end
    end
end

Events.PlayerEndTurnInitiated.Add(OnTurnEndingStarted)
```

### Strategic Analysis Integration
```lua
-- Capture turn ending initiation for AI analysis
function AnalyzeTurnEndInitiation(playerID)
    local player = Players[playerID]
    local gameCore = Game.GetGameCore()
    
    if player and gameCore then
        -- Collect pre-end-turn state data
        local turnData = {
            playerID = playerID,
            playerName = player:GetName(),
            turn = Game.GetGameTurn(),
            isHuman = player:IsHuman(),
            isAlive = player:IsAlive(),
            militaryMight = player:GetMilitaryMight(),
            economicMight = player:GetEconomicMight(),
            numCities = player:GetNumCities(),
            timestamp = os.time(),
            phase = "turn_end_initiated"
        }
        
        -- Send to bridge service for MCP analysis
        -- This would integrate with the Vox Deorum bridge service
        print("Turn ending state captured for strategic analysis")
        
        -- Log important turn-end preparation
        if player:IsHuman() then
            print("Human player ending turn - state ready for AI evaluation")
        end
    end
end

Events.PlayerEndTurnInitiated.Add(AnalyzeTurnEndInitiation)
```

### Turn Timing Analysis
```lua
-- Monitor turn duration and timing patterns
local turnStartTimes = {}

function OnPlayerEndTurnInitiated(playerID)
    local player = Players[playerID]
    if player and player:IsAlive() then
        local endTime = os.time()
        local startTime = turnStartTimes[playerID]
        
        if startTime then
            local turnDuration = endTime - startTime
            print(string.format("Player %s turn duration: %d seconds", 
                  player:GetName(), turnDuration))
            
            -- Track player efficiency metrics
            if player:IsHuman() then
                print(string.format("Human player turn time: %d seconds", turnDuration))
            end
        end
        
        -- Clear the start time for next turn
        turnStartTimes[playerID] = nil
    end
end

-- Note: You would set turnStartTimes[playerID] when turn starts
Events.PlayerEndTurnInitiated.Add(OnPlayerEndTurnInitiated)
```

## Implementation Details

**Source Location**: `CvGameCoreDLL_Expansion2/CvPlayer.cpp:32751`

The event is triggered from the `setTurnActive(bool bNewValue, bool bDoTurn)` function in the C++ DLL layer when a player's turn becomes inactive. The event is fired using the Lua support system:

```cpp
if (MOD_EVENTS_RED_TURN)
{
    ICvEngineScriptSystem1* pkScriptSystem = gDLL->GetScriptSystem();
    if(pkScriptSystem)
    {
        CvLuaArgsHandle args;
        args->Push(GetID());    // Player ID
        
        bool bResult = false;
        LuaSupport::CallHook(pkScriptSystem, "PlayerEndTurnInitiated", args.get(), bResult);
    }
}
```

**Context**: This event is fired within the "TURN IS ENDING" section of the `setTurnActive()` function, specifically before any end-of-turn cleanup such as:
- Delayed visibility processing
- Unit reset and healing
- Invalid unit repositioning
- End-turn blocking state management

## Related Events

- **PlayerEndTurnCompleted**: Triggered when a player has fully completed their turn (counterpart to this event)
- **GameCoreUpdateEnd**: Occurs at the end of each game update cycle
- **GameCoreUpdateBegin**: Occurs at the beginning of each game update cycle
- **PlayerDoTurn**: Triggered during active turn processing
- **GAMEEVENT_PlayerDoneTurn**: Legacy event system equivalent (when `MOD_EVENTS_PLAYER_TURN` is enabled)

## Event Sequence

The typical turn-related event sequence is:
1. **PlayerEndTurnInitiated** - Player begins ending turn *(this event)*
2. End-of-turn cleanup and processing occurs (visibility updates, unit healing, etc.)
3. `PlayerEndTurnCompleted` - Player has finished all turn actions
4. `TurnComplete` - All players have completed their turns
5. Next player's turn begins

## Strategic Considerations

### For AI Analysis
- Provides the earliest signal that a player is transitioning out of their active turn
- Marks the beginning of the end-of-turn evaluation period
- Essential for capturing the final state of a player's turn before cleanup
- Critical timing for strategic decision analysis

### For Turn Management
- Indicates when a player has made all their active decisions for the turn
- Useful for implementing turn-based automation and assistance
- Enables detection of turn transition patterns
- Provides timing data for performance analysis

### For Game Flow
- Marks the beginning of turn state transitions
- Enables preparation for next-player processing
- Supports implementation of turn-based features and modifications
- Critical for maintaining game synchronization

## Special Notes

1. **Configuration Dependency**: This event only fires when `MOD_EVENTS_RED_TURN` is enabled in the game's custom mod configuration.

2. **Timing**: This event occurs immediately when `setTurnActive(false)` is called, before any end-of-turn processing happens.

3. **State Consistency**: At this point, the player's turn is still technically active, but the transition process has begun.

4. **Multiplayer Compatibility**: In multiplayer games, this event fires for each player as they individually initiate their turn ending process.

5. **AI and Human Players**: Both human and AI players trigger this event, making it suitable for comprehensive game analysis.

6. **Cleanup Sequence**: This event occurs before delayed visibility processing, unit healing, and other end-of-turn cleanup operations.

## Technical Integration

When integrating with the Vox Deorum Bridge Service and MCP system:
- **Turn Transition Tracking**: Essential for monitoring the beginning of turn state changes
- **Decision Finalization**: Marks when a player has made their final decisions for the turn
- **State Capture**: Ideal timing for capturing the player's final turn state before cleanup
- **Strategic Analysis**: Turn initiation provides the starting point for end-of-turn evaluation
- **AI Training**: Historical turn ending patterns can inform AI behavior models

## Bridge Service Integration

This event is particularly valuable for the Vox Deorum architecture:
```
PlayerEndTurnInitiated Event → Bridge Service → MCP Server → AI Analysis
```

The event data should be:
1. Captured by the Civ5 mod Lua scripts
2. Transmitted to the Bridge Service via JSON API
3. Processed by the MCP Server for turn transition analysis
4. Used by MCP Clients to inform AI strategic planning for upcoming turns

## Use Cases

- **Turn State Management**: Track when players begin ending their turns
- **Performance Monitoring**: Measure turn duration and player efficiency
- **AI Decision Support**: Capture final turn state for strategic analysis
- **Multiplayer Synchronization**: Coordinate turn transitions across players
- **Custom Turn Features**: Implement mod-specific turn ending behaviors
- **Analytics**: Log turn patterns and player behavior data
- **Automation**: Trigger automated end-of-turn processes

## Version Information

- **Generated**: 2025-09-01T01:20:46.712Z
- **Occurrences Analyzed**: 1
- **Source**: Community Patch DLL Integration with RED Events
- **Configuration**: Requires `MOD_EVENTS_RED_TURN` enabled
- **DLL Integration**: Part of the Community Patch framework modifications