# CityCaptureComplete Event

## Overview

The `CityCaptureComplete` event is triggered when a player successfully acquires (captures, liberates, or receives as a gift) a city from another player. This event occurs at the end of the city acquisition process, after all ownership transfers, building destruction/preservation, Great Work transfers, and territorial updates have been completed.

## When This Event is Triggered

This event fires during the execution of the `CvPlayer::acquireCity` function when:

- A player conquers a city through military action
- A player liberates a city and returns it to its original or previous owner
- A player receives a city as a gift (through trade, diplomatic action, or special abilities like Austria's/Venice's unique abilities)
- A city-state is purchased or annexed

The event is triggered **after** all the following processes have completed:
- Building destruction and preservation logic
- Great Work transfer and redistribution
- Territory and plot ownership updates
- Unit displacement from captured territory
- Population and infrastructure adjustments

## Event Parameters

The event passes 9 parameters to Lua scripts in the following order:

| Parameter | Type | Variable Name | Description |
|-----------|------|---------------|-------------|
| 1 | `PlayerTypes` | `eOldOwner` | The ID of the player who previously owned the city |
| 2 | `boolean` | `bCapital` | True if the captured city was the capital of the previous owner |
| 3 | `int` | `iCityX` | The X coordinate of the city on the game map |
| 4 | `int` | `iCityY` | The Y coordinate of the city on the game map |
| 5 | `PlayerTypes` | `GetID()` | The ID of the player who now owns the city (the acquiring player) |
| 6 | `int` | `iPopulation` | The population of the city at the time of capture |
| 7 | `boolean` | `bConquest` | True if the city was captured through military conquest, false for gifts/liberation |
| 8 | `int` | `vcGreatWorkData.size()` | The total number of Great Works that were present in the city |
| 9 | `int` | `iCaptureGreatWorks` | The number of Great Works that were successfully captured/transferred |

## Usage Examples

### Basic Event Handler in Lua

```lua
-- Register the event handler
GameEvents.CityCaptureComplete.Add(OnCityCaptureComplete)

-- Event handler function
function OnCityCaptureComplete(oldOwnerID, wasCapital, cityX, cityY, newOwnerID, population, isConquest, totalGreatWorks, capturedGreatWorks)
    local oldOwner = Players[oldOwnerID]
    local newOwner = Players[newOwnerID]
    local city = Map.GetPlot(cityX, cityY):GetPlotCity()
    
    if isConquest then
        print(string.format("%s conquered %s from %s!", 
            newOwner:GetCivilizationDescription(), 
            city:GetName(), 
            oldOwner:GetCivilizationDescription()))
    else
        print(string.format("%s received %s from %s as a gift!", 
            newOwner:GetCivilizationDescription(), 
            city:GetName(), 
            oldOwner:GetCivilizationDescription()))
    end
    
    if wasCapital then
        print("A capital city has changed hands!")
    end
    
    if capturedGreatWorks > 0 then
        print(string.format("Captured %d Great Works out of %d total", capturedGreatWorks, totalGreatWorks))
    end
end
```

### Victory Condition Checking

```lua
function OnCityCaptureComplete(oldOwnerID, wasCapital, cityX, cityY, newOwnerID, population, isConquest, totalGreatWorks, capturedGreatWorks)
    if isConquest then
        local newOwner = Players[newOwnerID]
        
        -- Check for domination victory after conquest
        if newOwner:IsHuman() then
            CheckDominationProgress(newOwner)
        end
        
        -- Track conquest statistics
        UpdateConquestStats(newOwnerID, oldOwnerID, wasCapital)
    end
end
```

### Great Work Transfer Analysis

```lua
function OnCityCaptureComplete(oldOwnerID, wasCapital, cityX, cityY, newOwnerID, population, isConquest, totalGreatWorks, capturedGreatWorks)
    if totalGreatWorks > 0 then
        local transferRate = (capturedGreatWorks / totalGreatWorks) * 100
        local city = Map.GetPlot(cityX, cityY):GetPlotCity()
        
        print(string.format("Great Work Transfer in %s: %d/%d (%.1f%%)", 
            city:GetName(), capturedGreatWorks, totalGreatWorks, transferRate))
        
        if capturedGreatWorks < totalGreatWorks then
            local lostWorks = totalGreatWorks - capturedGreatWorks
            print(string.format("Warning: %d Great Works were lost or relocated", lostWorks))
        end
    end
end
```

## Related Events and Considerations

### Related Game Events
- **`CityCanBeBought`** - Triggered when checking if a city can be purchased from a city-state
- **`SerialEventCityDestroyed`** - Triggered when a city is razed or destroyed
- **`CityTrained`** - Triggered when a city completes unit production
- **`CityConstructed`** - Triggered when a city completes building construction

### Integration with Other Systems

1. **Diplomatic Impact**: City capture affects diplomatic relationships and may trigger war declarations or peace offers
2. **Victory Conditions**: Conquest victories are evaluated after this event
3. **Culture and Tourism**: Great Work transfers affect cultural and tourism calculations
4. **Religion**: Holy Cities may change hands, affecting religious spread
5. **Economics**: City capture may affect trade route validations and economic calculations

### Timing Considerations

- This event fires **after** the `acquireCity` process is complete
- All territorial changes have been applied when this event triggers
- Great Work redistributions are finalized
- Population and infrastructure changes are complete
- The event occurs before victory condition checks

## Special Notes

### Great Works Handling
- The `totalGreatWorks` parameter includes all Great Works that were present in buildings within the city
- The `capturedGreatWorks` parameter only counts Great Works that were successfully transferred to the new owner
- Some Great Works may be relocated to other cities if there's insufficient space in the captured city
- Great Works that cannot be accommodated anywhere may be lost

### Parameter Validation
- Always validate that player IDs are valid before using them
- Check that the city still exists at the given coordinates
- Be aware that in rare cases, the city might be razed immediately after capture

### Performance Considerations
- This event can fire multiple times in a single turn during large military campaigns
- Avoid expensive operations in event handlers to prevent game performance issues
- Consider batching operations or using delayed execution for complex logic

### Multiplayer Compatibility
- This event fires for all players in multiplayer games
- Ensure any UI updates or notifications are appropriate for the current player
- Be mindful of information that should remain hidden from other players

## Example Integration with MCP Server

```lua
-- Example of sending capture data to MCP Server
function OnCityCaptureComplete(oldOwnerID, wasCapital, cityX, cityY, newOwnerID, population, isConquest, totalGreatWorks, capturedGreatWorks)
    local captureData = {
        event = "CityCaptureComplete",
        oldOwner = oldOwnerID,
        newOwner = newOwnerID,
        cityLocation = {x = cityX, y = cityY},
        wasCapital = wasCapital,
        isConquest = isConquest,
        population = population,
        greatWorks = {
            total = totalGreatWorks,
            captured = capturedGreatWorks
        },
        timestamp = os.time()
    }
    
    -- Send to Bridge Service
    SendEventToBridge("city-capture-complete", captureData)
end
```