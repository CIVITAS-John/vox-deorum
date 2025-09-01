# GatherPerTurnReplayStats Event

## Overview

The `GatherPerTurnReplayStats` event is triggered during gameplay to collect statistical data for replay functionality. This event allows Lua scripts to gather per-turn statistics that can be used for game analysis, replay generation, and post-game reviews.

## Event Trigger

This event is called from the Community Patch DLL during turn processing to enable the collection of turn-by-turn statistical data. It provides an opportunity for Lua scripts to record important game state information that should be preserved for replay purposes.

**Source Location:** `CvGameCoreDLL_Expansion2/CvPlayer.cpp` (line 46699)

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerID` | `number` | The unique identifier of the player for whom statistics are being gathered |

### Parameter Details

- **playerID**: An integer representing the player's unique ID in the current game session. This allows scripts to identify which player's statistics are being collected and organize data accordingly.

## Usage Examples

### Basic Event Handler

```lua
-- Register event handler for gathering per-turn replay stats
Events.GatherPerTurnReplayStats.Add(function(playerID)
    local player = Players[playerID]
    if not player or not player:IsAlive() then
        return
    end
    
    -- Gather basic player statistics
    local stats = {
        turn = Game.GetGameTurn(),
        playerID = playerID,
        score = player:GetScore(),
        gold = player:GetGold(),
        science = player:GetScience(),
        culture = player:GetJONCultureEverGenerated(),
        population = player:GetTotalPopulation(),
        cities = player:GetNumCities(),
        units = player:GetNumUnits()
    }
    
    -- Store or process statistics as needed
    StoreReplayStats(stats)
end)
```

### Advanced Statistics Collection

```lua
-- More comprehensive statistics gathering
Events.GatherPerTurnReplayStats.Add(function(playerID)
    local player = Players[playerID]
    if not player or not player:IsAlive() or player:IsBarbarian() then
        return
    end
    
    -- Collect detailed player metrics
    local detailedStats = {
        -- Basic info
        turn = Game.GetGameTurn(),
        playerID = playerID,
        playerName = player:GetName(),
        civilization = player:GetCivilizationShortDescription(),
        
        -- Economic metrics
        gold = player:GetGold(),
        goldPerTurn = player:CalculateGoldRate(),
        
        -- Science metrics
        science = player:GetScience(),
        sciencePerTurn = player:GetScienceRate(),
        techsResearched = player:GetTeamTechs():GetNumTechsKnown(),
        
        -- Cultural metrics
        culture = player:GetJONCultureEverGenerated(),
        culturePerTurn = player:GetTotalJONCulturePerTurn(),
        
        -- Military metrics
        militaryMight = player:GetMilitaryMight(),
        numUnits = player:GetNumUnits(),
        numMilitaryUnits = player:GetNumMilitaryUnits(),
        
        -- Demographic metrics
        totalPopulation = player:GetTotalPopulation(),
        numCities = player:GetNumCities(),
        landScore = player:GetScoreFromLand(),
        wonderScore = player:GetScoreFromWonders()
    }
    
    -- Add to replay data structure
    AddToReplayDatabase(detailedStats)
end)
```

## Related Events

This event is part of the replay and statistics system and may be used alongside:

- **EndTurn events**: For finalizing turn-based calculations
- **PlayerTurn events**: For player-specific turn processing
- **GameCore events**: For overall game state management

## Technical Notes

1. **Performance Considerations**: This event may be called frequently (potentially every turn for every player), so handlers should be optimized to avoid performance impact.

2. **Data Persistence**: The collected statistics should be stored in a way that persists across game sessions if replay functionality is desired.

3. **Player Validation**: Always validate that the player exists and is active before attempting to gather statistics to avoid errors with eliminated or invalid players.

4. **Multiplayer Compatibility**: In multiplayer games, this event will be triggered for all players, so ensure your statistics collection handles multiple human players appropriately.

## Implementation Details

- **Event Type**: Lua Hook
- **DLL Source**: Community Patch DLL (CvPlayer.cpp)
- **Frequency**: Called during turn processing
- **Context**: Player-specific turn statistics gathering

## Best Practices

1. **Null Checks**: Always verify player validity before accessing player data
2. **Performance**: Keep statistics gathering lightweight to avoid turn processing delays
3. **Data Structure**: Use consistent data structures for replay statistics to ensure compatibility
4. **Error Handling**: Implement proper error handling to prevent crashes during statistics collection