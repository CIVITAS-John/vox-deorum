-- Get espionage info for AI accessibility
-- Returns spy locations, states, and intelligence
-- Addresses espionage gap identified in Issue #469

local pPlayer = Players[playerID]
if not pPlayer then
  return nil
end

local result = {
  -- Our spies
  Spies = {},

  -- City intelligence
  CityIntelligence = {},

  -- Intrigue messages
  IntrigueMessages = {},
}

-- Get our spies
local spies = pPlayer:GetEspionageSpies()
if spies then
  for i, spy in ipairs(spies) do
    local spyData = {
      Name = spy.Name,
      Rank = spy.Rank,
    }

    -- Location
    if spy.CityX and spy.CityY then
      local plot = Map.GetPlot(spy.CityX, spy.CityY)
      if plot then
        local city = plot:GetPlotCity()
        if city then
          spyData.Location = city:GetName()
          spyData.LocationOwner = Players[city:GetOwner()] and
                                  Players[city:GetOwner()]:GetCivilizationShortDescription() or "Unknown"
        end
      end
    end

    -- State
    if spy.IsDiplomat then
      spyData.State = "Diplomat"
    elseif spy.EstablishedSurveillance then
      spyData.State = "Surveillance"
    elseif spy.State == 0 then
      spyData.State = "Unassigned"
    elseif spy.State == 1 then
      spyData.State = "Travelling"
    elseif spy.State == 2 then
      spyData.State = "GatheringIntel"
    elseif spy.State == 3 then
      spyData.State = "RiggingElection"
    elseif spy.State == 4 then
      spyData.State = "CounterIntelligence"
    elseif spy.State == 5 then
      spyData.State = "StagingCoup"
    elseif spy.State == 6 then
      spyData.State = "Schmoozing"
    else
      spyData.State = "Unknown"
    end

    -- Progress for certain states
    if spy.TurnsInState then
      spyData.TurnsInState = spy.TurnsInState
    end

    table.insert(result.Spies, spyData)
  end
end

-- Get city espionage potential for cities we know about
for iPlayer = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
  local pLoopPlayer = Players[iPlayer]
  if pLoopPlayer and pLoopPlayer:IsAlive() and iPlayer ~= playerID then
    for city in pLoopPlayer:Cities() do
      -- Check if we've revealed this city
      local plot = city:Plot()
      if plot and plot:IsRevealed(pPlayer:GetTeam(), false) then
        local cityData = {
          CityName = city:GetName(),
          Owner = pLoopPlayer:GetCivilizationShortDescription(),
          Population = city:GetPopulation(),
        }

        -- Check if we have a spy there
        cityData.HasOurSpy = city:HasSpy(playerID)

        -- Get potential (based on population, tech level, etc.)
        -- Higher population = more potential
        cityData.EspionagePotential = city:GetPopulation() * 10

        -- Capital bonus
        if city:IsCapital() then
          cityData.EspionagePotential = cityData.EspionagePotential + 50
          cityData.IsCapital = true
        end

        table.insert(result.CityIntelligence, cityData)
      end
    end
  end
end

-- Get our own cities' counterintelligence
for city in pPlayer:Cities() do
  local cityData = {
    CityName = city:GetName(),
    Owner = "Us",
    HasOurSpy = city:HasSpy(playerID),
    IsOurCity = true,
  }

  table.insert(result.CityIntelligence, cityData)
end

-- Get intrigue messages (last 10)
local intrigueCount = pPlayer:GetNumIntrigueMessages()
local startIndex = math.max(0, intrigueCount - 10)
for i = startIndex, intrigueCount - 1 do
  local intrigue = pPlayer:GetIntrigueMessage(i)
  if intrigue then
    table.insert(result.IntrigueMessages, {
      Turn = intrigue.Turn,
      Message = intrigue.Message,
      SpyName = intrigue.SpyName,
    })
  end
end

return result
