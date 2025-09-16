-- Get an overview of all visible units for a given player
-- Groups units by civilization owner and AI type
local pPlayer = Players[playerID]
if not pPlayer or not pPlayer:IsAlive() then
    return nil, "Player " .. tostring(playerID) .. " is not valid or not alive"
end

local unitsByOwner = {}

-- Iterate through all players to find their units
for iPlayerLoop = 0, GameDefines.MAX_PLAYERS - 1 do
    local pLoopPlayer = Players[iPlayerLoop]

    -- Check if this player exists and has units
    if pLoopPlayer and pLoopPlayer:IsAlive() then
        local civName = nil
        local unitsForThisCiv = {}

        -- Iterate through all units of this player
        for pUnit in pLoopPlayer:Units() do
            -- Check if the unit's plot is visible to our player
            local pPlot = pUnit:GetPlot()
            if pPlot and pPlot:IsVisible(pPlayer:GetTeam(), false) then
                -- Get civilization name lazily (only when we find a visible unit)
                if not civName then
                    if pLoopPlayer:IsMinorCiv() then
                        civName = "City-States"
                    elseif pLoopPlayer:IsBarbarian() then
                        civName = "Barbarians"
                    else
                        civName = pLoopPlayer:GetCivilizationShortDescription()
                    end
                end

                -- Count this unit
                local aiType = pUnit:GetUnitAIType()
                unitsForThisCiv[aiType] = (unitsForThisCiv[aiType] or 0) + 1
            end
        end

        -- Add to main table if we found any visible units
        if civName and next(unitsForThisCiv) then
            unitsByOwner[civName] = unitsForThisCiv
        end
    end
end

return unitsByOwner