# SetPopulation Event

## Overview

The **SetPopulation** event is triggered when a city's population changes in Civilization V. This event provides information about the city location and both the old and new population values, allowing for tracking population changes across all cities in the game.

## Event Trigger

This event is fired from the Community Patch DLL whenever a city's population is modified through the `setPopulation()` method. This can occur due to various game mechanics such as:

- Natural population growth
- Population loss from starvation
- Population changes from buildings, wonders, or policies
- Direct population modifications from game events
- Population changes from conquest or city founding

**Source Location:** `CvGameCoreDLL_Expansion2/CvCity.cpp`, line 16906

## Event Parameters

The SetPopulation event provides the following parameters in order:

| Parameter | Type | Description |
|-----------|------|-------------|
| **X Coordinate** | `int` | The X coordinate of the city on the game map |
| **Y Coordinate** | `int` | The Y coordinate of the city on the game map |
| **Old Population** | `int` | The previous population value before the change |
| **New Population** | `int` | The new population value after the change |

### Parameter Details

- **Coordinates (X, Y)**: These coordinates uniquely identify the city on the hex-based game map. They can be used to correlate this event with other city-specific events.
- **Old Population**: The population count before the change occurred. This allows for calculating the population delta.
- **New Population**: The updated population count. This represents the city's current population after the change.

## Usage Examples

### Basic Event Handling

```lua
-- Example Lua event handler
function OnSetPopulation(iX, iY, iOldPop, iNewPop)
    local pCity = Map.GetPlot(iX, iY):GetPlotCity()
    if pCity then
        local cityName = pCity:GetName()
        local populationChange = iNewPop - iOldPop
        
        if populationChange > 0 then
            print(cityName .. " grew from " .. iOldPop .. " to " .. iNewPop .. " population")
        elseif populationChange < 0 then
            print(cityName .. " declined from " .. iOldPop .. " to " .. iNewPop .. " population")
        else
            print(cityName .. " population set to " .. iNewPop .. " (no net change)")
        end
    end
end

-- Register the event handler
GameEvents.SetPopulation.Add(OnSetPopulation)
```

### Tracking Population Growth Patterns

```lua
-- Track population changes for analysis
local cityPopulationHistory = {}

function TrackPopulationChanges(iX, iY, iOldPop, iNewPop)
    local cityKey = iX .. "," .. iY
    
    if not cityPopulationHistory[cityKey] then
        cityPopulationHistory[cityKey] = {}
    end
    
    table.insert(cityPopulationHistory[cityKey], {
        turn = Game.GetGameTurn(),
        oldPop = iOldPop,
        newPop = iNewPop,
        change = iNewPop - iOldPop
    })
end

GameEvents.SetPopulation.Add(TrackPopulationChanges)
```

## Related Events

The SetPopulation event is related to several other city and population events:

- **CityGrowth**: May be triggered in conjunction with population increases
- **CityStarved**: Often precedes population decreases
- **CityFounded**: Initial population setting when a city is established
- **CityCaptured**: Population changes when cities change ownership

## Technical Considerations

### Performance Notes

- This event is called frequently during gameplay, especially in large civilizations with many cities
- Event handlers should be optimized for quick execution to avoid game performance issues
- Consider batching operations or using turn-based processing for expensive calculations

### Data Validation

- Coordinates should always be valid map positions
- Population values are typically positive integers, but edge cases may exist
- The old and new population values may be equal in certain scenarios (e.g., forced population setting)

### Integration with Vox Deorum

In the Vox Deorum system, this event data flows through:

1. **Community Patch DLL** → Triggers the event
2. **Bridge Service** → Captures and forwards event data via JSON API
3. **MCP Server** → Processes event for game state tracking
4. **MCP Client** → Uses population data for AI strategy decisions

## Special Notes

- This event occurs for **all** cities, including both player and AI civilizations
- The event is triggered after the population change has been applied
- Population changes of 0 (same old and new values) may occur in certain game situations
- Event timing is synchronous with the game's population modification process

## Implementation Details

**Event Call Pattern:**
```cpp
// From CvCity.cpp
args->Push(getX());           // City X coordinate
args->Push(getY());           // City Y coordinate  
args->Push(iOldPopulation);   // Previous population
args->Push(iNewValue);        // New population value

LuaSupport::CallHook(pkScriptSystem, "SetPopulation", args.get(), bResult);
```

**Event Frequency:** High - occurs whenever any city's population changes during gameplay.