# Overview

The DeclareWar event is triggered when one team formally declares war on another team in Civilization V. This event captures the moment of diplomatic breakdown and the initiation of hostilities between civilizations, providing a critical hook for AI systems to respond to warfare declarations and adjust strategic planning accordingly.

# Event Triggers

This event is fired in the `CvTeam.cpp` file when a team declares war on another team. The event is invoked through the Lua scripting system hook mechanism, allowing external systems to monitor and respond to warfare declarations in real-time.

**Trigger Location:** `CvGameCoreDLL_Expansion2/CvTeam.cpp:1286`

**Trigger Condition:** When a team initiates a war declaration against another team

# Parameters

The DeclareWar event passes the following parameters:

1. **Declaring Team ID** (`GetID()`) - The unique identifier of the team that is declaring war
2. **Target Team ID** (`eTeam`) - The unique identifier of the team that war is being declared against

Both parameters are pushed to the Lua arguments stack in sequence, with the declaring team ID first, followed by the target team ID.

# Event Details

The DeclareWar event occurs during the diplomatic phase when teams transition from peaceful relations to active warfare. This event serves as a notification mechanism for external systems to:

- Track warfare initiation between civilizations
- Adjust diplomatic strategies and alliances
- Trigger AI responses to new conflict situations
- Update military and economic planning based on new hostilities

The event is fired before the actual war state changes take effect, allowing systems to prepare for the incoming warfare state transition.

# Technical Details

**Event Name:** `DeclareWar`
**Hook Type:** Lua scripting system hook
**Parameters Count:** 2
**Parameter Types:** 
- Team ID (integer)
- Target Team ID (integer)

**Source File:** `CvGameCoreDLL_Expansion2/CvTeam.cpp`
**Line Number:** 1286
**Implementation:** `LuaSupport::CallHook(pkScriptSystem, "DeclareWar", args.get(), bResult);`

The event is conditionally compiled based on the `MOD_EVENTS_WAR_AND_PEACE` preprocessor directive, ensuring it's only included in builds that support extended war and peace event handling.