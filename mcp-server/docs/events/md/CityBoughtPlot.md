# CityBoughtPlot Event

## Overview

The `CityBoughtPlot` event is triggered when a city purchases or acquires a new plot/tile to expand its territorial boundaries. This event captures both gold-based purchases and culture/faith-based acquisitions of adjacent tiles.

## When This Event is Triggered

This event is fired in the following scenarios:

1. **Culture/Faith-based Acquisition**: When a city naturally expands its borders through culture or faith accumulation (occurs in two contexts within the expansion logic)
2. **Gold-based Purchase**: When a player manually purchases a tile using gold through the city interface

## Event Parameters

The event passes the following parameters to Lua event handlers:

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerID` | `int` | The ID of the player who owns the city that acquired the plot |
| `cityID` | `int` | The unique identifier of the city that acquired the plot |
| `plotX` | `int` | The X coordinate of the acquired plot on the game map |
| `plotY` | `int` | The Y coordinate of the acquired plot on the game map |
| `bGold` | `boolean` | `true` if the plot was purchased with gold, `false` if acquired through culture/faith |
| `bCulture` | `boolean` | `true` if the plot was acquired through culture/faith expansion, `false` if purchased with gold |

## Usage Examples

### Lua Event Handler Example

```lua
function OnCityBoughtPlot(playerID, cityID, plotX, plotY, bGold, bCulture)
    local player = Players[playerID]
    local city = player:GetCityByID(cityID)
    local plot = Map.GetPlot(plotX, plotY)
    
    if bGold then
        print("City " .. city:GetName() .. " purchased plot at (" .. plotX .. ", " .. plotY .. ") with gold")
        -- Handle gold-based purchase logic
    elseif bCulture then
        print("City " .. city:GetName() .. " expanded borders to plot at (" .. plotX .. ", " .. plotY .. ") through culture/faith")
        -- Handle culture/faith-based expansion logic
    end
    
    -- Common logic for any plot acquisition
    local terrainType = plot:GetTerrainType()
    local resourceType = plot:GetResourceType()
    
    -- Process the newly acquired plot
    -- ...
end

-- Register the event handler
Events.CityBoughtPlot.Add(OnCityBoughtPlot)
```

### Strategic Considerations

```lua
function OnCityBoughtPlot(playerID, cityID, plotX, plotY, bGold, bCulture)
    local player = Players[playerID]
    local plot = Map.GetPlot(plotX, plotY)
    
    -- Analyze strategic value of acquired plot
    if plot:GetResourceType() ~= -1 then
        print("Strategic resource acquired!")
        -- Notify AI systems about resource acquisition
    end
    
    if plot:IsCoastalLand() then
        print("Coastal expansion - potential naval considerations")
        -- Update naval strategy
    end
    
    -- Check for defensive implications
    if plot:IsHills() then
        print("Defensive position acquired")
        -- Update defensive calculations
    end
end
```

## Related Events and Considerations

### Related Events
- `CityCanBuyPlot` - Event that determines if a city can purchase a specific plot
- `PlotOwnershipChanged` - Broader event for any plot ownership change
- `CityGrowth` - City growth events that may trigger natural expansion

### Strategic Implications
- **Resource Access**: Monitor when cities acquire plots containing strategic or luxury resources
- **Defensive Positioning**: Track acquisition of defensive terrain (hills, choke points)
- **Economic Impact**: Gold purchases reduce treasury, culture expansion indicates healthy city development
- **Border Security**: New plots may create or close strategic corridors

## Special Notes

### Timing Considerations
- This event fires immediately when a plot is acquired, before other systems may have updated
- The plot ownership has already changed when this event triggers
- Culture/faith-based acquisitions may trigger multiple times during border expansion calculations

### Implementation Details
- The event is triggered from three different locations in `CvCity.cpp`
- Two instances handle culture/faith-based expansion (lines 17331 and 17378)
- One instance handles gold-based purchases (line 28522)
- The `bGold` and `bCulture` parameters are mutually exclusive - exactly one will be `true`

### Performance Considerations
- This event can trigger frequently during periods of rapid city growth
- Consider caching expensive calculations or using delayed processing for non-critical responses
- The event provides coordinates rather than plot objects for performance reasons

## Source Code References

This event is implemented in the Community Patch DLL at the following locations:

- `CvGameCoreDLL_Expansion2/CvCity.cpp:17331` - Culture/faith expansion
- `CvGameCoreDLL_Expansion2/CvCity.cpp:17378` - Culture/faith expansion  
- `CvGameCoreDLL_Expansion2/CvCity.cpp:28522` - Gold-based purchase

Generated from event analysis on 2025-09-01T01:20:46.712Z with 3 total occurrences found in the codebase.