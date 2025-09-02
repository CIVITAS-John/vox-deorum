# Overview

The `CityCreated` event is triggered when a city completes construction of a project through various methods including normal production or gold purchase. This event specifically tracks project completion rather than building construction.

# Event Triggers

This event is triggered in two distinct scenarios:

1. **Normal Production Completion**: When a city finishes constructing a project through regular production queue processing
2. **Gold Purchase**: When a player purchases a project using gold currency

Both triggers occur within the `CvCity` class in the Community Patch DLL during project production methods.

# Parameters

The event passes five parameters to event handlers:

| Parameter | Type | Description |
|-----------|------|-------------|
| Owner | PlayerTypes | The ID of the player who owns the city |
| CityID | int | The unique identifier of the city |
| ProjectType | ProjectTypes | The type of project that was completed |
| bGold | bool | Whether the project was purchased with gold (true) or produced normally (false) |
| bFaith | bool | Whether the project was purchased with faith/culture - always false for projects |

# Event Details

The event provides comprehensive information about project completion circumstances:

- **Production Method Tracking**: The `bGold` parameter allows event handlers to distinguish between normal production and gold purchase
- **City Context**: The owner and city ID parameters provide full context for the project completion
- **Project Information**: The project type parameter identifies exactly what was completed
- **Faith Parameter**: The `bFaith` parameter is always false for projects, as they cannot be purchased with faith or culture

The event occurs immediately after the project is successfully completed in the city, ensuring that the game state reflects the finished project when handlers execute.

# Technical Details

**Source File**: `CvGameCoreDLL_Expansion2/CvCity.cpp`

**Trigger Locations**:
- Line 29706: Normal production completion in `CvCity::produce(ProjectTypes, bool)`
- Line 30994: Gold purchase completion in project purchasing system

**Event System**: Uses the Lua scripting hook system via `LuaSupport::CallHook()`

**Conditional Compilation**: The event uses MOD_EVENTS_CITY conditional compilation blocks with fallback to direct Lua hook calls for backward compatibility.

**Project Context**: Projects are special constructions that provide one-time or ongoing benefits to civilizations, such as space program components, world wonders, or special research initiatives. This event tracks their completion regardless of the acquisition method.