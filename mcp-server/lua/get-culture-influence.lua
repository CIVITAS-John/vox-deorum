-- Get culture/tourism influence for AI accessibility
-- Returns influence levels, tourism, ideology
-- Addresses culture gap identified in Issue #469

local pPlayer = Players[playerID]
if not pPlayer then
  return nil
end

local result = {
  -- Our culture output
  OurCulturePerTurn = pPlayer:GetTotalJONSCulturePerTurn(),
  OurTourismPerTurn = pPlayer:GetTourism(),

  -- Our ideology
  OurIdeology = nil,
  IdeologyLevel = 0,

  -- Influence on others
  InfluenceOnOthers = {},

  -- Others' influence on us
  InfluenceOnUs = {},

  -- Public opinion
  PublicOpinion = "Content",
  PublicOpinionUnhappiness = pPlayer:GetUnhappinessFromPublicOpinion(),
  PreferredIdeology = nil,

  -- Great works summary
  GreatWorksCount = 0,
  ThemedBonuses = 0,

  -- Per-city culture
  CultureByCity = {},
}

-- Get our ideology
local ideologyBranch = pPlayer:GetLateGamePolicyTree()
if ideologyBranch >= 0 then
  local branchInfo = GameInfo.PolicyBranchTypes[ideologyBranch]
  if branchInfo then
    result.OurIdeology = Locale.ConvertTextKey(branchInfo.Description)
    -- Count tenets adopted
    for policy in GameInfo.Policies() do
      if policy.PolicyBranchType == branchInfo.Type and pPlayer:HasPolicy(policy.ID) then
        result.IdeologyLevel = result.IdeologyLevel + 1
      end
    end
  end
end

-- Get public opinion details
local publicOpinionType = pPlayer:GetPublicOpinionType()
if publicOpinionType == 1 then
  result.PublicOpinion = "Dissidents"
elseif publicOpinionType == 2 then
  result.PublicOpinion = "Civil Resistance"
elseif publicOpinionType == 3 then
  result.PublicOpinion = "Revolutionary Wave"
end

local preferredIdeology = pPlayer:GetPublicOpinionPreferredIdeology()
if preferredIdeology >= 0 then
  local branchInfo = GameInfo.PolicyBranchTypes[preferredIdeology]
  if branchInfo then
    result.PreferredIdeology = Locale.ConvertTextKey(branchInfo.Description)
  end
end

-- Get influence on each other civ
for iPlayer = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
  local pLoopPlayer = Players[iPlayer]
  if pLoopPlayer and pLoopPlayer:IsAlive() and iPlayer ~= playerID then
    -- Skip if we haven't met them
    if pPlayer:GetTeam():IsHasMet(pLoopPlayer:GetTeam()) then
      local influenceData = {
        CivName = pLoopPlayer:GetCivilizationShortDescription(),
        InfluencePercent = pPlayer:GetInfluenceOn(iPlayer),
        TheirCulturePerTurn = pLoopPlayer:GetTotalJONSCulturePerTurn(),
        TourismTowardThem = pPlayer:GetTourismPerTurnAgainst(iPlayer),
      }

      -- Determine influence level
      local percent = influenceData.InfluencePercent
      if percent < 10 then
        influenceData.InfluenceLevel = "Unknown"
      elseif percent < 30 then
        influenceData.InfluenceLevel = "Exotic"
      elseif percent < 60 then
        influenceData.InfluenceLevel = "Familiar"
      elseif percent < 100 then
        influenceData.InfluenceLevel = "Popular"
      elseif percent < 200 then
        influenceData.InfluenceLevel = "Influential"
      else
        influenceData.InfluenceLevel = "Dominant"
      end

      -- Estimate turns to next level
      if influenceData.TourismTowardThem > 0 and influenceData.TheirCulturePerTurn > 0 then
        local netTourism = influenceData.TourismTowardThem - (influenceData.TheirCulturePerTurn * 0.1)
        if netTourism > 0 then
          -- Rough estimate
          local nextThreshold = 0
          if percent < 30 then nextThreshold = 30
          elseif percent < 60 then nextThreshold = 60
          elseif percent < 100 then nextThreshold = 100
          elseif percent < 200 then nextThreshold = 200
          end

          if nextThreshold > percent then
            local remaining = nextThreshold - percent
            influenceData.TurnsToNextLevel = math.ceil(remaining / (netTourism / influenceData.TheirCulturePerTurn * 100))
          end
        end
      end

      table.insert(result.InfluenceOnOthers, influenceData)
    end
  end
end

-- Get others' influence on us
for iPlayer = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
  local pLoopPlayer = Players[iPlayer]
  if pLoopPlayer and pLoopPlayer:IsAlive() and iPlayer ~= playerID then
    if pPlayer:GetTeam():IsHasMet(pLoopPlayer:GetTeam()) then
      local percent = pLoopPlayer:GetInfluenceOn(playerID)
      if percent > 0 then
        local influenceData = {
          CivName = pLoopPlayer:GetCivilizationShortDescription(),
          InfluencePercent = percent,
        }

        if percent < 10 then
          influenceData.InfluenceLevel = "Unknown"
        elseif percent < 30 then
          influenceData.InfluenceLevel = "Exotic"
        elseif percent < 60 then
          influenceData.InfluenceLevel = "Familiar"
        elseif percent < 100 then
          influenceData.InfluenceLevel = "Popular"
        elseif percent < 200 then
          influenceData.InfluenceLevel = "Influential"
        else
          influenceData.InfluenceLevel = "Dominant"
        end

        table.insert(result.InfluenceOnUs, influenceData)
      end
    end
  end
end

-- Count great works
for city in pPlayer:Cities() do
  result.GreatWorksCount = result.GreatWorksCount + city:GetNumGreatWorks()

  -- Per-city culture
  table.insert(result.CultureByCity, {
    Name = city:GetName(),
    CulturePerTurn = city:GetJONSCulturePerTurn(),
    TourismPerTurn = city:GetBaseTourism() / 100,
    GreatWorks = city:GetNumGreatWorks(),
  })
end

return result
