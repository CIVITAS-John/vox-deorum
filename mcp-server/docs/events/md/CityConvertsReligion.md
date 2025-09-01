# CityConvertsReligion Event

## Overview
The `CityConvertsReligion` event is triggered when a city in Civilization V converts to a different religion, becoming the majority religion in that city.

## When This Event is Triggered
This event fires when:
- A city's religious population shifts and a new religion becomes the majority
- The conversion process completes and the city officially adopts the new religion
- Religious pressure or missionary activities successfully convert a city

## Event Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerID` | `int` | The ID of the player who owns the city that converted |
| `religionID` | `int` | The ID of the religion that the city converted to (new majority religion) |
| `cityX` | `int` | The X coordinate of the city on the game map |
| `cityY` | `int` | The Y coordinate of the city on the game map |

### Parameter Details

- **playerID**: Identifies the civilization that controls the converting city. This allows tracking which player's cities are being converted.
- **religionID**: The numerical identifier for the religion that has become the new majority. This corresponds to the religion enum values in the game.
- **cityX/cityY**: The map coordinates of the city, allowing precise identification of which city converted.

## Usage Examples

### Basic Event Handling
```lua
function OnCityConvertsReligion(playerID, religionID, cityX, cityY)
    local player = Players[playerID]
    local city = Map.GetPlot(cityX, cityY):GetPlotCity()
    
    print("City " .. city:GetName() .. " has converted to religion " .. religionID)
    print("City belongs to player " .. playerID)
end

Events.CityConvertsReligion.Add(OnCityConvertsReligion)
```

### Advanced Event Processing
```lua
function OnCityConvertsReligion(playerID, religionID, cityX, cityY)
    local player = Players[playerID]
    local city = Map.GetPlot(cityX, cityY):GetPlotCity()
    local religion = GameInfos.Religions[religionID]
    
    -- Log the conversion
    print(string.format("RELIGION: %s converted to %s (Player %d)", 
          city:GetName(), 
          religion and religion.Description or "Unknown Religion",
          playerID))
    
    -- Check if this is a human player's city
    if player:IsHuman() then
        -- Notify human player of religious conversion
        player:AddNotification(NotificationTypes.NOTIFICATION_RELIGION_SPREAD,
                              "Your city has converted!",
                              "The city of " .. city:GetName() .. " has converted to a new religion.")
    end
end
```

## Related Events and Considerations

### Related Events
- `ReligionFounded` - When a new religion is founded
- `ReligionSpread` - When religion spreads to a city (but doesn't necessarily convert it)
- `ReligionEnhanced` - When a religion receives enhancements
- `InquisitionBegins` - When religious persecution begins

### Gameplay Implications
- **Diplomatic Impact**: Religious conversions can affect diplomatic relations between civilizations
- **Cultural Influence**: Converting cities can spread cultural influence and tourism
- **Strategic Planning**: Players may want to respond to conversions with missionaries or inquisitors
- **Victory Conditions**: Religious conversions are crucial for Religious Victory conditions

## Special Notes

### Technical Implementation
- This event is triggered from `CvReligionClasses.cpp` at line 5716
- The event occurs after the internal game state has been updated to reflect the conversion
- The event provides city coordinates rather than a direct city object reference

### Performance Considerations
- This event can fire frequently in games with active religious gameplay
- Event handlers should be optimized for performance to avoid game slowdown
- Consider batching operations if processing multiple conversions

### Data Validation
- Always validate that the player and city exist before processing
- Check that coordinates are valid map positions
- Verify religion ID corresponds to an actual religion in the game

## Source Reference
- **File**: `CvGameCoreDLL_Expansion2/CvReligionClasses.cpp`
- **Line**: 5716
- **Implementation**: Called through `LuaSupport::CallHook` mechanism

## Version History
- **Generated**: 2025-09-01T01:20:46.712Z
- **Occurrences**: 1 reference found in codebase