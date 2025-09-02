# Overview

The `ReformCooldownRateChanges` event is triggered whenever a player's reform cooldown rate modifier is changed. This rate affects how quickly reform cooldowns decrease each turn, allowing for acceleration or deceleration of the time required before new reforms can be enacted. The event enables external systems to track changes in reform timing flexibility.

# Event Triggers

This event is triggered in the following scenarios:

- When a player's reform cooldown rate is modified via `ChangeReformCooldownRate()`
- When a player's reform cooldown rate is set to a new value via `SetReformCooldownRate()`
- During gameplay mechanics that affect how quickly reform cooldowns expire
- When bonuses, penalties, or effects modify the rate at which reforms become available
- As a result of policies, buildings, or technologies that influence reform timing efficiency

# Parameters

The event passes the following parameters:

1. **Player ID** (`GetID()`) - The unique identifier of the player whose reform cooldown rate has changed
2. **Rate Change Value** (`iValue`) - The amount by which the cooldown rate is being modified (positive values speed up cooldown reduction, negative values slow it down)

# Event Details

The reform cooldown rate system provides a mechanism to modify how quickly players can transition between different reforms within governmental and religious systems. The rate modifier affects:

- **Reform Frequency:** Higher rates enable more frequent reform implementations
- **Strategic Flexibility:** Faster cooldown reduction allows for more adaptive governance
- **Competitive Advantage:** Superior reform rates can provide governmental agility benefits
- **Long-term Planning:** Rate bonuses compound over time for sustained reform capabilities

Factors that typically influence reform cooldown rate include:
- Administrative buildings and infrastructure
- Governmental efficiency policies and civics
- Technological advances in administration and bureaucracy
- Leader abilities or civilization bonuses related to governance
- Religious or cultural factors that affect reform acceptance

The rate system enables different strategic approaches:
- **Reform-Heavy Strategies:** Focus on maximizing rate bonuses for frequent changes
- **Stability-Focused Approaches:** Accept lower rates in exchange for other benefits
- **Adaptive Governance:** Use rate bonuses to respond quickly to changing circumstances
- **Timing Optimization:** Coordinate rate bonuses with planned reform sequences

This event is valuable for AI systems to:
- Predict when opponents will regain reform capability
- Assess the long-term reform potential of different civilizations
- Plan strategies around reform timing windows
- Evaluate the effectiveness of rate-enhancing investments

# Technical Details

**Source Files:**
- `CvGameCoreDLL_Expansion2/CvPlayer.cpp` (lines 29606, 29615)

**Triggering Functions:**
- `CvPlayer::ChangeReformCooldownRate(int iValue)` - Modifies the current cooldown rate by the specified amount
- `CvPlayer::SetReformCooldownRate(int iValue)` - Sets the cooldown rate to a specific value

**Related Members:**
- `m_iJFDReformCooldownRate` - Internal member storing the current cooldown rate modifier
- `GetReformCooldownRate()` - Accessor method returning the current cooldown rate

**Event Hook:**
```cpp
GAMEEVENTINVOKE_HOOK(GAMEEVENT_ReformCooldownRateChanges, GetID(), iValue);
```

**Parameter Behavior:**
- Unlike the base cooldown event, this passes the change value (`iValue`) rather than the current total rate
- Allows listeners to track incremental modifications to the rate system
- Positive values indicate rate improvements (faster cooldown reduction)
- Negative values indicate rate penalties (slower cooldown reduction)

**Related Systems:**
- Base reform cooldown system (separate event for absolute cooldown changes)
- Government and religious reform mechanics that depend on timing
- Policy and technology systems that provide rate bonuses
- Strategic planning systems that optimize reform sequences

**Compilation Requirements:**
- Part of the extended government framework in MOD_BALANCE_CORE
- Integrated with the JFD governmental mechanics system
- Works in conjunction with the broader cooldown and reform systems