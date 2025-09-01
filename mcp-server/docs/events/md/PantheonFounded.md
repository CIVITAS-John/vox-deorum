# PantheonFounded Event

## Overview

The `PantheonFounded` event is triggered when a player establishes a pantheon in Civilization V. A pantheon is the first step in founding a religion, representing early religious beliefs that provide small bonuses to the founding civilization.

## Event Trigger

This event is fired when:
- A player accumulates enough Faith points to found a pantheon
- The player selects a pantheon belief from the available options
- The pantheon is successfully established in the game

## Event Parameters

The event passes three parameters to registered listeners:

### Parameter 1: Capital City ID
- **Type**: Integer
- **Description**: The ID of the player's capital city where the pantheon is founded. If no capital exists, this value will be 0.
- **Source**: `pCapital ? pCapital->GetID() : 0`

### Parameter 2: Religion Type
- **Type**: Integer (Constant)
- **Description**: Always set to `RELIGION_PANTHEON`, indicating this is a pantheon founding event rather than a full religion founding.
- **Value**: `RELIGION_PANTHEON`

### Parameter 3: Belief ID
- **Type**: Integer
- **Description**: The unique identifier of the pantheon belief that was selected by the player.
- **Source**: `eBelief`

## Implementation Details

- **Source File**: `CvGameCoreDLL_Expansion2/CvReligionClasses.cpp`
- **Line**: 1070
- **Function Call**: `LuaSupport::CallHook(pkScriptSystem, "PantheonFounded", args.get(), bResult);`

## Usage Examples

### Lua Event Handler
```lua
function OnPantheonFounded(capitalCityID, religionType, beliefID)
    local player = Players[Game.GetActivePlayer()]
    local capital = player:GetCityByID(capitalCityID)
    
    if capital then
        print("Pantheon founded in " .. capital:GetName())
    else
        print("Pantheon founded (no capital city)")
    end
    
    print("Belief ID: " .. beliefID)
    print("Religion Type: " .. religionType) -- Should be RELIGION_PANTHEON
end

Events.PantheonFounded.Add(OnPantheonFounded)
```

### Bridge Service Integration
```json
{
  "eventType": "PantheonFounded",
  "timestamp": "2025-09-01T01:20:46.712Z",
  "data": {
    "capitalCityID": 123,
    "religionType": "RELIGION_PANTHEON",
    "beliefID": 5
  }
}
```

## Related Events

- **ReligionFounded**: Triggered when a full religion is established (follows pantheon founding)
- **BeliefAdded**: May be triggered when additional beliefs are added to religions
- **CityConverted**: Triggered when cities convert to different religions

## Special Considerations

### Capital City Handling
- The capital city ID may be 0 if the player has no capital at the time of pantheon founding
- This can occur in rare game situations or mod scenarios
- Always check for valid city ID before using it

### Timing
- This event occurs early in the game when Faith accumulation first reaches pantheon threshold
- Pantheons are typically founded before full religions
- Only one pantheon can be founded per civilization

### Game Balance
- Pantheon beliefs provide smaller bonuses compared to full religion beliefs
- The choice of pantheon belief can significantly impact early game strategy
- Some pantheon beliefs synergize better with certain victory conditions

## Technical Notes

- The event is called through the Lua support system in the Community Patch DLL
- Parameters are pushed onto the argument stack in the specific order listed above
- The event uses the standard Civilization V Lua event system
- Return value (`bResult`) can be used to potentially cancel or modify the pantheon founding process

## Event Frequency

Based on analysis data:
- **Occurrences**: 1 (in analyzed sample)
- **Generated At**: 2025-09-01T01:20:46.712Z

This suggests the event is relatively rare, occurring only when players reach the Faith threshold for pantheon founding, typically once per civilization per game.