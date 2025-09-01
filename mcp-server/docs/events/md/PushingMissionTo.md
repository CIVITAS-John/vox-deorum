# PushingMissionTo Event

## Overview

The `PushingMissionTo` event is triggered in Civilization V when a unit is about to execute a mission to a specific plot location. This event is part of the Community Patch framework's RED (Reconnaissance, Espionage, Diplomacy) combat mission system and provides a hook for monitoring and potentially intercepting unit mission execution.

## When Triggered

This event is triggered during the unit mission execution process, specifically:

- When a player issues a mission command to a unit (GAMEMESSAGE_PUSH_MISSION)
- The unit belongs to the active player and is not currently busy
- The mission is not a unit swap operation
- The MOD_EVENTS_RED_COMBAT_MISSION flag is enabled
- Just before the mission is actually sent to the game engine

The event is called from the `CvGame::selectionListGameNetMessage()` function in the game's core DLL, providing an opportunity to intercept or monitor unit missions before they are executed.

## Event Parameters

The event receives the following parameters in order:

| Parameter | Type | Description |
|-----------|------|-------------|
| **Player ID** | `int` | The ID of the player who owns the unit executing the mission |
| **Unit ID** | `int` | The unique identifier of the unit that will execute the mission |
| **Target X** | `int` | The X coordinate of the target plot where the mission will be executed |
| **Target Y** | `int` | The Y coordinate of the target plot where the mission will be executed |
| **Mission Type** | `int` | The type of mission being executed (corresponds to MissionTypes enum) |

### Parameter Details

- **Player ID**: Retrieved via `pkSelectedUnit->getOwner()` - identifies which civilization is issuing the command
- **Unit ID**: Retrieved via `pkSelectedUnit->GetID()` - allows precise identification of the specific unit
- **Target Coordinates**: Retrieved via `pPlot->getX()` and `pPlot->getY()` - specifies the exact map location
- **Mission Type**: The raw mission type value (`iData2`) - corresponds to various mission types like MISSION_MOVE_TO, MISSION_ATTACK, etc.

## Usage Examples

### Lua Event Handler

```lua
function OnPushingMissionTo(playerID, unitID, targetX, targetY, missionType)
    local player = Players[playerID]
    local unit = player:GetUnitByID(unitID)
    local plot = Map.GetPlot(targetX, targetY)
    
    if unit and plot then
        print(string.format("Unit %s (ID: %d) from %s is executing mission type %d to plot (%d, %d)", 
            unit:GetName(), 
            unitID, 
            player:GetCivilizationShortDescription(), 
            missionType, 
            targetX, 
            targetY))
        
        -- Example: Log combat missions
        if IsCombatMission(missionType) then
            LogCombatMission(playerID, unitID, targetX, targetY, missionType)
        end
        
        -- Example: Check for strategic resource denial
        if plot:GetResourceType() ~= -1 then
            CheckStrategicResourceControl(playerID, plot)
        end
    end
end

GameEvents.PushingMissionTo.Add(OnPushingMissionTo)
```

### Mission Type Analysis

```lua
function AnalyzeMissionPattern(playerID, unitID, targetX, targetY, missionType)
    -- Track unit movement patterns
    if not g_UnitMissionHistory then
        g_UnitMissionHistory = {}
    end
    
    local unitKey = playerID .. "_" .. unitID
    if not g_UnitMissionHistory[unitKey] then
        g_UnitMissionHistory[unitKey] = {}
    end
    
    table.insert(g_UnitMissionHistory[unitKey], {
        turn = Game.GetGameTurn(),
        x = targetX,
        y = targetY,
        mission = missionType
    })
    
    -- Analyze for suspicious patterns
    AnalyzeForScoutingPatterns(unitKey)
end
```

## Related Events

- **UnitMoved** - Triggered after a unit successfully completes movement
- **CombatResult** - Triggered after combat missions are resolved
- **UnitCreated** - For tracking unit lifecycle in conjunction with mission tracking
- **PlayerTurnStart/End** - For contextualizing mission timing within player turns

## Technical Notes

### Implementation Details

- **Source Location**: `CvGame.cpp`, line 2724 in `CvGame::selectionListGameNetMessage()`
- **Conditional Compilation**: Only available when `MOD_EVENTS_RED_COMBAT_MISSION` is defined
- **Thread Safety**: Called from the main game thread during UI interaction processing
- **Performance**: Low overhead as it's only triggered on explicit player commands

### Mission Type Values

The `missionType` parameter corresponds to the `MissionTypes` enumeration in the game engine. Common values include:
- Movement missions (MISSION_MOVE_TO, MISSION_ROUTE_TO)
- Combat missions (MISSION_ATTACK, MISSION_RANGED_ATTACK)
- Special missions (MISSION_HEAL, MISSION_FORTIFY, MISSION_SKIP)

### Coordinate System

- Coordinates use the game's internal hex grid system
- X and Y values are zero-indexed
- Use `Map.GetPlot(x, y)` to convert coordinates to plot objects in Lua

### Limitations

- Only triggered for the active player's units
- Does not capture AI-controlled unit missions
- Event is fired before mission validation, so some missions may still fail
- Limited to missions that go through the standard UI command system

## Best Practices

1. **Validate Parameters**: Always check that the player, unit, and plot exist before processing
2. **Performance Considerations**: Avoid expensive operations in the event handler as it's called frequently
3. **Error Handling**: Implement proper error handling as unit/plot references may become invalid
4. **State Tracking**: Use global tables to maintain state across multiple event calls
5. **Mission Filtering**: Consider filtering by mission type to avoid unnecessary processing

## See Also

- [Community Patch Documentation](../../../community-patch/)
- [Mission Types Reference](../mission-types.md)
- [Unit Event System](../unit-events.md)
- [Game Event Integration Guide](../integration-guide.md)