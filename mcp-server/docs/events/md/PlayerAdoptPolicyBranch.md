# PlayerAdoptPolicyBranch Event

## Overview

The `PlayerAdoptPolicyBranch` event is triggered when a player adopts (opens) a new policy branch in Civilization V. This event is fired during the policy selection process when a player chooses to unlock a specific policy tree, such as Tradition, Liberty, Honor, or any other policy branch available in the game.

## Event Trigger

This event is triggered in the following scenarios:
- When a player manually selects and adopts a new policy branch through the policy screen
- When the AI determines and executes the adoption of a policy branch
- During automatic policy branch selection processes

The event occurs at the moment the policy branch is officially adopted and becomes available for further policy selections within that branch.

## Event Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerID` | `integer` | The unique identifier of the player who is adopting the policy branch |
| `policyBranchID` | `integer` | The identifier of the policy branch being adopted (e.g., Tradition, Liberty, Honor, etc.) |

### Parameter Details

- **playerID**: This corresponds to the player's ID in the current game session. Player IDs typically range from 0 to the maximum number of civilizations in the game.
- **policyBranchID**: This is an enumerated value representing the specific policy branch. The exact values correspond to the policy branch definitions in the game's database.

## Usage Examples

### Lua Event Handler Example

```lua
-- Register event handler for policy branch adoption
function OnPlayerAdoptPolicyBranch(playerID, policyBranchID)
    local player = Players[playerID]
    if not player then
        return
    end
    
    local playerName = player:GetName()
    local policyBranchInfo = GameInfo.PolicyBranchTypes[policyBranchID]
    local branchName = policyBranchInfo and policyBranchInfo.Type or "Unknown"
    
    print(playerName .. " has adopted the " .. branchName .. " policy branch")
    
    -- Custom logic for tracking policy adoptions
    -- e.g., updating UI, triggering diplomatic reactions, etc.
end

-- Register the event
Events.PlayerAdoptPolicyBranch.Add(OnPlayerAdoptPolicyBranch)
```

### Bridge Service Integration Example

```json
{
  "eventType": "PlayerAdoptPolicyBranch",
  "timestamp": "2025-09-01T12:34:56.789Z",
  "data": {
    "playerID": 2,
    "policyBranchID": 5,
    "playerName": "Gandhi",
    "policyBranchName": "Tradition"
  }
}
```

## Code References

This event is triggered from multiple locations in the Community Patch DLL:

1. **CvPolicyAI.cpp (Line 743)**: Triggered during AI policy decision-making processes
2. **CvPolicyClasses.cpp (Line 5363 & 5809)**: Triggered during policy branch adoption mechanics

The event is consistently called with the same parameter structure across all trigger points:
- Player ID is pushed first
- Policy Branch ID is pushed second

## Related Events

- `PlayerAdoptPolicy`: Fired when a player adopts an individual policy within a branch
- `PolicyBranchUnlocked`: May be related to policy branch availability changes
- `PlayerPolicyUpdate`: General policy-related update events

## Special Considerations

### Timing
- This event fires immediately when the policy branch is adopted
- The event occurs before any dependent policy selections within the branch
- Multiple policy branches can be adopted by a single player throughout the game

### Game State Impact
- After this event fires, the player will have access to policies within the adopted branch
- The adoption may affect diplomatic relationships with other civilizations
- Policy branch adoption affects the player's culture and social policy strategy

### Multiplayer Considerations
- In multiplayer games, this event will fire for all players when any player adopts a policy branch
- Event handlers should check the player ID to determine if action is needed for specific players
- Network synchronization ensures all clients receive the event

### Debugging Notes
- The event occurs 3 times per adoption in the current codebase implementation
- This may be due to multiple validation or confirmation steps in the policy adoption process
- Event handlers should be designed to handle potential duplicate calls gracefully

## Best Practices

1. **Validation**: Always validate that the player exists before processing the event
2. **Performance**: Keep event handlers lightweight as they may be called frequently
3. **Error Handling**: Implement proper error handling for invalid policy branch IDs
4. **Logging**: Consider logging policy adoptions for debugging and analytics purposes
5. **State Management**: Update any custom state tracking systems when this event fires

## See Also

- [Policy System Documentation](../policy-system.md)
- [Event System Overview](../events.md)
- [Bridge Service Protocol](../../bridge-service/protocol.md)