# ChangeGoldenAgeProgressMeter Event

## Overview

The `ChangeGoldenAgeProgressMeter` event is triggered when a player's golden age progress meter is modified in Civilization V. This event occurs whenever the golden age progress points for a player are increased or decreased, allowing the game and mods to track and respond to changes in golden age progression.

## Event Trigger

This event is fired when:
- A player gains or loses golden age progress points
- The golden age meter is programmatically adjusted
- Golden age progress is modified through game mechanics such as:
  - Completing wonders that provide golden age points
  - Great Artist actions that generate golden age points
  - Policy adoptions that affect golden age progress
  - Special buildings or improvements that contribute to golden age points

## Parameters

The event passes the following parameters to Lua event handlers:

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerID` | `int` | The unique identifier of the player whose golden age progress meter is being changed |
| `change` | `int` | The amount of change applied to the golden age progress meter. Positive values indicate progress gained, negative values indicate progress lost |

## Usage Examples

### Basic Event Handler

```lua
function OnChangeGoldenAgeProgressMeter(playerID, change)
    local player = Players[playerID]
    if player and player:IsHuman() then
        local playerName = player:GetName()
        if change > 0 then
            print(string.format("%s gained %d golden age points", playerName, change))
        elseif change < 0 then
            print(string.format("%s lost %d golden age points", playerName, math.abs(change)))
        end
    end
end

Events.ChangeGoldenAgeProgressMeter.Add(OnChangeGoldenAgeProgressMeter)
```

### Tracking Golden Age Progress

```lua
function OnChangeGoldenAgeProgressMeter(playerID, change)
    local player = Players[playerID]
    if not player then return end
    
    local currentProgress = player:GetGoldenAgeProgressMeter()
    local progressThreshold = player:GetGoldenAgeProgressThreshold()
    local progressPercent = math.floor((currentProgress / progressThreshold) * 100)
    
    print(string.format("Player %d golden age progress: %d/%d (%d%%)", 
          playerID, currentProgress, progressThreshold, progressPercent))
    
    -- Check if player is close to golden age
    if progressPercent >= 90 and change > 0 then
        print("Player " .. playerID .. " is approaching a golden age!")
    end
end

Events.ChangeGoldenAgeProgressMeter.Add(OnChangeGoldenAgeProgressMeter)
```

## Source Code Reference

This event is triggered from the following location in the Community Patch DLL:

- **File**: `CvGameCoreDLL_Expansion2/CvPlayer.cpp`
- **Line**: 24171
- **Context**: Called when the golden age progress meter value is modified for a player

## Related Events

Consider these related events when working with golden age mechanics:

- `GoldenAge` - Triggered when a player enters a golden age
- `EndGoldenAge` - Triggered when a player's golden age ends
- `PlayerDoTurn` - Can be used to monitor golden age status changes each turn
- `CityCanWork` - May be relevant for tracking productivity during golden ages

## Technical Notes

1. **Frequency**: This event can be triggered multiple times per turn as different game actions contribute golden age points
2. **Player Context**: Always validate that the player exists before accessing player methods
3. **Progress Tracking**: The change parameter represents the delta, not the absolute value
4. **Performance**: For heavy calculations, consider caching results or using turn-based updates instead of responding to every progress change
5. **Multiplayer**: This event fires for all players, including AI players

## Special Considerations

- The event may fire with a change value of 0 in some edge cases - handle this appropriately in your event handlers
- Golden age progress can be negative in certain circumstances (e.g., through mod mechanics)
- The progress meter may be reset to 0 when a golden age is triggered, which would result in a large negative change value
- Some game mechanics may cause multiple rapid-fire calls to this event, so implement efficient event handlers

## See Also

- [Golden Age Mechanics Documentation](../mechanics/golden-age.md)
- [Player API Reference](../api/player.md)
- [Event System Overview](../events/README.md)