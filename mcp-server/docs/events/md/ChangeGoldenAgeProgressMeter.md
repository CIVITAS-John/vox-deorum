# Overview

The `ChangeGoldenAgeProgressMeter` event is triggered when a player's progress towards their next Golden Age is modified in Civilization V. This event captures changes to the Golden Age progress meter, which accumulates Golden Age points that eventually lead to the start of a Golden Age period.

# Event Triggers

This event is triggered when the `ChangeGoldenAgeProgressMeter` function is called on a player object in the following scenarios:

- **Production conversion to Golden Age points**: When cities convert production to Golden Age points through specific mechanics
- **Religion compensation**: When faith is converted to Golden Age points during religion founding
- **Historic events**: When difficulty bonuses grant Golden Age points through historic events
- **Goody huts**: When tribal villages provide Golden Age point rewards
- **Happiness accumulation**: During turn processing when excess happiness generates Golden Age points
- **Empire-wide bonuses**: When empire-wide effects contribute Golden Age points
- **World Congress rewards**: When voting resolutions provide Golden Age point benefits
- **Yield conversions**: When other yield types are converted to Golden Age points

# Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerID` | integer | The ID of the player whose Golden Age progress meter is being changed |
| `change` | integer | The amount by which the Golden Age progress meter is being modified (can be positive or negative) |

# Event Details

The event is fired through the Lua script system whenever the internal `ChangeGoldenAgeProgressMeter` function is executed. The function internally calls `ChangeGoldenAgeProgressMeterTimes100`, which handles the precise calculation including fractional Golden Age points.

**Key behaviors:**
- The event is only triggered when the `NO_HAPPINESS` game option is not enabled
- Changes can be both positive (accumulating points) and negative (reducing progress)
- The meter progress contributes to triggering Golden Age periods when thresholds are reached
- The event provides visibility into Golden Age point accumulation across all game mechanics

**Related game mechanics:**
- Golden Age point generation from excess happiness
- Faith-to-Golden Age point conversion during religion founding
- Production-to-Golden Age point conversion in cities
- Historic event rewards and difficulty bonuses
- World Congress resolution benefits

# Technical Details

**Source Location**: `CvGameCoreDLL_Expansion2/CvPlayer.cpp`, line 24171

**Function Context**: Called within `CvPlayer::ChangeGoldenAgeProgressMeter(int iChange)` and `CvPlayer::ChangeGoldenAgeProgressMeterTimes100(int iChange)`

**Script System Integration**: Uses `LuaSupport::CallHook` to notify registered Lua event listeners

**Preconditions**:
- Game option `GAMEOPTION_NO_HAPPINESS` must not be enabled
- Script system must be initialized and available

**Event Flow**:
1. Game logic calls `ChangeGoldenAgeProgressMeter` or `ChangeGoldenAgeProgressMeterTimes100`
2. Function checks for happiness game option
3. If enabled, the Lua script system is invoked
4. Event arguments (player ID and change amount) are pushed to Lua stack
5. Registered event listeners are notified through the hook system