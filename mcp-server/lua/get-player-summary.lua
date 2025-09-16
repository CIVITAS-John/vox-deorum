-- Extract player summary information from the game
-- Returns summary data with relative visibility between all players

local summaries = {}

-- Helper function to calculate visibility between two players
local function getVisibility(fromPlayerID, toPlayerID)
  if fromPlayerID == toPlayerID then
    return 2  -- Self
  end
  
  local fromPlayer = Players[fromPlayerID]
  local toPlayer = Players[toPlayerID]
  
  if not fromPlayer or not toPlayer then
    return 0
  end
  
  local fromTeamID = fromPlayer:GetTeam()
  local toTeamID = toPlayer:GetTeam()
  
  if fromTeamID == toTeamID then
    return 2  -- Team member
  elseif Teams[fromTeamID]:IsHasMet(toTeamID) then
    return 1  -- Met
  else
    return 0  -- Not met
  end
end

-- Iterate through all possible players
for playerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
  local player = Players[playerID]
  
  -- Only include players that are alive or have ever been alive
  if player and player:IsEverAlive() then
    -- Get current era information
    local currentEra = ""
    local currentTech = 0
    local teamID = player:GetTeam()
    if Teams[teamID] then
      local eraID = Teams[teamID]:GetCurrentEra()
      if eraID and GameInfo.Eras[eraID] then
        currentEra = GameInfo.Eras[eraID].Type
      end
      currentTech = Teams[teamID]:GetTeamTechs():GetNumTechsKnown() or 0
    end
    
    local summary = {
      Key = playerID,
      Era = currentEra,
      MajorAlly = nil,  -- Default to no ally
      Cities = player:GetNumCities(),
      Population = player:GetTotalPopulation(),
      Gold = player:GetGold(),
      GoldPerTurn = player:CalculateGoldRate(),
      TourismPerTurn = player:GetTourismPerTurnIncludingInstantTimes100() / 100,
      Technologies = currentTech,
      PolicyBranches = {},
      FoundedReligion = "",
      MajorityReligion = player:GetStateReligionName(),
      ResourcesAvailable = {}  -- Will be populated differently for major/minor civs
    }
    
    -- Add relative visibility to all other players
    for otherPlayerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
      local otherPlayer = Players[otherPlayerID]
      if otherPlayer and otherPlayer:IsEverAlive() then
        local fieldName = "Player" .. otherPlayerID
        summary[fieldName] = getVisibility(playerID, otherPlayerID)
      end
    end
    
    -- Get ally for minor civs (major ally of city-state)
    if player:IsMinorCiv() then
      local allyID = player:GetAlly()
      if allyID and allyID >= 0 then
        local allyPlayer = Players[allyID]
        if allyPlayer then
          summary.MajorAlly = Locale.ConvertTextKey(allyPlayer:GetCivilizationShortDescription())
        end
      end
    end
    
    -- Get policy branches
    local policyBranches = {}
    for policyBranchInfo in GameInfo.PolicyBranchTypes() do
      local branchType = policyBranchInfo.ID
      local branchName = Locale.ConvertTextKey(policyBranchInfo.Description)
      
      -- Check if player has unlocked this policy branch
      if player:IsPolicyBranchUnlocked(branchType) then
        policyBranches[branchName] = player:GetNumPolicyBranchesUnlocked(branchType)
      else
        policyBranches[branchName] = 0
      end
    end
    summary.PolicyBranches = policyBranches
    
    -- Get religion information
    local createdReligion = player:GetReligionCreatedByPlayer()
    if createdReligion and createdReligion > 0 then
      local religionInfo = GameInfo.Religions[createdReligion]
      if religionInfo then
        summary.FoundedReligion = Locale.ConvertTextKey(religionInfo.Description) or ""
      end
    end
    
    -- Get resources for major civs (revealed resources in format {"Iron": 0})
    local availableResources = {}
    for resource in GameInfo.Resources() do
      if player:IsResourceRevealed(resource.ID) then
        local resourceName = Locale.ConvertTextKey(resource.Description)
        local resourceCount = player:GetNumResourceAvailable(resource.ID, true)
        availableResources[resourceName] = resourceCount
      end
    end
    summary.ResourcesAvailable = availableResources
  
    -- Add to results
    table.insert(summaries, summary)
  end
end

-- Also check minor civs (city-states)
for playerID = GameDefines.MAX_MAJOR_CIVS, GameDefines.MAX_CIV_PLAYERS - 1 do
  local player = Players[playerID]
  
  -- Only include minor civs that are alive
  if player and player:IsAlive() and player:IsMinorCiv() then
    -- Get current era and tech information
    local currentTech = 0
    local teamID = player:GetTeam()
    if Teams[teamID] then
      currentTech = Teams[teamID]:GetTeamTechs():GetNumTechsKnown() or 0
    end
    
    local summary = {
      Key = playerID,
      MajorAlly = nil,  -- Will be populated below
      Cities = player:GetNumCities(),
      Population = player:GetTotalPopulation(),
      Gold = player:GetGold(),
      GoldPerTurn = math.floor(player:CalculateGoldRateTimes100() / 100),
      Technologies = currentTech,  -- Get actual tech count for minor civs
      ResourcesAvailable = {}  -- Will be populated with actual available resources
    }
    
    -- Get ally name for minor civs
    local allyID = player:GetAlly()
    if allyID and allyID >= 0 then
      local allyPlayer = Players[allyID]
      if allyPlayer then
        summary.MajorAlly = Locale.ConvertTextKey(allyPlayer:GetCivilizationShortDescription())
      end
    end

    -- Add relative visibility to all other players
    for otherPlayerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
      local otherPlayer = Players[otherPlayerID]
      if otherPlayer and otherPlayer:IsEverAlive() then
        local fieldName = "Player" .. otherPlayerID
        summary[fieldName] = getVisibility(playerID, otherPlayerID)
      end
    end

    -- Get majority religion for city-state
    local capital = player:GetCapitalCity()
    if capital then
      local majorityReligion = capital:GetReligiousMajority()
      if majorityReligion and majorityReligion > 0 then
        local religionInfo = GameInfo.Religions[majorityReligion]
        if religionInfo then
          summary.MajorityReligion = Locale.ConvertTextKey(religionInfo.Description) or ""
        end
      end
    end
    
    -- Get actual available resources for minor civs (skip 0s)
    local availableResources = {}
    for resource in GameInfo.Resources() do
      local resourceCount = player:GetNumResourceAvailable(resource.ID, true)
      if resourceCount > 0 then
        -- Use localized name
        local resourceName = Locale.ConvertTextKey(resource.Description)
        availableResources[resourceName] = resourceCount
      end
    end
    summary.ResourcesAvailable = availableResources
    
    -- Add relative visibility to all other players
    for otherPlayerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
      local otherPlayer = Players[otherPlayerID]
      if otherPlayer and otherPlayer:IsEverAlive() then
        local fieldName = "Player" .. otherPlayerID
        summary[fieldName] = getVisibility(playerID, otherPlayerID)
      end
    end
     
    -- Add to results
    table.insert(summaries, summary)
  end
end

return summaries