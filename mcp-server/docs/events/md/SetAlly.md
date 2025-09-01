# SetAlly Event

## Overview

The `SetAlly` event is triggered when a minor civilization (city-state) changes its ally status. This event occurs when the ally relationship of a city-state transitions from one major civilization to another, or when an ally relationship is established or removed.

## When This Event Is Triggered

This event is fired when:
- A city-state establishes a new ally relationship with a major civilization
- A city-state's existing ally relationship changes to a different major civilization  
- A city-state loses its ally status (transitions from having an ally to having no ally)

The event is triggered from the Minor Civilization AI system (`CvMinorCivAI.cpp`) during ally status updates.

## Event Parameters

The event passes three parameters to Lua handlers:

| Parameter | Type | Description |
|-----------|------|-------------|
| `minorCivId` | `number` | The Player ID of the minor civilization (city-state) whose ally status is changing |
| `oldAllyId` | `number` | The Player ID of the previous ally, or -1 if there was no previous ally |
| `newAllyId` | `number` | The Player ID of the new ally, or -1 if the city-state no longer has an ally |

### Parameter Details

- **minorCivId**: Always represents a valid minor civilization player ID
- **oldAllyId**: Can be -1 when a city-state gains its first ally, or a valid player ID when switching allies
- **newAllyId**: Can be -1 when a city-state loses its ally status, or a valid player ID when gaining/switching allies

## Usage Examples

### Lua Event Handler

```lua
-- Register the event handler
GameEvents.SetAlly.Add(OnSetAlly)

-- Event handler function
function OnSetAlly(minorCivId, oldAllyId, newAllyId)
    local minorCivPlayer = Players[minorCivId]
    local minorCivName = minorCivPlayer:GetName()
    
    if oldAllyId == -1 and newAllyId ~= -1 then
        -- City-state gained its first ally
        local newAllyName = Players[newAllyId]:GetName()
        print(minorCivName .. " has become allied with " .. newAllyName)
        
    elseif oldAllyId ~= -1 and newAllyId == -1 then
        -- City-state lost its ally
        local oldAllyName = Players[oldAllyId]:GetName()
        print(minorCivName .. " is no longer allied with " .. oldAllyName)
        
    elseif oldAllyId ~= -1 and newAllyId ~= -1 then
        -- City-state switched allies
        local oldAllyName = Players[oldAllyId]:GetName()
        local newAllyName = Players[newAllyId]:GetName()
        print(minorCivName .. " switched alliance from " .. oldAllyName .. " to " .. newAllyName)
    end
end
```

### Common Use Cases

- **Diplomatic notifications**: Inform players about ally status changes
- **Achievement tracking**: Monitor alliance-related achievements
- **AI decision making**: Update AI strategies based on changing city-state alliances
- **UI updates**: Refresh diplomatic screens and city-state information

## Related Events and Considerations

### Related Events
- City-state influence events (if they exist in the system)
- Diplomatic state change events
- Player relationship events

### Important Considerations

1. **Timing**: This event fires after the ally status has already been changed in the game state
2. **Validation**: Always validate that player IDs are valid before using them
3. **Threading**: This event is called from the game's main thread during turn processing
4. **Performance**: Keep event handlers lightweight as they're called during critical game state updates

## Technical Details

- **Source Location**: `CvGameCoreDLL_Expansion2/CvMinorCivAI.cpp` at line 12449
- **Hook Type**: Lua hook called via `LuaSupport::CallHook`
- **Frequency**: Triggered only when actual ally status changes occur
- **Game Phase**: Can occur during any phase of the game when influence levels change

## Notes

- The event only fires for actual ally status changes, not for influence level changes that don't affect ally status
- Player IDs of -1 indicate "no player" or "no ally" status
- This event is part of the Community Patch framework's enhanced minor civilization system
- Event handlers should be designed to handle all three scenarios: gaining first ally, losing ally, and switching allies