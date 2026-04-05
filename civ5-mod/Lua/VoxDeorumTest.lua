-- Test listener for Vox Deorum observer API events.
-- Prints events to Lua.log for verification.

LuaEvents.VoxDeorumPlayerInfo.Add(function(playerID, aiLabel)
  print("[VoxDeorum] Player " .. playerID .. ": " .. aiLabel)
end)

LuaEvents.VoxDeorumAction.Add(function(playerID, turn, actionType, summary, rationale)
  print("[VoxDeorum] Player " .. playerID .. " T" .. turn
    .. " (" .. actionType .. "): " .. summary)
end)

-- Treat barbarians as minor civs for the purposes of segment control —
-- downstream ignores minor civ render events.
local function isMinorCivPlayer(playerID)
  local p = Players[playerID]
  return p and (p:IsMinorCiv() or p:IsBarbarian()) or false
end

-- Render-time event forwarding to the bridge (fire-and-forget via BroadcastEvent).
-- Fires when the top panel auto-switches to show a player (rationale arrived).
LuaEvents.VD_TopPanelAutoSwitchedPlayer.Add(function(playerID, prevPlayerID)
  Game.BroadcastEvent("Render:PlayerPanelSwitch", {
    playerID     = playerID,
    prevPlayerID = prevPlayerID,
    isMinorCiv   = isMinorCivPlayer(playerID),
    turn         = Game.GetGameTurn(),
    time         = Game.GetCurrentTimeEpochMs(),
  })
end)

-- Fires when a player's turn animations are estimated to begin.
-- VD_AnimationStarted is triggered externally; we forward it to the bridge.
LuaEvents.VD_AnimationStarted.Add(function(playerID)
  Game.BroadcastEvent("Render:AnimationStarted", {
    playerID   = playerID,
    isMinorCiv = isMinorCivPlayer(playerID),
    turn       = Game.GetGameTurn(),
    time       = Game.GetCurrentTimeEpochMs(),
  })
end)
