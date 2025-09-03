# Stage 5: Automatic Visibility Determination

## Overview
Stage 5 implements automatic visibility determination for game events using a Lua-based analyzer that queries in-game APIs directly for optimal performance.

## Core Implementation: Lua Visibility Analyzer

### Performance-Optimized Design
Similar to the game-identity implementation, the visibility analyzer will be a Lua script that:
- Executes in-game for direct API access
- Returns visibility data as a number array
- Handles all entity lookups internally
- Processes events in a single query

### Lua Script Structure (`scripts/visibility.lua`)
The script will analyze event payloads and determine visibility by:

#### Direct Player Field Detection
- `PlayerID` - Primary player involved
- `OwnerID` - Entity owner  
- `OriginatingPlayerID` - Action initiator
- `TargetPlayerID` - Affected player

#### Entity Resolution (In-Game API)
- `CityID` - Query city ownership via `Players[x]:GetCityByID()`
- `UnitID` - Query unit ownership via `Players[x]:GetUnitByID()`
- `TeamID` - Expand to team members via `Teams[teamID]:GetNumMembers()`

#### Spatial Visibility
- `PlotX/PlotY` - Check plot visibility via `Plot:IsRevealed(teamID)`
- Fog-of-war validation for location-based events

### Implementation Steps

1. **Create Lua Visibility Script** (`scripts/utils/visibility.lua`)
   - Accept event type and payload as parameters
   - Query in-game APIs for all entity information
   - Return visibility array (0/1 for each player 0-21)

2. **TypeScript Interface** (`src/utils/knowledge/visibility.ts`)
   - Implement in a similar structure to `src/utils/lua/game-identity.ts`

3. **KnowledgeStore Integration**
   - Apply visibility using existing `markVisibility` helper

4. **Event Type Rules (In Lua)**
   - Global events (wonders, victories) - all players see
   - Combat events - both participants see
   - Diplomatic events - context-dependent visibility
   - Territory events - owner and visible neighbors

## Technical Approach

### Lua Script Example
```lua
-- visibility.lua
function analyzeVisibility(eventType, payload)
  local visibility = {}
  for i = 0, 21 do
    visibility[i] = 0
  end
  
  -- Direct player fields
  if payload.PlayerID then
    visibility[payload.PlayerID] = 1
  end
  
  -- Entity resolution via in-game API
  if payload.CityID then
    for playerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
      local player = Players[playerID]
      if player:IsAlive() then
        local city = player:GetCityByID(payload.CityID)
        if city then
          visibility[playerID] = 1
          break
        end
      end
    end
  end
  
  -- Global events
  if isGlobalEvent(eventType) then
    for i = 0, 21 do
      visibility[i] = 1
    end
  end
  
  return visibility
end
```

### TypeScript Integration
```typescript
// In KnowledgeStore
async analyzeEventVisibility(eventType: string, payload: any): Promise<number[]> {
  const result = await bridgeManager.executeLua(
    'visibility.lua',
    'analyzeVisibility',
    [eventType, payload]
  );
  return result as number[];
}
```

## Integration Points

### With Existing Code
- Use existing `markVisibility` function in KnowledgeStore
- No changes to database schema needed
- Minimal changes to event handling pipeline

### Performance Benefits
- Single Lua execution vs multiple TypeScript-Lua roundtrips
- Direct in-game API access for entity lookups
- No caching needed (game state is authoritative)
- Batch processing capability

## Testing Strategy

### Unit Tests (Limited)
- KnowledgeStore visibility method integration
- Visibility data structure validation
- Mock Lua script responses

### Integration Tests
- Test with actual game running
- Verify visibility for various event types
- Performance benchmarking with many events

## Summary
Stage 5 implements visibility determination as a high-performance Lua script that leverages direct in-game API access, returning visibility data as a simple number array. This approach minimizes TypeScript-Lua communication overhead while ensuring accurate visibility based on actual game state.