# NuclearDetonation Event

## Overview

The `NuclearDetonation` event is triggered when a nuclear weapon is detonated in Civilization V. This event provides information about the nuclear attack, including the attacking player, target location, and diplomatic context.

## Trigger Conditions

This event is fired when:
- A nuclear weapon (Nuclear Missile or Atomic Bomb) is used by any civilization
- The nuclear weapon successfully detonates at its target location
- The event occurs during the combat resolution phase in `CvUnitCombat.cpp`

## Event Parameters

The event provides the following parameters in order:

| Parameter | Type | Description |
|-----------|------|-------------|
| `attackerOwner` | `PlayerID` | The player ID of the civilization that launched the nuclear weapon |
| `targetX` | `int` | The X coordinate of the plot where the nuclear weapon detonated |
| `targetY` | `int` | The Y coordinate of the plot where the nuclear weapon detonated |
| `bWar` | `boolean` | Indicates whether the attacker and target owner are at war |
| `bBystander` | `boolean` | Indicates whether there are bystander civilizations affected by the detonation |

## Usage Examples

### Lua Event Handler
```lua
-- Register the event handler
Events.NuclearDetonation.Add(OnNuclearDetonation)

-- Event handler function
function OnNuclearDetonation(attackerOwner, targetX, targetY, bWar, bBystander)
    local attacker = Players[attackerOwner]
    local attackerName = attacker:GetName()
    
    print(string.format("%s detonated a nuclear weapon at (%d, %d)", 
          attackerName, targetX, targetY))
    
    if bWar then
        print("Nuclear weapon used in active warfare")
    else
        print("Nuclear weapon used against non-war target")
    end
    
    if bBystander then
        print("Bystander civilizations were affected by the detonation")
    end
end
```

### Strategic Response Example
```lua
function OnNuclearDetonation(attackerOwner, targetX, targetY, bWar, bBystander)
    -- Diplomatic consequences for nuclear weapon use
    for playerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
        local player = Players[playerID]
        if player:IsAlive() and playerID ~= attackerOwner then
            -- Apply diplomatic penalties for nuclear weapon use
            if not bWar then
                -- Heavier penalty for unprovoked nuclear attack
                player:GetDiplomacyAI():ChangeNukeEvil(attackerOwner, 2)
            else
                player:GetDiplomacyAI():ChangeNukeEvil(attackerOwner, 1)
            end
        end
    end
end
```

## Related Events

- **UnitAttack**: Fired before the nuclear detonation during combat resolution
- **CityDestroyed**: May be triggered if the nuclear weapon destroys a city
- **UnitKilled**: Fired for any units killed by the nuclear blast
- **PlotFeatureRemoved**: May fire if terrain features are destroyed

## Technical Details

### Source Location
- **File**: `CvGameCoreDLL_Expansion2/CvUnitCombat.cpp`
- **Line**: 2408
- **Context**: Nuclear combat resolution in the Community Patch DLL

### Event Timing
The event is fired after:
1. Nuclear weapon combat calculations are completed
2. Damage is applied to the target area
3. Diplomatic and strategic implications are determined
4. Before any subsequent cleanup or notification processes

## Special Considerations

### Diplomatic Impact
- Nuclear weapon use typically results in significant diplomatic penalties
- The `bWar` parameter helps distinguish between defensive/offensive nuclear use
- Bystander effects can influence multiple civilizations simultaneously

### Strategic Implications
- Nuclear detonations can shift the balance of power dramatically
- AI civilizations may respond with increased military production or alliance formation
- The event can trigger emergency sessions in the World Congress (if enabled)

### Performance Notes
- This event is relatively rare in typical gameplay
- Heavy processing in event handlers should be avoided to prevent game lag
- Consider caching player and plot data if performing complex calculations

## Version Information
- **Occurrences**: 1 (based on current codebase analysis)
- **Generated**: 2025-09-01T01:20:46.712Z
- **Framework**: Community Patch DLL for Civilization V

## See Also
- [Combat System Documentation](../combat/README.md)
- [Diplomatic Events](../diplomatic/README.md)
- [Unit Events](../units/README.md)