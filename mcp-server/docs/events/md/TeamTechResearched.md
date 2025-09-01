# TeamTechResearched Event

## Overview

The `TeamTechResearched` event is triggered when a team successfully completes research on a technology in Civilization V. This event provides information about which team researched the technology and any associated changes.

## Event Trigger

This event is fired when:
- A team completes research on a technology
- Technology research progress is modified for a team
- Called from `CvTeam.cpp` at line 8271 in the Community Patch DLL

## Event Parameters

The event is called with the following parameters in order:

| Parameter | Type | Description |
|-----------|------|-------------|
| `teamId` | Integer | The ID of the team that researched the technology |
| `techId` | Integer | The ID of the technology that was researched |
| `change` | Integer | The change in research progress or completion status |

### Parameter Details

1. **Team ID (`teamId`)**
   - Represents the team that completed or progressed in the technology research
   - Used to identify which civilization/team gained the technology

2. **Technology ID (`techId`)**
   - The specific technology identifier (eTech) from the game's technology database
   - Corresponds to entries in the Technologies table

3. **Change (`iChange`)**
   - Indicates the nature of the research change
   - Typically represents completion or progress modification

## Usage Examples

### Lua Hook Implementation

```lua
function OnTeamTechResearched(teamId, techId, change)
    print("Team " .. teamId .. " researched technology " .. techId .. " with change: " .. change)
    
    -- Example: Handle technology completion
    if change > 0 then
        local tech = GameInfo.Technologies[techId]
        if tech then
            print("Technology researched: " .. tech.Type)
        end
    end
end

Events.TeamTechResearched.Add(OnTeamTechResearched)
```

### Bridge Service Integration

```json
{
  "eventType": "TeamTechResearched",
  "data": {
    "teamId": 0,
    "techId": 15,
    "change": 1
  }
}
```

## Related Events

- **TechResearched**: Individual player technology research events
- **TeamSetEra**: When a team advances to a new era through technology
- **ResearchAgreementCompleted**: When research agreements contribute to technology progress

## Implementation Notes

- This event is triggered at the team level, not individual player level
- The event occurs in the Community Patch DLL's team management code
- Technology IDs correspond to the game's internal technology database
- The change parameter can indicate different types of research modifications

## Technical Details

- **Source File**: `CvTeam.cpp`
- **Line Number**: 8271
- **Hook Call**: `LuaSupport::CallHook(pkScriptSystem, "TeamTechResearched", args.get(), bResult)`
- **Arguments Setup**: Lines 8266-8268 in the source file

## Special Considerations

- This event may be triggered multiple times for the same technology if research progress is modified incrementally
- Teams in Civilization V can consist of multiple human or AI players
- The event is part of the Community Patch framework's extended event system
- Modders should handle cases where the technology ID might not correspond to valid entries in custom scenarios