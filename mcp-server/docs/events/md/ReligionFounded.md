# ReligionFounded Event

## Overview

The `ReligionFounded` event is triggered when a religion is founded in Civilization V. This event captures the moment when a player establishes a new religion, providing details about the founding player, location, religion type, and selected beliefs.

## When This Event Is Triggered

This event is fired when:
- A player successfully founds a new religion using a Great Prophet
- The religion founding process is completed in the game engine
- All required beliefs have been selected and assigned to the religion

The event originates from the Community Patch DLL in the religion system (`CvReligionClasses.cpp`).

## Event Parameters

The ReligionFounded event passes the following parameters in order:

| Parameter | Type | Description |
|-----------|------|-------------|
| `ePlayer` | PlayerID | The ID of the player who founded the religion |
| `pkHolyCity->GetID()` | CityID | The ID of the city that becomes the holy city for this religion |
| `eReligion` | ReligionType | The type/ID of the religion being founded |
| `eBelief` | BeliefType | The founder belief selected for this religion |
| `eBelief1` | BeliefType | The first follower belief selected |
| `eBelief2` | BeliefType | The second follower belief selected |
| `eBelief3` | BeliefType | The third belief (may be enhancer or additional follower belief) |
| `eBelief4` | BeliefType | The fourth belief (may be enhancer or additional follower belief) |

### Parameter Details

- **Player ID**: Identifies which civilization founded the religion
- **Holy City ID**: The city where the religion was founded becomes its holy city, providing various bonuses
- **Religion Type**: The specific religion being founded (Christianity, Islam, Buddhism, etc.)
- **Beliefs**: The collection of beliefs that define the religion's unique properties and bonuses

## Usage Examples

### Lua Event Handler Example

```lua
-- Register the event handler
Events.ReligionFounded.Add(OnReligionFounded)

function OnReligionFounded(playerID, holyCityID, religionID, founderBelief, belief1, belief2, belief3, belief4)
    local player = Players[playerID]
    local holyCity = player:GetCityByID(holyCityID)
    
    print("Religion founded!")
    print("Player: " .. player:GetName())
    print("Holy City: " .. holyCity:GetName())
    print("Religion ID: " .. religionID)
    
    -- Process beliefs
    local beliefs = {founderBelief, belief1, belief2, belief3, belief4}
    for i, belief in ipairs(beliefs) do
        if belief ~= -1 then  -- Check if belief is valid
            print("Belief " .. i .. ": " .. belief)
        end
    end
end
```

### MCP Server Integration Example

```javascript
// Handle ReligionFounded event in MCP server
function handleReligionFounded(eventData) {
    const {
        playerID,
        holyCityID,
        religionID,
        founderBelief,
        belief1,
        belief2,
        belief3,
        belief4
    } = eventData.parameters;
    
    // Update game state
    updateReligionState({
        foundedBy: playerID,
        holyCity: holyCityID,
        religion: religionID,
        beliefs: [founderBelief, belief1, belief2, belief3, belief4].filter(b => b !== -1)
    });
    
    // Notify MCP clients
    notifyClients('religion_founded', eventData);
}
```

## Related Events and Considerations

### Related Religion Events
- `ReligionEnhanced` - When a religion gains enhancer beliefs
- `ReligionSpread` - When a religion spreads to new cities
- `ReligionReformed` - When a religion is reformed (in some game modes)

### Strategic Considerations
- Religion founding is typically limited to the first few players who generate Great Prophets
- The choice of beliefs significantly impacts gameplay strategy
- Holy city location affects religion spread mechanics
- AI players may found religions based on their strategic priorities

### Technical Notes
- Belief parameters may contain `-1` values if fewer than the maximum beliefs were selected
- The event occurs after all validation and setup is complete in the game engine
- Religion IDs are consistent throughout the game session
- City and player IDs should be validated before use in event handlers

## Source Code Reference

This event is triggered from:
- **File**: `CvGameCoreDLL_Expansion2/CvReligionClasses.cpp`
- **Line**: 1274
- **Context**: Religion founding validation and setup completion

The event is called using the Lua support hook system:
```cpp
LuaSupport::CallHook(pkScriptSystem, "ReligionFounded", args.get(), bResult);
```

## Notes

- This event is part of the Community Patch DLL's extended event system
- The event provides comprehensive information about the newly founded religion
- All belief slots are passed even if not all are used (unused slots will have invalid values)
- The holy city becomes a permanent feature of the religion and affects spread mechanics
- This event is crucial for AI systems that need to track religious developments in the game