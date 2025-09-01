# UnitPrekill Event

## Overview

The `UnitPrekill` event is triggered in Civilization V just before a unit is about to be killed or destroyed. This event provides an opportunity for mods and external systems to intercept and potentially modify the unit destruction process.

## When This Event is Triggered

This event is fired from the game's core DLL (`CvUnit.cpp`) when a unit is about to be destroyed, before the actual destruction occurs. The "prekill" nature of this event allows for last-minute interventions or data collection before the unit is removed from the game.

**Source Location**: `CvGameCoreDLL_Expansion2/CvUnit.cpp` at line 2655

## Event Parameters

The `UnitPrekill` event passes the following parameters in order:

| Parameter | Type | Description |
|-----------|------|-------------|
| `eUnitOwner` | `int` | The player ID who owns the unit that is about to be killed |
| `unitId` | `int` | The unique identifier of the unit being killed |
| `unitType` | `int` | The unit type identifier (corresponds to game's unit definitions) |
| `x` | `int` | The X coordinate of the unit's current position on the map |
| `y` | `int` | The Y coordinate of the unit's current position on the map |
| `bDelay` | `boolean` | Flag indicating whether the kill operation should be delayed |
| `ePlayer` | `int` | The player ID associated with the kill action (may be attacker or event initiator) |

## Parameter Details

### eUnitOwner
- **Type**: Integer (Player ID)
- **Description**: Identifies which civilization/player owns the unit that is being destroyed

### unitId
- **Type**: Integer
- **Description**: Unique identifier for the specific unit instance within the game session

### unitType
- **Type**: Integer
- **Description**: References the unit's type definition from the game's unit database (e.g., warrior, archer, settler)

### x, y Coordinates
- **Type**: Integer
- **Description**: The map coordinates where the unit is currently located when the kill event occurs

### bDelay
- **Type**: Boolean
- **Description**: Indicates whether the unit destruction should be delayed, potentially allowing for animations or other processing

### ePlayer
- **Type**: Integer (Player ID)
- **Description**: The player associated with causing the unit's death (could be the attacker in combat, or another player through various game mechanics)

## Usage Examples

### Basic Event Handler
```lua
function OnUnitPrekill(eUnitOwner, unitId, unitType, x, y, bDelay, ePlayer)
    print("Unit about to be killed:")
    print("  Owner: " .. tostring(eUnitOwner))
    print("  Unit ID: " .. tostring(unitId))
    print("  Unit Type: " .. tostring(unitType))
    print("  Position: (" .. tostring(x) .. ", " .. tostring(y) .. ")")
    print("  Delayed: " .. tostring(bDelay))
    print("  Killer Player: " .. tostring(ePlayer))
end

Events.UnitPrekill.Add(OnUnitPrekill)
```

### Advanced Usage with Unit Information
```lua
function OnUnitPrekill(eUnitOwner, unitId, unitType, x, y, bDelay, ePlayer)
    local pUnit = Players[eUnitOwner]:GetUnitByID(unitId)
    if pUnit then
        local unitName = pUnit:GetName()
        local pOwner = Players[eUnitOwner]
        local ownerName = pOwner:GetName()
        
        print(string.format("%s's %s is about to be destroyed at (%d, %d)", 
              ownerName, unitName, x, y))
              
        -- Log important unit deaths
        if pUnit:IsGreatPerson() then
            print("WARNING: Great Person about to be killed!")
        end
    end
end

Events.UnitPrekill.Add(OnUnitPrekill)
```

## Related Events

- **UnitKilled**: Fired after a unit has been destroyed (post-kill event)
- **CombatResult**: Triggered after combat resolution, which may lead to unit death
- **UnitDestroyed**: Alternative event that may be fired in different destruction scenarios

## Special Notes

1. **Timing**: This event occurs before the unit is actually removed from the game, so the unit object should still be accessible through normal game API calls.

2. **Intervention Opportunity**: Since this is a "prekill" event, there may be opportunities to prevent or modify the unit destruction through return values or game state modifications (depending on the specific implementation in the Community Patch framework).

3. **Performance Considerations**: This event can be triggered frequently during combat-heavy periods of the game, so event handlers should be optimized for performance.

4. **Player Context**: The distinction between `eUnitOwner` and `ePlayer` is important - the owner is who possesses the unit, while `ePlayer` represents who is causing the death.

5. **Coordinate Validity**: The X,Y coordinates represent the unit's last known position and should be valid map coordinates at the time of the event.

## Implementation Notes

This event is part of the Community Patch DLL modifications and integrates with the Vox Deorum system's Bridge Service for external AI system communication. The event data can be captured and processed by external agents through the MCP (Model Context Protocol) server interface.