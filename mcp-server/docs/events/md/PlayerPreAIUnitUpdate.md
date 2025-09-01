# PlayerPreAIUnitUpdate Event

## Overview

The `PlayerPreAIUnitUpdate` event is triggered immediately before AI unit processing begins in Civilization V, providing an opportunity to intercept and customize unit behavior before the game's AI systems take control.

## Event Details

- **Event Name**: `PlayerPreAIUnitUpdate`
- **Source File**: `CvGameCoreDLL_Expansion2/CvPlayerAI.cpp` (line 267)
- **Frequency**: Once per player per turn (when AI unit updates are needed)

## When Triggered

This event is fired at the beginning of the `CvPlayerAI::AI_unitUpdate()` method execution sequence:

1. **PlayerPreAIUnitUpdate event is triggered** ← You are here
2. Busy unit/city check (if busy, processing is skipped)
3. Human player tactical AI visibility update (if applicable)
4. AI unit movement and decision processing begins
5. Homeland AI updates (if needed)
6. Unit automation and AI behavior execution

The event occurs during the game's `UpdateMoves()` cycle when:
- The player's turn is active, OR
- Automated units need updates, OR 
- Homeland AI needs updates

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerID` | `int` | The unique identifier of the player whose units are about to be processed by AI. Retrieved via `GetID()` method. |

### Parameter Details

- **playerID**: 
  - Range: 0 to maximum number of players in the game
  - Represents both major civilizations and city-states
  - Identifies which specific player's units are about to undergo AI processing
  - Valid for both human players (with automated units) and AI players

## Usage Examples

### Lua Event Handler
```lua
-- Register event handler for PlayerPreAIUnitUpdate
Events.PlayerPreAIUnitUpdate.Add(function(playerID)
    local player = Players[playerID]
    if player and player:IsAlive() then
        print("About to process AI units for player " .. playerID .. " (" .. player:GetName() .. ")")
        
        -- Example: Pre-AI unit processing logic
        if player:IsHuman() then
            -- Handle human player's automated units
            PrepareAutomatedUnits(playerID)
        else
            -- Handle AI player unit preparation
            PrepareAIUnits(playerID)
        end
    end
end)
```

### Unit State Modification
```lua
function OnPlayerPreAIUnitUpdate(playerID)
    local player = Players[playerID]
    if not player or not player:IsAlive() then
        return
    end
    
    -- Example: Modify unit states before AI processing
    for unit in player:Units() do
        if unit and not unit:IsDead() then
            -- Apply custom unit modifications before AI takes over
            -- - Set custom movement priorities
            -- - Apply temporary buffs/debuffs
            -- - Override automation settings
            
            -- Example: Boost combat units near cities
            if unit:IsCombatUnit() and unit:GetPlot():IsCity() then
                -- Custom logic here (requires additional mod support)
                print("Preparing combat unit " .. unit:GetName() .. " for AI processing")
            end
        end
    end
end
Events.PlayerPreAIUnitUpdate.Add(OnPlayerPreAIUnitUpdate)
```

### Performance Monitoring
```lua
function OnPlayerPreAIUnitUpdate(playerID)
    local player = Players[playerID]
    if not player then return end
    
    -- Track AI processing timing for performance analysis
    local unitCount = player:GetNumUnits()
    print("Player " .. playerID .. " has " .. unitCount .. " units entering AI processing")
    
    -- Store timestamp for later performance measurement
    g_AIUpdateStartTimes = g_AIUpdateStartTimes or {}
    g_AIUpdateStartTimes[playerID] = os.clock()
end
Events.PlayerPreAIUnitUpdate.Add(OnPlayerPreAIUnitUpdate)
```

## Related Events

- **PlayerDoTurn**: Triggered earlier in the turn sequence during general turn processing
- **UnitSetXY**: May be triggered multiple times during AI unit movement after this event
- **UnitPrekill**: May be triggered if units are destroyed during AI combat decisions
- **GameCoreUpdateBegin/GameCoreUpdateEnd**: Frame the broader game update cycle that contains this event

## Implementation Context

The event is called through the Lua scripting system using the `LuaSupport::CallHook` mechanism:

```cpp
ICvEngineScriptSystem1* pkScriptSystem = gDLL->GetScriptSystem();
if(pkScriptSystem)
{
    CvLuaArgsHandle args;
    args->Push(GetID());  // Push player ID as parameter
    
    bool bResult = false;
    LuaSupport::CallHook(pkScriptSystem, "PlayerPreAIUnitUpdate", args.get(), bResult);
}
```

## Special Considerations

1. **Timing Critical**: This event fires immediately before AI unit processing, making it the last opportunity to modify unit states before the AI takes control.

2. **Performance Impact**: Since this event can fire multiple times per turn (for different players), minimize processing time in event handlers to avoid impacting game performance.

3. **Early Termination**: If the player has busy units or cities, AI unit processing may be skipped entirely after this event fires.

4. **Human vs AI Players**: The event fires for both human players (with automated units) and AI players, but subsequent processing differs based on player type.

5. **Game State**: At this point in the turn sequence, most other turn processing has completed, providing a stable game state for unit-related decisions.

## Use Cases

- **Unit Behavior Modification**: Apply custom unit states or properties before AI processing
- **Performance Monitoring**: Track AI processing performance and unit counts
- **Custom Automation**: Implement mod-specific unit automation logic
- **AI Enhancement**: Provide additional information or context to AI systems
- **Debug and Logging**: Monitor unit states and AI processing triggers
- **Balance Modifications**: Apply turn-based unit balance changes

## Implementation Notes

1. **Conditional Processing**: The actual AI unit update may be skipped if:
   - The player has busy units or cities (`hasBusyUnitOrCity()` returns true)
   - The player is human and certain conditions aren't met

2. **Update Conditions**: AI unit updates occur when:
   - Player's turn is active, OR
   - Automated units need updates, OR
   - Homeland AI requires updates

3. **Human Player Behavior**: For human players, this primarily affects automated units and tactical AI visibility updates.

## Technical Details

- **Function Context**: Called from `CvPlayerAI::AI_unitUpdate(bool bUpdateHomelandAI)`
- **Thread Safety**: Executes on the main game thread during turn processing
- **Error Handling**: The event call is protected by script system availability checks
- **Return Value**: The event supports a boolean return value, though the base implementation doesn't use it

## Notes

- This event is only available when using the modified Community Patch DLL
- Event handlers should be lightweight to avoid impacting turn processing speed  
- Always validate that the player exists and is alive before performing operations
- The event provides the final opportunity to influence unit behavior before AI systems engage
- Consider the cascading effects of any unit modifications, as they may impact subsequent AI decisions