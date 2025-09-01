# TestEvent

## Overview

**TestEvent** is a development and testing event used within the Vox Deorum system to validate the communication flow between the Community Patch DLL and the Lua scripting system.

## When This Event is Triggered

This event is triggered programmatically for testing purposes. It is primarily used during development to:
- Verify the Lua hook system is functioning correctly
- Test the event pipeline between C++ DLL and Lua scripts
- Validate argument passing mechanisms
- Debug communication issues

## Event Parameters

The TestEvent pushes four integer parameters to the Lua environment:

| Parameter | Type | Value | Description |
|-----------|------|-------|-------------|
| arg1 | `number` | `-1` | First test parameter |
| arg2 | `number` | `-1` | Second test parameter |
| arg3 | `number` | `-1` | Third test parameter |
| arg4 | `number` | `-1` | Fourth test parameter |

All parameters are currently hardcoded to `-1` for consistency in testing scenarios.

## Usage Examples

### Lua Event Handler

```lua
-- Example Lua event handler for TestEvent
function OnTestEvent(arg1, arg2, arg3, arg4)
    print("TestEvent triggered with parameters:", arg1, arg2, arg3, arg4)
    -- Expected output: TestEvent triggered with parameters: -1 -1 -1 -1
    
    -- Add your test logic here
    if arg1 == -1 and arg2 == -1 and arg3 == -1 and arg4 == -1 then
        print("TestEvent parameters received correctly")
        return true
    else
        print("TestEvent parameters unexpected")
        return false
    end
end

-- Register the event handler
Events.TestEvent.Add(OnTestEvent)
```

### C++ Trigger Location

The event is triggered from the following location in the codebase:
- **File**: `CvGameCoreDLL_Expansion2/Lua/CvLuaGame.cpp`
- **Line**: 3763
- **Implementation**: `LuaSupport::CallHook(pkScriptSystem, "TestEvent", args.get(), bResult);`

## Technical Details

### Source Code Reference

```cpp
// From CvLuaGame.cpp lines 3757-3763
args->Push(-1);  // arg1
args->Push(-1);  // arg2  
args->Push(-1);  // arg3
args->Push(-1);  // arg4
LuaSupport::CallHook(pkScriptSystem, "TestEvent", args.get(), bResult);
```

### Event Flow

1. C++ code prepares arguments by pushing four `-1` values onto the argument stack
2. `LuaSupport::CallHook` is called with the event name "TestEvent"
3. Lua scripting system receives the event and parameters
4. Registered Lua event handlers are executed with the provided arguments

## Related Events or Considerations

### Development Context
- This is a **development-only event** and should not be present in production builds
- Used alongside other testing mechanisms in the Vox Deorum system
- Part of the broader event system validation suite

### Integration Points
- **Bridge Service**: May relay this event through the JSON/REST API for system testing
- **MCP Server**: Could expose this event as part of game state monitoring during development
- **MCP Client**: May use this event to validate LLM agent communication pipelines

## Special Notes

### Important Considerations

1. **Development Only**: This event is intended for development and testing purposes only. It should be removed or disabled in production builds.

2. **Hardcoded Values**: All parameters are currently hardcoded to `-1`. This provides predictable behavior for automated testing but limits flexibility.

3. **Event Frequency**: Based on the JSON data, this event has been triggered only once (`"occurrences": 1`), suggesting it's used for specific testing scenarios rather than continuous monitoring.

4. **No Game Logic**: Unlike other events in the system, TestEvent does not affect game state or player experience. It exists purely for system validation.

### Best Practices

- Use TestEvent during development to verify new event handling code
- Remove or comment out TestEvent triggers before releasing to production
- Consider creating more specific test events with varied parameters for comprehensive testing
- Monitor TestEvent occurrences to ensure it's not accidentally triggering in live gameplay

## Generated Information

- **Generated At**: 2025-09-01T01:20:46.712Z
- **Total Occurrences Detected**: 1
- **Source Analysis**: Automated analysis of Community Patch DLL source code