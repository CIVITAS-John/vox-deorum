-- Get trade route info for AI accessibility
-- Returns active routes with yields
-- Addresses trade route gap identified in Issue #469

local pPlayer = Players[playerID]
if not pPlayer then
  return nil
end

local result = {
  -- Summary
  TotalRoutes = pPlayer:GetNumInternationalTradeRoutesUsed(),
  AvailableSlots = pPlayer:GetNumInternationalTradeRoutesAvailable() - pPlayer:GetNumInternationalTradeRoutesUsed(),
  MaxRoutes = pPlayer:GetNumInternationalTradeRoutesAvailable(),

  -- Active routes
  ActiveRoutes = {},

  -- Idle trade units (can establish new routes)
  IdleTradeUnits = {},
}

-- Get all trade routes
local tradeRoutes = pPlayer:GetTradeRoutes()
for i, route in ipairs(tradeRoutes) do
  local fromCity = pPlayer:GetCityByID(route.FromID)
  local toPlayer = Players[route.ToPlayerID]
  local toCity = toPlayer and toPlayer:GetCityByID(route.ToID) or nil

  if fromCity and toCity then
    local routeData = {
      Domain = route.Domain == GameInfoTypes.DOMAIN_SEA and "Sea" or "Land",
      FromCity = fromCity:GetName(),
      ToCity = toCity:GetName(),
      ToCiv = toPlayer:GetCivilizationShortDescription(),

      TurnsRemaining = route.TurnsLeft,

      -- Is it internal?
      IsInternal = route.ToPlayerID == playerID,
    }

    -- Get yields
    -- Gold yields
    routeData.FromGold = route.FromGPT or 0
    routeData.ToGold = route.ToGPT or 0

    -- Food/Production (internal routes)
    if routeData.IsInternal then
      routeData.FromFood = route.FromFood or 0
      routeData.FromProduction = route.FromProduction or 0
    end

    -- Science from tech difference
    routeData.FromScience = route.FromScience or 0
    routeData.ToScience = route.ToScience or 0

    -- Religious pressure
    routeData.FromReligiousPressure = route.FromReligiousPressure or 0
    routeData.ToReligiousPressure = route.ToReligiousPressure or 0

    table.insert(result.ActiveRoutes, routeData)
  end
end

-- Find idle trade units
for pUnit in pPlayer:Units() do
  local unitInfo = GameInfo.Units[pUnit:GetUnitType()]
  if unitInfo and unitInfo.Trade then
    -- Check if this unit has moves and isn't on a route
    if pUnit:GetMoves() > 0 and not pUnit:IsTrade() then
      local plot = pUnit:GetPlot()
      local city = plot and plot:GetPlotCity() or nil

      table.insert(result.IdleTradeUnits, {
        ID = pUnit:GetID(),
        Name = Locale.ConvertTextKey(unitInfo.Description),
        X = pUnit:GetX(),
        Y = pUnit:GetY(),
        InCity = city and city:GetName() or nil,
        Domain = unitInfo.Domain == "DOMAIN_SEA" and "Sea" or "Land",
      })
    end
  end
end

return result
