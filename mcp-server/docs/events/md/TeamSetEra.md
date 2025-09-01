# TeamSetEra Event

## Overview

The `TeamSetEra` event is triggered when a team (civilization) advances to a new era in Civilization V. This event represents a major milestone in a civilization's technological and cultural development, marking their progression through the various stages of human advancement from Ancient times to the modern era and beyond.

## When This Event is Triggered

This event is fired when:
- A team advances to a new era through technological research or other game mechanics
- The team's current era changes from one era to another (e.g., Ancient to Classical, Industrial to Modern)
- The event is called from the `SetCurrentEra` function in the team management logic
- Only fires when the era actually changes (not on initialization with the same era)

The event occurs in the `CvTeam::SetCurrentEra()` function when a team's era is updated to a new value, typically as a result of technological advancement or special game events.

## Event Parameters

The TeamSetEra event passes the following parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `GetID()` | TeamID | The ID of the team that has advanced to the new era |
| `GetCurrentEra()` | EraTypes | The new era that the team has just entered |

### Parameter Details

1. **GetID() (TeamID)**
   - Represents the team that has advanced to a new era
   - Used to identify which civilization has progressed
   - Essential for tracking technological and cultural development
   - Allows scripts to determine which team is experiencing the era change

2. **GetCurrentEra() (EraTypes)**
   - The newly set era that the team has just entered
   - Represents the technological/cultural level the team has achieved
   - Common era values include Ancient, Classical, Medieval, Renaissance, Industrial, Modern, Atomic, Information, and Future eras
   - Used for era-specific game mechanics, bonuses, and restrictions

## Usage Examples

### Lua Event Handler Example

```lua
function OnTeamSetEra(iTeamID, iNewEra)
    local pTeam = Teams[iTeamID]
    
    if pTeam then
        local teamName = pTeam:GetName()
        local eraName = GameInfo.Eras[iNewEra].Description
        
        print(string.format("%s has entered the %s!", teamName, Locale.ConvertTextKey(eraName)))
        
        -- Check if this team is human-controlled
        if pTeam:IsHuman() then
            -- Trigger era-specific notifications or bonuses
            -- Update UI elements or provide era advancement rewards
            -- Log the era advancement for historical records
        end
        
        -- AI behavior adjustments based on new era
        if not pTeam:IsHuman() then
            -- Update AI strategies for the new era
            -- Adjust diplomatic priorities
            -- Modify military unit production preferences
        end
    end
end

Events.TeamSetEra.Add(OnTeamSetEra)
```

### Practical Applications

- **Era-Specific Bonuses**: Grant special bonuses or unlock features when entering new eras
- **AI Behavior Adaptation**: Update AI strategies and priorities based on technological level
- **Historical Tracking**: Log era advancements for replay analysis and civilization tracking
- **Mod Features**: Enable custom era-based mechanics, buildings, units, or gameplay changes
- **Diplomatic Relations**: Adjust diplomatic modifiers based on technological disparities
- **Economic Systems**: Modify trade routes, resource availability, or economic bonuses

## Related Events and Considerations

### Related Events
- **TechResearched**: Often precedes this event when new technologies unlock era advancement
- **PlayerDoTurn**: May follow this event as civilizations adjust to new era capabilities
- **BuildingConstructed**: May be triggered by new era-specific buildings becoming available
- **UnitTrained**: May follow as new era-appropriate military units are produced

### Important Considerations

1. **Era Prerequisites**: Teams must meet specific technological requirements to advance eras
2. **Era-Specific Content**: Different eras unlock various buildings, units, and game mechanics
3. **Team vs Player**: This event occurs at the team level, affecting all players on the same team
4. **Historical Progression**: Eras represent logical progression of human technological development
5. **Balance Implications**: Era advancement affects military capabilities, economic potential, and diplomatic standing

## Implementation Details

### Source Location
- **File**: `CvGameCoreDLL_Expansion2/CvTeam.cpp`
- **Line**: 8965
- **Function Context**: `CvTeam::SetCurrentEra(EraTypes eNewValue)` function

### Technical Notes
- The event is called through the Lua scripting system using `LuaSupport::CallHook`
- Parameters are pushed onto the argument stack in the order: `GetID()`, `GetCurrentEra()`
- The event only fires when the era actually changes (checked via `GetCurrentEra() != eNewValue`)
- Part of the Community Patch DLL's enhanced event system
- Alternative event hook `GAMEEVENT_TeamSetEra` is available when `MOD_EVENTS_NEW_ERA` is enabled

### Era Change Process
The era change involves several steps:
1. Check if the new era is different from the current era
2. Update team's era value to the new era
3. Trigger era-specific game mechanics and updates
4. Fire the TeamSetEra event to notify all registered handlers
5. Update minor civilization rewards and diplomatic relationships
6. Process era-specific building and unit availability

## Best Practices

1. **Performance**: Era changes are infrequent but significant events, so more complex processing is acceptable
2. **Era Validation**: Always validate era values and team objects before processing
3. **Historical Accuracy**: Consider maintaining era progression logic that reflects historical development
4. **Mod Compatibility**: Be aware that other mods may modify era advancement mechanics
5. **Balance Considerations**: Era-based modifications should maintain game balance across different civilizations

## Version Information

- **Occurrences**: 1 (as of generation date)
- **Generated**: 2025-09-01T01:20:46.712Z
- **Component**: Community Patch DLL (CvGameCoreDLL_Expansion2)