-- Extract victory progress information from the game
-- Returns a single global victory progress object for all victory types
-- Visible to all players (global knowledge)

local victoryProgress = {
  DominationVictory = "Not available",
  ScienceVictory = "Not available",
  CulturalVictory = "Not available",
  DiplomaticVictory = "Not available"
}

-- Helper function to get all original capitals in the game
local function getTotalOriginalCapitals()
  local count = 0
  for playerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
    local player = Players[playerID]
    if player and player:IsEverAlive() and not player:IsBarbarian() then
      count = count + 1
    end
  end
  return count
end

-- Check and populate Domination victory
local dominationVictory = GameInfo.Victories["VICTORY_DOMINATION"]
if dominationVictory and Game:IsVictoryValid(dominationVictory.ID) then
  local totalCapitals = getTotalOriginalCapitals()
  local capitalsNeeded = math.ceil(totalCapitals * 0.5)  -- Need 50% of original capitals

  local dominationData = {
    CapitalsNeeded = capitalsNeeded,
    Contender = nil
  }

  local maxCapitals = 0

  -- Iterate through all major players to count capitals controlled
  for playerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
    local player = Players[playerID]

    if player and player:IsAlive() then
      local capitalsControlled = 0

      -- Count how many original capitals this player controls
      for otherPlayerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
        local otherPlayer = Players[otherPlayerID]
        if otherPlayer and otherPlayer:IsEverAlive() then
          local capitalPlot = otherPlayer:GetOriginalCapitalPlot()
          if capitalPlot then
            local capital = capitalPlot:GetPlotCity()
            if capital and capital:GetOwnerForDominationVictory() == playerID then
              capitalsControlled = capitalsControlled + 1
            end
          end
        end
      end

      -- Only include players who control at least one capital
      if capitalsControlled > 1 then
        local capitalsPercentage = math.floor((capitalsControlled * 100) / totalCapitals)
        local playerName = player:GetCivilizationShortDescription()

        -- Track who's leading
        if capitalsControlled > maxCapitals then
          maxCapitals = capitalsControlled
          dominationData.Contender = playerName
        end

        dominationData[playerName] = {
          CapitalsControlled = capitalsControlled,
          CapitalsPercentage = capitalsPercentage
        }
      end
    end
  end

  victoryProgress.DominationVictory = dominationData
end

-- Check and populate Science victory
local scienceVictory = GameInfo.Victories["VICTORY_SPACE_RACE"]
if scienceVictory and Game:IsVictoryValid(scienceVictory.ID) then
  local apolloProject = GameInfo.Projects["PROJECT_APOLLO_PROGRAM"]

  if apolloProject then
    local scienceData = {
      Contender = nil
    }

    local maxPartsCompleted = 0
    local spaceshipUnlocked = false

    -- Iterate through all major players to check spaceship progress
    for playerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
      local player = Players[playerID]

      if player and player:IsAlive() then
        local team = Teams[player:GetTeam()]

        -- Check if Apollo Program is complete
        local apolloComplete = team:GetProjectCount(apolloProject.ID)
        if apolloComplete > 0 then
          spaceshipUnlocked = true
        end

        -- Count spaceship parts (SS parts are projects)
        local partsCompleted = 0
        for projectInfo in GameInfo.Projects() do
          if projectInfo.Spaceship then
            local projectCount = team:GetProjectCount(projectInfo.ID)
            partsCompleted = partsCompleted + projectCount
          end
        end

        -- Total spaceship parts needed (excluding Apollo)
        local totalParts = 6  -- Typically: Booster, Stasis Chamber, Engine (each can be built multiple times)
        local partsPercentage = math.floor((partsCompleted * 100) / totalParts)
        local playerName = player:GetCivilizationShortDescription()

        -- Track who's leading
        if partsCompleted > maxPartsCompleted then
          maxPartsCompleted = partsCompleted
          scienceData.Contender = playerName
        end

        scienceData[playerName] = {
          ApolloComplete = apolloComplete,
          PartsCompleted = partsCompleted,
          PartsPercentage = partsPercentage
        }
      end
    end

    if spaceshipUnlocked then
      victoryProgress.ScienceVictory = scienceData
    else
      victoryProgress.ScienceVictory = "Unlocked in later eras"
    end
  end
end

-- Check and populate Cultural victory
local culturalVictory = GameInfo.Victories["VICTORY_CULTURAL"]
if culturalVictory and Game:IsVictoryValid(culturalVictory.ID) then
  local totalCivs = 0

  -- Count total major civs
  for playerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
    local player = Players[playerID]
    if player and player:IsAlive() then
      totalCivs = totalCivs + 1
    end
  end

  -- Need to be influential over all other civs (excluding self)
  local civsNeeded = totalCivs - 1

  local culturalData = {
    CivsNeeded = civsNeeded,
    Contender = nil
  }

  local maxInfluentialCivs = 0

  -- Iterate through all major players to check cultural influence
  for playerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
    local player = Players[playerID]

    if player and player:IsAlive() then
      local influentialCivs = 0
      local totalPolicies = 0
      local unlockedPolicies = 0

      -- Count how many civs this player is influential over
      for otherPlayerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
        if otherPlayerID ~= playerID then
          local otherPlayer = Players[otherPlayerID]
          if otherPlayer and otherPlayer:IsAlive() then
            local influenceLevel = player:GetInfluenceLevel(otherPlayerID)
            -- Influential = 4, Dominant = 5
            if influenceLevel >= InfluenceLevelTypes.INFLUENCE_LEVEL_INFLUENTIAL then
              influentialCivs = influentialCivs + 1
            end
          end
        end
      end

      -- Count policy progress
      for policyInfo in GameInfo.Policies() do
        totalPolicies = totalPolicies + 1
        if player:HasPolicy(policyInfo.ID) then
          unlockedPolicies = unlockedPolicies + 1
        end
      end

      local influentialPercentage = math.floor((influentialCivs * 100) / civsNeeded)
      local policyPercentage = totalPolicies > 0 and math.floor((unlockedPolicies * 100) / totalPolicies) or 0
      local playerName = player:GetCivilizationShortDescription()

      -- Track who's leading
      if influentialCivs > maxInfluentialCivs then
        maxInfluentialCivs = influentialCivs
        culturalData.Contender = playerName
      end

      culturalData[playerName] = {
        InfluentialCivs = influentialCivs,
        InfluentialPercentage = influentialPercentage,
        PolicyPercentage = policyPercentage
      }
    end
  end

  victoryProgress.CulturalVictory = culturalData
end

-- Check and populate Diplomatic victory
local diplomaticVictory = GameInfo.Victories["VICTORY_DIPLOMATIC"]
if diplomaticVictory and Game:IsVictoryValid(diplomaticVictory.ID) then
  local league = Game.GetActiveLeague()

  if league then
    local votesNeeded = Game.GetVotesNeededForDiploVictory()
    local status = "World Congress"

    -- Check if we have United Nations
    for projectInfo in GameInfo.Projects() do
      if projectInfo.Type == "PROJECT_UNITED_NATIONS" then
        -- Check if any team has built the UN
        for teamID = 0, GameDefines.MAX_TEAMS - 1 do
          local team = Teams[teamID]
          if team and team:GetProjectCount(projectInfo.ID) > 0 then
            status = "United Nations"
            break
          end
        end
        break
      end
    end

    local diplomaticData = {
      VotesNeeded = votesNeeded,
      Status = status,
      ActiveResolutions = {},
      Contender = nil
    }

    -- Extract active resolutions from the league
    for _, resolution in ipairs(league:GetActiveResolutions()) do
      local resolutionEntry = GameInfo.Resolutions[resolution.Type]
      local resolutionInfo = {
        Name = league:GetResolutionName(resolution.Type, resolution.ID, resolution.ProposerDecision or -1, false),
        Description = resolutionEntry and Locale.Lookup(resolutionEntry.Help) or "Unknown resolution",
        EnactedOn = resolution.TurnEnacted or 0
      }
      table.insert(diplomaticData.ActiveResolutions, resolutionInfo)
    end

    local maxDelegates = 0

    -- Iterate through all major players to check delegates
    for playerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
      local player = Players[playerID]

      if player and player:IsAlive() then
        local delegates = league:CalculateStartingVotesForMember(playerID)
        local victoryPercentage = votesNeeded > 0 and math.floor((delegates * 100) / votesNeeded) or 0
        local playerName = player:GetCivilizationShortDescription()

        -- Track who's leading
        if delegates > maxDelegates then
          maxDelegates = delegates
          diplomaticData.Contender = playerName
        end

        diplomaticData[playerName] = {
          Delegates = delegates,
          VictoryPercentage = victoryPercentage
        }
      end
    end

    victoryProgress.DiplomaticVictory = diplomaticData
  else
    victoryProgress.DiplomaticVictory = "Unlocked in later eras"
  end
end

return {victoryProgress}
