# UnitPromoted Event

## Overview

The `UnitPromoted` event is triggered when a unit in Civilization V receives a promotion. This event provides information about which unit was promoted, which player owns the unit, and what promotion was gained.

## When Triggered

This event is fired when:
- A unit gains a promotion through combat experience
- A unit is manually promoted by the player using accumulated experience points
- A unit receives a promotion through special game mechanics or events

The event is called from the unit promotion system within the game's core DLL.

## Event Parameters

The `UnitPromoted` event passes three parameters to Lua event handlers:

| Parameter | Type | Description |
|-----------|------|-------------|
| `iOwner` | `int` | The player ID who owns the promoted unit |
| `iUnitID` | `int` | The unique identifier of the unit that was promoted |
| `iPromotion` | `int` | The promotion ID that the unit received |

### Parameter Details

- **iOwner**: Represents the civilization/player index (0-based) that controls the promoted unit
- **iUnitID**: The internal game ID used to identify the specific unit instance
- **iPromotion**: The promotion type identifier corresponding to the specific promotion gained (e.g., Combat I, Shock, Drill, etc.)

## Usage Examples

### Basic Event Handler

```lua
-- Register the event handler
Events.UnitPromoted.Add(OnUnitPromoted)

-- Event handler function
function OnUnitPromoted(iOwner, iUnitID, iPromotion)
    local pPlayer = Players[iOwner]
    local pUnit = pPlayer:GetUnitByID(iUnitID)
    local promotionInfo = GameInfo.UnitPromotions[iPromotion]
    
    if pUnit and promotionInfo then
        print(string.format("Unit %s (ID: %d) owned by Player %d received promotion: %s", 
            pUnit:GetName(), iUnitID, iOwner, promotionInfo.Description))
    end
end
```

### Tracking Player Unit Promotions

```lua
-- Track promotions for human player only
function OnUnitPromoted(iOwner, iUnitID, iPromotion)
    local pPlayer = Players[iOwner]
    
    if pPlayer and pPlayer:IsHuman() then
        local pUnit = pPlayer:GetUnitByID(iUnitID)
        local promotionInfo = GameInfo.UnitPromotions[iPromotion]
        
        if pUnit and promotionInfo then
            -- Log or process human player unit promotions
            local unitType = GameInfo.Units[pUnit:GetUnitType()]
            print(string.format("Your %s has been promoted with %s!", 
                unitType.Description, promotionInfo.Description))
        end
    end
end
```

## Related Events

- **`UnitCreated`**: Fired when a unit is first created
- **`UnitKilled`**: Fired when a unit is destroyed
- **`UnitSetXY`**: Fired when a unit moves to a new position
- **`UnitPrekill`**: Fired before a unit is killed
- **`SerialEventUnitFlagSelected`**: UI event for unit selection

## Implementation Notes

### Source Code Reference

- **File**: `CvGameCoreDLL_Expansion2/CvUnit.cpp`
- **Line**: 13784
- **Function Context**: Unit promotion processing within the Community Patch DLL

### Special Considerations

1. **Timing**: This event is fired after the promotion has been successfully applied to the unit
2. **Validation**: Always validate that the player and unit exist before accessing their properties
3. **Performance**: This event can fire frequently during active gameplay, especially in combat-heavy scenarios
4. **Promotion IDs**: Promotion IDs correspond to entries in the `GameInfo.UnitPromotions` table
5. **Multiplayer**: The event fires for all players in multiplayer games, so filter by player if needed

### Common Use Cases

- **Achievement Systems**: Track specific promotion milestones
- **AI Behavior**: Adjust AI strategies based on enemy unit promotions
- **UI Notifications**: Display custom promotion messages to players
- **Statistics Tracking**: Record promotion data for post-game analysis
- **Mod Features**: Implement custom promotion effects or bonuses

## Error Handling

When working with this event, consider these potential issues:

```lua
function OnUnitPromoted(iOwner, iUnitID, iPromotion)
    -- Validate player exists
    local pPlayer = Players[iOwner]
    if not pPlayer then
        print("ERROR: Invalid player ID in UnitPromoted event: " .. tostring(iOwner))
        return
    end
    
    -- Validate unit exists
    local pUnit = pPlayer:GetUnitByID(iUnitID)
    if not pUnit then
        print("ERROR: Unit not found with ID: " .. tostring(iUnitID))
        return
    end
    
    -- Validate promotion exists
    local promotionInfo = GameInfo.UnitPromotions[iPromotion]
    if not promotionInfo then
        print("ERROR: Invalid promotion ID: " .. tostring(iPromotion))
        return
    end
    
    -- Safe to process the promotion event
end
```

## Integration with Vox Deorum

In the context of the Vox Deorum AI system, this event can be used to:
- Inform AI agents about unit strength changes
- Update strategic assessments based on promoted enemy units
- Track military development progress
- Trigger AI responses to significant unit improvements