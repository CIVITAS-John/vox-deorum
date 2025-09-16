local modActivating = -1
local modActivated = -1

function onEndFrame()
  if modActivating > 0 and os.time() > modActivating + 2 then
    print("Trying to activate the mods...");
    Events.FrontEndPopup("Activating the mods");
    modActivating = 0;
  end
  if modActivated > 0 and os.time() > modActivated + 2 then
    Automation.SetEventFunction("EndFrame", nil);
    -- Game settings
    local t = {};
    t.worldSize = 1; -- Tiny
    t.climate = 0; -- Temperate
    t.seaLevel = 0; -- Medium
    t.era = 0; -- Ancient
    -- Player slots
    -- 0 = empty
    -- 1 = human
    -- 2 = computer
    t.slot = { 2, 2, 2, 2 }; -- 4 Players for tiny
    -- Set how many turns we want to play
    -- t.autorunTurnLimit = 10;
    -- Set the delay between AI turns, in seconds.  Can be 0.
    t.autorunTurnDelay = 1;
    -- Apply the parameters to the GameCoreInit structure
    print("Starting the game...");
    modActivated = -1
    Automation.SetGameCoreInit(t);
    Events.SerialEventStartGame(0);
  end
end
  
Events.AfterModsActivate.Add(function()
  if (modActivating == -1) then
    print("Vanilla game activated!");
    modActivating = os.time();
    -- Set the 'EndFrame' event handler
    Automation.SetEventFunction("EndFrame", onEndFrame);
    return
  elseif (modActivated == -1) then
    print("Custom mods activated!");
    modActivated = os.time();
  end
end)