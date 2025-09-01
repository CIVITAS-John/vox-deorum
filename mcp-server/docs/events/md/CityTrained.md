# CityTrained Event

## Overview
The `CityTrained` event is triggered when a city completes training a unit in Civilization V. This event provides information about the city that trained the unit, the unit itself, and the method by which the training was completed (normal production, gold purchase, or faith/culture purchase).

## When This Event is Triggered
This event fires in the following scenarios:
1. **Normal unit production** - When a city completes training a unit through regular production
2. **Gold purchase** - When a unit is purchased with gold in a city
3. **Faith/Culture purchase** - When a unit is purchased using faith or culture points

## Event Parameters

The event passes five parameters to Lua event handlers:

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerID` | `integer` | The ID of the player who owns the city that trained the unit |
| `cityID` | `integer` | The unique ID of the city that trained the unit |
| `unitID` | `integer` | The unique ID of the newly trained unit |
| `bGold` | `boolean` | `true` if the unit was purchased with gold, `false` otherwise |
| `bFaithCulture` | `boolean` | `true` if the unit was purchased with faith or culture, `false` otherwise |

## Parameter Combinations

The boolean parameters indicate the training method:
- Normal production: `bGold = false`, `bFaithCulture = false`
- Gold purchase: `bGold = true`, `bFaithCulture = false`
- Faith/Culture purchase: `bGold = false`, `bFaithCulture = true`

## Usage Examples

### Basic Event Handler
```lua
function OnCityTrained(playerID, cityID, unitID, bGold, bFaithCulture)
    local player = Players[playerID]
    local city = player:GetCityByID(cityID)
    local unit = player:GetUnitByID(unitID)
    
    if city and unit then
        local cityName = city:GetName()
        local unitType = unit:GetUnitType()
        local unitName = GameInfo.Units[unitType].Type
        
        print(string.format("City %s trained unit %s", cityName, unitName))
        
        if bGold then
            print("Unit was purchased with gold")
        elseif bFaithCulture then
            print("Unit was purchased with faith or culture")
        else
            print("Unit was trained through normal production")
        end
    end
end

Events.CityTrained.Add(OnCityTrained)
```

### Tracking Military Unit Production
```lua
function OnMilitaryUnitTrained(playerID, cityID, unitID, bGold, bFaithCulture)
    local player = Players[playerID]
    local unit = player:GetUnitByID(unitID)
    
    if unit then
        local unitInfo = GameInfo.Units[unit:GetUnitType()]
        
        -- Check if it's a military unit
        if unitInfo.Combat > 0 or unitInfo.RangedCombat > 0 then
            local city = player:GetCityByID(cityID)
            if city then
                print(string.format("Military unit %s trained in %s", 
                    unitInfo.Type, city:GetName()))
            end
        end
    end
end

Events.CityTrained.Add(OnMilitaryUnitTrained)
```

### Purchase Method Analysis
```lua
function OnUnitPurchaseAnalysis(playerID, cityID, unitID, bGold, bFaithCulture)
    local purchaseMethod = "production"
    
    if bGold then
        purchaseMethod = "gold"
    elseif bFaithCulture then
        purchaseMethod = "faith/culture"
    end
    
    -- Log purchase statistics or trigger AI responses
    LogUnitPurchase(playerID, cityID, unitID, purchaseMethod)
end

Events.CityTrained.Add(OnUnitPurchaseAnalysis)
```

## Related Events

- **`CityCanTrain`** - Fired to check if a city can train a specific unit
- **`PlayerCanTrain`** - Fired to check if a player can train a specific unit type
- **`UnitCreated`** - General event for when any unit is created (not just trained)
- **`CityProduction`** - Events related to city production choices

## Technical Implementation

The event is implemented in three locations within `CvCity.cpp`:

1. **Line 29541** - Normal unit training completion
2. **Line 30591** - Gold purchase of units  
3. **Line 30651** - Faith/Culture purchase of units

Each implementation pushes the same five parameters but with different boolean flag combinations to distinguish the training method.

## Special Considerations

### Performance Notes
- This event fires frequently in active games, so event handlers should be optimized
- Avoid expensive operations within event handlers unless necessary

### Timing
- The event fires after the unit has been created and added to the player's unit list
- The unit is fully initialized and can be queried for its properties

### Multiplayer Compatibility
- Event handlers should account for both human and AI players
- Use player ID checks if behavior should differ between player types

### Modding Considerations
- Custom units will also trigger this event when trained
- The event respects unit prerequisites and availability conditions
- Modders can use this event to implement custom unit training logic or achievements

## Error Handling

When handling this event, consider these potential issues:
- Units or cities may be null if they were destroyed between event trigger and handler execution
- Player objects should be validated before use
- Unit and city IDs are persistent but should still be validated

```lua
function SafeCityTrainedHandler(playerID, cityID, unitID, bGold, bFaithCulture)
    -- Validate player
    if not Players[playerID] then
        return
    end
    
    local player = Players[playerID]
    local city = player:GetCityByID(cityID)
    local unit = player:GetUnitByID(unitID)
    
    -- Validate city and unit exist
    if not city or not unit then
        print("Warning: CityTrained event fired but city or unit not found")
        return
    end
    
    -- Safe to proceed with event handling
    -- ... your event logic here
end
```