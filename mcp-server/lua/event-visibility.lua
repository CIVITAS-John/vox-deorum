local visibilityFlags = {}
local invalidations = {}
local extraPayloads = {}
local scannedPlayers = {}
local maxMajorCivs = ${MaxMajorCivs} - 1

-- Initialize visibility flags for all players
for i = 0, maxMajorCivs do
  table.insert(visibilityFlags, 0)
end

-- Helper function to add an extra payload
local function addPayload(key, value)
  if key ~= nil then
    extraPayloads[string.sub(key, 1, -3)] = value
  end
end

-- Helper function to mark player as able to see the event
local function setVisible(playerID, value)
  -- For visibility, we only care about major civs
  if playerID <= ${MaxMajorCivs} and visibilityFlags[playerID + 1] < value then
    visibilityFlags[playerID + 1] = value
  end
end

-- Helper function to add team-based visibility
local function addTeam(teamID, value, key)
  if teamID < 0 then return end

  -- Invalidate the team's cached metadata
  invalidations["Team_" .. teamID] = true

  -- All team players should have the same visibility
  local metadata = {}
  for otherID = 0, maxMajorCivs do
    local otherPlayer = Players[otherID]
    if otherPlayer and otherPlayer:GetTeam() == teamID then
      metadata["Player_" .. otherID] = otherPlayer:GetName()
      setVisible(otherID, value)
    end
  end

  -- Add to the extra payload
  addPayload(key, metadata)
end

-- Helper function to add met leaders visibility
local function addMetPlayer(playerID, value)
  local player = Players[playerID]
  if not player then return end
  
  local teamID = player:GetTeam()
  for otherID = 0, maxMajorCivs do
    local otherPlayer = Players[otherID]
    if otherPlayer then
      local otherTeam = Teams[otherPlayer:GetTeam()]
      if otherTeam and otherTeam:IsHasMet(teamID) then
        setVisible(otherID, value)
      end
    end
  end
end

-- Helper function to add player-based visibility
local function addPlayer(playerID, value, key)
  -- Check if player exists
  local player = Players[playerID]
  if not player then return end

  -- Invalidate the player's cached metadata
  invalidations["Player_" .. playerID] = true

  -- Team members can see each other's events
  addTeam(player:GetTeam(), value)

  -- Get the succinct metadata for the player
  if key ~= nil then
    local metadata = {}
    metadata["Name"] = player:GetName()
    metadata["Civilization"] = Locale.ConvertTextKey(GameInfo.Civilizations[player:GetCivilizationType()].ShortDescription)
    addPayload(key, metadata)
    table.insert(scannedPlayers, player)
  end
end

-- Helper function to handle plot-based visibility
local function addPlotVisibility(plotX, plotY, value, key)
  if plotX < 0 or plotY < 0 then return end
  
  local plot = Map.GetPlot(plotX, plotY)
  if not plot then return end
  
  -- Check visibility for all players
  -- Except for TileRevealed, which doesn't make sense
  if eventType ~= "TileRevealed" then
    for playerID = 0, maxMajorCivs do
      local player = Players[playerID]
      local teamID = player:GetTeam()
      -- Check if plot is revealed to this team
      if player:IsAlive() and plot:IsRevealed(teamID) then
        if plot:IsVisible(teamID) then
          setVisible(playerID, value)
        else
          setVisible(playerID, math.min(value - 1, 1))  -- Reduced visibility if revealed but not visible
        end
      end
    end
  end
  
  -- Get the succinct metadata for the player
  if key ~= nil then
    local metadata = {}

    -- Try to get its owner
    local owner = Players[plot:GetOwner()]
    if owner ~= nil then
      -- Use Civilization name for major civs, Player name for minor civs
      if owner:IsMinorCiv() then
        metadata["Owner"] = owner:GetName()
      else
        metadata["Owner"] = Locale.ConvertTextKey(GameInfo.Civilizations[owner:GetCivilizationType()].ShortDescription)
      end
      -- City
      local city = owner:GetCityByID(plot:GetPlotCity())
      if city ~= nil then
        metadata["City"] = city:GetName()
        metadata["CityID"] = city:GetID()
        metadata["Population"] = city:GetPopulation()
        metadata["ReligionID"] = city:GetReligiousMajority()
      end
    end

    -- Terrain
    metadata["PlotType"] = plot:GetPlotType()
    metadata["IsRiver"] = plot:IsRiver()
    metadata["ResourceType"] = plot:GetResourceType(-1)
    metadata["RouteType"] = plot:GetRouteType()
    metadata["FeatureType"] = plot:GetFeatureType()
    metadata["FeatureType"] = plot:GetFeatureType()
    metadata["ImprovementType"] = plot:GetImprovementType()

    addPayload(key, metadata)
    table.insert(scannedPlayers, owner)
  end
end

-- Helper function to add unit-based visibility
local function addUnit(unitID, value, key)
  -- Check if the unit exists
  if unitID < 0 then return end

  -- Find the unit's owner
  local unit = nil
  for _, player in pairs(scannedPlayers) do
    unit = player:GetUnitByID(unitID)
    if unit ~= nil then
      break
    end
  end
  if unit == nil then return end

  -- Check if unit is visible to other players based on plot visibility
  local plotX = unit:GetX()
  local plotY = unit:GetY()
  addPlotVisibility(plotX, plotY, value)

  -- Get unit metadata
  if key ~= nil then
    local metadata = {}
    metadata["UnitType"] = unit:GetUnitType()
    metadata["AIType"] = unit:GetUnitAIType()
    metadata["Hp"] = unit:GetCurrHitPoints()
    metadata["MaxHp"] = unit:GetMaxHitPoints()
    metadata["Level"] = unit:GetLevel()
    addPayload(key, metadata)
  end
  
  -- Invalidate the unit's cached metadata
  invalidations["Unit_" .. unitID] = true
end

-- Helper function to add city-based visibility
local function addCity(cityID, value, key)
  -- Check if the city exists
  if cityID < 0 then return end

  -- Find the city's owner
  local city = nil
  for _, player in pairs(scannedPlayers) do
    city = player:GetCityByID(cityID)
    if city ~= nil then
      break
    end
  end
  
  -- Check if city is visible to other players based on plot visibility
  local plotX = city:GetX()
  local plotY = city:GetY()
  addPlotVisibility(plotX, plotY, value)

  -- Get city metadata
  if key ~= nil then
    local metadata = {}
    metadata["Name"] = city:GetName()
    metadata["Population"] = city:GetPopulation()
    metadata["ReligionID"] = city:GetReligiousMajority()
    metadata["Hp"] = city:GetMaxHitPoints() - city:GetDamage()
    metadata["MaxHp"] = city:GetMaxHitPoints()
    addPayload(key, metadata)
  end
  
  -- Invalidate the city's cached metadata
  invalidations["City_" .. cityID] = true
end

-- Analyze visibility based on event type and payload
for key, value in pairs(payload) do
  -- Check for player-related fields in payload
  if (string.match(key, "PlayerID$") or string.match(key, "OwnerID$")) then
    addPlayer(value, 2, key)
  end
  
  -- Check for team-related fields in payload
  if string.match(key, "TeamID$") then
    addTeam(value, 2, key)
  end
  
  -- Handle plot coordinates for visibility
  if string.match(key, "X$") then
    local plotY = payload[string.sub(key, 1, -2) .. "Y"]
    if plotY then
      addPlotVisibility(value, plotY, 2, key .. "$")
    end
  end
end

-- A second round for units/cities
for key, value in pairs(payload) do
  -- Check for unit-related fields in payload
  if string.match(key, "UnitID$") then
    addUnit(value, 2, key)
  end
  
  -- Check for city-related fields in payload
  if string.match(key, "CityID$") then
    addCity(value, 2, key)
  end
end

return {visibilityFlags, invalidations, extraPayloads}