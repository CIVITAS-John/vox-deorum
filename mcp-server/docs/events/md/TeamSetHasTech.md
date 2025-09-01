# TeamSetHasTech Event

## Description
The `TeamSetHasTech` event is triggered whenever a team's technology status is changed in Civilization V. This event fires when a team either acquires or loses a technology, making it essential for tracking technological progress and implementing custom game mechanics based on tech acquisition.

## When Triggered
This event is triggered by the `CvTeamTechs::SetHasTech()` function in the game's core DLL whenever:
- A team researches and completes a new technology
- A technology is granted to a team through other means (e.g., trade, events, cheats)
- A technology is removed from a team (rare, but possible through mods or special circumstances)

The event only fires when there is an actual change in the team's technology status - it will not trigger if the same technology state is set again.

## Event Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `teamID` | `number` | The unique identifier of the team whose technology status changed |
| `techType` | `number` | The technology type index (TechTypes enum value) representing which technology was affected |
| `hasTime` | `boolean` | The new technology status - `true` if the team now has the technology, `false` if they lost it |

### Parameter Details

- **teamID**: Corresponds to the team's ID in the game. Teams are different from players - multiple players can be on the same team in team-based games.
- **techType**: An integer representing the specific technology using the game's internal TechTypes enumeration. This maps to technologies like "Agriculture", "Writing", "Gunpowder", etc.
- **hasTime**: A boolean flag indicating whether the team now possesses (`true`) or no longer possesses (`false`) the specified technology.

## Usage Examples

### Basic Event Listener
```lua
function OnTeamSetHasTech(teamID, techType, hasTech)
    print("Team " .. teamID .. " tech status changed for tech " .. techType .. " to " .. tostring(hasTech))
    
    if hasTech then
        print("Team acquired new technology!")
        -- Handle technology acquisition
    else
        print("Team lost a technology!")
        -- Handle technology loss (rare)
    end
end

Events.TeamSetHasTech.Add(OnTeamSetHasTech)
```

### Technology-Specific Handling
```lua
function OnTeamSetHasTech(teamID, techType, hasTech)
    if not hasTech then return end -- Only handle acquisitions
    
    -- Check for specific technologies
    if techType == GameInfoTypes["TECH_WRITING"] then
        print("Team " .. teamID .. " has discovered Writing!")
        -- Grant bonus or trigger special event
        
    elseif techType == GameInfoTypes["TECH_GUNPOWDER"] then
        print("Team " .. teamID .. " has entered the gunpowder age!")
        -- Update military strategies or unlock special units
    end
end
```

### Team Progress Tracking
```lua
local teamTechCounts = {}

function OnTeamSetHasTech(teamID, techType, hasTech)
    if not teamTechCounts[teamID] then
        teamTechCounts[teamID] = 0
    end
    
    if hasTech then
        teamTechCounts[teamID] = teamTechCounts[teamID] + 1
        print("Team " .. teamID .. " now has " .. teamTechCounts[teamID] .. " technologies")
    else
        teamTechCounts[teamID] = teamTechCounts[teamID] - 1
        print("Team " .. teamID .. " lost a technology, now has " .. teamTechCounts[teamID])
    end
end
```

## Related Events

- **PlayerResearched**: Fired when an individual player completes research on a technology
- **TeamTechDiscovered**: May be used in some contexts as an alternative name for technology discovery
- **TechAcquired**: Player-level technology acquisition events

## Special Notes

1. **Team vs Player**: This event tracks technology at the team level, not individual players. In single-player games, there's typically one player per team, but in multiplayer team games, multiple players share the same team's technology pool.

2. **Event Timing**: The event fires after the internal game state has been updated, so querying the team's technology status within the event handler will reflect the new state.

3. **Technology Loss**: While rare in standard gameplay, the `hasTech` parameter can be `false`, indicating technology loss. This might occur in custom scenarios or mods that implement technology regression mechanics.

4. **Performance Considerations**: This event can fire frequently during active research phases of the game. Consider performance implications when implementing heavy processing in event handlers.

5. **Source Location**: The event is triggered from `CvTechClasses.cpp` line 2372 in the `CvTeamTechs::SetHasTech()` method, ensuring it captures all programmatic technology changes, not just player-initiated research.

## Implementation Context

The event is part of the Community Patch DLL's Lua scripting system, allowing modders to create sophisticated technology-based game mechanics and AI behaviors. It integrates with the broader Vox Deorum system for LLM-enhanced AI decision making based on technological progress.