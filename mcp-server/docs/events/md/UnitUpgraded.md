# UnitUpgraded Event

## Overview

The `UnitUpgraded` event is triggered when a unit in Civilization V undergoes an upgrade transformation, changing from one unit type to another. This event captures both regular unit upgrades (using gold or resources) and special upgrades that may occur through other game mechanics.

## When This Event is Triggered

This event is fired in two main scenarios:

1. **Regular Unit Upgrade** (`CvUnit.cpp`): When a player manually upgrades a unit using the standard upgrade system (typically requiring gold and/or resources)
2. **Goody Hut Upgrade** (`CvPlayer.cpp`): When a unit is upgraded as a result of discovering a goody hut or similar special event

## Event Parameters

The event passes four parameters to Lua scripts:

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerID` | `int` | The ID of the player who owns the unit being upgraded |
| `oldUnitID` | `int` | The unique ID of the original unit before upgrade |
| `newUnitID` | `int` | The unique ID of the new unit after upgrade |
| `isGoodyHut` | `boolean` | Indicates whether the upgrade was triggered by a goody hut (`true`) or regular upgrade (`false`) |

### Parameter Details

- **playerID**: Identifies which civilization/player initiated or received the upgrade
- **oldUnitID**: The game's internal identifier for the unit that was upgraded (this unit no longer exists after the event)
- **newUnitID**: The game's internal identifier for the newly created upgraded unit
- **isGoodyHut**: Distinguishes between voluntary upgrades and special event upgrades

## Usage Examples

### Basic Event Handler

```lua
function OnUnitUpgraded(playerID, oldUnitID, newUnitID, isGoodyHut)
    local player = Players[playerID]
    local newUnit = player:GetUnitByID(newUnitID)
    
    if isGoodyHut then
        print("Unit upgraded by goody hut for player " .. playerID)
    else
        print("Unit manually upgraded for player " .. playerID)
    end
    
    if newUnit then
        print("New unit type: " .. newUnit:GetUnitType())
    end
end

Events.UnitUpgraded.Add(OnUnitUpgraded)
```

### Tracking Upgrade Statistics

```lua
local upgradeStats = {}

function TrackUnitUpgrades(playerID, oldUnitID, newUnitID, isGoodyHut)
    if not upgradeStats[playerID] then
        upgradeStats[playerID] = {
            regularUpgrades = 0,
            goodyHutUpgrades = 0
        }
    end
    
    if isGoodyHut then
        upgradeStats[playerID].goodyHutUpgrades = upgradeStats[playerID].goodyHutUpgrades + 1
    else
        upgradeStats[playerID].regularUpgrades = upgradeStats[playerID].regularUpgrades + 1
    end
end

Events.UnitUpgraded.Add(TrackUnitUpgrades)
```

## Related Events

- **UnitCreated**: Fired when any new unit is created (including the upgraded unit)
- **UnitKilled**: May be related if the old unit is considered "killed" during upgrade
- **GoodyHutCanNotReceive**: Related to goody hut mechanics that might trigger upgrades

## Special Considerations

### Important Notes

1. **Unit ID Validity**: After the upgrade, the `oldUnitID` no longer references a valid unit. Always use `newUnitID` for post-upgrade operations.

2. **Timing**: This event fires after the upgrade is complete, so both the old unit destruction and new unit creation have already occurred.

3. **Goody Hut Distinction**: The `isGoodyHut` parameter is crucial for distinguishing between player-initiated upgrades and special event upgrades, which may have different strategic implications.

4. **Player Context**: All upgrades are associated with a specific player, making this event useful for per-civilization tracking and AI decision making.

### Performance Considerations

- The event fires relatively infrequently compared to movement or combat events
- Unit lookup operations using the provided IDs are generally fast
- Consider caching unit information if performing complex calculations in the event handler

## Source Code References

This event is triggered from two locations in the Community Patch DLL:

- `CvPlayer.cpp:12760` - Goody hut upgrades
- `CvUnit.cpp:14314` - Regular unit upgrades

Both implementations follow the same parameter pattern but differ in the context of the upgrade trigger.