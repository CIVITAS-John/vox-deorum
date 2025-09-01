# UnitGetSpecialExploreTarget Event

## Overview

The `UnitGetSpecialExploreTarget` event is triggered during the Homeland AI's exploration target selection process. This event allows external systems to influence or override the default exploration behavior for units by providing custom exploration targets.

## Event Trigger

This event is fired when the Homeland AI system is determining special exploration targets for units during the AI's turn processing. The event occurs within the exploration logic of the Homeland AI module, specifically when the system is evaluating potential exploration destinations for a unit.

**Source Location:** `CvGameCoreDLL_Expansion2/CvHomelandAI.cpp` at line 2344

## Event Parameters

The event passes the following parameters to Lua hooks:

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerID` | `int` | The ID of the player who owns the unit (retrieved via `pUnit->getOwner()`) |
| `unitID` | `int` | The unique identifier of the unit being processed for exploration (retrieved via `pUnit->GetID()`) |

## Usage Examples

### Basic Event Handler

```lua
-- Register event handler for special explore target selection
function OnUnitGetSpecialExploreTarget(playerID, unitID)
    local player = Players[playerID]
    local unit = player:GetUnitByID(unitID)
    
    if unit then
        -- Custom logic to determine special exploration targets
        local unitType = unit:GetUnitType()
        local unitX, unitY = unit:GetX(), unit:GetY()
        
        -- Example: Prioritize coastal exploration for naval units
        if unit:getDomainType() == DomainTypes.DOMAIN_SEA then
            return GetCoastalExploreTarget(unitX, unitY)
        end
        
        -- Example: Send scouts to unexplored natural wonders
        if unit:IsRecon() then
            return GetNaturalWonderTarget(playerID, unitX, unitY)
        end
    end
    
    return nil -- Return nil to use default exploration logic
end

Events.UnitGetSpecialExploreTarget.Add(OnUnitGetSpecialExploreTarget)
```

### Advanced Strategic Exploration

```lua
function OnUnitGetSpecialExploreTarget(playerID, unitID)
    local player = Players[playerID]
    local unit = player:GetUnitByID(unitID)
    
    if unit and unit:IsRecon() then
        -- Prioritize exploration based on strategic considerations
        local targets = {}
        
        -- Look for areas near other civilizations
        for otherPlayerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
            if otherPlayerID ~= playerID and Players[otherPlayerID]:IsAlive() then
                local capital = Players[otherPlayerID]:GetCapitalCity()
                if capital then
                    table.insert(targets, {
                        x = capital:GetX(),
                        y = capital:GetY(),
                        priority = 5
                    })
                end
            end
        end
        
        -- Return highest priority unexplored target
        return GetBestExploreTarget(targets, unit:GetX(), unit:GetY())
    end
    
    return nil
end
```

## Return Values

The event handler should return:
- **Custom target coordinates** (table with x, y values) to override default exploration behavior
- **`nil`** to use the default Homeland AI exploration logic

## Related Events

- **UnitMoved**: Triggered when a unit completes movement, useful for tracking exploration progress
- **UnitSetXY**: Fired when a unit's position changes, can be used in conjunction with exploration targeting
- **PlayerTurn**: General turn processing event that encompasses exploration phases

## Technical Considerations

### Performance Notes
- This event is called during AI turn processing, so handlers should be efficient
- Avoid complex calculations that could slow down AI turns
- Cache exploration targets when possible to reduce computational overhead

### Integration with Homeland AI
- The event integrates with the existing Homeland AI exploration system
- Custom targets should respect game rules (valid plots, movement restrictions, etc.)
- The system will fall back to default behavior if no custom target is provided

### Multiplayer Compatibility
- Event handlers should only process units owned by the current player
- Avoid accessing information that wouldn't be available to the player in a multiplayer context
- Be mindful of turn timer implications when implementing complex logic

## Implementation Details

The event is implemented in the Community Patch DLL's Homeland AI module. The C++ code snippet that triggers this event:

```cpp
// From CvHomelandAI.cpp, line 2340-2344
args->Push(pUnit->getOwner());
args->Push(pUnit->GetID());
// ... 
LuaSupport::CallHook(pkScriptSystem, "UnitGetSpecialExploreTarget", args.get(), bResult);
```

This event is part of the exploration logic enhancement system that allows for more sophisticated AI behavior and external system integration through the Vox Deorum architecture.

## Error Handling

When implementing event handlers:
- Always validate that the unit exists before processing
- Handle cases where the player or unit might be invalid
- Return `nil` for any error conditions to ensure the game continues with default behavior
- Use appropriate error logging for debugging purposes

```lua
function OnUnitGetSpecialExploreTarget(playerID, unitID)
    -- Validate inputs
    if not Players[playerID] or not Players[playerID]:IsAlive() then
        return nil
    end
    
    local unit = Players[playerID]:GetUnitByID(unitID)
    if not unit then
        print("Warning: Invalid unit ID " .. unitID .. " for player " .. playerID)
        return nil
    end
    
    -- Your custom logic here
    -- ...
    
    return nil -- Default behavior
end
```