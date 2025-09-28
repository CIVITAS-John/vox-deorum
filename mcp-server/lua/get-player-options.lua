-- Extract player options information from the game
-- Returns options data (technologies, policies, strategies) for each player
-- No visibility needed as each player can only see their own options

local options = {}

-- Iterate through all major players
for playerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
  local player = Players[playerID]

  -- Only include players that are alive
  if player and player:IsAlive() then
    local playerOptions = {
      Key = playerID,
      EconomicStrategies = player:GetPossibleEconomicStrategies(),
      MilitaryStrategies = player:GetPossibleMilitaryStrategies(),
      Technologies = player:GetPossibleTechs(true)
    }

    -- Get possible policies and policy branches
    local possiblePolicies, possibleBranches = player:GetPossiblePolicies(true)
    playerOptions.Policies = possiblePolicies
    playerOptions.PolicyBranches = possibleBranches

    -- Add to results
    table.insert(options, playerOptions)
  end
end

return options