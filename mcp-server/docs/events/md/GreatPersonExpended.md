# GreatPersonExpended Event

## Overview

The `GreatPersonExpended` event is triggered when a Great Person unit is expended (consumed) in Civilization V. This event occurs when a player uses a Great Person to perform an action that consumes the unit, such as creating a Great Work, founding a religion, or constructing an improvement.

## Event Trigger

This event is fired from the `CvPlayer.cpp` file in the Community Patch DLL when a Great Person unit is expended through player actions.

**Source Location**: `CvGameCoreDLL_Expansion2/CvPlayer.cpp` (line 27934)

## Event Parameters

The event passes the following parameters to Lua event handlers:

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerId` | `int` | The ID of the player who expended the Great Person |
| `greatPersonUnit` | `int` | The unit type ID of the Great Person that was expended |

### Parameter Details

1. **Player ID** (`args->Push(GetID())`)
   - Represents the civilization/player that performed the Great Person action
   - Used to identify which player triggered the event
   - Type: Integer (player index)

2. **Great Person Unit Type** (`args->Push(eGreatPersonUnit)`)
   - Identifies the specific type of Great Person that was expended
   - Examples: Great Scientist, Great Artist, Great Engineer, etc.
   - Type: Integer (unit type enumeration)

## Usage Examples

### Basic Event Handler

```lua
-- Register event handler for Great Person expended
Events.GreatPersonExpended.Add(function(playerId, greatPersonUnit)
    print("Player " .. playerId .. " expended Great Person unit type: " .. greatPersonUnit)
    
    -- Get player object
    local player = Players[playerId]
    if player then
        local playerName = player:GetName()
        print(playerName .. " has used a Great Person!")
    end
end)
```

### Advanced Event Handler with Unit Type Checking

```lua
-- Handle specific Great Person types
Events.GreatPersonExpended.Add(function(playerId, greatPersonUnit)
    local player = Players[playerId]
    if not player then return end
    
    local unitInfo = GameInfo.Units[greatPersonUnit]
    if unitInfo then
        local unitName = unitInfo.Description
        local playerName = player:GetName()
        
        print(playerName .. " expended a " .. unitName)
        
        -- Perform specific actions based on Great Person type
        if unitInfo.Type == "UNIT_GREAT_SCIENTIST" then
            -- Handle Great Scientist expended
            print("Science boost or academy created!")
        elseif unitInfo.Type == "UNIT_GREAT_ARTIST" then
            -- Handle Great Artist expended  
            print("Great Work created or Golden Age started!")
        elseif unitInfo.Type == "UNIT_GREAT_ENGINEER" then
            -- Handle Great Engineer expended
            print("Wonder rushed or Manufactory built!")
        end
    end
end)
```

## Related Events

This event is closely related to other Great Person and unit-related events:

- **UnitCreated** - Triggered when Great Person units are initially created
- **UnitKilled** - May be triggered alongside or instead of GreatPersonExpended in certain scenarios
- **CityBuiltBuilding** - May fire when Great Person creates improvements like Academy or Manufactory
- **PlayerDoTurn** - Great Person expending typically happens during a player's turn

## Special Considerations

### Event Timing
- This event fires immediately when the Great Person is expended
- It occurs after the Great Person's action has been processed but before turn cleanup
- The Great Person unit will no longer exist after this event fires

### Important Notes
- Not all Great Person actions may trigger this event - verify behavior for specific use cases
- The event provides unit type information, but not the specific action taken
- Great Person units that are killed in combat will not trigger this event (use UnitKilled instead)
- Some Great Person abilities may have different triggering mechanisms

### Data Validation
Always validate that the player and unit type parameters are valid before using them:

```lua
Events.GreatPersonExpended.Add(function(playerId, greatPersonUnit)
    -- Validate player exists
    if not Players[playerId] or not Players[playerId]:IsAlive() then
        return
    end
    
    -- Validate unit type exists
    local unitInfo = GameInfo.Units[greatPersonUnit]
    if not unitInfo then
        return
    end
    
    -- Safe to proceed with event handling
end)
```

## Integration with Vox Deorum

In the context of the Vox Deorum AI system, this event can be used to:
- Track AI civilization Great Person usage patterns
- Trigger strategic analysis when opponents expend powerful Great Persons
- Update game state models for decision-making algorithms
- Generate notifications for significant Great Person activities

The event data flows through the Bridge Service to the MCP Server, where it can be processed by AI agents for strategic planning and game state analysis.