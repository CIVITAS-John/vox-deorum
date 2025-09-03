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
  local maxMajorCivs = ${MaxMajorCivs} - 1
  
  -- Initialize visibility flags for all players
  for i = 0, maxMajorCivs do
    visibilityFlags[i] = false
  end
  
  -- Helper function to mark player as able to see the event
  local function setVisible(playerID)
    visibilityFlags[playerID] = true
  end

  -- Helper function to add team-based visibility
  local function addTeam(teamID)
    for otherID = 0, maxMajorCivs do
      local otherPlayer = Players[otherID]
      if otherPlayer and otherPlayer:GetTeam() == teamID then
        setVisible(otherID)
      end
    end
  end

  -- Helper function to add met leaders visibility
  local function addMetPlayer(playerid)
    for otherID = 0, maxMajorCivs do
      local otherPlayer = Players[otherID]
      local otherTeam = Teams[otherPlayer:GetTeam()]
      if otherTeam and otherTeam:IsHasMet(teamID) then
        setVisible(otherID)
      end
    end
  end
  
  -- Helper function to add player-based visibility
  local function addPlayer(playerID)
    -- Check if player exists
    local player = Players[playerID]
    if not player then return
    
    -- Team members can see each other's events
    addTeam(teamID)
  end

  -- Analyze visibility based on event type and payload
  for key, value in pairs(payload) do
    -- Check for player-related fields in payload
    if (string.match(key, "PlayerID$") or string.match(key, "OwnerID$")) then
      addPlayer(value)
    end
    
    -- Check for team-related fields in payload
    if (string.match(key, "TeamID$") then
      addTeam(value)
    end
  end
  
  -- Convert visibility flags to list of visible player IDs
  local visiblePlayers = {}
  for playerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
    if visibilityFlags[playerID] then
      table.insert(visiblePlayers, playerID)
    end
  end
  
  return visiblePlayers
`);

/**
 * Analyze event visibility to determine which players can see it
 * @param eventType The type of the event
 * @param payload The event payload data
 * @returns Array of visible player IDs
 */
export async function analyzeEventVisibility(eventType: string, payload: any): Promise<number[] | undefined> {
  const response = await analyzeVisibilityFunc.execute(eventType, payload);
  if (!response.success) {
    return undefined;
  }
  return response.result as number[];
}