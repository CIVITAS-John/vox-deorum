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
    
    -- Get current research
    local currentResearch = "None"
    if teamID and Teams[teamID] then
      local techID = Teams[teamID]:GetTeamTechs():GetCurrentResearch()
      if techID and techID >= 0 and GameInfo.Technologies[techID] then
        currentResearch = Locale.ConvertTextKey(GameInfo.Technologies[techID].Description)
      end
    end

    local summary = {
      Key = playerID,
      Era = currentEra,
      MajorAlly = nil,  -- Default to no ally
      Cities = player:GetNumCities(),
      Population = player:GetTotalPopulation(),
      Territory = player:GetNumPlots(),  -- Number of plots owned (major civs only)
      Gold = player:GetGold(),
      GoldPerTurn = player:CalculateGoldRate(),
      TourismPerTurn = player:GetTourismPerTurnIncludingInstantTimes100() / 100,
      Technologies = currentTech,
      CurrentResearch = currentResearch,
      PolicyBranches = nil,  -- Will be populated if player has policies
      FoundedReligion = nil,  -- Will be populated if player founded religion
      MajorityReligion = player:GetStateReligionName(),
      ResourcesAvailable = nil,  -- Will be populated if player has resources
      Relationships = nil  -- Will be populated if player has diplomatic relationships
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
    
    -- Get policy branches with individual policies
    local policyBranches = nil  -- Start with nil, only allocate if needed
    for policyBranchInfo in GameInfo.PolicyBranchTypes() do
      local branchType = policyBranchInfo.ID

      -- Check if player has unlocked this policy branch
      if player:IsPolicyBranchUnlocked(branchType) then
        -- Get individual policies in this branch
        local policies = nil  -- Start with nil to avoid allocation
        for policyInfo in GameInfo.Policies() do
          if policyInfo.PolicyBranchType == policyBranchInfo.Type then
            -- Check if player has this specific policy
            if player:HasPolicy(policyInfo.ID) then
              if not policies then policies = {} end  -- Lazy allocate
              local policyName = Locale.ConvertTextKey(policyInfo.Description)
              policies[#policies + 1] = policyName
            end
          end
        end

        -- Only add the branch if it has policies
        if policies then
          if not policyBranches then policyBranches = {} end  -- Lazy allocate
          local branchName = Locale.ConvertTextKey(policyBranchInfo.Description)
          policyBranches[branchName] = policies
        end
      end
    end
    summary.PolicyBranches = policyBranches
    
    -- Get religion information
    local createdReligion = player:GetReligionCreatedByPlayer()
    if createdReligion and createdReligion > 0 then
      local religionInfo = GameInfo.Religions[createdReligion]
      if religionInfo then
        summary.FoundedReligion = Locale.ConvertTextKey(religionInfo.Description)
      end
    end
    
    -- Get resources for major civs (revealed resources in format {"Iron": 0})
    local availableResources = nil  -- Start with nil, only allocate if needed
    for resource in GameInfo.Resources() do
      if player:IsResourceRevealed(resource.ID) then
        local resourceCount = player:GetNumResourceAvailable(resource.ID, true)
        -- Only allocate and add if we have revealed resources
        if not availableResources then availableResources = {} end
        local resourceName = Locale.ConvertTextKey(resource.Description)
        availableResources[resourceName] = resourceCount
      end
    end
    summary.ResourcesAvailable = availableResources

    -- Get diplomatic relationships with other major civilizations (only if player is major civ)
    local relationships = nil  -- Start with nil, only allocate if needed
    if not player:IsMinorCiv() and player:IsAlive() then
      local fromTeam = Teams[player:GetTeam()]  -- Cache team reference

      for otherPlayerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
        if otherPlayerID ~= playerID then
          local otherPlayer = Players[otherPlayerID]
          if otherPlayer and otherPlayer:IsAlive() and not otherPlayer:IsMinorCiv() then
            local relationshipList = nil  -- Start with nil to avoid allocation
            local otherTeamID = otherPlayer:GetTeam()

            -- Check for war and pacts
            if fromTeam then
              if fromTeam:IsAtWar(otherTeamID) then
                if not relationshipList then relationshipList = {} end
                relationshipList[#relationshipList + 1] = "War"
              elseif fromTeam:IsDefensivePact(otherTeamID) then
                if not relationshipList then relationshipList = {} end
                relationshipList[#relationshipList + 1] = "Defensive Pact"
              end

              -- Check for other agreements
              if fromTeam:IsAllowsOpenBordersToTeam(otherTeamID) then
                if not relationshipList then relationshipList = {} end
                relationshipList[#relationshipList + 1] = "Open Borders"
              end

              -- Check for research agreement
              if fromTeam:IsHasResearchAgreement(otherTeamID) then
                if not relationshipList then relationshipList = {} end
                relationshipList[#relationshipList + 1] = "Research Agreement"
              end
            end

            -- Check for Declaration of Friendship
            if player:IsDoF(otherPlayerID) then
              if not relationshipList then relationshipList = {} end
              relationshipList[#relationshipList + 1] = "Declaration of Friendship"
            end

            -- Check for denouncement
            if player:IsDenouncedPlayer(otherPlayerID) then
              if not relationshipList then relationshipList = {} end
              relationshipList[#relationshipList + 1] = "Denounced"
            end

            -- Only add if there are relationships
            if relationshipList then
              if not relationships then relationships = {} end  -- Lazy allocate
              local civName = Locale.ConvertTextKey(otherPlayer:GetCivilizationShortDescription())
              relationships[civName] = relationshipList
            end
          end
        end
      end
    end
    summary.Relationships = relationships

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
          summary.MajorityReligion = Locale.ConvertTextKey(religionInfo.Description)
        end
      end
    end
    
    -- Get actual available resources for minor civs (skip 0s)
    local availableResources = nil  -- Start with nil, only allocate if needed
    for resource in GameInfo.Resources() do
      local resourceCount = player:GetNumResourceAvailable(resource.ID, true)
      if resourceCount > 0 then
        if not availableResources then availableResources = {} end  -- Lazy allocate
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