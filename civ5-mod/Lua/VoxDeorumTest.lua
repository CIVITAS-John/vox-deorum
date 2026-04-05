-- Test listener for Vox Deorum observer API events.
-- Prints events to Lua.log for verification.

LuaEvents.VoxDeorumPlayerInfo.Add(function(playerID, aiLabel)
  print("[VoxDeorum] Player " .. playerID .. ": " .. aiLabel)
end)

LuaEvents.VoxDeorumAction.Add(function(playerID, turn, actionType, summary, rationale)
  print("[VoxDeorum] Player " .. playerID .. " T" .. turn
    .. " (" .. actionType .. "): " .. summary)
end)

-- Render-time event forwarding to the bridge (fire-and-forget via BroadcastEvent).
-- Fires when the top panel auto-switches to show a player (rationale arrived).
LuaEvents.VD_TopPanelAutoSwitchedPlayer.Add(function(playerID, prevPlayerID)
  Game.BroadcastEvent("Render:PlayerPanelSwitch", {
    playerID     = playerID,
    prevPlayerID = prevPlayerID,
    turn         = Game.GetGameTurn(),
    time         = Game.GetCurrentTimeEpochMs(),
  })
end)

-- Fires when a player's turn animations are estimated to begin.
-- VD_AnimationStarted is triggered externally; we forward it to the bridge.
LuaEvents.VD_AnimationStarted.Add(function(playerID)
  Game.BroadcastEvent("Render:AnimationStarted", {
    playerID = playerID,
    turn     = Game.GetGameTurn(),
    time     = Game.GetCurrentTimeEpochMs(),
  })
end)
