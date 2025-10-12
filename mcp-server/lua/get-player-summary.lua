-- Extract player summary information from the game
-- Returns summary data with relative visibility between all players

local influenceLookup = {
  [InfluenceLevelTypes.INFLUENCE_LEVEL_UNKNOWN] = "Unknown",
  [InfluenceLevelTypes.INFLUENCE_LEVEL_EXOTIC] = "Exotic",
  [InfluenceLevelTypes.INFLUENCE_LEVEL_FAMILIAR] = "Familiar",
  [InfluenceLevelTypes.INFLUENCE_LEVEL_POPULAR] = "Popular",
  [InfluenceLevelTypes.INFLUENCE_LEVEL_INFLUENTIAL] = "Influential",
  [InfluenceLevelTypes.INFLUENCE_LEVEL_DOMINANT] = "Dominant",
};

-- Helper function to get civilization name with city-state prefix if applicable
local function getCivName(player)
  local civName = player:GetCivilizationShortDescription()
  if player:IsMinorCiv() then
    return "City-State " .. civName
  end
  return civName
end

-- Helper function to determine spy role
local function getSpyRole(spy, playerID)
  if spy.IsDiplomat then
    if spy.VassalDiplomatPlayer >= 0 then
      return "Vassal Diplomat"
    else
      return "Diplomat"
    end
  end

  -- Check if spy is in own city (counterspy)
  if spy.CityX and spy.CityY and spy.CityX >= 0 and spy.CityY >= 0 then
    local plot = Map.GetPlot(spy.CityX, spy.CityY)
    if plot then
      local city = plot:GetPlotCity()
      if city and city:GetOwner() == playerID then
        return "Counterspy"
      end
    end
  end

  return "Spy"
end

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

Game.RegisterFunction("${Name}", function(${Arguments})
  local summaries = {}
  -- Get the active league once at the beginning
  local league = Game.GetActiveLeague()

  -- Iterate through all major players
  for playerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
    local player = Players[playerID]
    
    -- Only include players that are alive
    if player and player:IsAlive() then
      -- Get current era information
      local currentEra = ""
      -- Use player method for era if available, otherwise fall back to team
      local eraID = player:GetCurrentEra()
      if eraID and GameInfo.Eras[eraID] then
        currentEra = GameInfo.Eras[eraID].Type
      end
      -- Tech count still requires team access
      local teamID = player:GetTeam()
      local fromTeam = Teams[player:GetTeam()]
      
      -- Get current research
      local currentResearch = nil
      local techID = player:GetCurrentResearch()
      if techID and techID >= 0 and GameInfo.Technologies[techID] then
        currentResearch = Locale.ConvertTextKey(GameInfo.Technologies[techID].Description)
      else
        currentResearch = "None"
      end

      -- Get votes in the league if it exists
      local votes = nil
      if league then
        votes = league:CalculateStartingVotesForMember(playerID)
      end

      local summary = {
        Key = playerID,
        Score = player:GetScore(),  -- Player's current score
        Era = currentEra,
        Votes = votes,  -- Votes in the World Congress/UN
        Cities = player:GetNumCities(),
        Population = player:GetTotalPopulation(),
        Territory = player:GetNumPlots(),  -- Number of plots owned (major civs only)
        Gold = player:GetGold(),
        GoldPerTurn = player:CalculateGoldRate(),
        HappinessPercentage = player:GetExcessHappiness(),  -- Excess happiness (can be negative)
        TourismPerTurn = player:GetTourismPerTurnIncludingInstantTimes100() / 100,
        CulturePerTurn = player:GetTotalJONSCulturePerTurn(),  -- Culture per turn (visible to met players)
        FaithPerTurn = player:GetTotalFaithPerTurn(),  -- Faith per turn (only visible to team)
        SciencePerTurn = player:GetScience(),  -- Science per turn (only visible to team)
        Technologies = fromTeam:GetTeamTechs():GetNumTechsKnown() or 0,
        CurrentResearch = currentResearch,
        PolicyBranches = nil,  -- Will be populated if player has policies
        FoundedReligion = nil,  -- Will be populated if player founded religion
        MajorityReligion = player:GetStateReligionName(),
        ResourcesAvailable = nil,  -- Will be populated if player has resources
        Relationships = nil,  -- Will be populated if player has diplomatic relationships
        OutgoingTradeRoutes = nil,  -- Will be populated if player has outgoing trade routes
        IncomingTradeRoutes = nil,  -- Will be populated if player has incoming trade routes
        Spies = nil  -- Will be populated if player has spies
      }
      
      -- Add relative visibility to all other players
      for otherPlayerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
        local otherPlayer = Players[otherPlayerID]
        if otherPlayer and otherPlayer:IsEverAlive() then
          local fieldName = "Player" .. otherPlayerID
          summary[fieldName] = getVisibility(playerID, otherPlayerID)
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
      elseif player:HasCreatedPantheon() then
        -- Player has a pantheon but no full religion
        -- Check if religion is still possible (religions still available to found)
        local religionsStillToFound = Game.GetNumReligionsStillToFound()
        if religionsStillToFound > 0 then
          summary.FoundedReligion = "Pantheon (Religion Possible)"
        else
          summary.FoundedReligion = "Pantheon (Religion Impossible)"
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
      local relationships = {}

      for otherPlayerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
        if otherPlayerID ~= playerID then
          local otherPlayer = Players[otherPlayerID]
          if otherPlayer and otherPlayer:IsAlive() and not otherPlayer:IsMinorCiv() then
            local relationshipList = {}
            local otherTeamID = otherPlayer:GetTeam()

            -- Check for war using player method if available
            if player:IsAtWarWith(otherPlayerID) then
              -- Include war score (positive = winning, negative = losing)
              local warScore = player:GetWarScore(otherPlayerID)
              local weariness = player:GetWarWearinessPercent(otherPlayerID)
              relationshipList[#relationshipList + 1] = string.format("War (Our Score: %d%%; Our War Weariness: %d%%)", warScore, weariness)
            elseif fromTeam and fromTeam:IsDefensivePact(otherTeamID) then
              -- Defensive pacts still need team check
              relationshipList[#relationshipList + 1] = "Defensive Pact"
            end

            -- Check for peace treaty
            if fromTeam:IsForcePeace(otherTeamID) then
              relationshipList[#relationshipList + 1] = "Peace Treaty"
            end

            -- Check vassal/master relationships at team level
            local otherTeam = Teams[otherTeamID]
            -- Check if other team is our vassal
            if otherTeam:IsVassal(teamID) then
              local voluntary = otherTeam:IsVoluntaryVassal(player:GetTeam())
              relationshipList[#relationshipList + 1] = voluntary and "Our Vassal (Voluntary)" or "Our Vassal (Capitulated)"
            -- Check if we are vassal of other team
            elseif fromTeam:IsVassal(otherTeamID) then
              local voluntary = fromTeam:IsVoluntaryVassal(otherTeamID)
              relationshipList[#relationshipList + 1] = voluntary and "Our Master (Voluntary)" or "Our Master (Capitulated)"
            end

            -- Check for other agreements
            if fromTeam:IsAllowsOpenBordersToTeam(otherTeamID) then
              relationshipList[#relationshipList + 1] = "Open Borders"
            end

            -- Check for research agreement
            if fromTeam:IsHasResearchAgreement(otherTeamID) then
              relationshipList[#relationshipList + 1] = "Research Agreement"
            end

            -- Check for Declaration of Friendship
            if player:IsDoF(otherPlayerID) then
              relationshipList[#relationshipList + 1] = "Declaration of Friendship"
            end

            -- Check for denouncement
            if player:IsDenouncedPlayer(otherPlayerID) then
              relationshipList[#relationshipList + 1] = "Denounced Them"
            end

            if player:IsDenouncingPlayer(otherPlayerID) then
              relationshipList[#relationshipList + 1] = "Denounced By Them"
            end

            -- Check for cultural influence from tourism
            local iInfluenceLevel = player:GetInfluenceLevel(otherPlayerID)
            if iInfluenceLevel and iInfluenceLevel > InfluenceLevelTypes.INFLUENCE_LEVEL_UNKNOWN then
              local levelText = Locale.ConvertTextKey(influenceLookup[iInfluenceLevel])

              -- Calculate influence percentage
              local iInfluence = player:GetInfluenceOn(otherPlayerID)
              local iCulture = otherPlayer:GetJONSCultureEverGenerated()
              local iPercent = 0

              if iCulture > 0 then
                iPercent = math.floor((iInfluence * 100) / iCulture)
              end

              -- Get the trend information
              local iTrend = player:GetInfluenceTrend(otherPlayerID)
              local trendText = ""

              if iTrend == InfluenceLevelTrend.INFLUENCE_TREND_FALLING then
                trendText = "Falling"
              elseif iTrend == InfluenceLevelTrend.INFLUENCE_TREND_STATIC then
                trendText = "Static"
              elseif iTrend == InfluenceLevelTrend.INFLUENCE_TREND_RISING then
                local turnsToInfluential = player:GetTurnsToInfluential(otherPlayerID)
                -- Check if rising slowly or normal rising
                if turnsToInfluential >= 999 then
                  trendText = "Rising Slowly"
                else
                  -- Add turns to influential if not already influential
                  if iInfluenceLevel < InfluenceLevelTypes.INFLUENCE_LEVEL_INFLUENTIAL then
                    trendText = string.format("Rising (%d turns to Influential)", turnsToInfluential)
                  else
                    trendText = "Rising"
                  end
                end
              end

              relationshipList[#relationshipList + 1] = string.format("Our Cultural Influence through Tourism: %s (%d%%) - %s", levelText, iPercent, trendText)
            end

            -- Only add if there are relationships
            if #relationshipList > 0 then
              relationships[getCivName(otherPlayer)] = relationshipList
            end
          end
        end
      end
      summary.Relationships = relationships

      -- Get outgoing trade routes
      local outgoingTradeRoutes = {}
      local playerTradeRoutes = player:GetTradeRoutes()
      local activeRouteCount = playerTradeRoutes and #playerTradeRoutes or 0
      local maxRoutes = player:GetNumInternationalTradeRoutesAvailable()
      local unassignedCount = maxRoutes - activeRouteCount

      if unassignedCount > 0 then
        outgoingTradeRoutes["Available"] = unassignedCount
      end

      if playerTradeRoutes then
        for _, route in ipairs(playerTradeRoutes) do
          local fromCityName = route.FromCityName or "Unknown"
          local toCityName = route.ToCityName or "Unknown"
          local fromCivName = "Unknown"
          local toCivName = "Unknown"

          if route.FromID and Players[route.FromID] then
            fromCivName = getCivName(Players[route.FromID])
          end

          if route.ToID and Players[route.ToID] then
            toCivName = getCivName(Players[route.ToID])
          end

          local routeKey = string.format("%s (%s) => %s (%s)", fromCityName, fromCivName, toCityName, toCivName)
          outgoingTradeRoutes[routeKey] = {
            TurnsLeft = route.TurnsLeft,
            Domain = route.Domain == DomainTypes.DOMAIN_LAND and "Land" or "Sea",
            FromGold = route.FromGPT > 0 and route.FromGPT / 100 or -1, -- If the value is 0, set to -1 to indicate no gold from origin
            ToGold = route.ToGPT > 0 and route.ToGPT / 100 or -1,
            ToFood = route.ToFood > 0 and route.ToFood / 100 or -1,
            ToProduction = route.ToProduction > 0 and route.ToProduction / 100 or -1,
            FromScience = route.FromScience > 0 and route.FromScience / 100 or -1,
            ToScience = route.ToScience > 0 and route.ToScience / 100 or -1,
            FromCulture = route.FromCulture > 0 and route.FromCulture / 100 or -1,
            ToCulture = route.ToCulture > 0 and route.ToCulture / 100 or -1,
          }
        end
      end
      summary.OutgoingTradeRoutes = outgoingTradeRoutes

      -- Get incoming trade routes
      local incomingTradeRoutes = {}
      local incomingRoutes = player:GetTradeRoutesToYou()

      if incomingRoutes then
        for _, route in ipairs(incomingRoutes) do
          local fromCityName = route.FromCityName or "Unknown"
          local toCityName = route.ToCityName or "Unknown"
          local fromCivName = "Unknown"
          local toCivName = "Unknown"

          if route.FromID and Players[route.FromID] then
            fromCivName = getCivName(Players[route.FromID])
          end

          if route.ToID and Players[route.ToID] then
            toCivName = getCivName(Players[route.ToID])
          end

          local routeKey = string.format("%s (%s) => %s (%s)", fromCityName, fromCivName, toCityName, toCivName)
          incomingTradeRoutes[routeKey] = {
            TurnsLeft = route.TurnsLeft,
            Domain = route.Domain == DomainTypes.DOMAIN_LAND and "Land" or "Sea",
            FromGold = route.FromGPT > 0 and route.FromGPT / 100 or -1,
            ToGold = route.ToGPT > 0 and route.ToGPT / 100 or -1,
            ToFood = route.ToFood > 0 and route.ToFood / 100 or -1,
            ToProduction = route.ToProduction > 0 and route.ToProduction / 100 or -1,
            FromScience = route.FromScience > 0 and route.FromScience / 100 or -1,
            ToScience = route.ToScience > 0 and route.ToScience / 100 or -1,
            FromCulture = route.FromCulture > 0 and route.FromCulture / 100 or -1,
            ToCulture = route.ToCulture > 0 and route.ToCulture / 100 or -1,
          }
        end
      end
      summary.IncomingTradeRoutes = incomingTradeRoutes

      -- Get spy information
      local espionageSpies = player:GetEspionageSpies()

      if espionageSpies then
        local spies = {}
        for _, spy in ipairs(espionageSpies) do
          -- Get spy location
          local location = "Unassigned"
          if spy.CityX and spy.CityY and spy.CityX >= 0 and spy.CityY >= 0 then
            local plot = Map.GetPlot(spy.CityX, spy.CityY)
            if plot then
              local city = plot:GetPlotCity()
              if city then
                local cityName = city:GetName()
                local cityOwner = Players[city:GetOwner()]
                if cityOwner then
                  local civName = getCivName(cityOwner)
                  location = string.format("%s (%s)", cityName, civName)
                else
                  location = cityName
                end
              end
            end
          end

          -- Determine spy role
          local role = getSpyRole(spy, playerID)

          -- Get rank name (localized)
          local rankName = Locale.ConvertTextKey(spy.Rank)

          -- Create condensed spy identifier
          local spyIdentifier = string.format("%s %s (%d)", rankName, Locale.ConvertTextKey(spy.Name), spy.AgentID)

          -- Build spy entry
          local spyEntry = {
            Role = role,
            Location = location,
            State = Locale.ConvertTextKey(spy.State),
            Network = spy.NetworkPointsStored,
            NetworkPerTurn = spy.NetworkPointsPerTurn
          }

          -- Add to spies table using spy identifier as key
          spies[spyIdentifier] = spyEntry
        end
        summary.Spies = spies
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
      -- Get current tech information (still requires team access)
      local fromTeam = Teams[player:GetTeam()]

      local summary = {
        Key = playerID,
        MajorAlly = nil,  -- Will be populated below
        Cities = player:GetNumCities(),
        Population = player:GetTotalPopulation(),
        Gold = player:GetGold(),
        GoldPerTurn = math.floor(player:CalculateGoldRateTimes100() / 100),
        Technologies = fromTeam:GetTeamTechs():GetNumTechsKnown() or 0,  -- Get actual tech count for minor civs
        ResourcesAvailable = nil,  -- Will be populated with actual available resources
        Relationships = nil  -- Will be populated with relationships to major civs
      }
      
      -- Get ally name for minor civs
      local allyID = player:GetAlly()
      if allyID and allyID >= 0 then
        local allyPlayer = Players[allyID]
        if allyPlayer then
          summary.MajorAlly = getCivName(allyPlayer)
        end
      end

      -- Get relationships with all major civs
      local relationships = {}
      for majorID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
        local major = Players[majorID]
        if major and major:IsAlive() then
          -- Get influence score
          local influence = player:GetMinorCivFriendshipWithMajor(majorID)

          -- Determine relationship status
          local status = "Neutral"
          local majorTeam = Teams[major:GetTeam()]
          local isProtected = player:IsProtectedByMajor(majorID)

          -- Check war status first
          if fromTeam:IsAtWar(major:GetTeam()) then
            if player:IsMinorPermanentWar(majorTeam) then
              status = "Permanent War"
            else
              status = "War"
            end
          -- Check if peace is blocked
          elseif player:IsPeaceBlocked(majorTeam) then
            status = "Peace Blocked"
          -- Check if major is the ally
          elseif player:IsAllies(majorID) then
            status = "Ally"
          -- Check if major is friends
          elseif player:IsFriends(majorID) then
            status = "Friends"
          -- Neutral
          else
            status = "Neutral"
          end

          -- Format the status with influence and protected status at the end
          local formattedStatus
          if isProtected then
            formattedStatus = string.format("%s (Influence: %d, Protected)", status, influence)
          else
            formattedStatus = string.format("%s (Influence: %d)", status, influence)
          end

          relationships[getCivName(major)] = formattedStatus
        end
      end
      summary.Relationships = relationships

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
end)

return true