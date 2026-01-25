-------------------------------------------------
-- Popup Broadcaster for Vox Deorum
--
-- Captures all popup events and writes them to
-- MapModData for the bridge to read.
-------------------------------------------------

-- Initialize our namespace in MapModData
if not MapModData.VoxDeorum then
    MapModData.VoxDeorum = {}
end

-- Track popup history for debugging
MapModData.VoxDeorum.PopupHistory = MapModData.VoxDeorum.PopupHistory or {}

-------------------------------------------------
-- Popup Type Names (for human-readable output)
-------------------------------------------------
local PopupTypeNames = {
    [ButtonPopupTypes.BUTTONPOPUP_TEXT] = "TEXT",
    [ButtonPopupTypes.BUTTONPOPUP_CONFIRM_MENU] = "CONFIRM_MENU",
    [ButtonPopupTypes.BUTTONPOPUP_DECLAREWARMOVE] = "DECLARE_WAR_MOVE",
    [ButtonPopupTypes.BUTTONPOPUP_DECLAREWAR] = "DECLARE_WAR",
    [ButtonPopupTypes.BUTTONPOPUP_DECLAREWAR_PLUNDER_TRADE_ROUTE] = "DECLARE_WAR_PLUNDER",
    [ButtonPopupTypes.BUTTONPOPUP_CONFIRMCOMMAND] = "CONFIRM_COMMAND",
    [ButtonPopupTypes.BUTTONPOPUP_CONFIRMMISSION] = "CONFIRM_MISSION",
    [ButtonPopupTypes.BUTTONPOPUP_CHOOSETECH] = "CHOOSE_TECH",
    [ButtonPopupTypes.BUTTONPOPUP_CHOOSEPRODUCTION] = "CHOOSE_PRODUCTION",
    [ButtonPopupTypes.BUTTONPOPUP_CHOOSEPOLICY] = "CHOOSE_POLICY",
    [ButtonPopupTypes.BUTTONPOPUP_CHOOSEELECTION] = "CHOOSE_ELECTION",
    [ButtonPopupTypes.BUTTONPOPUP_CHOOSEGOODY] = "CHOOSE_GOODY",
    [ButtonPopupTypes.BUTTONPOPUP_CITY_CAPTURED] = "CITY_CAPTURED",
    [ButtonPopupTypes.BUTTONPOPUP_ANNEX_CITY] = "ANNEX_CITY",
    [ButtonPopupTypes.BUTTONPOPUP_CHOOSE_PANTHEON] = "CHOOSE_PANTHEON",
    [ButtonPopupTypes.BUTTONPOPUP_CHOOSE_RELIGION] = "CHOOSE_RELIGION",
    [ButtonPopupTypes.BUTTONPOPUP_CHOOSE_IDEOLOGY] = "CHOOSE_IDEOLOGY",
    [ButtonPopupTypes.BUTTONPOPUP_GOLDEN_AGE_REWARD] = "GOLDEN_AGE_REWARD",
    [ButtonPopupTypes.BUTTONPOPUP_GREAT_PERSON_REWARD] = "GREAT_PERSON_REWARD",
    [ButtonPopupTypes.BUTTONPOPUP_CHOOSE_ADMIRAL_PORT] = "CHOOSE_ADMIRAL_PORT",
    [ButtonPopupTypes.BUTTONPOPUP_BARBARIAN_CAMP_REWARD] = "BARBARIAN_CAMP_REWARD",
    [ButtonPopupTypes.BUTTONPOPUP_LEAGUE_OVERVIEW] = "LEAGUE_OVERVIEW",
    [ButtonPopupTypes.BUTTONPOPUP_CHOOSE_ARCHAEOLOGY] = "CHOOSE_ARCHAEOLOGY",
    [ButtonPopupTypes.BUTTONPOPUP_GIFT_CONFIRM] = "GIFT_CONFIRM",
    [ButtonPopupTypes.BUTTONPOPUP_KICKED] = "KICKED",
    [ButtonPopupTypes.BUTTONPOPUP_RELIGION_OVERVIEW] = "RELIGION_OVERVIEW",
    [ButtonPopupTypes.BUTTONPOPUP_ECONOMIC_OVERVIEW] = "ECONOMIC_OVERVIEW",
    [ButtonPopupTypes.BUTTONPOPUP_MILITARY_OVERVIEW] = "MILITARY_OVERVIEW",
    [ButtonPopupTypes.BUTTONPOPUP_DEMOGRAPHICS] = "DEMOGRAPHICS",
}

-- Get human-readable popup type name
local function GetPopupTypeName(popupType)
    return PopupTypeNames[popupType] or ("UNKNOWN_" .. tostring(popupType))
end

-------------------------------------------------
-- Capture ALL popup events
-------------------------------------------------
function OnPopupOpened(popupInfo)
    if popupInfo == nil then return end

    local popupData = {
        Type = popupInfo.Type,
        TypeName = GetPopupTypeName(popupInfo.Type),
        Data1 = popupInfo.Data1,
        Data2 = popupInfo.Data2,
        Data3 = popupInfo.Data3,
        Text = popupInfo.Text,
        Option1 = popupInfo.Option1,
        Option2 = popupInfo.Option2,
        Timestamp = os.time(),
        Turn = Game.GetGameTurn(),
    }

    -- Store as active popup
    MapModData.VoxDeorum.ActivePopup = popupData

    -- Add to history (keep last 10)
    table.insert(MapModData.VoxDeorum.PopupHistory, 1, popupData)
    while #MapModData.VoxDeorum.PopupHistory > 10 do
        table.remove(MapModData.VoxDeorum.PopupHistory)
    end

    print("[VoxDeorum] Popup opened: " .. popupData.TypeName)
end
Events.SerialEventGameMessagePopup.Add(OnPopupOpened)

-------------------------------------------------
-- Track when popups are processed/closed
-------------------------------------------------
function OnPopupProcessed(popupType, popupData)
    -- Clear active popup if it matches
    if MapModData.VoxDeorum.ActivePopup and
       MapModData.VoxDeorum.ActivePopup.Type == popupType then
        print("[VoxDeorum] Popup closed: " .. GetPopupTypeName(popupType))
        MapModData.VoxDeorum.ActivePopup = nil
    end
end
Events.SerialEventGameMessagePopupProcessed.Add(OnPopupProcessed)

-------------------------------------------------
-- Track popup shown events (for popups that use this)
-------------------------------------------------
function OnPopupShown(popupInfo)
    if popupInfo == nil then return end
    -- Update timestamp when actually shown (some popups queue before showing)
    if MapModData.VoxDeorum.ActivePopup and
       MapModData.VoxDeorum.ActivePopup.Type == popupInfo.Type then
        MapModData.VoxDeorum.ActivePopup.ShownTimestamp = os.time()
    end
end
Events.SerialEventGameMessagePopupShown.Add(OnPopupShown)

-------------------------------------------------
-- Initialize on load
-------------------------------------------------
print("[VoxDeorum] PopupBroadcaster loaded - monitoring all popup events")
MapModData.VoxDeorum.PopupBroadcasterActive = true
