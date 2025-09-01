# NaturalWonderDiscovered Event

## Overview

The `NaturalWonderDiscovered` event is triggered when a team discovers a natural wonder in Civilization V. This event provides information about which team made the discovery, the type of natural wonder found, its location, and whether this is the first discovery of this particular wonder by any major civilization.

## Event Trigger

This event is fired when:
- A team's unit or city reveals a plot containing a natural wonder feature
- The natural wonder becomes visible to the discovering team for the first time
- The event occurs during map exploration or territory expansion

**Source Location:** `CvGameCoreDLL_Expansion2/CvPlot.cpp` (line 11999)

## Event Parameters

The event passes the following parameters to Lua event handlers:

| Parameter | Type | Description |
|-----------|------|-------------|
| `eTeam` | TeamID | The ID of the team that discovered the natural wonder |
| `featureType` | FeatureType | The type/ID of the natural wonder feature that was discovered |
| `x` | Integer | The X coordinate of the plot containing the natural wonder |
| `y` | Integer | The Y coordinate of the plot containing the natural wonder |
| `bFirst` | Boolean | `true` if this is the first major civilization to discover this natural wonder, `false` otherwise |

## Parameter Details

### Team ID (`eTeam`)
- Identifies which team made the discovery
- Can be used to determine the discovering player or civilization
- Useful for tracking exploration progress by team

### Feature Type (`featureType`)
- Represents the specific type of natural wonder discovered
- Maps to the game's feature enumeration system
- Examples include: Mount Fuji, Grand Canyon, Great Barrier Reef, etc.

### Coordinates (`x`, `y`)
- Provides the exact map location of the natural wonder
- Uses the game's coordinate system
- Can be used for distance calculations, strategic planning, or UI updates

### First Discovery Flag (`bFirst`)
- Indicates whether this is a "first discovery" by any major civilization
- Based on `getNumMajorCivsRevealed() == 0` condition
- Important for determining discovery bonuses or achievements
- City-states and other non-major civilizations don't count toward this flag

## Usage Examples

### Basic Event Handler
```lua
function OnNaturalWonderDiscovered(teamID, featureType, x, y, bFirst)
    local team = Teams[teamID]
    local player = Players[team:GetLeaderID()]
    
    if bFirst then
        print("First discovery of natural wonder by " .. player:GetName())
        -- Award first discovery bonus
    else
        print("Natural wonder rediscovered by " .. player:GetName())
    end
    
    -- Log the discovery location
    print("Natural wonder found at coordinates (" .. x .. ", " .. y .. ")")
end

Events.NaturalWonderDiscovered.Add(OnNaturalWonderDiscovered)
```

### Strategic Analysis
```lua
function OnNaturalWonderDiscovered(teamID, featureType, x, y, bFirst)
    -- Store discovery for strategic planning
    local plot = Map.GetPlot(x, y)
    local wonderInfo = {
        teamID = teamID,
        featureType = featureType,
        location = {x = x, y = y},
        firstDiscovery = bFirst,
        turn = Game.GetGameTurn()
    }
    
    -- Add to strategic database
    AddNaturalWonderToDatabase(wonderInfo)
    
    -- Evaluate strategic value
    EvaluateNaturalWonderValue(plot, featureType)
end
```

## Related Events

- **PlotRevealed**: Fired when any plot becomes visible to a team
- **TeamMeet**: May be relevant if the discovery leads to meeting other civilizations
- **CityFounded**: Natural wonders often influence city placement decisions

## Special Considerations

### Performance Notes
- This event fires once per team per natural wonder discovery
- Multiple teams can discover the same natural wonder, triggering multiple events
- The `bFirst` flag only considers major civilizations, not city-states

### Strategic Implications
- Natural wonders provide significant bonuses and are valuable strategic resources
- First discovery often provides additional benefits (culture, gold, etc.)
- Location information is crucial for territorial planning and city placement
- Some natural wonders have special victory condition implications

### Modding Considerations
- The feature type parameter allows mods to add custom natural wonders
- Coordinate information enables custom UI overlays or notifications
- The first discovery flag can be used for custom achievement systems
- Event timing occurs after the wonder is revealed but before any UI updates

## Technical Notes

- **Event Frequency**: Single occurrence per team per natural wonder
- **Thread Safety**: Called from the main game thread
- **Performance Impact**: Minimal - simple parameter passing
- **Multiplayer**: Synchronized across all players in multiplayer games

## Version Information

- **Generated**: 2025-09-01T01:20:46.712Z
- **Source**: Community Patch DLL
- **Occurrences**: 1 reference found in codebase