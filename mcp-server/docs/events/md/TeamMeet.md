# TeamMeet Event

## Overview

The `TeamMeet` event is triggered when two teams encounter each other for the first time in Civilization V. This event represents the initial diplomatic contact between civilizations and is a crucial moment for establishing international relations.

## When This Event is Triggered

This event is fired when:
- Two teams that have never met before come into contact
- This typically occurs through exploration, trade routes, or other forms of contact
- The event is called from the team interaction logic in the game's core DLL

## Event Parameters

The TeamMeet event passes the following parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `eTeam` | TeamID | The ID of the team that is being met (the other team) |
| `GetID()` | TeamID | The ID of the current team (the team initiating or experiencing the meeting) |

### Parameter Details

1. **eTeam (TeamID)**
   - Represents the foreign team being encountered
   - Used to identify which civilization has been met
   - Essential for diplomatic and AI decision-making

2. **GetID() (TeamID)**
   - The ID of the team experiencing the meeting
   - Represents the "self" in the meeting context
   - Allows scripts to distinguish between the meeting team and the met team

## Usage Examples

### Lua Event Handler Example

```lua
function OnTeamMeet(iTeam, iMetTeam)
    local pTeam = Teams[iTeam]
    local pMetTeam = Teams[iMetTeam]
    
    if pTeam and pMetTeam then
        local teamName = pTeam:GetName()
        local metTeamName = pMetTeam:GetName()
        
        print(string.format("%s has met %s for the first time!", teamName, metTeamName))
        
        -- Trigger diplomatic events, notifications, or AI behavior
        -- Log the meeting for historical records
        -- Update relationship tracking systems
    end
end

Events.TeamMeet.Add(OnTeamMeet)
```

### Practical Applications

- **Diplomatic Notifications**: Alert players when they encounter new civilizations
- **AI Behavior**: Trigger AI diplomatic assessments and strategy adjustments  
- **Historical Logging**: Record first contact events for replay analysis
- **Mod Features**: Enable custom diplomatic mechanics or meeting bonuses

## Related Events and Considerations

### Related Events
- **PlayerMet**: Similar event but at the player level rather than team level
- **DiplomacyEvents**: Various diplomatic interaction events that may follow
- **WarEvents**: Potential conflict events that could arise from meetings

### Important Considerations

1. **Team vs Player Distinction**: This event occurs at the team level, which may include multiple players in team games
2. **One-Time Event**: This event only fires once per unique team pairing
3. **Bidirectional**: Both teams will experience this event when they meet
4. **Timing**: The event fires immediately upon contact establishment

## Implementation Details

### Source Location
- **File**: `CvGameCoreDLL_Expansion2/CvTeam.cpp`
- **Line**: 2528
- **Function Context**: Team interaction and contact establishment logic

### Technical Notes
- The event is called through the Lua scripting system using `LuaSupport::CallHook`
- Parameters are pushed onto the argument stack in the order: `eTeam`, `GetID()`
- The event uses the standard Civilization V event system architecture

## Best Practices

1. **Performance**: Keep event handlers lightweight as they may be called frequently during exploration phases
2. **Error Handling**: Always validate team objects before accessing their properties
3. **Logging**: Consider logging these events for debugging diplomatic issues
4. **Mod Compatibility**: Be aware that other mods may also hook this event

## Version Information

- **Occurrences**: 1 (as of generation date)
- **Generated**: 2025-09-01T01:20:46.712Z
- **Component**: Community Patch DLL (CvGameCoreDLL_Expansion2)