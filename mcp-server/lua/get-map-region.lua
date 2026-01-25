-- Get map region data for AI accessibility
-- Returns terrain, features, resources, improvements for specified tiles
-- Addresses spatial awareness gap identified in Issue #469

-- Input parameters (passed from TypeScript):
-- centerX, centerY: Center coordinates for radius query
-- radius: Tiles around center to query (max 10)
-- playerID: Player perspective for visibility filtering

local tiles = {}
local pPlayer = Players[playerID]
local ourTeam = pPlayer and pPlayer:GetTeam() or -1

-- Helper: Get terrain name from type ID
local function getTerrainName(terrainType)
  if terrainType < 0 then return nil end
  local terrainInfo = GameInfo.Terrains[terrainType]
  if terrainInfo then
    return Locale.ConvertTextKey(terrainInfo.Description)
  end
  return nil
end

-- Helper: Get feature name from type ID
local function getFeatureName(featureType)
  if featureType < 0 then return nil end
  local featureInfo = GameInfo.Features[featureType]
  if featureInfo then
    return Locale.ConvertTextKey(featureInfo.Description)
  end
  return nil
end

-- Helper: Get resource info
local function getResourceInfo(plot, playerID)
  local resourceType = plot:GetResourceType(ourTeam)
  if resourceType < 0 then return nil, nil, nil, nil end

  local resourceInfo = GameInfo.Resources[resourceType]
  if not resourceInfo then return nil, nil, nil, nil end

  local name = Locale.ConvertTextKey(resourceInfo.Description)
  local quantity = plot:GetNumResource()

  -- Determine resource class (Bonus, Strategic, Luxury)
  local resourceClass = "Bonus"
  if resourceInfo.ResourceClassType == "RESOURCECLASS_LUXURY" then
    resourceClass = "Luxury"
  elseif resourceInfo.ResourceClassType == "RESOURCECLASS_MODERN" or
         resourceInfo.ResourceClassType == "RESOURCECLASS_RUSH" then
    resourceClass = "Strategic"
  end

  -- Check if improved
  local improvementType = plot:GetImprovementType()
  local isImproved = false
  if improvementType >= 0 then
    -- Check if this improvement works the resource
    local improvementInfo = GameInfo.Improvements[improvementType]
    if improvementInfo then
      for row in GameInfo.Improvement_ResourceTypes() do
        if row.ImprovementType == improvementInfo.Type and row.ResourceType == resourceInfo.Type then
          isImproved = true
          break
        end
      end
    end
  end

  return name, quantity, resourceClass, isImproved
end

-- Helper: Get improvement name
local function getImprovementName(improvementType)
  if improvementType < 0 then return nil end
  local improvementInfo = GameInfo.Improvements[improvementType]
  if improvementInfo then
    return Locale.ConvertTextKey(improvementInfo.Description)
  end
  return nil
end

-- Helper: Get route type
local function getRouteName(routeType)
  if routeType < 0 then return nil end
  local routeInfo = GameInfo.Routes[routeType]
  if routeInfo then
    return Locale.ConvertTextKey(routeInfo.Description)
  end
  return nil
end

-- Helper: Get owner name
local function getOwnerName(plot)
  local ownerID = plot:GetOwner()
  if ownerID < 0 then return nil end

  local owner = Players[ownerID]
  if not owner then return nil end

  if owner:IsMinorCiv() then
    return "City-State " .. owner:GetName()
  elseif owner:IsBarbarian() then
    return "Barbarians"
  else
    return owner:GetCivilizationShortDescription()
  end
end

-- Helper: Get visibility level
local function getVisibility(plot)
  if not pPlayer then return "Unknown" end

  if plot:IsVisible(ourTeam, false) then
    return "Visible"
  elseif plot:IsRevealed(ourTeam, false) then
    return "Revealed"
  else
    return "Hidden"
  end
end

-- Helper: Get units on plot (if visible)
local function getUnitsOnPlot(plot)
  if not plot:IsVisible(ourTeam, false) then return nil end

  local units = {}
  local numUnits = plot:GetNumUnits()

  for i = 0, numUnits - 1 do
    local pUnit = plot:GetUnit(i)
    if pUnit and not pUnit:IsInvisible(ourTeam, false) then
      local unitOwner = Players[pUnit:GetOwner()]
      local ownerName = "Unknown"
      if unitOwner then
        if unitOwner:IsMinorCiv() then
          ownerName = "City-State"
        elseif unitOwner:IsBarbarian() then
          ownerName = "Barbarians"
        else
          ownerName = unitOwner:GetCivilizationShortDescription()
        end
      end

      local unitInfo = GameInfo.Units[pUnit:GetUnitType()]
      local unitName = unitInfo and Locale.ConvertTextKey(unitInfo.Description) or "Unknown Unit"

      table.insert(units, {
        Name = unitName,
        Owner = ownerName,
        Strength = pUnit:GetBaseCombatStrength(),
        RangedStrength = pUnit:GetBaseRangedCombatStrength(),
        Health = math.floor((pUnit:GetCurrHitPoints() / pUnit:GetMaxHitPoints()) * 100)
      })
    end
  end

  return #units > 0 and units or nil
end

-- Helper: Calculate defense modifier for plot
local function getDefenseModifier(plot)
  local modifier = 0

  -- Hills give defense bonus
  if plot:IsHills() then
    modifier = modifier + 25
  end

  -- Features can give defense
  local featureType = plot:GetFeatureType()
  if featureType >= 0 then
    local featureInfo = GameInfo.Features[featureType]
    if featureInfo and featureInfo.Defense then
      modifier = modifier + featureInfo.Defense
    end
  end

  -- River crossing penalty (for attackers, shown as defender bonus)
  if plot:IsRiver() then
    modifier = modifier + 10
  end

  return modifier
end

-- Helper: Calculate movement cost
local function getMovementCost(plot)
  local cost = 1

  -- Hills cost extra
  if plot:IsHills() then
    cost = cost + 1
  end

  -- Features can add cost
  local featureType = plot:GetFeatureType()
  if featureType >= 0 then
    local featureInfo = GameInfo.Features[featureType]
    if featureInfo and featureInfo.Movement then
      cost = cost + featureInfo.Movement
    end
  end

  -- Rivers add cost when crossing
  if plot:IsRiver() then
    cost = cost + 1
  end

  return cost
end

-- Clamp radius
if radius > 10 then radius = 10 end
if radius < 1 then radius = 1 end

-- Get map dimensions
local mapWidth = Map.GetGridSize()
local mapHeight = Map.GetGridSize()

-- Iterate through tiles in radius
for dx = -radius, radius do
  for dy = -radius, radius do
    -- Hex distance check
    local distance = math.max(math.abs(dx), math.abs(dy), math.abs(dx + dy))
    if distance <= radius then
      local x = centerX + dx
      local y = centerY + dy

      -- Wrap x coordinate if needed (cylindrical map)
      if x < 0 then x = x + mapWidth end
      if x >= mapWidth then x = x - mapWidth end

      -- Skip if y is out of bounds
      if y >= 0 and y < mapHeight then
        local plot = Map.GetPlot(x, y)

        if plot then
          local visibility = getVisibility(plot)

          -- Only include visible or revealed tiles
          if visibility ~= "Hidden" then
            local tileData = {
              X = x,
              Y = y,
              Visibility = visibility
            }

            -- Terrain (always available for revealed tiles)
            tileData.Terrain = getTerrainName(plot:GetTerrainType())
            tileData.IsHills = plot:IsHills()
            tileData.IsMountain = plot:IsMountain()
            tileData.Feature = getFeatureName(plot:GetFeatureType())

            -- Water info
            tileData.IsRiver = plot:IsRiver()
            tileData.IsFreshWater = plot:IsFreshWater()
            tileData.IsLake = plot:IsLake()
            tileData.IsCoastal = plot:IsCoastalLand()

            -- Resource info
            local resName, resQty, resClass, resImproved = getResourceInfo(plot, playerID)
            if resName then
              tileData.Resource = resName
              tileData.ResourceQuantity = resQty
              tileData.ResourceClass = resClass
              tileData.ResourceImproved = resImproved
            end

            -- Improvement info
            local improvementType = plot:GetImprovementType()
            if improvementType >= 0 then
              tileData.Improvement = getImprovementName(improvementType)
              tileData.ImprovementPillaged = plot:IsImprovementPillaged()
            end

            -- Route info
            local routeType = plot:GetRouteType()
            if routeType >= 0 then
              tileData.Route = getRouteName(routeType)
              tileData.RoutePillaged = plot:IsRoutePillaged()
            end

            -- Ownership
            tileData.Owner = getOwnerName(plot)

            -- City on this tile
            local city = plot:GetPlotCity()
            if city then
              tileData.City = city:GetName()
            end

            -- Working city (if owned by us)
            local workingCity = plot:GetWorkingCity()
            if workingCity and workingCity:GetOwner() == playerID then
              tileData.WorkedByCity = workingCity:GetName()
            end

            -- Units (only if visible)
            if visibility == "Visible" then
              tileData.Units = getUnitsOnPlot(plot)
            end

            -- Combat modifiers
            tileData.DefenseModifier = getDefenseModifier(plot)
            tileData.MovementCost = getMovementCost(plot)

            -- Yields (if we own or can see details)
            if visibility == "Visible" then
              tileData.Yields = {
                Food = plot:GetYield(GameInfoTypes.YIELD_FOOD),
                Production = plot:GetYield(GameInfoTypes.YIELD_PRODUCTION),
                Gold = plot:GetYield(GameInfoTypes.YIELD_GOLD),
                Science = plot:GetYield(GameInfoTypes.YIELD_SCIENCE),
                Culture = plot:GetYield(GameInfoTypes.YIELD_CULTURE),
                Faith = plot:GetYield(GameInfoTypes.YIELD_FAITH)
              }
            end

            table.insert(tiles, tileData)
          end
        end
      end
    end
  end
end

return tiles
