# UnitKilledInCombat Event

## Overview

The `UnitKilledInCombat` event is triggered when a unit is killed in combat within Civilization V. This event provides information about both the killed unit and the attacking unit, allowing for tracking combat outcomes and implementing game mechanics that respond to unit deaths.

## When This Event Is Triggered

This event fires when:
- A unit is eliminated during combat (either attacking or defending)
- The unit death occurs as a direct result of combat damage
- The event is called from the `CvPlayer::DoUnitKilledCombat` function in the Community Patch DLL

The event is triggered after the unit has been killed but before any cleanup operations are performed, making it ideal for implementing mechanics that need to respond immediately to unit deaths.

## Event Parameters

The event passes the following parameters to Lua scripts:

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerID` | `number` | The ID of the player who owned the killed unit |
| `killedPlayerID` | `number` | The ID of the player whose unit was killed (same as playerID) |
| `unitType` | `number` | The unit type ID of the killed unit (UnitTypes enum value) |
| `killingUnitID` | `number` | The ID of the unit that killed this unit, or -1 if no specific killing unit |

### Parameter Details

- **playerID**: Represents the player whose unit was killed. This is obtained via `GetID()` in the DLL code.
- **killedPlayerID**: Duplicate of the player ID for the killed unit's owner.
- **unitType**: The specific type of unit that was killed (e.g., Warrior, Archer, Tank). This corresponds to the UnitTypes enumeration.
- **killingUnitID**: The unique identifier of the unit that dealt the killing blow. Returns -1 if the killing unit is null or no longer exists.

## Usage Examples

### Basic Event Handler

```lua
function OnUnitKilledInCombat(playerID, killedPlayerID, unitType, killingUnitID)
    local pPlayer = Players[playerID]
    local pKillingUnit = nil
    
    if killingUnitID ~= -1 then
        pKillingUnit = pPlayer:GetUnitByID(killingUnitID)
    end
    
    print(string.format("Unit of type %d belonging to player %d was killed in combat", 
          unitType, playerID))
    
    if pKillingUnit then
        print(string.format("Killed by unit ID %d", killingUnitID))
    else
        print("Killing unit unknown or no longer exists")
    end
end

Events.UnitKilledInCombat.Add(OnUnitKilledInCombat)
```

### Tracking Combat Statistics

```lua
local g_CombatStats = {}

function OnUnitKilledInCombat(playerID, killedPlayerID, unitType, killingUnitID)
    -- Initialize player stats if needed
    if not g_CombatStats[playerID] then
        g_CombatStats[playerID] = { unitsLost = 0, unitTypesLost = {} }
    end
    
    -- Track total units lost
    g_CombatStats[playerID].unitsLost = g_CombatStats[playerID].unitsLost + 1
    
    -- Track specific unit types lost
    if not g_CombatStats[playerID].unitTypesLost[unitType] then
        g_CombatStats[playerID].unitTypesLost[unitType] = 0
    end
    g_CombatStats[playerID].unitTypesLost[unitType] = 
        g_CombatStats[playerID].unitTypesLost[unitType] + 1
end

Events.UnitKilledInCombat.Add(OnUnitKilledInCombat)
```

### Experience or Reward System

```lua
function OnUnitKilledInCombat(playerID, killedPlayerID, unitType, killingUnitID)
    if killingUnitID ~= -1 then
        -- Find the killing unit to award experience or bonuses
        for pPlayer in Players:Pairs() do
            local pKillingUnit = pPlayer:GetUnitByID(killingUnitID)
            if pKillingUnit then
                -- Award bonus experience or special abilities
                local currentXP = pKillingUnit:GetExperience()
                pKillingUnit:SetExperience(currentXP + 5) -- Bonus XP for kill
                break
            end
        end
    end
end

Events.UnitKilledInCombat.Add(OnUnitKilledInCombat)
```

## Related Events and Considerations

### Related Events
- **UnitPrekill**: Triggered before a unit is actually killed, allowing for last-minute interventions
- **CombatResult**: Provides detailed information about combat outcomes
- **UnitCreated**: Triggered when units are created, useful for tracking unit lifecycles

### Important Considerations

1. **Unit Reference Validity**: The killing unit may no longer exist by the time this event is processed. Always check if `killingUnitID` is -1 and verify unit existence before accessing unit properties.

2. **Player Validation**: Always validate that the player exists and is active before processing player-related operations.

3. **Performance**: This event can fire frequently during combat-heavy periods. Ensure event handlers are optimized for performance.

4. **Multiplayer Compatibility**: Be aware that this event fires for all players, including AI and human players. Design handlers to work correctly in multiplayer scenarios.

## Special Notes

- The event is called from `CvPlayer::DoUnitKilledCombat` in `CvPlayer.cpp` at line 25021
- The killing unit ID can be -1 if the unit that dealt the killing blow no longer exists or was not properly tracked
- This event is part of the Community Patch DLL modification and may not be available in vanilla Civilization V
- The event fires after the unit has been marked for death but potentially before all cleanup operations are complete
- Unit type parameter corresponds to the UnitTypes enumeration defined in the game's database

## Source Code Reference

**File**: `CvGameCoreDLL_Expansion2/CvPlayer.cpp`  
**Line**: 25021  
**Function**: `CvPlayer::DoUnitKilledCombat`

The event is implemented as a Lua hook call with the following argument structure:
```cpp
args->Push(GetID());                                    // Player ID
args->Push(eKilledPlayer);                             // Killed player ID  
args->Push(eUnitType);                                 // Unit type
args->Push(pKillingUnit ? pKillingUnit->GetID() : -1); // Killing unit ID
```