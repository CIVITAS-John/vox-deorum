Events.AfterModsActivate.Add(function()
    print("Mods activated!")
    -- Game settings
    local t = {};
    t.worldSize = 0; -- Tiny
    t.climate = 0; -- Temperate
    t.seaLevel = 0; -- Medium
    t.era = 0; -- Ancient
    -- Player slots
    -- 0 = empty
    -- 1 = human
    -- 2 = computer
    t.slot = { 2, 2, 2 };
    -- Set how many turns we want to play
    -- t.autorunTurnLimit = 10;
    -- Set the delay between AI turns, in seconds.  Can be 0.
    t.autorunTurnDelay = 1;
    -- Apply the parameters to the GameCoreInit structure
    Automation.SetGameCoreInit(t);
    Events.SerialEventStartGame();
end)