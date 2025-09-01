# CityCreated Event

## Overview
The `CityCreated` event is triggered when a city creates or completes a project in Civilization V. This event provides information about the project creation process, including whether the project was purchased with gold or other resources.

## When This Event is Triggered
This event is fired in two main scenarios:
1. When a city completes a project through normal production
2. When a city purchases a project using gold or other currencies

The event is triggered from `CvCity.cpp` in the Community Patch DLL, specifically when the city's project creation logic is executed.

## Event Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `owner` | `PlayerID` | The ID of the player who owns the city |
| `cityId` | `CityID` | The unique identifier of the city that created the project |
| `projectType` | `ProjectType` | The type of project that was created/completed |
| `bGold` | `boolean` | Indicates whether the project was purchased with gold (`true`) or completed through normal production (`false`) |
| `bFaith` | `boolean` | Indicates whether the project involved faith or culture (currently always `false` based on the code references) |

## Usage Examples

### Basic Event Handler
```lua
function OnCityCreated(playerId, cityId, projectType, bGold, bFaith)
    local player = Players[playerId]
    local city = player:GetCityByID(cityId)
    
    if city then
        local cityName = city:GetName()
        local projectName = GameInfo.Projects[projectType].Description
        
        if bGold then
            print(string.format("%s purchased %s with gold in %s", 
                player:GetName(), projectName, cityName))
        else
            print(string.format("%s completed %s in %s", 
                player:GetName(), projectName, cityName))
        end
    end
end

GameEvents.CityCreated.Add(OnCityCreated)
```

### Tracking Gold Purchases
```lua
function OnCityProjectCreated(playerId, cityId, projectType, bGold, bFaith)
    if bGold then
        -- Handle gold purchase logic
        local player = Players[playerId]
        local city = player:GetCityByID(cityId)
        
        -- Update statistics, trigger notifications, etc.
        UpdatePlayerStats(playerId, "gold_purchases", 1)
    end
end

GameEvents.CityCreated.Add(OnCityProjectCreated)
```

## Related Events
- `CityConstructed` - Fired when a city constructs buildings or units
- `ProjectCompleted` - May be related to general project completion events
- `CityBoughtPlot` - Another city-related purchase event
- `PlayerDoTurn` - Context for when city actions occur

## Implementation Details

### Code References
The event is implemented in two locations within `CvCity.cpp`:

1. **Line 29706**: Standard project completion
   - Parameters: `owner`, `cityId`, `createProject`, `false` (not gold), `false` (not faith/culture)

2. **Line 30994**: Gold purchase scenario  
   - Parameters: `owner`, `cityId`, `projectType`, `true` (gold purchase), `false` (not faith/culture)

### Parameter Variations
The main difference between the two trigger points is the `bGold` parameter:
- Normal production completion: `bGold = false`
- Gold purchase: `bGold = true`

## Special Notes

1. **Faith/Culture Parameter**: Currently, the `bFaith` parameter is always set to `false` in both scenarios. This suggests it may be reserved for future use or different project types.

2. **Project vs Create Distinction**: The variable names suggest a distinction between `eCreateProject` and `eProjectType`, which may indicate different project classification systems within the game.

3. **Event Frequency**: Based on the documentation metadata, this event has been observed 2 times, suggesting it's triggered during specific game scenarios rather than being a high-frequency event.

4. **Compatibility**: This event is part of the Community Patch framework and may not be available in the base Civilization V game.

## Best Practices

- Always check if the city exists before accessing its properties
- Use the `bGold` parameter to differentiate between purchased and produced projects
- Consider the player context when handling this event for multiplayer scenarios
- Cache frequently accessed data to improve performance if handling many city events

## See Also
- [Community Patch DLL Documentation](../../dll/)
- [Lua Event System Overview](../README.md)
- [City Management Events](../city-events.md)