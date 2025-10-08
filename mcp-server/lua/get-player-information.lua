-- Extract player information from the game
-- Filters out players not actually in the game

local playerInfo = {}

-- Iterate through all possible players
for playerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
  local player = Players[playerID]
  
  -- Only include players that are alive or have ever been alive (excludes empty slots)
  if player and player:IsEverAlive() then
    local info = {
      Key = playerID,
      TeamID = player:GetTeam(),
      Civilization = player:GetCivilizationShortDescription(),
      Leader = player:GetName(),
      IsHuman = player:IsHuman() and 1 or 0,
      IsMajor = player:IsMajorCiv() and 1 or 0
    }
    
    -- Add to results
    table.insert(playerInfo, info)
  end
end

-- Also check minor civs (city-states)
for playerID = GameDefines.MAX_MAJOR_CIVS, GameDefines.MAX_CIV_PLAYERS - 1 do
  local player = Players[playerID]
  
  -- Only include minor civs that are alive
  if player and player:IsAlive() and player:IsMinorCiv() then
    local info = {
      Key = playerID,
      TeamID = player:GetTeam(),
      Civilization = player:GetCivilizationShortDescription(),
      Leader = player:GetName(),
      IsHuman = 0, -- Minor civs are never human
      IsMajor = 0  -- Minor civs are not major
    }
    
    -- Add to results
    table.insert(playerInfo, info)
  end
end

-- Check for barbarians (special case - player 63)
local barbarianID = GameDefines.MAX_CIV_PLAYERS
local barbarian = Players[barbarianID]
if barbarian and barbarian:IsAlive() and barbarian:IsBarbarian() then
  local info = {
    Key = barbarianID,
    TeamID = barbarian:GetTeam(),
    Civilization = "Barbarians",
    Leader = "Barbarians",
    IsHuman = 0,
    IsMajor = 0
  }
  
  table.insert(playerInfo, info)
end

return playerInfo