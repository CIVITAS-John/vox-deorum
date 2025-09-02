-- Returns static game configuration information as a table
function GetGameInfo()
    local info = {}
    
    -- Game configuration (static)
    info.gameSpeed = Game.GetGameSpeedType()
    info.difficulty = Game.GetHandicapType()
    info.startEra = Game.GetStartEra()
    info.startYear = Game.GetStartYear()
    info.maxTurns = Game.GetMaxTurns()
    
    -- Victory conditions (static)
    info.victoryTypes = {}
    info.victoryTypes.domination = Game.IsVictoryValid(GameInfoTypes.VICTORY_DOMINATION)
    info.victoryTypes.science = Game.IsVictoryValid(GameInfoTypes.VICTORY_SPACE_RACE)
    info.victoryTypes.cultural = Game.IsVictoryValid(GameInfoTypes.VICTORY_CULTURAL)
    info.victoryTypes.diplomatic = Game.IsVictoryValid(GameInfoTypes.VICTORY_DIPLOMATIC)
    info.victoryTypes.time = Game.IsVictoryValid(GameInfoTypes.VICTORY_TIME)
    
    -- Game options (static)
    info.options = {}
    info.options.noBarbarians = Game.IsOption(GameOptionTypes.GAMEOPTION_NO_BARBARIANS)
    info.options.noRuins = Game.IsOption(GameOptionTypes.GAMEOPTION_NO_GOODY_HUTS)
    info.options.noEspionage = Game.IsOption(GameOptionTypes.GAMEOPTION_NO_ESPIONAGE)
    info.options.noCityRazing = Game.IsOption(GameOptionTypes.GAMEOPTION_NO_CITY_RAZING)
    info.options.noCityStates = Game.IsOption(GameOptionTypes.GAMEOPTION_NO_CITY_STATE)
    info.options.oneCity = Game.IsOption(GameOptionTypes.GAMEOPTION_ONE_CITY_CHALLENGE)
    info.options.alwaysWar = Game.IsOption(GameOptionTypes.GAMEOPTION_ALWAYS_WAR)
    info.options.completeKills = Game.IsOption(GameOptionTypes.GAMEOPTION_COMPLETE_KILLS)
    info.options.ragingBarbarians = Game.IsOption(GameOptionTypes.GAMEOPTION_RAGING_BARBARIANS)
    
    local map = Map
    if map then
        info.mapWidth = map.GetGridSize()
        info.mapHeight = map.GetGridSizeY and map.GetGridSizeY() or nil
        info.numPlots = map.GetNumPlots()
    end
    
    return info
end

return GetGameInfo()