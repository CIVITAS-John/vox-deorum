-- Test listener for Vox Deorum observer API events.
-- Prints events to Lua.log for verification.

LuaEvents.VoxDeorumPlayerInfo.Add(function(playerID, aiLabel)
  print("[VoxDeorum] Player " .. playerID .. ": " .. aiLabel)
end)

LuaEvents.VoxDeorumAction.Add(function(playerID, turn, actionType, summary, rationale)
  print("[VoxDeorum] Player " .. playerID .. " T" .. turn
    .. " (" .. actionType .. "): " .. summary)
end)
