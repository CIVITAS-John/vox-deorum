# Overview

The `PlayerBullied` event is triggered when a major civilization successfully bullies a city-state (minor civilization) into providing tribute or resources. This event captures aggressive diplomatic actions where major powers coerce minor civilizations into giving up gold, science, or military units through intimidation rather than cooperation.

# Event Triggers

This event is triggered from three distinct bullying scenarios within the minor civilization AI system, representing different types of tribute extraction:

1. **Gold Tribute**: When a major civilization bullies a city-state into providing gold payments
2. **Science Tribute**: When a major civilization forces a city-state to share scientific knowledge or research
3. **Unit Tribute**: When a major civilization coerces a city-state into providing military units

All triggers occur within the `CvMinorCivAI` class during diplomatic interactions where the major civilization uses intimidation tactics to extract resources.

# Parameters

The event passes seven parameters to event handlers:

| Parameter | Type | Description |
|-----------|------|-------------|
| BullyingPlayer | PlayerTypes | The ID of the major civilization performing the bullying |
| MinorPlayer | PlayerTypes | The ID of the minor civilization (city-state) being bullied |
| GoldAmount | int | Amount of gold extracted (or -1 if not applicable) |
| UnitType | int | Type of unit provided (or -1 if not applicable) |
| UnitX | int | X coordinate of provided unit (or -1 if not applicable) |
| UnitY | int | Y coordinate of provided unit (or -1 if not applicable) |
| YieldType | YieldTypes | Type of yield being extracted (GOLD, SCIENCE, or -1 for units) |

# Event Details

The event provides comprehensive information about bullying outcomes:

- **Tribute Type Identification**: The yield type and parameter values indicate whether gold, science, or units were extracted
- **Resource Quantification**: Specific amounts and types of tribute are tracked
- **Location Context**: For unit tributes, the exact spawn location is provided
- **Diplomatic Impact**: Bullying typically damages relationships but provides immediate benefits
- **Player Dynamics**: Both the aggressor and victim civilizations are clearly identified
- **Strategic Consequences**: Bullying can affect regional diplomatic stability and city-state relationships

The multiple parameter pattern allows the event to handle different tribute types while maintaining consistent event structure across all bullying scenarios.

# Technical Details

**Source File**: `CvGameCoreDLL_Expansion2/CvMinorCivAI.cpp`

**Trigger Locations**:
- Line 16595: Gold tribute extraction (YIELD_GOLD)
- Line 16925: Science tribute extraction (YIELD_SCIENCE) 
- Line 16957: Unit tribute extraction (military units)

**Event System**: Uses the game event system via `GAMEEVENTINVOKE_HOOK(GAMEEVENT_PlayerBullied)`

**Bullying Context**: Bullying mechanics typically:
- Require military or diplomatic superiority over the target city-state
- Provide immediate benefits but damage long-term relationships
- May have cooldown periods or increasing difficulty with repeated attempts
- Can affect the city-state's relationships with other major civilizations
- Often involve risk/reward calculations based on military strength and diplomatic consequences

**Parameter Patterns**:
- **Gold/Science**: Uses positive values in the respective fields, -1 in unused parameters
- **Units**: Uses -1 for gold, unit type/coordinates for unit information, -1 for yield type
- **Consistency**: The seven-parameter structure accommodates all tribute types while maintaining event signature consistency