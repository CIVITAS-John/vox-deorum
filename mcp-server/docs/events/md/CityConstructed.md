# CityConstructed Event

## Overview

The `CityConstructed` event is triggered when a city completes construction of a building in Civilization V. This event provides information about which player, city, and building was constructed, along with how the construction was completed (through production, gold purchase, or faith/culture purchase).

## When This Event is Triggered

This event is fired when:
- A city completes construction of a building through normal production
- A building is purchased with gold
- A building is purchased with faith or culture

The event occurs in three different scenarios based on the construction method, each providing slightly different parameter values.

## Event Parameters

The event passes the following parameters in order:

| Parameter | Type | Description |
|-----------|------|-------------|
| `owner` | `PlayerID` | The ID of the player who owns the city |
| `cityId` | `CityID` | The unique identifier of the city that constructed the building |
| `buildingType` | `BuildingType` | The type/ID of the building that was constructed |
| `bGold` | `boolean` | `true` if the building was purchased with gold, `false` otherwise |
| `bFaith` | `boolean` | `true` if the building was purchased with faith/culture, `false` otherwise |

## Construction Method Detection

The boolean flags `bGold` and `bFaith` allow you to determine how the building was constructed:

- **Normal Production**: `bGold = false`, `bFaith = false`
- **Gold Purchase**: `bGold = true`, `bFaith = false`  
- **Faith/Culture Purchase**: `bGold = false`, `bFaith = true`

## Usage Examples

### Basic Event Handler
```lua
function OnCityConstructed(playerId, cityId, buildingType, bGold, bFaith)
    local player = Players[playerId]
    local city = player:GetCityByID(cityId)
    local buildingInfo = GameInfo.Buildings[buildingType]
    
    print(string.format("City %s (Player %d) constructed %s", 
          city:GetName(), playerId, buildingInfo.Type))
    
    if bGold then
        print("Building was purchased with gold")
    elseif bFaith then
        print("Building was purchased with faith/culture")
    else
        print("Building was constructed through normal production")
    end
end

Events.CityConstructed.Add(OnCityConstructed)
```

### Tracking Construction Methods
```lua
local constructionStats = {
    production = 0,
    gold = 0,
    faith = 0
}

function OnCityConstructed(playerId, cityId, buildingType, bGold, bFaith)
    if bGold then
        constructionStats.gold = constructionStats.gold + 1
    elseif bFaith then
        constructionStats.faith = constructionStats.faith + 1
    else
        constructionStats.production = constructionStats.production + 1
    end
end

Events.CityConstructed.Add(OnCityConstructed)
```

### Player-Specific Building Tracking
```lua
function OnCityConstructed(playerId, cityId, buildingType, bGold, bFaith)
    -- Only track human player's constructions
    if Players[playerId]:IsHuman() then
        local buildingInfo = GameInfo.Buildings[buildingType]
        local city = Players[playerId]:GetCityByID(cityId)
        
        print(string.format("You completed %s in %s!", 
              buildingInfo.Description, city:GetName()))
        
        -- Special handling for wonder constructions
        if buildingInfo.MaxGlobalInstances == 1 then
            print("Congratulations on completing a world wonder!")
        end
    end
end

Events.CityConstructed.Add(OnCityConstructed)
```

## Related Events

- **`CityTrained`** - Triggered when a city completes training a unit
- **`BuildingConstructed`** - May be a related event for building completion
- **`CityBoughtPlot`** - Triggered when a city purchases a tile
- **`PlayerDoTurn`** - Can be used to check city states at turn boundaries

## Technical Notes

- The event is triggered from `CvCity.cpp` in the Community Patch DLL
- There are three separate trigger points in the code, corresponding to the three construction methods
- The `buildingType` parameter uses the internal building ID, which can be resolved using `GameInfo.Buildings`
- The event occurs after the building has been successfully added to the city
- This event is called through the Lua scripting system hook mechanism

## Source References

The event is triggered from the following locations in the codebase:
- `CvCity.cpp:29627` - Normal production completion
- `CvCity.cpp:30856` - Gold purchase completion  
- `CvCity.cpp:30907` - Faith/culture purchase completion

## Considerations

- Always validate that the player and city objects exist before accessing their properties
- Be aware that AI players will also trigger this event frequently
- The building type ID needs to be cross-referenced with GameInfo.Buildings for meaningful data
- Consider performance implications when adding heavy processing to this frequently-triggered event
- The event fires for all building types, including both regular buildings and wonders