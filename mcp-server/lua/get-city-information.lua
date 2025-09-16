-- Extract city information from the game
-- Returns city data with visibility-based access control

local cities = {}

-- Helper function to calculate visibility between a player and a city
local function getCityVisibility(playerID, city)
  if not city then
    return 0  -- Not visible
  end

  local cityOwnerID = city:GetOwner()
  local player = Players[playerID]

  if not player or not player:IsAlive() then
    return 0
  end

  -- Check if player owns the city
  if playerID == cityOwnerID then
    return 2  -- Full visibility (owner)
  end

  -- Check if players are on the same team
  local playerTeamID = player:GetTeam()
  local cityOwnerTeamID = Players[cityOwnerID]:GetTeam()

  if playerTeamID == cityOwnerTeamID then
    return 2  -- Full visibility (team member)
  end

  -- Check if city plot is revealed to the player
  local plot = city:Plot()
  if plot and plot:IsRevealed(playerTeamID, false) then
    return 1  -- Basic visibility (revealed)
  end

  return 0  -- Not visible
end

-- Helper function to get localized production name
local function getProductionName(city)
  if not city:IsProduction() then
    return nil
  end

  local productionName = ""
  if city:IsProductionUnit() then
    local unitID = city:GetProductionUnit()
    local unitInfo = GameInfo.Units[unitID]
    if unitInfo then
      productionName = Locale.ConvertTextKey(unitInfo.Description)
    end
  elseif city:IsProductionBuilding() then
    local buildingID = city:GetProductionBuilding()
    local buildingInfo = GameInfo.Buildings[buildingID]
    if buildingInfo then
      productionName = Locale.ConvertTextKey(buildingInfo.Description)
    end
  elseif city:IsProductionProject() then
    local projectID = city:GetProductionProject()
    local projectInfo = GameInfo.Projects[projectID]
    if projectInfo then
      productionName = Locale.ConvertTextKey(projectInfo.Description)
    end
  elseif city:IsProductionProcess() then
    local processID = city:GetProductionProcess()
    local processInfo = GameInfo.Processes[processID]
    if processInfo then
      productionName = Locale.ConvertTextKey(processInfo.Description)
    end
  end

  return productionName ~= "" and productionName or nil
end

-- Iterate through all players
for playerID = 0, GameDefines.MAX_CIV_PLAYERS - 1 do
  local player = Players[playerID]

  if player and player:IsAlive() and player:GetNumCities() > 0 then
    -- Iterate through all cities of this player
    for city in player:Cities() do
      -- Get owner name based on whether it's a major or minor civ
      local cityData = {
        Key = city:GetID(),  -- Use city ID as the key for MutableKnowledge
        Name = city:GetName(),
        X = city:GetX(),
        Y = city:GetY(),
        Population = city:GetPopulation(),
        MajorityReligion = nil,
        DefenseStrength = city:GetStrengthValue() / 100,
        HitPoints = city:GetMaxHitPoints() - city:GetDamage(),  -- Calculate current HP
        MaxHitPoints = city:GetMaxHitPoints(),
        -- Basic status flags visible at level 1
        IsPuppet = city:IsPuppet() and 1 or 0,
        IsOccupied = city:IsOccupied() and 1 or 0,
        IsRazing = city:IsRazing() and 1 or 0,
        IsCoastal = city:IsCoastal(10) and 1 or 0  -- Near a water body of 10+ tiles
      }
      
      -- Use Civilization name for major civs, Player name for minor civs
      if player:IsMinorCiv() then
        cityData["Owner"] = Locale.ConvertTextKey(GameInfo.Civilizations[player:GetCivilizationType()].ShortDescription)
      else
        cityData["Owner"] = player:GetName()
      end

      -- Get majority religion
      local majorityReligion = city:GetReligiousMajority()
      if majorityReligion and majorityReligion > 0 then
        local religionInfo = GameInfo.Religions[majorityReligion]
        if religionInfo then
          cityData.MajorityReligion = Locale.ConvertTextKey(religionInfo.Description)
        end
      end

      -- Add visibility level 2 fields (will be filtered based on visibility)
      cityData.FoodStored = city:GetFood()
      cityData.FoodPerTurn = city:FoodDifference()
      cityData.ProductionStored = city:GetProduction()
      cityData.ProductionPerTurn = city:GetCurrentProductionDifference(false, false)

      -- Get yield rates
      cityData.GoldPerTurn = city:GetYieldRate(GameInfoTypes.YIELD_GOLD)
      cityData.SciencePerTurn = city:GetYieldRate(GameInfoTypes.YIELD_SCIENCE)
      cityData.CulturePerTurn = city:GetJONSCulturePerTurn()
      cityData.FaithPerTurn = city:GetFaithPerTurn()
      cityData.TourismPerTurn = city:GetBaseTourism()

      -- Get happiness
      cityData.LocalHappiness = city:GetLocalHappiness()

      -- Additional city status flags (visible at level 2)
      cityData.RazingTurns = city:IsRazing() and city:GetRazingTurns() or 0
      cityData.ResistanceTurns = city:IsResistance() and city:GetResistanceTurns() or 0

      -- Building and wonder counts
      cityData.BuildingCount = city:GetNumBuildings()
      cityData.WonderCount = city:GetNumWorldWonders() + city:GetNumNationalWonders()
      cityData.GreatWorkCount = city:GetNumGreatWorks()

      -- Trade route count (needs to be calculated)
      cityData.TradeRouteCount = 0  -- Will be calculated from trade route data if available

      -- Current production
      cityData.CurrentProduction = getProductionName(city)
      cityData.ProductionTurnsLeft = city:GetProductionTurnsLeft()

      -- Add visibility information for each player
      for otherPlayerID = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
        local otherPlayer = Players[otherPlayerID]
        if otherPlayer and otherPlayer:IsEverAlive() then
          local fieldName = "Player" .. otherPlayerID
          cityData[fieldName] = getCityVisibility(otherPlayerID, city)
        end
      end

      -- Add to results
      table.insert(cities, cityData)
    end
  end
end

return cities