# PlayerCityFounded Event

## Overview

The `PlayerCityFounded` event is triggered when a player establishes a new city in Civilization V. This event provides essential information about the newly founded city, including the founding player and the city's location coordinates.

## When This Event is Triggered

This event is fired immediately after a player successfully founds a new city. The event occurs during the city creation process in the game engine and is triggered from the player's city founding logic in the Community Patch DLL.

**Source Location:** `CvGameCoreDLL_Expansion2/CvPlayer.cpp` at line 13478

## Event Parameters

The event passes three parameters to Lua event handlers:

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerID` | `int` | The unique identifier of the player who founded the city |
| `cityX` | `int` | The X coordinate of the city's location on the game map |
| `cityY` | `int` | The Y coordinate of the city's location on the game map |

### Parameter Details

1. **playerID** - Retrieved via `GetID()`
   - Represents the player index (0-based) who founded the city
   - Can be used to identify which civilization established the city

2. **cityX** - Retrieved via `pCity->getX()`
   - The horizontal coordinate of the city on the hex grid
   - Used for map positioning and spatial calculations

3. **cityY** - Retrieved via `pCity->getY()`
   - The vertical coordinate of the city on the hex grid
   - Combined with X coordinate provides exact city location

## Usage Examples

### Basic Event Handler

```lua
-- Register event handler for city founding
GameEvents.PlayerCityFounded.Add(OnPlayerCityFounded)

function OnPlayerCityFounded(playerID, cityX, cityY)
    local player = Players[playerID]
    if player and player:IsHuman() then
        print(string.format("Human player %d founded a city at (%d, %d)", 
              playerID, cityX, cityY))
    end
end
```

### Advanced Usage with City Information

```lua
function OnPlayerCityFounded(playerID, cityX, cityY)
    local player = Players[playerID]
    if not player then return end
    
    local plot = Map.GetPlot(cityX, cityY)
    if plot then
        local city = plot:GetPlotCity()
        if city then
            local cityName = city:GetName()
            local civName = player:GetCivilizationShortDescription()
            
            print(string.format("%s founded %s at coordinates (%d, %d)", 
                  civName, cityName, cityX, cityY))
            
            -- Trigger AI analysis or strategic planning
            AnalyzeNewCityThreat(playerID, cityX, cityY)
        end
    end
end
```

### Strategic Analysis Example

```lua
function OnPlayerCityFounded(playerID, cityX, cityY)
    -- Check if this is an AI player's city
    local player = Players[playerID]
    if player and not player:IsHuman() then
        -- Evaluate strategic implications
        local plot = Map.GetPlot(cityX, cityY)
        local nearbyResources = GetNearbyStrategicResources(plot)
        local proximityToHuman = GetDistanceToNearestHumanCity(cityX, cityY)
        
        -- Log for AI analysis system
        LogCityFoundingEvent({
            player = playerID,
            location = {x = cityX, y = cityY},
            resources = nearbyResources,
            threat_level = proximityToHuman < 10 and "HIGH" or "LOW"
        })
    end
end
```

## Related Events

- **CityCanBeFounded** - Triggered before city founding to determine if location is valid
- **PlayerCityDestroyed** - Opposite event when a city is destroyed
- **CityBuilt** - Related to city construction completion
- **CityFounded** - Generic city founding event (may be different from PlayerCityFounded)

## Special Considerations

### Timing
- This event fires after the city has been successfully created in the game state
- The city object is accessible via the plot coordinates provided in the event
- Event occurs before UI updates, making it ideal for immediate game state analysis

### Performance Notes
- Event handlers should be lightweight as this can fire frequently during expansion phases
- Consider batching analysis operations if processing multiple city foundings
- Use efficient coordinate-based lookups when accessing city data

### AI Integration
- Particularly useful for AI systems that need to track opponent expansion
- Can be used to trigger diplomatic evaluations or strategic reassessments
- Coordinates allow for immediate spatial analysis and threat assessment

### Map Considerations
- Coordinates are in the game's internal hex grid system
- X and Y values are 0-based and correspond to the game map dimensions
- Plot coordinates can be used with `Map.GetPlot(x, y)` to access additional location data

## Implementation Notes

The event is called from the Community Patch DLL's player city founding logic, ensuring it captures all valid city establishments including:
- Settler founding
- City capture and refounding
- Special scenario city placements

This makes it a reliable hook for monitoring all city establishment activities in the game.