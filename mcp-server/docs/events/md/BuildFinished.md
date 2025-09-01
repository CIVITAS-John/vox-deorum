# BuildFinished Event

## Overview
The `BuildFinished` event is triggered when a build operation (such as constructing an improvement) is completed on a plot in Civilization V.

## When This Event is Triggered
This event fires when:
- A worker unit completes construction of an improvement on a plot
- Any build operation finishes successfully on a tile
- The improvement is fully constructed and becomes active on the plot

## Event Parameters

The `BuildFinished` event provides the following parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `ePlayer` | PlayerID | The ID of the player who owns the unit that completed the build |
| `x` | Integer | The X coordinate of the plot where the build was completed |
| `y` | Integer | The Y coordinate of the plot where the build was completed |
| `eImprovement` | ImprovementID | The type of improvement that was built on the plot |

## Usage Examples

### Lua Script Example
```lua
function OnBuildFinished(playerID, x, y, improvementID)
    local player = Players[playerID]
    local plot = Map.GetPlot(x, y)
    local improvement = GameInfo.Improvements[improvementID]
    
    print(string.format("Player %s completed building %s at (%d, %d)", 
          player:GetName(), 
          improvement.Type, 
          x, y))
    
    -- Custom logic for build completion
    if improvement.Type == "IMPROVEMENT_FARM" then
        -- Handle farm completion
    elseif improvement.Type == "IMPROVEMENT_MINE" then
        -- Handle mine completion
    end
end

Events.BuildFinished.Add(OnBuildFinished)
```

### Bridge Service Integration
This event can be captured by the Bridge Service and forwarded to external systems for:
- Tracking construction progress
- Analyzing player building patterns
- Triggering AI responses to infrastructure development
- Economic analysis and optimization

## Related Events and Considerations

### Related Events
- **BuildStarted** - When a build operation begins (if available)
- **ImprovementCreated** - Similar event for improvement creation
- **WorkerAction** - General worker unit actions

### Important Considerations

1. **Timing**: This event fires after the improvement is fully constructed and active
2. **Player Context**: The `ePlayer` parameter refers to the owner of the worker unit, not necessarily the plot owner
3. **Coordinate System**: X and Y coordinates use the game's internal coordinate system
4. **Improvement Types**: The `eImprovement` parameter corresponds to improvement definitions in the game database

### Special Notes

- This event is triggered from `CvPlot.cpp` in the Community Patch DLL
- The event occurs at line 12838 in the plot management code
- Parameters are pushed in order: player ID, X coordinate, Y coordinate, improvement type
- The event is part of the Lua hook system, allowing mod scripts to respond to build completions
- Useful for tracking economic development and territorial improvements

## Source Code Reference

**File**: `CvGameCoreDLL_Expansion2/CvPlot.cpp`  
**Line**: 12838  
**Hook Call**: `LuaSupport::CallHook(pkScriptSystem, "BuildFinished", args.get(), bResult);`

The event arguments are prepared starting at line 12832 and pushed in the following order:
1. Player ID (line 12832)
2. X coordinate (line 12833) 
3. Y coordinate (line 12834)
4. Improvement type (line 12835)