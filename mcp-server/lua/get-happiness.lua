-- Get happiness breakdown for AI accessibility
-- Returns full happiness/unhappiness sources
-- Addresses happiness gap identified in Issue #469

local pPlayer = Players[playerID]
if not pPlayer then
  return nil
end

local result = {
  -- Totals
  TotalHappiness = pPlayer:GetHappiness(),
  TotalUnhappiness = pPlayer:GetUnhappiness(),
  NetHappiness = pPlayer:GetExcessHappiness(),

  -- Happiness sources
  HappinessSources = {
    FromCities = pPlayer:GetHappinessFromCities(),
    FromTradeRoutes = pPlayer:GetHappinessFromTradeRoutes(),
    FromReligion = pPlayer:GetHappinessFromReligion(),
    FromNaturalWonders = pPlayer:GetHappinessFromNaturalWonders(),
    FromMinorCivs = pPlayer:GetHappinessFromMinorCivs(),
    FromLeagues = pPlayer:GetHappinessFromLeagues(),
    FromVassals = pPlayer:GetHappinessFromVassals(),
    FromLuxuries = pPlayer:GetHappinessFromResources(),
    FromPolicies = pPlayer:GetHappinessFromPolicies(),
    FromBuildings = pPlayer:GetHappinessFromBuildings(),
    FromExtraHappinessPerCity = pPlayer:GetExtraHappinessPerCity() * pPlayer:GetNumCities(),
  },

  -- Unhappiness sources
  UnhappinessSources = {
    FromCities = pPlayer:GetUnhappinessFromCityCount(),
    FromPopulation = pPlayer:GetUnhappinessFromCityPopulation(),
    FromOccupation = pPlayer:GetUnhappinessFromOccupiedCities(),
    FromPublicOpinion = pPlayer:GetUnhappinessFromPublicOpinion(),
    FromUnits = pPlayer:GetUnhappinessFromUnits(),
    FromCitySpecialists = pPlayer:GetUnhappinessFromCitySpecialists(),
    FromWarWeariness = pPlayer:GetUnhappinessFromWarWeariness(),
  },

  -- Golden Age info
  IsGoldenAge = pPlayer:IsGoldenAge(),
  GoldenAgeProgress = pPlayer:GetGoldenAgeProgressMeter(),
  GoldenAgeThreshold = pPlayer:GetGoldenAgeProgressThreshold(),
  GoldenAgeTurnsLeft = pPlayer:GetGoldenAgeTurns(),

  -- Per-city breakdown
  CityHappiness = {},

  -- Warnings
  Warnings = {},
}

-- Calculate turns to golden age if not in one
if not result.IsGoldenAge and result.NetHappiness > 0 then
  local remaining = result.GoldenAgeThreshold - result.GoldenAgeProgress
  result.TurnsToGoldenAge = math.ceil(remaining / result.NetHappiness)
end

-- Per-city happiness
for city in pPlayer:Cities() do
  local cityData = {
    Name = city:GetName(),
    LocalHappiness = city:GetLocalHappiness(),
    Unhappiness = city:GetUnhappinessFromCulture() + city:GetUnhappinessFromDefense() +
                  city:GetUnhappinessFromGold() + city:GetUnhappinessFromScience() +
                  city:GetUnhappinessFromConnection(),
  }

  -- Check for resistance
  if city:IsResistance() then
    cityData.IsResistance = true
    cityData.ResistanceTurns = city:GetResistanceTurns()
  end

  -- Check for occupation
  if city:IsOccupied() and not city:IsNoOccupiedUnhappiness() then
    cityData.IsOccupied = true
  end

  -- Check for WLTKD
  if city:GetWeLoveTheKingDayCounter() > 0 then
    cityData.WLTKD = city:GetWeLoveTheKingDayCounter()
  end

  table.insert(result.CityHappiness, cityData)
end

-- Generate warnings
if result.NetHappiness < 0 then
  table.insert(result.Warnings, "Empire is unhappy! Growth and combat effectiveness reduced.")
end

if result.NetHappiness < -10 then
  table.insert(result.Warnings, "Very unhappy! Risk of rebels spawning.")
end

local publicOpinionUnhappiness = pPlayer:GetUnhappinessFromPublicOpinion()
if publicOpinionUnhappiness > 0 then
  local preferredIdeology = pPlayer:GetPublicOpinionPreferredIdeology()
  if preferredIdeology >= 0 then
    local ideologyInfo = GameInfo.PolicyBranchTypes[preferredIdeology]
    if ideologyInfo then
      table.insert(result.Warnings, "Public opinion unhappiness: People prefer " ..
        Locale.ConvertTextKey(ideologyInfo.Description))
    end
  end
end

-- Count cities in resistance
local resistanceCount = 0
for city in pPlayer:Cities() do
  if city:IsResistance() then
    resistanceCount = resistanceCount + 1
  end
end
if resistanceCount > 0 then
  table.insert(result.Warnings, resistanceCount .. " cities in resistance")
end

return result
