# CombatEnded Event

## Overview

The `CombatEnded` event is triggered after a combat resolution between units in Civilization V, providing comprehensive information about the combat outcome for all participating units.

## When This Event is Triggered

This event fires immediately after combat calculations are completed, including:
- Direct unit-to-unit combat (melee, ranged, naval)
- Combat involving intercepting units (air interception)
- Combat resolution in any location on the map

The event is called from `CvUnitCombat.cpp` at line 3454, after all combat damage calculations have been finalized.

## Event Parameters

The CombatEnded event provides 15 parameters with detailed information about all participants:

### Attacking Unit
| Parameter | Type | Description |
|-----------|------|-------------|
| `iAttackingPlayer` | integer | Player ID of the attacking unit's owner |
| `iAttackingUnit` | integer | Unique ID of the attacking unit |
| `attackerDamage` | integer | Damage dealt by the attacker during this combat |
| `attackerFinalDamage` | integer | Total damage the attacker has after combat |
| `attackerMaxHP` | integer | Maximum hit points of the attacking unit |

### Defending Unit
| Parameter | Type | Description |
|-----------|------|-------------|
| `iDefendingPlayer` | integer | Player ID of the defending unit's owner |
| `iDefendingUnit` | integer | Unique ID of the defending unit |
| `defenderDamage` | integer | Damage dealt by the defender during this combat |
| `defenderFinalDamage` | integer | Total damage the defender has after combat |
| `defenderMaxHP` | integer | Maximum hit points of the defending unit |

### Intercepting Unit (Air Combat)
| Parameter | Type | Description |
|-----------|------|-------------|
| `iInterceptingPlayer` | integer | Player ID of the intercepting unit's owner (0 if none) |
| `iInterceptingUnit` | integer | Unique ID of the intercepting unit (0 if none) |
| `interceptorDamage` | integer | Damage dealt by the interceptor (0 if none) |

### Location Information
| Parameter | Type | Description |
|-----------|------|-------------|
| `plotX` | integer | X coordinate of the combat location |
| `plotY` | integer | Y coordinate of the combat location |

## Usage Examples

### Basic Combat Analysis
```lua
-- Example: Track combat outcomes for strategic analysis
function OnCombatEnded(iAttackingPlayer, iAttackingUnit, attackerDamage, attackerFinalDamage, attackerMaxHP,
                       iDefendingPlayer, iDefendingUnit, defenderDamage, defenderFinalDamage, defenderMaxHP,
                       iInterceptingPlayer, iInterceptingUnit, interceptorDamage, plotX, plotY)
    
    local attackerSurvived = attackerFinalDamage < attackerMaxHP
    local defenderSurvived = defenderFinalDamage < defenderMaxHP
    
    print("Combat at (" .. plotX .. "," .. plotY .. ")")
    print("Attacker: Player " .. iAttackingPlayer .. " Unit " .. iAttackingUnit)
    print("  - Dealt: " .. attackerDamage .. " damage")
    print("  - Status: " .. (attackerSurvived and "Survived" or "Destroyed"))
    
    print("Defender: Player " .. iDefendingPlayer .. " Unit " .. iDefendingUnit)
    print("  - Dealt: " .. defenderDamage .. " damage") 
    print("  - Status: " .. (defenderSurvived and "Survived" or "Destroyed"))
end

Events.CombatEnded.Add(OnCombatEnded)
```

### Air Interception Handling
```lua
-- Example: Handle air interception scenarios
function OnCombatEnded(iAttackingPlayer, iAttackingUnit, attackerDamage, attackerFinalDamage, attackerMaxHP,
                       iDefendingPlayer, iDefendingUnit, defenderDamage, defenderFinalDamage, defenderMaxHP,
                       iInterceptingPlayer, iInterceptingUnit, interceptorDamage, plotX, plotY)
    
    if iInterceptingUnit > 0 then
        print("Air interception occurred!")
        print("Interceptor: Player " .. iInterceptingPlayer .. " Unit " .. iInterceptingUnit)
        print("Interceptor dealt: " .. interceptorDamage .. " damage")
    end
end

Events.CombatEnded.Add(OnCombatEnded)
```

### Combat Statistics Tracking
```lua
-- Example: Track player combat performance
local combatStats = {}

function OnCombatEnded(iAttackingPlayer, iAttackingUnit, attackerDamage, attackerFinalDamage, attackerMaxHP,
                       iDefendingPlayer, iDefendingUnit, defenderDamage, defenderFinalDamage, defenderMaxHP,
                       iInterceptingPlayer, iInterceptingUnit, interceptorDamage, plotX, plotY)
    
    -- Initialize stats if needed
    if not combatStats[iAttackingPlayer] then
        combatStats[iAttackingPlayer] = {attacks = 0, totalDamageDealt = 0, unitsLost = 0}
    end
    if not combatStats[iDefendingPlayer] then
        combatStats[iDefendingPlayer] = {attacks = 0, totalDamageDealt = 0, unitsLost = 0}
    end
    
    -- Update attacker stats
    combatStats[iAttackingPlayer].attacks = combatStats[iAttackingPlayer].attacks + 1
    combatStats[iAttackingPlayer].totalDamageDealt = combatStats[iAttackingPlayer].totalDamageDealt + attackerDamage
    if attackerFinalDamage >= attackerMaxHP then
        combatStats[iAttackingPlayer].unitsLost = combatStats[iAttackingPlayer].unitsLost + 1
    end
    
    -- Update defender stats  
    combatStats[iDefendingPlayer].totalDamageDealt = combatStats[iDefendingPlayer].totalDamageDealt + defenderDamage
    if defenderFinalDamage >= defenderMaxHP then
        combatStats[iDefendingPlayer].unitsLost = combatStats[iDefendingPlayer].unitsLost + 1
    end
end

Events.CombatEnded.Add(OnCombatEnded)
```

## Related Events

- **CombatResult**: May provide additional combat outcome information
- **UnitKilled**: Triggered when a unit is destroyed (may follow CombatEnded)
- **UnitPrekill**: Triggered before a unit is destroyed
- **PlayerDoTurn**: Can be used to analyze combat statistics per turn

## Special Notes

### Damage Calculation
- `attackerDamage` and `defenderDamage` represent damage **dealt** by each unit during this specific combat
- `attackerFinalDamage` and `defenderFinalDamage` represent the **total accumulated damage** on each unit after combat
- A unit is destroyed when `finalDamage >= maxHP`

### Air Interception
- If no air interception occurs, `iInterceptingPlayer` and `iInterceptingUnit` will be 0
- `interceptorDamage` will be 0 if no interception happened
- Air interception can occur during both air-to-ground and air-to-air combat

### Unit Identification
- Unit IDs are unique within the game session
- Player IDs correspond to civilization player numbers (0-based indexing)
- Use `Players[playerID]:GetUnitByID(unitID)` to get the actual unit object

### Coordinate System
- `plotX` and `plotY` use the game's internal coordinate system
- These coordinates can be used with `Map.GetPlot(x, y)` to get plot information
- Combat location is typically the defender's position

### Performance Considerations
- This event fires for **every** combat in the game, including AI vs AI
- Consider filtering by player ID if only tracking human player combats
- Avoid heavy computations in the event handler to prevent game slowdown

## Source Reference

This event is triggered from:
- **File**: `CvGameCoreDLL_Expansion2/CvUnitCombat.cpp`
- **Line**: 3454
- **Context**: Called after combat resolution calculations are complete