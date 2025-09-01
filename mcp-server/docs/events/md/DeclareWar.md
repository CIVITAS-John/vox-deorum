# DeclareWar Event

## Overview

The `DeclareWar` event is triggered when one team (civilization) declares war against another team in Civilization V. This is a critical diplomatic event that marks the beginning of active hostilities between civilizations.

## When This Event Is Triggered

This event is fired whenever a team declares war on another team through the game's diplomatic system. The event occurs after all necessary validation checks have been performed but before the actual war state is fully implemented in the game.

**Source Location**: `CvGameCoreDLL_Expansion2/CvTeam.cpp`, line 1286

## Event Parameters

The DeclareWar event receives the following parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `declaringTeam` | Integer (Team ID) | The ID of the team that is declaring war |
| `targetTeam` | Integer (Team ID) | The ID of the team that war is being declared against |

### Parameter Details

- **declaringTeam**: Represents the team initiating the declaration of war. This is obtained via `GetID()` in the source code.
- **targetTeam**: Represents the team that will be the target of the war declaration. This is passed as the `eTeam` parameter.

## Usage Examples

### Lua Hook Example

```lua
-- Example of handling the DeclareWar event in Lua
function OnDeclareWar(declaringTeam, targetTeam)
    local declaringTeamName = Teams[declaringTeam]:GetName()
    local targetTeamName = Teams[targetTeam]:GetName()
    
    print(string.format("%s has declared war on %s!", 
          declaringTeamName, targetTeamName))
    
    -- Additional logic can be added here, such as:
    -- - Updating diplomatic relationships
    -- - Triggering AI responses
    -- - Logging the event for analysis
    -- - Notifying other civilizations
end

-- Register the event handler
LuaEvents.DeclareWar.Add(OnDeclareWar)
```

### JSON Event Structure

When captured by the bridge service, the event would appear as:

```json
{
    "eventName": "DeclareWar",
    "timestamp": "2025-09-01T12:00:00.000Z",
    "parameters": {
        "declaringTeam": 2,
        "targetTeam": 5
    }
}
```

## Related Events and Considerations

### Related Events
- **MakePeace**: The counterpart event when war ends
- **DiplomacyResponse**: May be triggered as a result of war declarations
- **TeamMeet**: Initial contact between civilizations that can lead to future conflicts

### Diplomatic Context
- This event occurs within the broader diplomatic system of Civilization V
- War declarations can cascade to affect relationships with other civilizations
- Allied civilizations may be automatically drawn into conflicts

### AI Considerations
- AI civilizations will respond to war declarations with strategic adjustments
- This event can trigger complex AI decision-making processes
- Multiple AI systems may react simultaneously to this event

## Special Notes

### Technical Implementation
- The event is called through the `LuaSupport::CallHook` mechanism
- The event occurs in the `CvTeam` class, indicating it's handled at the team level rather than individual civilization level
- Parameters are pushed to the argument stack before the hook is called

### Game State Impact
- This event occurs before the actual war state is fully implemented
- Handlers should be aware that game state may be in transition when this event fires
- The event provides an opportunity to implement custom logic before war effects take place

### Performance Considerations
- As a diplomatic event, this typically occurs infrequently during gameplay
- Event handlers should be efficient as they may need to process quickly during AI turns
- Consider the impact of multiple simultaneous war declarations in multiplayer scenarios

### Modding Applications
- Custom victory conditions based on warfare
- Enhanced diplomatic AI that reacts to war declarations
- Historical logging and analysis systems
- Custom notification systems for players
- Balance modifications that affect war costs or consequences

## See Also

- [CvTeam.cpp Source Reference](F:\Minor Solutions\vox-deorum\civ5-dll\CvGameCoreDLL_Expansion2\CvTeam.cpp#L1286)
- Civilization V Community Patch Documentation
- Lua Events Reference
- Diplomatic System Overview