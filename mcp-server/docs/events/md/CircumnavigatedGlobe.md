# Overview

The `CircumnavigatedGlobe` event is triggered when a team successfully circumnavigates the globe in Civilization V. This historic achievement occurs when a team explores enough of the world's ocean tiles to complete a full navigation around the planet, marking a significant exploration milestone.

# Event Triggers

This event is triggered during the `testCircumnavigated()` function execution, which is called during team turn processing. The circumnavigation test evaluates whether a team has discovered sufficient ocean tiles to qualify for this achievement.

**Specific trigger conditions:**
- **World exploration**: A team discovers enough ocean tiles spanning the globe
- **Ocean connectivity**: The team must have revealed connected ocean passages
- **First achievement**: Only the first team to circumnavigate triggers this event
- **Turn processing**: Checked automatically during each team's turn processing phase
- **Astronomy prerequisite**: Requires ocean-passable technology (typically Astronomy)

# Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `teamID` | integer | The ID of the team that successfully circumnavigated the globe |

# Event Details

The circumnavigation system tracks global exploration progress and awards this achievement to the first team to complete the feat. The event is part of the exploration victory conditions and provides both mechanical and narrative significance.

**Achievement mechanics:**
- Grants additional free movement points to naval units (configurable via `CIRCUMNAVIGATE_FREE_MOVES`)
- Marks the world as circumnavigated, preventing other teams from achieving the same feat
- Triggers notification messages to all players about the achievement
- Updates minor civilization quest states related to circumnavigation

**Implementation details:**
- The event can be triggered through either the legacy Lua hook system or the newer GAMEEVENT system
- Legacy path uses `LuaSupport::CallHook` for backward compatibility
- Modern path uses `GAMEEVENTINVOKE_HOOK` when `MOD_EVENTS_CIRCUMNAVIGATION` is enabled
- Global game state tracks both circumnavigation status and the achieving team

**Related quest mechanics:**
- Minor civilization circumnavigation quests are automatically completed/failed
- Quest rewards are distributed to the achieving team
- Other teams' circumnavigation quests become obsolete

# Technical Details

**Source Location**: `CvGameCoreDLL_Expansion2/CvTeam.cpp`, line 7704 (legacy path) and line 7690 (modern path)

**Function Context**: Called within `CvTeam::testCircumnavigated()` during `CvTeam::doTurn()` processing

**Script System Integration**: 
- **Legacy**: Uses `LuaSupport::CallHook` to notify registered Lua event listeners
- **Modern**: Uses `GAMEEVENTINVOKE_HOOK` macro with `GAMEEVENT_CircumnavigatedGlobe`

**Preconditions**:
- Game must not already be marked as circumnavigated (`isCircumnavigated() == false`)
- Team must pass the circumnavigation exploration requirements
- Astronomy technology (or equivalent ocean-passable tech) must be available
- Script system must be initialized and available

**Event Flow**:
1. `CvTeam::doTurn()` calls `testCircumnavigated()` for exploration check
2. Function evaluates ocean tile discovery and connectivity
3. If circumnavigation achieved, `makeCircumnavigated()` sets global flag
4. Team ID is stored via `SetTeamThatCircumnavigated()`
5. Free naval movement bonus applied (if configured)
6. Event notification sent through appropriate hook system
7. UI messages distributed to all players
8. Minor civ quests updated accordingly