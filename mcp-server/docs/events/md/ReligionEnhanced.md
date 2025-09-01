# ReligionEnhanced Event

## Overview

The `ReligionEnhanced` event is triggered in Civilization V when a player enhances their religion by adding beliefs to it. This event provides information about the religion enhancement process and the beliefs being added.

## Event Trigger

This event is fired when a player successfully enhances their religion in the game. Religion enhancement is a mid-to-late game mechanic where players can add additional beliefs to their founded religion, providing more bonuses and expanding their religious influence.

**Source Location:** `CvGameCoreDLL_Expansion2/CvReligionClasses.cpp` at line 1507

## Event Parameters

The event passes the following parameters to Lua event handlers:

| Parameter | Type | Description |
|-----------|------|-------------|
| `ePlayer` | PlayerTypes | The player ID who is enhancing their religion |
| `eReligion` | ReligionTypes | The religion being enhanced |
| `eBelief1` | BeliefTypes | The first belief being added during enhancement |
| `eBelief2` | BeliefTypes | The second belief being added during enhancement |

### Parameter Details

- **ePlayer**: Identifies which civilization/player is performing the religion enhancement
- **eReligion**: Specifies which religion is being enhanced (important for tracking multiple religions in the game)
- **eBelief1**: The primary belief being added to the religion
- **eBelief2**: The secondary belief being added to the religion

## Usage Examples

### Basic Event Handler

```lua
-- Example event handler for ReligionEnhanced
function OnReligionEnhanced(playerID, religionID, belief1ID, belief2ID)
    local player = Players[playerID]
    local playerName = player:GetName()
    
    print(string.format("%s has enhanced their religion with new beliefs!", playerName))
    
    -- Process the beliefs being added
    if belief1ID ~= -1 then
        local belief1 = GameInfo.Beliefs[belief1ID]
        print(string.format("Added belief: %s", belief1.Description))
    end
    
    if belief2ID ~= -1 then
        local belief2 = GameInfo.Beliefs[belief2ID]
        print(string.format("Added belief: %s", belief2.Description))
    end
end

-- Register the event handler
Events.ReligionEnhanced.Add(OnReligionEnhanced)
```

### Advanced Event Handler with State Tracking

```lua
-- Track religion enhancements for AI decision making
local religionEnhancements = {}

function OnReligionEnhanced(playerID, religionID, belief1ID, belief2ID)
    -- Initialize tracking for this player if needed
    if not religionEnhancements[playerID] then
        religionEnhancements[playerID] = {}
    end
    
    -- Record the enhancement
    religionEnhancements[playerID][religionID] = {
        enhancedTurn = Game.GetGameTurn(),
        belief1 = belief1ID,
        belief2 = belief2ID
    }
    
    -- Trigger strategic analysis for AI players
    if not Players[playerID]:IsHuman() then
        AnalyzeReligionStrategy(playerID, religionID)
    end
end

Events.ReligionEnhanced.Add(OnReligionEnhanced)
```

## Related Events

The `ReligionEnhanced` event is part of the broader religion system and may be used alongside:

- **ReligionFounded**: Triggered when a player initially founds a religion
- **ReligionReformed**: Triggered when a religion is reformed (if using certain mods)
- **ReligionSpread**: Triggered when religion spreads to cities
- **BeliefAdded**: More granular events for individual belief additions

## Technical Considerations

### Belief Parameters

- Both `eBelief1` and `eBelief2` may contain valid belief IDs or may be -1 if no belief is being added in that slot
- The actual number of beliefs added depends on the game rules and the player's current religion state
- Enhancement typically allows adding Enhancer beliefs and sometimes additional Follower or Founder beliefs

### Game State Context

- This event fires after the enhancement has been processed by the game engine
- The religion's belief list will already include the new beliefs when the event handlers execute
- Players can only enhance religions they have founded (not religions founded by other players)

### Performance Notes

- This event has low frequency (typically once per player per game, if at all)
- Event handlers should be efficient as they may be called during critical game state updates
- Consider deferring heavy computations to subsequent turns if implementing complex AI logic

## Special Notes

- Religion enhancement requires specific game conditions to be met (sufficient Faith, appropriate technology/social policies)
- Not all players may enhance their religions during a game, making this event occurrence variable
- The beliefs added through enhancement can significantly impact gameplay balance and should be tracked for AI decision-making
- Some game modifications may alter the enhancement mechanics, potentially affecting the parameters passed to this event

## Integration with Vox Deorum

In the context of the Vox Deorum AI system, this event is crucial for:

- **Strategic Planning**: AI agents can analyze belief combinations to understand player strategies
- **Diplomatic Considerations**: Enhanced religions may affect diplomatic relationships
- **Counter-Strategy Development**: Understanding opponent religion enhancements helps in planning counter-measures
- **Resource Allocation**: AI can adjust Faith spending and religious unit production based on enhancement patterns