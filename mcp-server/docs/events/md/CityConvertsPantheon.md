# CityConvertsPantheon Event

## Overview

The `CityConvertsPantheon` event is triggered when a city converts to following a pantheon belief in Civilization V. This event is part of the religion system and occurs during the religious conversion mechanics within the game.

## Event Trigger

This event is fired when:
- A city adopts a pantheon belief for the first time
- The city's religious state changes to follow a pantheon
- Religious pressure or other game mechanics cause a city to convert to a pantheon

The event is called from the religion classes in the game's core DLL, specifically within the city conversion logic.

## Event Parameters

The event passes the following parameters to Lua event handlers:

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerID` | Integer | The ID of the player who owns the city that converted to the pantheon |
| `cityX` | Integer | The X coordinate of the city on the game map |
| `cityY` | Integer | The Y coordinate of the city on the game map |

### Parameter Details

- **playerID**: Represents the civilization/player that controls the city. This can be used to identify which player's city is affected by the pantheon conversion.
- **cityX, cityY**: The map coordinates allow precise identification of which city converted. These coordinates can be used with game API functions to retrieve the full city object and additional city information.

## Usage Examples

### Basic Event Handler

```lua
-- Register the event handler
GameEvents.CityConvertsPantheon.Add(OnCityConvertsPantheon)

function OnCityConvertsPantheon(playerID, cityX, cityY)
    local player = Players[playerID]
    if player then
        local city = Map.GetPlot(cityX, cityY):GetPlotCity()
        if city then
            print(string.format("City %s (Player %d) has converted to a pantheon!", 
                city:GetName(), playerID))
        end
    end
end
```

### Advanced Usage with City Information

```lua
function OnCityConvertsPantheon(playerID, cityX, cityY)
    local player = Players[playerID]
    local plot = Map.GetPlot(cityX, cityY)
    local city = plot:GetPlotCity()
    
    if player and city then
        local cityName = city:GetName()
        local playerName = player:GetName()
        local population = city:GetPopulation()
        
        -- Log the conversion
        print(string.format("%s's city of %s (pop. %d) at (%d,%d) converted to pantheon", 
            playerName, cityName, population, cityX, cityY))
        
        -- Trigger custom game logic
        -- e.g., award faith, trigger notifications, update UI
    end
end
```

## Related Events

This event is part of the broader religion system and may be related to:

- **CityConvertsReligion**: Triggered when a city converts to a full religion (not just pantheon)
- **PantheonFounded**: Triggered when a pantheon is first founded by a player
- **ReligionFounded**: Triggered when a full religion is established
- **CityReligionChange**: More general religious state changes in cities

## Technical Notes

### Source Location
- **File**: `CvGameCoreDLL_Expansion2/CvReligionClasses.cpp`
- **Line**: 5748
- **Function Context**: City religion conversion logic

### Implementation Details
- The event is called using the Lua support hook system: `LuaSupport::CallHook`
- Arguments are pushed to a Lua argument stack before the event is fired
- The event occurs during the internal religion calculation and conversion process

### Performance Considerations
- This event may fire frequently in games with active religious competition
- Event handlers should be optimized for performance, especially in late-game scenarios with many cities
- Consider batching operations or using conditional logic to reduce processing overhead

## Best Practices

1. **Validation**: Always validate that the player and city exist before accessing their properties
2. **Performance**: Keep event handlers lightweight to avoid game performance issues
3. **Null Checks**: Verify that `Map.GetPlot()` and `GetPlotCity()` return valid objects
4. **Error Handling**: Implement proper error handling to prevent crashes from invalid data

## Example Use Cases

- **Achievement Systems**: Track pantheon conversions for achievement progress
- **Notification Systems**: Alert players when their cities adopt pantheons
- **AI Decision Making**: Help AI players make strategic decisions based on religious spread
- **Statistics Tracking**: Maintain detailed religion statistics for post-game analysis
- **Custom Religion Mechanics**: Implement additional game rules or bonuses based on pantheon adoption