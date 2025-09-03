/**
 * Lua-based visibility analyzer for game events
 * Determines which players can see specific events based on game state
 */

import { LuaFunction } from '../../bridge/lua-function.js';
import { MaxMajorCivs } from '../../knowledge/schema/base.js';

/**
 * Lua function that analyzes event visibility
 */
const analyzeVisibilityFunc = new LuaFunction("analyzeEventVisibility", ["eventType", "payload"], `
  local visibilityFlags = {}
  local invalidations = {}
  local maxMajorCivs = ${MaxMajorCivs} - 1
  
  -- Initialize visibility flags for all players
  for i = 0, maxMajorCivs do
    table.insert(visibilityFlags, 0)
  end

  -- Helper function to mark player as able to see the event
  local function setVisible(playerID, value)
    -- For visibility, we only care about major civs
    if playerID <= ${MaxMajorCivs} and visibilityFlags[playerID + 1] < value then
      visibilityFlags[playerID + 1] = value
    end
  end

  -- Helper function to add team-based visibility
  local function addTeam(teamID, value)
    -- Invalidate the team's cached metadata
    invalidations["team_" .. teamID] = true

    -- All team players should have the same visibility
    for otherID = 0, maxMajorCivs do
      local otherPlayer = Players[otherID]
      if otherPlayer and otherPlayer:GetTeam() == teamID then
        setVisible(otherID, value)
      end
    end
  end

  -- Helper function to add met leaders visibility
  local function addMetPlayer(playerID, value)
    local player = Players[playerID]
    if not player then return end
    
    local teamID = player:GetTeam()
    for otherID = 0, maxMajorCivs do
      local otherPlayer = Players[otherID]
      if otherPlayer then
        local otherTeam = Teams[otherPlayer:GetTeam()]
        if otherTeam and otherTeam:IsHasMet(teamID) then
          setVisible(otherID, value)
        end
      end
    end
  end
  
  -- Helper function to add player-based visibility
  local function addPlayer(playerID, value)
    -- Check if player exists
    local player = Players[playerID]
    if not player then return end

    -- Invalidate the player's cached metadata
    invalidations["player_" .. playerID] = true

    -- Team members can see each other's events
    addTeam(player:GetTeam(), value)
  end

  -- Analyze visibility based on event type and payload
  for key, value in pairs(payload) do
    -- Check for player-related fields in payload
    if (string.match(key, "PlayerID$") or string.match(key, "OwnerID$")) then
      addPlayer(value, 2)
    end
    
    -- Check for team-related fields in payload
    if (string.match(key, "TeamID$")) then
      addTeam(value, 2)
    end
  end

  return {visibilityFlags, invalidations}
`);

/**
 * Result of event visibility analysis
 */
export interface EventVisibilityResult {
  /** Array of visibility flags for each player (0=invisible, 1=partial, 2=full) */
  visibilityFlags: number[];
  /** Map of cache invalidation keys */
  invalidations: Record<string, boolean>;
}

/**
 * Analyze event visibility to determine which players can see it
 * @param eventType The type of the event
 * @param payload The event payload data
 * @returns Visibility analysis result containing flags and invalidations, or undefined on error
 */
export async function analyzeEventVisibility(eventType: string, payload: any): Promise<EventVisibilityResult | undefined> {
  const response = await analyzeVisibilityFunc.execute(eventType, payload);
  if (!response.success || !Array.isArray(response.result) || response.result.length !== 2) {
    return undefined;
  }
  return {
    visibilityFlags: response.result[0],
    invalidations:  response.result[1]
  };
}