# ParadropAt Event

## Overview

The `ParadropAt` event is triggered when a unit performs a paradrop operation from one location to another in Civilization V. This event captures the movement of airborne units (typically paratroopers) as they are deployed from their current position to a target location.

## Event Trigger

This event is fired when:
- A unit with paradrop capability executes a paradrop maneuver
- The unit successfully moves from its origin plot to the target plot via air transport
- The paradrop action is completed in the game engine

## Event Parameters

The `ParadropAt` event passes the following parameters to Lua event handlers:

| Parameter | Type | Description |
|-----------|------|-------------|
| `owner` | `int` | The player ID who owns the unit performing the paradrop |
| `unitId` | `int` | The unique identifier of the unit being paradropped |
| `fromX` | `int` | The X coordinate of the plot where the unit originated |
| `fromY` | `int` | The Y coordinate of the plot where the unit originated |
| `toX` | `int` | The X coordinate of the target plot where the unit lands |
| `toY` | `int` | The Y coordinate of the target plot where the unit lands |

## Usage Examples

### Basic Event Handler

```lua
function OnParadropAt(ownerId, unitId, fromX, fromY, toX, toY)
    local player = Players[ownerId]
    local unit = player:GetUnitByID(unitId)
    
    if unit then
        local unitName = unit:GetName()
        print(string.format("%s paradropped from (%d,%d) to (%d,%d)", 
              unitName, fromX, fromY, toX, toY))
    end
end
Events.ParadropAt.Add(OnParadropAt)
```

### Tracking Paradrop Distance

```lua
function OnParadropAt(ownerId, unitId, fromX, fromY, toX, toY)
    local distance = Map.PlotDistance(fromX, fromY, toX, toY)
    local player = Players[ownerId]
    
    -- Log long-range paradrops
    if distance > 5 then
        print(string.format("Long-range paradrop detected: %d tiles", distance))
    end
end
Events.ParadropAt.Add(OnParadropAt)
```

### Strategic Analysis

```lua
function OnParadropAt(ownerId, unitId, fromX, fromY, toX, toY)
    local fromPlot = Map.GetPlot(fromX, fromY)
    local toPlot = Map.GetPlot(toX, toY)
    local player = Players[ownerId]
    
    -- Analyze tactical significance
    if toPlot:IsEnemyCity(player:GetTeam()) then
        print("Paradrop near enemy city detected - possible assault preparation")
    end
    
    if toPlot:GetResourceType() ~= -1 then
        print("Paradrop on strategic resource location")
    end
end
Events.ParadropAt.Add(OnParadropAt)
```

## Related Events and Considerations

### Related Events
- `UnitMoved` - General unit movement event that may also fire for paradrops
- `UnitSetXY` - Low-level position change event
- `UnitCreated` - May be relevant if paradrop units are spawned rather than moved

### Tactical Considerations
- Paradrop operations typically have range limitations based on unit type
- Some terrain types may restrict paradrop landing zones
- Enemy units or cities in the target area may affect paradrop success
- Paradrops can be used for both offensive and defensive operations

### Performance Notes
- This event fires for each individual paradrop operation
- High-frequency paradrop operations (multiple units) may generate multiple rapid events
- Consider batching operations if processing multiple paradrops simultaneously

## Special Notes

- The event is triggered from the C++ DLL layer (`CvUnit.cpp` line 8915)
- Coordinates use the standard Civilization V hex grid system
- The event occurs after the paradrop has been validated and executed by the game engine
- Units must have the appropriate promotion or unit type to perform paradrops
- Weather, terrain, and diplomatic conditions may affect paradrop availability but are not reflected in this event's parameters

## Source Reference

**File:** `CvGameCoreDLL_Expansion2/CvUnit.cpp`  
**Line:** 8915  
**Implementation:** LuaSupport::CallHook with 6 parameters (owner, unitId, fromX, fromY, toX, toY)