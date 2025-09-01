# CombatResult Event

## Overview

The `CombatResult` event is triggered whenever a combat encounter is resolved in Civilization V, providing detailed information about the combat outcome including damage dealt, final health states, and participating units.

## When Triggered

This event fires after combat resolution in the following scenarios:
- Unit vs Unit combat encounters
- Unit vs City combat
- Combat involving intercepting units (e.g., anti-air units intercepting aircraft)
- Any other combat scenario where damage is calculated and applied

The event is triggered from `CvUnitCombat.cpp` line 3293 after all combat calculations are complete.

## Event Parameters

The event provides detailed information about all parties involved in the combat:

| Parameter | Type | Description |
|-----------|------|-------------|
| `iAttackingPlayer` | `int` | Player ID of the attacking unit's owner |
| `iAttackingUnit` | `int` | Unit ID of the attacking unit |
| `attackerDamage` | `int` | Damage dealt TO the attacking unit during combat |
| `attackerFinalDamage` | `int` | Final damage/health state of the attacking unit after combat |
| `attackerMaxHP` | `int` | Maximum health points of the attacking unit |
| `iDefendingPlayer` | `int` | Player ID of the defending unit's owner |
| `iDefendingUnit` | `int` | Unit ID of the defending unit |
| `defenderDamage` | `int` | Damage dealt TO the defending unit during combat |
| `defenderFinalDamage` | `int` | Final damage/health state of the defending unit after combat |
| `defenderMaxHP` | `int` | Maximum health points of the defending unit |
| `iInterceptingPlayer` | `int` | Player ID of any intercepting unit's owner (if applicable) |
| `iInterceptingUnit` | `int` | Unit ID of any intercepting unit (if applicable) |
| `interceptorDamage` | `int` | Damage dealt TO the intercepting unit (if applicable) |
| `plotX` | `int` | X coordinate of the combat location |
| `plotY` | `int` | Y coordinate of the combat location |

## Parameter Notes

- **Damage vs Final Damage**: The `*Damage` parameters represent the damage inflicted during this specific combat, while `*FinalDamage` represents the unit's total accumulated damage after the combat.
- **Interceptor Parameters**: These will be -1 or 0 when no interception occurs.
- **Unit Survival**: A unit is destroyed if its final damage equals or exceeds its maximum HP.

## Usage Examples

### Basic Combat Analysis
```lua
function OnCombatResult(iAttackingPlayer, iAttackingUnit, attackerDamage, attackerFinalDamage, attackerMaxHP,
                       iDefendingPlayer, iDefendingUnit, defenderDamage, defenderFinalDamage, defenderMaxHP,
                       iInterceptingPlayer, iInterceptingUnit, interceptorDamage, plotX, plotY)
    
    local attackerDestroyed = (attackerFinalDamage >= attackerMaxHP)
    local defenderDestroyed = (defenderFinalDamage >= defenderMaxHP)
    
    print(string.format("Combat at (%d,%d): Attacker took %d damage, Defender took %d damage", 
                        plotX, plotY, attackerDamage, defenderDamage))
    
    if attackerDestroyed then
        print("Attacking unit was destroyed!")
    end
    
    if defenderDestroyed then
        print("Defending unit was destroyed!")
    end
end

Events.CombatResult.Add(OnCombatResult)
```

### Combat Statistics Tracking
```lua
local combatStats = {
    totalCombats = 0,
    attackerWins = 0,
    defenderWins = 0,
    mutualDestruction = 0
}

function OnCombatResult(iAttackingPlayer, iAttackingUnit, attackerDamage, attackerFinalDamage, attackerMaxHP,
                       iDefendingPlayer, iDefendingUnit, defenderDamage, defenderFinalDamage, defenderMaxHP,
                       iInterceptingPlayer, iInterceptingUnit, interceptorDamage, plotX, plotY)
    
    combatStats.totalCombats = combatStats.totalCombats + 1
    
    local attackerDestroyed = (attackerFinalDamage >= attackerMaxHP)
    local defenderDestroyed = (defenderFinalDamage >= defenderMaxHP)
    
    if attackerDestroyed and defenderDestroyed then
        combatStats.mutualDestruction = combatStats.mutualDestruction + 1
    elseif defenderDestroyed then
        combatStats.attackerWins = combatStats.attackerWins + 1
    elseif attackerDestroyed then
        combatStats.defenderWins = combatStats.defenderWins + 1
    end
end

Events.CombatResult.Add(OnCombatResult)
```

### Interception Handling
```lua
function OnCombatResult(iAttackingPlayer, iAttackingUnit, attackerDamage, attackerFinalDamage, attackerMaxHP,
                       iDefendingPlayer, iDefendingUnit, defenderDamage, defenderFinalDamage, defenderMaxHP,
                       iInterceptingPlayer, iInterceptingUnit, interceptorDamage, plotX, plotY)
    
    if iInterceptingPlayer ~= -1 and iInterceptingUnit ~= -1 then
        print(string.format("Interception occurred! Intercepting unit (Player %d, Unit %d) took %d damage", 
                            iInterceptingPlayer, iInterceptingUnit, interceptorDamage))
    end
end

Events.CombatResult.Add(OnCombatResult)
```

## Related Events

- **UnitPrekill**: Triggered just before a unit is destroyed, useful for cleanup or last-moment effects
- **UnitKilled**: Triggered after a unit is destroyed, provides information about the killed unit
- **CombatEnded**: May be triggered in some combat scenarios (check availability in your mod version)

## Important Considerations

1. **Event Timing**: This event fires after all combat calculations are complete but before any post-combat cleanup (such as unit destruction)

2. **Unit References**: Unit IDs may become invalid immediately after this event if units were destroyed in combat

3. **Damage Interpretation**: The damage values represent the amount of damage dealt during this combat round, not the total accumulated damage

4. **Interception Edge Cases**: When no interception occurs, the interceptor parameters may contain default values (-1 or 0)

5. **Performance**: This event can fire frequently during active warfare, so keep event handlers efficient

6. **Coordinate System**: Plot coordinates use the standard Civilization V hex grid system

## Technical Details

- **Source Location**: `CvGameCoreDLL_Expansion2/CvUnitCombat.cpp` line 3293
- **Event Type**: Lua hook event
- **Parameters**: 15 total parameters
- **Frequency**: High during warfare phases

This event is essential for implementing combat-related AI decisions, statistical tracking, and custom combat mechanics in Civilization V mods.