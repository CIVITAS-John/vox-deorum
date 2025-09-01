# PlayerAdoptPolicy Event

## Overview

The `PlayerAdoptPolicy` event is triggered when a player adopts (purchases or unlocks) a social policy in Civilization V. This event provides essential information about policy adoption decisions, which are crucial for understanding a player's strategic direction and cultural development path.

## Event Trigger

This event is fired when:
- A player successfully adopts a new social policy
- The policy adoption process is completed through the game's policy system
- The player has sufficient culture points to unlock the policy
- The policy prerequisites (if any) have been met

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerID` | Integer | The unique identifier of the player who adopted the policy. Corresponds to the player's ID in the game session. |
| `policyID` | Integer | The unique identifier of the social policy that was adopted. References the policy's enum value in the game's policy database. |

### Parameter Details

- **playerID**: Ranges from 0 to the maximum number of players in the game (typically 0-21 for standard games)
- **policyID**: References specific policies from the game's policy tree, including policies from base game, expansions, and Community Patch modifications

## Usage Examples

### Basic Event Handling
```lua
-- Example Lua event handler
function OnPlayerAdoptPolicy(playerID, policyID)
    local player = Players[playerID]
    local policyInfo = GameInfo.Policies[policyID]
    
    print(string.format("Player %s adopted policy: %s", 
          player:GetName(), 
          policyInfo.Description))
end

Events.PlayerAdoptPolicy.Add(OnPlayerAdoptPolicy)
```

### Strategic Analysis
```lua
-- Track policy adoption patterns
function AnalyzePolicyAdoption(playerID, policyID)
    local player = Players[playerID]
    local policyInfo = GameInfo.Policies[policyID]
    
    -- Log for AI analysis
    if player:IsHuman() then
        print(string.format("Human player adopted %s - analyzing strategic implications", policyInfo.Type))
    else
        print(string.format("AI player %d adopted %s", playerID, policyInfo.Type))
    end
end
```

## Implementation Details

**Source Location**: `CvPlayer.cpp:23576`

The event is triggered from the C++ DLL layer using the Lua support system:
```cpp
LuaSupport::CallHook(pkScriptSystem, "PlayerAdoptPolicy", args.get(), bResult);
```

**Argument Preparation**:
```cpp
args->Push(GetID());    // Player ID
args->Push(ePolicy);    // Policy ID
```

## Related Events

- **PlayerPolicyBranchUnlocked**: Triggered when a player unlocks an entire policy branch
- **PlayerCultureChange**: Fired when a player's culture points change (often related to policy costs)
- **PlayerTechResearched**: Technology research can affect available policies
- **PlayerAdoptPantheon**: Related to religious policy decisions

## Strategic Considerations

### For AI Analysis
- Policy adoption reveals strategic priorities (military, cultural, economic focus)
- Early policy choices can predict long-term civilization development
- Policy synergies indicate advanced strategic planning

### For Game Balance
- Track which policies are most/least adopted across games
- Monitor policy adoption timing relative to game phases
- Analyze policy effectiveness through adoption patterns

## Special Notes

- This event occurs after the policy has been successfully adopted and all game state has been updated
- The event provides only the basic identifiers; additional policy details must be retrieved through game database queries
- In multiplayer games, this event fires for all players, allowing observation of opponent policy choices
- Community Patch modifications may introduce additional policies not present in the base game
- The event timing is synchronous with the game's policy adoption process

## Technical Integration

When integrating with the Bridge Service and MCP system:
- Policy adoption events should be captured for strategic analysis
- The event data can be enriched with policy details from the game database
- Policy trees and prerequisites can be analyzed to predict future adoptions
- Historical policy adoption patterns can inform AI decision-making

## Version Information

- **Generated**: 2025-09-01T01:20:46.712Z
- **Occurrences Analyzed**: 1
- **Source**: Community Patch DLL Integration