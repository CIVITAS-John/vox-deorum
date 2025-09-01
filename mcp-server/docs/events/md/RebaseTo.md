# RebaseTo Event

## Overview

The `RebaseTo` event is triggered when a unit in Civilization V performs a rebase operation to a new location. This event is primarily used for air units and other units that can relocate to different positions on the map without traditional movement.

## Event Trigger

This event is fired from the Community Patch DLL when a unit successfully rebases to a new position. The event occurs after the rebase operation has been validated and executed.

**Source Location:** `CvGameCoreDLL_Expansion2/CvUnit.cpp` (line 10281)

## Event Parameters

The `RebaseTo` event provides the following parameters in order:

| Parameter | Type | Description |
|-----------|------|-------------|
| `owner` | PlayerID (integer) | The player ID who owns the unit performing the rebase |
| `unitID` | UnitID (integer) | The unique identifier of the unit being rebased |
| `targetX` | integer | The X coordinate of the target rebase location |
| `targetY` | integer | The Y coordinate of the target rebase location |

## Parameter Details

### owner (PlayerID)
- **Type:** Integer
- **Description:** Identifies which player owns the unit that is rebasing
- **Range:** 0 to maximum number of players in the game

### unitID
- **Type:** Integer  
- **Description:** The unique identifier of the specific unit performing the rebase operation
- **Usage:** Can be used to retrieve additional unit information or track unit-specific actions

### targetX, targetY
- **Type:** Integer coordinates
- **Description:** The map coordinates where the unit is rebasing to
- **Usage:** Defines the exact tile location for the rebase destination

## Usage Examples

### Lua Event Handler
```lua
-- Register event handler for unit rebase operations
Events.RebaseTo.Add(function(playerID, unitID, targetX, targetY)
    local player = Players[playerID]
    local unit = player:GetUnitByID(unitID)
    
    if unit then
        local unitName = unit:GetName()
        local targetPlot = Map.GetPlot(targetX, targetY)
        
        print(string.format("%s rebased to (%d, %d)", 
              unitName, targetX, targetY))
        
        -- Additional logic for rebase tracking or validation
        if targetPlot:IsCity() then
            print("Unit rebased to a city location")
        end
    end
end)
```

### Strategic AI Integration
```lua
-- Track air unit rebase patterns for strategic analysis
local rebaseHistory = {}

Events.RebaseTo.Add(function(playerID, unitID, targetX, targetY)
    local unit = Players[playerID]:GetUnitByID(unitID)
    
    if unit and unit:GetDomainType() == DomainTypes.DOMAIN_AIR then
        -- Record rebase for strategic planning
        if not rebaseHistory[unitID] then
            rebaseHistory[unitID] = {}
        end
        
        table.insert(rebaseHistory[unitID], {
            x = targetX,
            y = targetY,
            turn = Game.GetGameTurn()
        })
    end
end)
```

## Related Events

- **UnitMoved**: Triggered for regular unit movement (not rebasing)
- **UnitCreated**: When new units are created that might later rebase
- **UnitKilled**: When rebased units are destroyed
- **CityBombard**: Air units often rebase to perform bombardment actions

## Special Considerations

### Air Unit Mechanics
- This event is most commonly triggered by air units (fighters, bombers, helicopters)
- Air units have specific rebase range limitations based on their movement points
- Rebasing typically consumes all remaining movement points for the turn

### Validation
- The event fires after successful validation of the rebase operation
- Invalid rebase attempts (out of range, occupied tiles, etc.) will not trigger this event
- The target location has already been confirmed as valid when this event fires

### Performance Notes
- This event may fire multiple times per turn for players with large air forces
- Consider performance implications when implementing complex event handlers
- The event provides coordinates directly, avoiding the need for additional plot lookups

## Integration with Vox Deorum

In the context of the Vox Deorum AI system, the `RebaseTo` event can be used to:

- Track air unit positioning for tactical analysis
- Monitor enemy air force deployment patterns
- Coordinate AI-driven air unit strategies
- Provide real-time unit movement data to the MCP server for strategic decision making

The event data flows through the Bridge Service to the MCP Server, where it can be processed by AI agents for strategic planning and response coordination.