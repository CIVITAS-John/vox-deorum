# GoodyHutTechResearched Event

## Description
The `GoodyHutTechResearched` event is triggered when a player discovers a technology as a result of exploring a goody hut (also known as ancient ruins or tribal villages) in Civilization V. This event provides notification when a player receives free technology research from these special map features.

## Event Trigger
This event is fired when:
- A player's unit enters a goody hut tile
- The goody hut outcome is determined to be a free technology
- The technology is successfully added to the player's research

## Event Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerId` | `int` | The unique identifier of the player who discovered the technology |
| `techId` | `int` | The identifier of the technology that was researched (`eBestTech`) |

### Parameter Details

#### playerId
- **Source**: `GetID()` - Retrieved from the player object
- **Usage**: Identifies which civilization/player received the free technology
- **Range**: Typically 0-based player index (0-63 for multiplayer games)

#### techId
- **Source**: `eBestTech` - The best available technology for the player
- **Usage**: Specifies which technology was granted to the player
- **Note**: The game determines the "best" technology based on the player's current research state and available prerequisites

## Code Reference
- **File**: `CvGameCoreDLL_Expansion2/CvPlayer.cpp`
- **Line**: 12853
- **Implementation**: `LuaSupport::CallHook(pkScriptSystem, "GoodyHutTechResearched", args.get(), bScriptResult);`

## Usage Examples

### Basic Event Handling
```lua
function OnGoodyHutTechResearched(playerId, techId)
    local player = Players[playerId]
    local tech = GameInfo.Technologies[techId]
    
    if player and tech then
        print("Player " .. player:GetName() .. " discovered " .. tech.Description .. " from a goody hut!")
    end
end

Events.GoodyHutTechResearched.Add(OnGoodyHutTechResearched)
```

### Advanced Event Processing
```lua
function OnGoodyHutTechResearched(playerId, techId)
    local player = Players[playerId]
    local tech = GameInfo.Technologies[techId]
    
    if not player or not tech then
        return
    end
    
    -- Log the discovery
    local playerName = player:GetName()
    local techName = Locale.ConvertTextKey(tech.Description)
    
    -- Notify all players of the discovery
    local message = playerName .. " has discovered " .. techName .. " from ancient ruins!"
    
    for i = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
        if Players[i]:IsHuman() then
            Players[i]:AddNotification(
                NotificationTypes.NOTIFICATION_TECH_AWARD,
                message,
                "Technology Discovered",
                -1, -1
            )
        end
    end
    
    -- Track goody hut discoveries for statistics
    if not _goodyHutTechCount then
        _goodyHutTechCount = {}
    end
    
    _goodyHutTechCount[playerId] = (_goodyHutTechCount[playerId] or 0) + 1
end

Events.GoodyHutTechResearched.Add(OnGoodyHutTechResearched)
```

## Related Events and Considerations

### Related Events
- **GoodyHutCanResearch**: May be triggered before this event to determine eligibility
- **TechAcquired**: General technology acquisition event that may also fire
- **GoodyHutReward**: Broader goody hut reward event for other types of discoveries

### Related Game Mechanics
- **Technology Prerequisites**: The granted technology will respect normal prerequisite chains
- **Era Progression**: Free technologies can trigger era changes and associated mechanics
- **Victory Conditions**: Technology discoveries can impact science victory progress
- **Diplomatic Relations**: Other civilizations may react to rapid technological advancement

## Special Notes

### Technology Selection Logic
- The game automatically selects the "best" available technology for the player
- Selection considers the player's current research priorities and civilization bonuses
- Technologies that are already known or unavailable due to prerequisites are excluded

### Balance Considerations
- Goody hut technologies provide significant early-game advantages
- The impact decreases in later eras as technology costs increase
- Multiple goody hut discoveries can accelerate a civilization's development significantly

### Performance Notes
- This event fires immediately when the technology is granted
- Event handlers should be efficient as they may be called multiple times per turn in active exploration phases
- Consider caching player and technology data if performing complex operations

### Compatibility
- This event is part of the Community Patch framework
- Standard Civilization V installations may not include this specific event hook
- Mods should verify event availability before registering handlers

## Implementation History
- **Generated**: 2025-09-01T01:20:46.712Z
- **Occurrences**: 1 (as of generation time)
- **Source File**: CvGameCoreDLL_Expansion2/CvPlayer.cpp, line 12853