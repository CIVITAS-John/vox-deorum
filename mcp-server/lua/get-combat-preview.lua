-- Get combat preview for AI accessibility
-- Returns combat predictions for attacker vs potential targets
-- Addresses combat prediction gap identified in Issue #469

-- Input parameters:
-- playerID: Player perspective
-- attackerUnitID: (optional) Specific attacker unit ID
-- defenderUnitID: (optional) Specific defender unit ID
-- showAllTargets: (optional) If true, show all valid targets for the attacker

local results = {}
local pPlayer = Players[playerID]

if not pPlayer then
  return results
end

local ourTeam = pPlayer:GetTeam()

-- Helper: Get unit owner name
local function getOwnerName(unit)
  local ownerID = unit:GetOwner()
  local owner = Players[ownerID]
  if not owner then return "Unknown" end

  if owner:IsMinorCiv() then
    return "City-State " .. owner:GetName()
  elseif owner:IsBarbarian() then
    return "Barbarians"
  else
    return owner:GetCivilizationShortDescription()
  end
end

-- Helper: Get unit info
local function getUnitInfo(unit)
  local unitInfo = GameInfo.Units[unit:GetUnitType()]
  local name = unitInfo and Locale.ConvertTextKey(unitInfo.Description) or "Unknown"

  return {
    ID = unit:GetID(),
    Name = name,
    Owner = getOwnerName(unit),
    X = unit:GetX(),
    Y = unit:GetY(),
    CurrentHP = unit:GetCurrHitPoints(),
    MaxHP = unit:GetMaxHitPoints(),
    BaseStrength = unit:GetBaseCombatStrength(),
    RangedStrength = unit:GetBaseRangedCombatStrength(),
    Moves = unit:GetMoves() / GameDefines.MOVE_DENOMINATOR,
    MaxMoves = unit:MaxMoves() / GameDefines.MOVE_DENOMINATOR,
  }
end

-- Helper: Convert combat prediction enum to string
local function predictionToString(prediction)
  -- CombatPredictionTypes enum values
  local predictions = {
    [0] = "Ranged",       -- No counter damage
    [1] = "Stalemate",
    [2] = "TotalDefeat",
    [3] = "TotalVictory",
    [4] = "MajorVictory",
    [5] = "SmallVictory",
    [6] = "MajorDefeat",
    [7] = "SmallDefeat",
  }
  return predictions[prediction] or "Unknown"
end

-- Helper: Assess risk level
local function assessRisk(prediction, attackerWouldDie, defenderWouldDie)
  if attackerWouldDie then
    return "Suicidal"
  elseif prediction == 2 or prediction == 6 then -- TotalDefeat or MajorDefeat
    return "Dangerous"
  elseif prediction == 7 or prediction == 1 then -- SmallDefeat or Stalemate
    return "Risky"
  elseif prediction == 5 then -- SmallVictory
    return "Favorable"
  else -- TotalVictory, MajorVictory, Ranged
    return "Safe"
  end
end

-- Helper: Get combat modifiers for a unit
local function getModifiers(unit, isAttacker, plot, enemyUnit)
  local modifiers = {}

  -- Terrain modifiers
  if not isAttacker and plot then
    if plot:IsHills() then
      table.insert(modifiers, { Source = "Hills", Value = 25 })
    end
    if plot:IsRiver() then
      table.insert(modifiers, { Source = "River Defense", Value = 10 })
    end
    local featureType = plot:GetFeatureType()
    if featureType >= 0 then
      local featureInfo = GameInfo.Features[featureType]
      if featureInfo and featureInfo.Defense and featureInfo.Defense > 0 then
        table.insert(modifiers, { Source = Locale.ConvertTextKey(featureInfo.Description), Value = featureInfo.Defense })
      end
    end
  end

  -- Health penalty
  local healthPercent = (unit:GetCurrHitPoints() / unit:GetMaxHitPoints()) * 100
  if healthPercent < 100 then
    local penalty = math.floor((100 - healthPercent) / 2)
    if penalty > 0 then
      table.insert(modifiers, { Source = "Damaged", Value = -penalty })
    end
  end

  -- Flanking (simplified - check for adjacent friendly units)
  if isAttacker and enemyUnit then
    local enemyPlot = enemyUnit:GetPlot()
    if enemyPlot then
      local flankingBonus = 0
      for direction = 0, 5 do
        local adjPlot = Map.PlotDirection(enemyPlot:GetX(), enemyPlot:GetY(), direction)
        if adjPlot then
          local numUnits = adjPlot:GetNumUnits()
          for i = 0, numUnits - 1 do
            local adjUnit = adjPlot:GetUnit(i)
            if adjUnit and adjUnit:GetOwner() == unit:GetOwner() and adjUnit:GetID() ~= unit:GetID() then
              if adjUnit:GetBaseCombatStrength() > 0 then
                flankingBonus = flankingBonus + 10
              end
            end
          end
        end
      end
      if flankingBonus > 0 then
        table.insert(modifiers, { Source = "Flanking", Value = math.min(flankingBonus, 50) })
      end
    end
  end

  return modifiers
end

-- Helper: Calculate combat preview between two units
local function getCombatPreview(attacker, defender)
  -- Get basic prediction
  local prediction = Game.GetCombatPrediction(attacker, defender)
  local predictionStr = predictionToString(prediction)

  -- Calculate damage
  local attackerStrength = attacker:GetMaxAttackStrength(attacker:GetPlot(), defender:GetPlot(), defender)
  local defenderStrength = defender:GetMaxDefenseStrength(defender:GetPlot(), attacker, attacker:GetPlot(), false)

  local damageToDefender = 0
  local damageToAttacker = 0

  local isRanged = attacker:GetBaseRangedCombatStrength() > 0 and attacker:IsRangeAttackIgnoreLOS() == false

  if isRanged then
    -- Ranged attack - use ranged combat damage
    damageToDefender = attacker:GetRangeCombatDamage(defender, nil, false)
    damageToAttacker = 0 -- No counter-attack from ranged
  else
    -- Melee attack
    damageToDefender = attacker:GetMeleeCombatDamage(attackerStrength, defenderStrength, false, defender, 0)
    damageToAttacker = defender:GetMeleeCombatDamage(defenderStrength, attackerStrength, false, attacker, 0)
  end

  -- Would they die?
  local defenderWouldDie = damageToDefender >= defender:GetCurrHitPoints()
  local attackerWouldDie = damageToAttacker >= attacker:GetCurrHitPoints()

  -- Get modifiers
  local attackerModifiers = getModifiers(attacker, true, attacker:GetPlot(), defender)
  local defenderModifiers = getModifiers(defender, false, defender:GetPlot(), attacker)

  return {
    Attacker = getUnitInfo(attacker),
    Defender = {
      ID = defender:GetID(),
      Name = getUnitInfo(defender).Name,
      Type = "Unit",
      Owner = getOwnerName(defender),
      X = defender:GetX(),
      Y = defender:GetY(),
      CurrentHP = defender:GetCurrHitPoints(),
      MaxHP = defender:GetMaxHitPoints(),
      BaseStrength = defender:GetBaseCombatStrength(),
    },
    Prediction = predictionStr,
    ExpectedDamageToDefender = damageToDefender,
    ExpectedDamageToAttacker = damageToAttacker,
    DefenderWouldDie = defenderWouldDie,
    AttackerWouldDie = attackerWouldDie,
    RiskLevel = assessRisk(prediction, attackerWouldDie, defenderWouldDie),
    IsRanged = isRanged,
    CanCounterAttack = not isRanged and defender:GetBaseCombatStrength() > 0,
    AttackerModifiers = attackerModifiers,
    DefenderModifiers = defenderModifiers,
  }
end

-- Helper: Get all valid attack targets for a unit
local function getValidTargets(attacker)
  local targets = {}
  local attackerPlot = attacker:GetPlot()
  if not attackerPlot then return targets end

  local range = attacker:GetRange()
  if range == 0 then range = 1 end -- Melee units

  -- Check tiles in range
  local attackerX = attacker:GetX()
  local attackerY = attacker:GetY()

  for dx = -range, range do
    for dy = -range, range do
      local distance = math.max(math.abs(dx), math.abs(dy), math.abs(dx + dy))
      if distance <= range and distance > 0 then
        local x = attackerX + dx
        local y = attackerY + dy

        local plot = Map.GetPlot(x, y)
        if plot and plot:IsVisible(ourTeam, false) then
          -- Check for enemy units
          local numUnits = plot:GetNumUnits()
          for i = 0, numUnits - 1 do
            local unit = plot:GetUnit(i)
            if unit and not unit:IsInvisible(ourTeam, false) then
              local unitOwner = unit:GetOwner()
              -- Is this an enemy?
              if Teams[ourTeam]:IsAtWar(Players[unitOwner]:GetTeam()) then
                table.insert(targets, unit)
              end
            end
          end
        end
      end
    end
  end

  return targets
end

-- Main logic
if attackerUnitID then
  -- Get specific attacker
  local attacker = pPlayer:GetUnitByID(attackerUnitID)
  if not attacker then
    return results
  end

  if defenderUnitID then
    -- Specific attacker vs specific defender
    -- Find the defender unit (could belong to any player)
    local defender = nil
    for iPlayer = 0, GameDefines.MAX_PLAYERS - 1 do
      local pLoopPlayer = Players[iPlayer]
      if pLoopPlayer and pLoopPlayer:IsAlive() then
        local unit = pLoopPlayer:GetUnitByID(defenderUnitID)
        if unit then
          defender = unit
          break
        end
      end
    end

    if defender then
      table.insert(results, getCombatPreview(attacker, defender))
    end
  elseif showAllTargets then
    -- Get all valid targets for this attacker
    local targets = getValidTargets(attacker)
    for _, defender in ipairs(targets) do
      table.insert(results, getCombatPreview(attacker, defender))
    end
  end
end

return results
