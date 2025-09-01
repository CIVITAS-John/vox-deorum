# MakePeace Event

## Overview

The `MakePeace` event is triggered when two teams in Civilization V establish a peace agreement, ending their state of war. This event is fired from the Community Patch DLL when the diplomatic status between teams changes from war to peace.

## When Triggered

This event is triggered when:
- Two teams that were previously at war negotiate and establish peace
- The peace agreement is successfully processed by the game engine
- The diplomatic state transition from war to peace is completed

**Source Location:** `CvGameCoreDLL_Expansion2/CvTeam.cpp` at line 2164

## Event Parameters

The MakePeace event passes the following parameters to Lua scripts:

| Parameter | Type | Description |
|-----------|------|-------------|
| `teamId` | Integer | The ID of the team that is making peace (the initiating team) |
| `otherTeamId` | Integer | The ID of the other team involved in the peace agreement |

### Parameter Details

1. **teamId** (First argument)
   - Represents the team calling the MakePeace function
   - Retrieved via `GetID()` method on the team object
   - Used to identify which civilization is establishing peace

2. **otherTeamId** (Second argument)  
   - Represents the target team in the peace agreement
   - Passed as the `eTeam` parameter to the function
   - Identifies the other civilization involved in the peace treaty

## Usage Examples

### Basic Event Handler

```lua
-- Register event handler for MakePeace
Events.MakePeace.Add(function(teamId, otherTeamId)
    local team1 = Teams[teamId]
    local team2 = Teams[otherTeamId]
    
    print(string.format("Peace established between Team %d and Team %d", teamId, otherTeamId))
    
    -- Get civilization names for better logging
    local civ1Name = team1:GetName()
    local civ2Name = team2:GetName()
    
    print(string.format("%s and %s have made peace", civ1Name, civ2Name))
end)
```

### Advanced Peace Tracking

```lua
-- Track peace agreements for diplomatic analysis
local peaceAgreements = {}

Events.MakePeace.Add(function(teamId, otherTeamId)
    local currentTurn = Game.GetGameTurn()
    
    -- Store peace agreement data
    local agreementKey = math.min(teamId, otherTeamId) .. "_" .. math.max(teamId, otherTeamId)
    peaceAgreements[agreementKey] = {
        team1 = teamId,
        team2 = otherTeamId,
        turn = currentTurn,
        gameTime = os.time()
    }
    
    -- Notify other systems about the peace
    LuaEvents.PeaceEstablished(teamId, otherTeamId, currentTurn)
end)
```

## Related Events

The MakePeace event is part of the broader diplomatic event system. Related events include:

- **DeclareWar** - Triggered when teams go to war
- **DoF** (Declaration of Friendship) - For friendship agreements
- **TeamMeet** - When teams first encounter each other
- **TeamSetHasMet** - Related to diplomatic contact establishment

## Implementation Notes

### Technical Details
- Event is called from `CvTeam::MakePeace()` method in the Community Patch DLL
- Uses the LuaSupport system to bridge C++ game logic with Lua scripting
- Parameters are pushed onto the Lua argument stack in order: teamId, otherTeamId

### Timing Considerations
- This event fires after the peace agreement has been processed by the game engine
- The diplomatic status has already changed when this event is triggered
- Both teams will have their war state cleared before the event fires

### Special Considerations
- Teams are indexed starting from 0 in Civilization V
- The event fires once per peace agreement, regardless of which team initiated it
- Peace agreements can be bilateral negotiations or may involve AI decision-making
- This event does not differentiate between player-initiated and AI-initiated peace

## Best Practices

1. **Validation**: Always validate that team IDs are valid before processing
2. **Symmetry**: Remember that peace affects both teams equally - avoid duplicate processing
3. **Performance**: Keep event handlers lightweight as they may be called frequently
4. **State Checking**: Verify that teams were actually at war before processing peace logic

## Example Integration with AI Systems

```lua
-- Integration with Vox Deorum AI system
Events.MakePeace.Add(function(teamId, otherTeamId)
    -- Notify the Bridge Service about the peace agreement
    local eventData = {
        eventType = "MakePeace",
        participants = {teamId, otherTeamId},
        turn = Game.GetGameTurn(),
        timestamp = os.time()
    }
    
    -- Send to external AI system via bridge
    BridgeService.SendEvent("diplomatic_change", eventData)
end)
```

This event is crucial for AI systems like Vox Deorum to track diplomatic relationships and make informed strategic decisions based on the changing political landscape of the game.