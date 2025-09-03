/**
 * Lua-based visibility analyzer for game events
 * Determines which players can see specific events based on game state
 */

import { LuaFunction } from '../../bridge/lua-function.js';

/**
 * Lua function that analyzes event visibility
 */
const analyzeVisibilityFunc = new LuaFunction("analyzeEventVisibility", ["eventType", "payload"], `
  local visibility = {}
  
  -- Initialize all players to not visible (0)
  for i = 0, 21 do
    visibility[i] = 0
  end
  
  -- Helper function to check if event is global (all players see)
  local function isGlobalEvent(eventType)
    local globalEvents = {
      ["PlayerVictory"] = true,
      ["WonderConstructed"] = true,
      ["PlayerDefeated"] = true,
      ["TeamVictory"] = true,
      ["GameEnded"] = true,
    }
    return globalEvents[eventType] == true
  end
  
  -- Helper function to get plot visibility
  local function checkPlotVisibility(x, y, playerID)
    local plot = Map.GetPlot(x, y)
    if plot then
      local player = Players[playerID]
      if player and player:IsAlive() then
        local team = Teams[player:GetTeam()]
        if team and plot:IsRevealed(team:GetID(), false) then
          return true
        end
      end
    end
    return false
  end
  
  -- Helper function to get city owner
  local function getCityOwner(cityID)
    for playerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
      local player = Players[playerID]
      if player and player:IsAlive() then
        local city = player:GetCityByID(cityID)
        if city then
          return playerID
        end
      end
    end
    -- Check minor civs
    for playerID = GameDefines.MAX_MAJOR_CIVS, GameDefines.MAX_CIV_PLAYERS - 1 do
      local player = Players[playerID]
      if player and player:IsAlive() then
        local city = player:GetCityByID(cityID)
        if city then
          return playerID
        end
      end
    end
    return nil
  end
  
  -- Helper function to get unit owner
  local function getUnitOwner(unitID)
    for playerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
      local player = Players[playerID]
      if player and player:IsAlive() then
        local unit = player:GetUnitByID(unitID)
        if unit then
          return playerID
        end
      end
    end
    return nil
  end
  
  -- Check if it's a global event first
  if isGlobalEvent(eventType) then
    for i = 0, 21 do
      visibility[i] = 1
    end
    return visibility
  end
  
  -- Direct player field detection
  if payload.PlayerID ~= nil and payload.PlayerID >= 0 and payload.PlayerID <= 21 then
    visibility[payload.PlayerID] = 1
  end
  
  if payload.OwnerID ~= nil and payload.OwnerID >= 0 and payload.OwnerID <= 21 then
    visibility[payload.OwnerID] = 1
  end
  
  if payload.OriginatingPlayerID ~= nil and payload.OriginatingPlayerID >= 0 and payload.OriginatingPlayerID <= 21 then
    visibility[payload.OriginatingPlayerID] = 1
  end
  
  if payload.TargetPlayerID ~= nil and payload.TargetPlayerID >= 0 and payload.TargetPlayerID <= 21 then
    visibility[payload.TargetPlayerID] = 1
  end
  
  if payload.AttackerPlayerID ~= nil and payload.AttackerPlayerID >= 0 and payload.AttackerPlayerID <= 21 then
    visibility[payload.AttackerPlayerID] = 1
  end
  
  if payload.DefenderPlayerID ~= nil and payload.DefenderPlayerID >= 0 and payload.DefenderPlayerID <= 21 then
    visibility[payload.DefenderPlayerID] = 1
  end
  
  -- Team expansion
  if payload.TeamID ~= nil then
    local team = Teams[payload.TeamID]
    if team then
      for playerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
        local player = Players[playerID]
        if player and player:IsAlive() and player:GetTeam() == payload.TeamID then
          visibility[playerID] = 1
        end
      end
    end
  end
  
  -- City resolution
  if payload.CityID ~= nil then
    local owner = getCityOwner(payload.CityID)
    if owner and owner >= 0 and owner <= 21 then
      visibility[owner] = 1
    end
    
    -- Also check if any player can see the city's plot
    if payload.PlotX ~= nil and payload.PlotY ~= nil then
      for playerID = 0, 21 do
        if checkPlotVisibility(payload.PlotX, payload.PlotY, playerID) then
          visibility[playerID] = 1
        end
      end
    end
  end
  
  -- Unit resolution
  if payload.UnitID ~= nil then
    local owner = getUnitOwner(payload.UnitID)
    if owner and owner >= 0 and owner <= 21 then
      visibility[owner] = 1
    end
    
    -- Check if any player can see the unit's plot
    if payload.PlotX ~= nil and payload.PlotY ~= nil then
      for playerID = 0, 21 do
        if checkPlotVisibility(payload.PlotX, payload.PlotY, playerID) then
          visibility[playerID] = 1
        end
      end
    end
  end
  
  -- Plot visibility (for events that only have location)
  if payload.PlotX ~= nil and payload.PlotY ~= nil then
    for playerID = 0, 21 do
      if checkPlotVisibility(payload.PlotX, payload.PlotY, playerID) then
        visibility[playerID] = 1
      end
    end
  end
  
  -- Diplomatic events (both parties see)
  if eventType:find("Diplo") or eventType:find("Trade") or eventType:find("Deal") then
    if payload.FromPlayer ~= nil and payload.FromPlayer >= 0 and payload.FromPlayer <= 21 then
      visibility[payload.FromPlayer] = 1
    end
    if payload.ToPlayer ~= nil and payload.ToPlayer >= 0 and payload.ToPlayer <= 21 then
      visibility[payload.ToPlayer] = 1
    end
  end
  
  -- Combat events (both participants see)
  if eventType:find("Combat") or eventType:find("Attack") or eventType:find("Battle") then
    if payload.AttackerID ~= nil then
      local owner = getUnitOwner(payload.AttackerID)
      if owner and owner >= 0 and owner <= 21 then
        visibility[owner] = 1
      end
    end
    if payload.DefenderID ~= nil then
      local owner = getUnitOwner(payload.DefenderID)
      if owner and owner >= 0 and owner <= 21 then
        visibility[owner] = 1
      end
    end
  end
  
  return visibility
`);

/**
 * Analyze event visibility to determine which players can see it
 * @param eventType The type of the event
 * @param payload The event payload data
 * @returns Array of visibility flags (0/1) for each player (0-21)
 */
export async function analyzeEventVisibility(eventType: string, payload: any): Promise<number[] | undefined> {
  const response = await analyzeVisibilityFunc.execute(eventType, payload);
  if (!response.success) {
    return undefined;
  }
  return response.result as number[];
}