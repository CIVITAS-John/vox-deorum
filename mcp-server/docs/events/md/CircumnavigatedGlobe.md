# CircumnavigatedGlobe Event

## Overview

The `CircumnavigatedGlobe` event is triggered when a team successfully circumnavigates the globe in Civilization V. This is a significant achievement that occurs when a team's units have explored the entire circumference of the world map, making circumnavigation no longer available to other teams.

## Event Trigger

This event is fired from the `testCircumnavigated()` function in `CvTeam.cpp` when:

1. A team's units have explored enough of the world map to complete circumnavigation
2. The game determines that circumnavigation is available (`circumnavigationAvailable()` returns true)
3. The team has visible plots spanning the entire circumference of the world
4. The game has progressed beyond turn 0

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `eTeamID` | `TeamTypes` (integer) | The ID of the team that successfully circumnavigated the globe |

## Event Details

- **Event Name**: `CircumnavigatedGlobe`
- **Frequency**: Once per game (only the first team to achieve circumnavigation triggers this event)
- **Source**: `CvTeam::testCircumnavigated()` in `CvGameCoreDLL_Expansion2/CvTeam.cpp` (line 7704)

## Usage Examples

### Lua Event Handler
```lua
-- Example event handler in Lua
function OnCircumnavigatedGlobe(teamID)
    local team = Teams[teamID]
    if team then
        print("Team " .. team:GetName() .. " has circumnavigated the globe!")
        
        -- Award bonus or trigger custom mechanics
        for playerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
            local player = Players[playerID]
            if player and player:GetTeam() == teamID then
                -- Grant bonus to all players on the team
                player:ChangeGold(500) -- Example: bonus gold
            end
        end
    end
end

-- Register the event handler
GameEvents.CircumnavigatedGlobe.Add(OnCircumnavigatedGlobe)
```

### MCP Server Integration
This event can be monitored by the MCP Server to:
- Update game state resources
- Trigger strategic AI analysis
- Generate notifications for connected clients
- Track exploration milestones

## Game Effects

When circumnavigation is completed, the following automatic effects occur:

1. **Free Movement**: The achieving team gains free movement points for naval units (configurable via `CIRCUMNAVIGATE_FREE_MOVES`)
2. **Achievement**: Steam achievement "Around the World in 80 Turns" may be unlocked for human players
3. **Global Notification**: All players receive a message about the circumnavigation
4. **Exclusivity**: Circumnavigation becomes unavailable to other teams

## Related Events

- **Exploration Events**: Related to map discovery and unit movement
- **Achievement Events**: May trigger alongside Steam achievements
- **Team Events**: Part of broader team-based milestone system

## Implementation Notes

- This event is part of the Community Patch DLL modification system
- The event uses conditional compilation (`MOD_EVENTS_CIRCUMNAVIGATION`) to maintain compatibility
- When the MOD_EVENTS_CIRCUMNAVIGATION flag is enabled, it uses the modern event system; otherwise, it falls back to direct Lua hook calls
- The event is called once per affected player, not once per team

## Technical Details

- **Source File**: `F:\Minor Solutions\vox-deorum\civ5-dll\CvGameCoreDLL_Expansion2\CvTeam.cpp`
- **Source Line**: 7704
- **Hook Type**: Lua script hook via `LuaSupport::CallHook`
- **Return Type**: Boolean result (though not typically used by handlers)

## Considerations for Modders

- This event fires for the entire team, so handle multiple players on the same team appropriately
- The event occurs during the team's turn processing, so game state is stable
- Consider the timing of any modifications made in response to this event
- The `teamID` parameter is reliable and can be used to identify all players on the achieving team