# Overview

The MakePeace event is triggered when two teams formally establish peace and end their state of war in Civilization V. This diplomatic event captures the moment when hostilities cease and peaceful relations are restored between civilizations, providing a crucial hook for AI systems to respond to conflict resolution and adjust strategic planning accordingly.

# Event Triggers

This event is fired in the `CvTeam.cpp` file when a team makes peace with another team through the diplomatic system. The event is invoked through the Lua scripting system hook mechanism, allowing external systems to monitor and respond to peace agreements in real-time.

**Trigger Location:** `CvGameCoreDLL_Expansion2/CvTeam.cpp:2164`

**Trigger Condition:** When a team establishes peace with another team, ending their state of war

# Parameters

The MakePeace event passes the following parameters:

1. **Initiating Team ID** (`GetID()`) - The unique identifier of the team that is making peace
2. **Target Team ID** (`eTeam`) - The unique identifier of the team that peace is being made with

Both parameters are pushed to the Lua arguments stack in sequence, with the peace-initiating team ID first, followed by the target team ID.

# Event Details

The MakePeace event occurs during the diplomatic resolution phase when teams transition from warfare to peaceful relations. This event serves as a notification mechanism for external systems to:

- Track peace agreements and conflict resolution between civilizations
- Adjust diplomatic strategies and alliance considerations
- Trigger AI responses to new peaceful relationships
- Update military and economic planning based on ended hostilities
- Reset war-related damage counters and relationship modifiers

The event is fired before the actual peace state changes take effect, allowing systems to prepare for the incoming peaceful state transition and associated game mechanics.

# Technical Details

**Event Name:** `MakePeace`
**Hook Type:** Lua scripting system hook
**Parameters Count:** 2
**Parameter Types:**
- Team ID (integer)
- Target Team ID (integer)

**Source File:** `CvGameCoreDLL_Expansion2/CvTeam.cpp`
**Line Number:** 2164
**Implementation:** `LuaSupport::CallHook(pkScriptSystem, "MakePeace", args.get(), bResult);`

The event is triggered during the peace-making process, immediately followed by the actual state changes that set both teams to no longer be at war with each other (`setAtWar(eTeam, false, bPacifier)` and `kTeam.setAtWar(GetID(), false, !bPacifier)`). The event also coincides with the resetting of city damage counters between the formerly warring civilizations.