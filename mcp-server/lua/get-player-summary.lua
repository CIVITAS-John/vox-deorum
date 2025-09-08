-- Extract player summary information from the game
-- Returns summary data visible to met players

local summaries = {}

-- Iterate through all possible players
for playerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
  local player = Players[playerID]
  
  -- Only include players that are alive or have ever been alive
  if player and player:IsEverAlive() then
    local summary = {
      Key = playerID,
      MajorAllyID = -1,  -- Default to none
      Cities = player:GetNumCities(),
      Population = player:GetTotalPopulation(),
      Gold = player:GetGold(),
      GoldPerTurn = player:CalculateGoldRate(),
      TourismPerTurn = player:GetTourism() or 0,
      Technologies = Teams[player:GetTeam()]:GetTeamTechs():GetNumTechsKnown() or 0,
      PolicyBranches = {},
      CreatedReligion = "",
      MajorityReligion = player:GetStateReligionName()
    }
    
    -- Get ally for minor civs (major ally of city-state)
    if player:IsMinorCiv() then
      summary.MajorAllyID = player:GetAlly()
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
        summary.CreatedReligion = religionInfo.Type or nil
      end
    end
    
    -- Add to results
    table.insert(summaries, summary)
  end
end

-- Also check minor civs (city-states)
for playerID = GameDefines.MAX_MAJOR_CIVS, GameDefines.MAX_CIV_PLAYERS - 1 do
  local player = Players[playerID]
  
  -- Only include minor civs that are alive
  if player and player:IsAlive() and player:IsMinorCiv() then
    local summary = {
      Key = playerID,
      MajorAllyID = player:GetAlly() or -1,
      Cities = player:GetNumCities(),
      Population = player:GetTotalPopulation(),
      Gold = player:GetGold(),
      GoldPerTurn = math.floor(player:CalculateGoldRateTimes100() / 100),
      TourismPerTurn = 0,  -- Minor civs don't generate tourism
      Technologies = 0,  -- Minor civs don't research techs
      PolicyBranches = {},  -- Minor civs don't have policies
      CreatedReligion = "",  -- Minor civs don't found religions
      MajorityReligion = ""
    }
    
    -- Get majority religion for city-state
    local capital = player:GetCapitalCity()
    if capital then
      local majorityReligion = capital:GetReligiousMajority()
      if majorityReligion and majorityReligion > 0 then
        local religionInfo = GameInfo.Religions[majorityReligion]
        if religionInfo then
          summary.MajorityReligion = religionInfo.Type or ""
        end
      end
    end
    
    -- Add to results
    table.insert(summaries, summary)
  end
end

return summaries