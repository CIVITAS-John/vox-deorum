-- Utility function to get the most recent save file
function getMostRecentSave()
  local fileList = {}
  print("Loading recent saves...")
  -- Load single player saves (not autosaves, not cloud saves)
  UI.SaveFileList(fileList, GameTypes.GAME_SINGLE_PLAYER, true, true)

  if #fileList == 0 then
    print("No save files found")
    return nil
  end

  print("Loaded recent saves: " .. #fileList)
  -- Find the most recent save by comparing modification times
  local mostRecentFile = fileList[1]
  local mostRecentHigh, mostRecentLow = UI.GetSavedGameModificationTimeRaw(mostRecentFile)

  for i = 2, #fileList do
    local high, low = UI.GetSavedGameModificationTimeRaw(fileList[i])
    local compareResult = UI.CompareFileTime(high, low, mostRecentHigh, mostRecentLow)
    if compareResult == 1 then
      mostRecentFile = fileList[i]
      mostRecentHigh = high
      mostRecentLow = low
    end
  end

  print("Found most recent save: " .. mostRecentFile)
  return mostRecentFile
end

function handlePopup(text)
  if (text == "Loading the last game save") then
    print("Load the last game save...")

    -- Get and load the most recent save file
    local saveToLoad = getMostRecentSave()
    if saveToLoad then
      print("Loading save file: " .. saveToLoad)
      Events.PlayerChoseToLoadGame(saveToLoad, false)
    else
      print("No save file found to load")
    end

    Events.FrontEndPopup.Remove(handlePopup)
  end
end

Events.FrontEndPopup.Add(handlePopup)