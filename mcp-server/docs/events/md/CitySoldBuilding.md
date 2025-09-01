# CitySoldBuilding Event

## Description

The `CitySoldBuilding` event is triggered when a player sells a building from one of their cities in Civilization V. This event provides information about which player performed the action, which city the building was sold from, and which specific building was sold.

## When This Event Is Triggered

This event occurs when:
- A player manually sells a building from a city through the city management interface
- A building is automatically sold due to game mechanics or mod functionality
- The sell building network message is processed by the game engine

The event is called from the network message handler, specifically when processing building sale transactions.

## Event Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `ePlayer` | PlayerID | The unique identifier of the player who sold the building |
| `iCityID` | CityID | The unique identifier of the city from which the building was sold |
| `eBuilding` | BuildingType | The type/identifier of the building that was sold |

### Parameter Details

- **ePlayer**: Represents the player performing the building sale action. This is typically the current player's turn, but could be any player in multiplayer scenarios.
- **iCityID**: The internal city identifier used by the game engine to track individual cities. This allows precise identification of which city the transaction occurred in.
- **eBuilding**: The building type enumeration that specifies exactly which building was sold (e.g., Library, Granary, Market, etc.).

## Usage Examples

### Basic Event Handling
```lua
function OnCitySoldBuilding(playerID, cityID, buildingType)
    local player = Players[playerID]
    local city = player:GetCityByID(cityID)
    local buildingInfo = GameInfo.Buildings[buildingType]
    
    print(string.format("Player %s sold %s in city %s", 
          player:GetName(), 
          buildingInfo.Description, 
          city:GetName()))
end

Events.CitySoldBuilding.Add(OnCitySoldBuilding)
```

### Economic Tracking
```lua
function TrackBuildingSales(playerID, cityID, buildingType)
    -- Track economic decisions for AI analysis
    local buildingInfo = GameInfo.Buildings[buildingType]
    local goldGained = buildingInfo.GoldMaintenance * 10 -- Typical sell value
    
    -- Log the economic impact
    GameEvents.LogEconomicEvent.Call(playerID, "BUILDING_SOLD", goldGained)
end

Events.CitySoldBuilding.Add(TrackBuildingSales)
```

### City Management Analysis
```lua
function AnalyzeCityOptimization(playerID, cityID, buildingType)
    local player = Players[playerID]
    local city = player:GetCityByID(cityID)
    local buildingInfo = GameInfo.Buildings[buildingType]
    
    -- Analyze if this was a strategic decision
    if city:GetGold() < 0 and buildingInfo.GoldMaintenance > 0 then
        -- Player likely sold due to maintenance costs
        GameEvents.StrategicDecision.Call(playerID, "MAINTENANCE_OPTIMIZATION")
    end
end

Events.CitySoldBuilding.Add(AnalyzeCityOptimization)
```

## Related Events

- **`CityBoughtPlot`**: Triggered when a city purchases a tile
- **`CityCultureChanged`**: May be relevant if selling culture-generating buildings
- **`CityGoldChanged`**: Related to the economic impact of selling buildings
- **`BuildingConstructed`**: The opposite action of building construction
- **`CityProductionChanged`**: May be affected if selling production-enhancing buildings

## Special Notes

### Technical Implementation
- The event is called from `CvDllNetMessageHandler.cpp` at line 1125
- The event uses the LuaSupport system to bridge C++ game engine events to Lua scripting
- Parameters are pushed to the argument stack in the order: Player, CityID, Building

### Game Mechanics Considerations
- Building sales typically refund a portion of the original construction cost
- Some buildings may not be sellable due to game rules or mod restrictions
- The sale may trigger cascading effects (e.g., losing building bonuses, affecting city yields)
- In multiplayer games, this event fires for all players' building sales

### Modding Applications
- Economic tracking and analysis systems
- AI decision-making enhancement
- City management optimization tools
- Historical event logging
- Strategic decision analysis

### Performance Notes
- This is a relatively infrequent event compared to per-turn events
- Event handlers should be efficient as they may be called during network message processing
- Consider batching related operations if multiple buildings are sold in succession

## Source Reference

**File**: `CvGameCoreDLL_Expansion2/CvDllNetMessageHandler.cpp`  
**Line**: 1125  
**Implementation**: `LuaSupport::CallHook(pkScriptSystem, "CitySoldBuilding", args.get(), bResult);`