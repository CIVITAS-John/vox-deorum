-- Get-Metadata Lua Script
-- Retrieves static game metadata that doesn't change during gameplay
-- Helper function to get localized text from GameInfo
local function getLocalizedGameInfo(category, id)
    local info = GameInfo[category] and GameInfo[category][id]
    if info then
        if info.Description then
            return Locale.ConvertTextKey(info.Description)
        elseif info.Type then
            return info.Type
        end
    end
    return "Unknown"
end

-- Get game speed
local gameSpeedID = Game.GetGameSpeedType()
local gameSpeed = getLocalizedGameInfo("GameSpeeds", gameSpeedID)

-- Get map size
local map = Map
local mapSizeID = map.GetWorldSize()
local mapSize = getLocalizedGameInfo("Worlds", mapSizeID)

-- Get map type (from map script name if available)
local mapType = Game:GetMapScriptName()

-- Get difficulty
local difficultyID = Game.GetHandicapType()
local difficulty = getLocalizedGameInfo("HandicapInfos", difficultyID)

-- Get start era
local startEraID = Game.GetStartEra()
local startEra = getLocalizedGameInfo("Eras", startEraID)

-- Get max turns
local maxTurns = Game.GetMaxTurns()

-- Get enabled victory types
local victoryTypes = {}
for row in GameInfo.Victories() do
    if Game.IsVictoryValid(row.ID) then
        local victoryName = Locale.ConvertTextKey(row.Description)
        table.insert(victoryTypes, victoryName)
    end
end

-- Build metadata
local metadata = {
    GameSpeed = gameSpeed,
    MapType = mapType,
    MapSize = mapSize,
    Difficulty = difficulty,
    StartEra = startEra,
    MaxTurns = maxTurns,
    VictoryTypes = victoryTypes
}

-- Add player-specific information if PlayerID was provided
if playerID ~= -1 then
    local player = Players[playerID]
    if player and not player:IsBarbarian() and not player:IsMinorCiv() then
        local leaderName = player:GetName()
        local civName = player:GetCivilizationShortDescription()
        metadata.YouAre = leaderName .. " (" .. civName .. ")"
    end
end

return metadata