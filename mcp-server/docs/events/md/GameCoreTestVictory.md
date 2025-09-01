# GameCoreTestVictory Event

## Overview
The `GameCoreTestVictory` event is a special Lua hook that allows custom scripts to intervene in the victory condition testing process in Civilization V. This event provides an opportunity for mods and custom logic to set victory states before the game's internal victory checking mechanisms are executed.

## When This Event is Triggered
This event fires during the game's victory testing cycle when:
- The `CvGame::testVictory()` function is called to check for victory conditions
- The game is evaluating whether any player has achieved victory
- Before any built-in victory condition checks are performed
- The game state is not already set to extended mode (`GAMESTATE_EXTENDED`)
- No victory has already been declared (`getVictory() == NO_VICTORY`)

The event occurs early in the victory testing process, allowing Lua scripts to potentially set a victory state before the game's default victory logic runs.

## Event Parameters

The `GameCoreTestVictory` event provides no parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| *None* | - | This event takes no parameters and passes an empty argument list to Lua scripts |

## Usage Examples

### Lua Script Example
```lua
function OnGameCoreTestVictory()
    -- Custom victory condition logic
    print("GameCoreTestVictory event triggered - checking custom victory conditions")
    
    -- Example: Check for a custom victory condition
    local humanPlayer = Players[Game.GetActivePlayer()]
    
    -- Custom condition: Player has 10 or more cities and specific technology
    if humanPlayer:GetNumCities() >= 10 and Teams[humanPlayer:GetTeam()]:IsHasTech(GameInfoTypes.TECH_FUTURE_TECH) then
        print("Custom victory condition met!")
        
        -- Set custom victory (this would need to be implemented via game functions)
        -- Game.SetWinner(humanPlayer:GetTeam(), VICTORY_CONQUEST)
    end
    
    -- Example: Check for time-based victory
    local currentTurn = Game.GetGameTurn()
    if currentTurn >= 500 then
        print("Time limit reached - triggering custom victory evaluation")
        -- Custom logic for time victory
    end
    
    -- Example: Check for diplomatic conditions
    local numAllies = 0
    for playerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
        local player = Players[playerID]
        if player:IsAlive() and not player:IsHuman() then
            if humanPlayer:IsDoF(playerID) then
                numAllies = numAllies + 1
            end
        end
    end
    
    if numAllies >= 5 then
        print("Diplomatic victory conditions potentially met")
        -- Custom diplomatic victory logic
    end
end

Events.GameCoreTestVictory.Add(OnGameCoreTestVictory)
```

### Bridge Service Integration
This event can be captured by the Bridge Service for:
- Implementing custom victory conditions through external AI systems
- Monitoring victory testing cycles for game state analysis
- Triggering external victory evaluation algorithms
- Logging victory testing events for game analysis
- Coordinating with MCP Server for victory condition strategies

## Related Events and Considerations

### Related Events
- **GameCoreUpdateDiplomacy** - Diplomatic updates that might affect victory conditions
- **PlayerTurnStart** - Turn-based events that might trigger victory checks
- **CityConstructed** - City creation that might affect victory conditions
- **TechResearched** - Technology advancement affecting victory paths

### Important Considerations

1. **Timing**: This event fires very early in the victory testing process, before any game victory checks
2. **No Parameters**: Unlike most events, this hook receives no game state parameters
3. **Victory Setting**: Custom victory logic would need to use game functions to actually set victory states
4. **Performance**: Since this fires during victory testing, expensive operations should be avoided
5. **Game State**: The event only fires when no victory has been set and the game is not in extended mode

### Special Notes

- This event is designed specifically for custom victory condition implementations
- The event passes an empty argument list, requiring scripts to query game state directly
- The event is called before the game updates scores (`updateScore()` is called after)
- This is a pre-check hook, allowing mods to override or supplement default victory logic
- The `bResult` parameter in the hook call allows scripts to potentially modify the victory testing flow
- Particularly useful for total conversion mods with entirely custom victory conditions

## Source Code Reference

**File**: `CvGameCoreDLL_Expansion2/CvGame.cpp`  
**Line**: 9731  
**Function**: `CvGame::testVictory()`  
**Hook Call**: `LuaSupport::CallHook(pkScriptSystem, "GameCoreTestVictory", args.get(), bResult);`

The event is triggered within the `testVictory()` function and occurs:
- After checking if the script system is available (line 9727)
- Before checking if victory is already set (line 9734)
- Before checking if the game is in extended mode (line 9739)
- Before updating the game score (line 9744)

The empty argument list is created at line 9729 with `CvLuaArgsHandle args;` and no parameters are pushed to it.