# UnitSetXY Event

## Overview

The `UnitSetXY` event is triggered when a unit's position is being set or updated on the game map. This event provides information about the unit and its new coordinates.

## When This Event is Triggered

This event is fired when a unit's X and Y coordinates are being set or modified on the game map. This typically occurs during:
- Unit movement
- Unit teleportation
- Unit placement
- Position updates due to game mechanics

## Event Parameters

The event receives the following parameters in order:

| Parameter | Type | Description |
|-----------|------|-------------|
| `owner` | Integer | The player ID who owns the unit |
| `unitId` | Integer | The unique identifier of the unit being positioned |
| `x` | Integer | The X coordinate on the game map where the unit is being placed |
| `y` | Integer | The Y coordinate on the game map where the unit is being placed |

## Source Location

**File:** `CvGameCoreDLL_Expansion2/CvUnit.cpp`  
**Line:** 20899

## Implementation Details

The event is called from the C++ DLL using the following code structure:
```cpp
args->Push(getOwner());    // Player ID
args->Push(GetID());       // Unit ID  
args->Push(getX());        // X coordinate
args->Push(getY());        // Y coordinate
LuaSupport::CallHook(pkScriptSystem, "UnitSetXY", args.get(), bResult);
```

## Usage Examples

### Basic Event Handler
```lua
function OnUnitSetXY(playerId, unitId, x, y)
    print("Unit " .. unitId .. " owned by player " .. playerId .. 
          " positioned at (" .. x .. ", " .. y .. ")")
end

Events.UnitSetXY.Add(OnUnitSetXY)
```

### Tracking Unit Movement
```lua
local unitPositions = {}

function OnUnitSetXY(playerId, unitId, x, y)
    local key = playerId .. "_" .. unitId
    local previousPos = unitPositions[key]
    
    if previousPos then
        local distance = Map.PlotDistance(previousPos.x, previousPos.y, x, y)
        print("Unit moved " .. distance .. " tiles")
    end
    
    unitPositions[key] = {x = x, y = y}
end

Events.UnitSetXY.Add(OnUnitSetXY)
```

## Related Events

- `UnitMoved` - Triggered when a unit completes movement
- `UnitCreated` - Triggered when a new unit is created
- `UnitDestroyed` - Triggered when a unit is destroyed
- `UnitTeleported` - May be related to special movement cases

## Special Considerations

- This event is called during the positioning process, which may occur multiple times for complex movements
- The coordinates provided are the destination coordinates where the unit is being placed
- This event occurs at a low level in the unit positioning system and may fire for both player and AI units
- Care should be taken when performing expensive operations in this event handler, as it may be called frequently during gameplay

## Notes

- This event is part of the Community Patch DLL's Lua hook system
- The event provides immediate notification of unit position changes at the C++ level
- Handlers for this event should be efficient as it may be called multiple times per turn for active units