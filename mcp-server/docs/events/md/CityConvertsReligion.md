# Overview

The `CityConvertsReligion` event is triggered when a city's religious majority changes from one religion to another. This event captures significant religious shifts within cities and provides information about the new dominant religion.

# Event Triggers

This event is triggered in one specific scenario:

1. **Religious Majority Change**: When a city's religious composition shifts such that a different religion becomes the majority faith

The trigger occurs within the religious follower change processing system in the Community Patch DLL.

# Parameters

The event passes four parameters to event handlers:

| Parameter | Type | Description |
|-----------|------|-------------|
| Owner | PlayerTypes | The ID of the player who owns the city |
| Religion | ReligionTypes | The type of religion that has become the new majority |
| X | int | The X coordinate of the city on the game map |
| Y | int | The Y coordinate of the city on the game map |

# Event Details

The event provides comprehensive information about religious conversions:

- **New Majority Religion**: The religion parameter identifies which faith has gained dominance in the city
- **City Location**: The X and Y coordinates allow precise identification of the affected city's position
- **Ownership Context**: The owner parameter identifies which player's city has undergone the religious conversion
- **Conversion Significance**: The event only triggers for majority changes, not minor fluctuations in religious followers

The event occurs after the city's religious state has been fully updated to reflect the new majority religion, ensuring accurate game state when handlers execute.

# Technical Details

**Source File**: `CvGameCoreDLL_Expansion2/CvReligionClasses.cpp`

**Trigger Location**:
- Line 5716: Religious conversion in the religious follower change processing system

**Event System**: Uses the Lua scripting hook system via `LuaSupport::CallHook()`

**Context**: The event is part of the broader religious conversion system that tracks and responds to changes in city religious demographics. It represents a significant shift in religious influence rather than minor population changes.

**Integration**: This event works alongside other religious events and systems to provide comprehensive religious gameplay mechanics, including interactions with faith generation, religious pressure, and civilization-wide religious effects.