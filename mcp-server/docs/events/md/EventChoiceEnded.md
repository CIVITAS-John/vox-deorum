# Overview

The `EventChoiceEnded` event is triggered when a player makes a final decision for a player-level event choice in Civilization V. This event represents the conclusion of the interactive decision-making phase, where the player's selected choice is executed and its effects are applied to the civilization. This marks the final stage of the event lifecycle.

# Event Triggers

This event is triggered when a player makes a decision on an active event choice, typically through UI interaction or automatic resolution.

**Specific trigger conditions:**
- **Active event choice**: An event choice must be currently active and available for decision
- **Player decision**: The player has selected one of the available choice options
- **Choice execution**: The selected choice is being processed and its effects applied
- **Event conclusion**: The event system is finalizing the event and cleaning up its state

**Related mechanics that can trigger event choice endings:**
- Direct player interaction with the event choice UI
- Automatic resolution when event choice duration expires
- Scripted or modded systems that programmatically resolve choices
- Event chain progression where one choice triggers the next event
- Game state changes that force event resolution

# Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerID` | integer | The ID of the player who made the event choice (from `GetID()`) |
| `eventChoiceID` | integer | The identifier of the specific event choice that was selected (`eChosenEventChoice`) |

# Event Details

Event choice endings represent the resolution and conclusion phase of the player event system. When an event choice ends, the player's decision is implemented, resulting in immediate and potentially long-term changes to the civilization's state, resources, and capabilities.

**Event choice ending mechanics:**
- **Choice finalization**: The selected choice becomes permanent and cannot be changed
- **Effect application**: All consequences of the chosen option are applied to the player
- **Resource changes**: Costs and benefits defined by the choice are processed
- **State cleanup**: The event system removes the active choice and may trigger follow-up events
- **Notification**: The player receives feedback about the consequences of their decision

**Choice resolution outcomes:**
- **Immediate effects**: Instant changes to yields, resources, units, or buildings
- **Permanent modifications**: Long-lasting changes to civilization capabilities or bonuses
- **Diplomatic consequences**: Effects on relationships with other civilizations or city-states
- **Technology/policy unlocks**: Access to new research options or policy branches
- **Follow-up events**: Some choices may trigger additional events or event chains

**Event lifecycle conclusion:**
- **EventActivated**: The initial event activation
- **EventChoiceActivated**: When choices were presented to the player
- **EventChoiceEnded**: Final stage where the selected choice is executed and the event concludes

# Technical Details

**Source Location**: `CvGameCoreDLL_Expansion2/CvPlayer.cpp`, line 6758

**Function Context**: Called within the event choice resolution system when a player finalizes their decision

**Script System Integration**: Uses `GAMEEVENTINVOKE_HOOK` macro with `GAMEEVENT_EventChoiceEnded`

**Preconditions**:
- `eChosenEventChoice` parameter must be a valid event choice type
- The event choice must have been previously activated
- Player must have a valid ID
- The choice must be in a state that allows resolution

**Event Flow**:
1. Player makes a decision on an active event choice
2. Choice validation occurs to ensure the selection is valid
3. Choice effects are calculated and prepared for application
4. `GAMEEVENT_EventChoiceEnded` hook is invoked with player ID and chosen choice ID
5. Choice consequences are applied to the player's civilization
6. Event state is cleaned up and the choice is marked as resolved
7. Follow-up events or notifications may be triggered based on the choice
8. Event history is updated to track the decision made

**Related Events**:
- `EventActivated`: The initial event that led to this choice
- `EventChoiceActivated`: When the choice options were presented
- `CityEventChoiceEnded`: The city-specific version of event choice endings