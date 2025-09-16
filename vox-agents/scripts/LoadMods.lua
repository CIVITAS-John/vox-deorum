local modActivating = -1
local modActivated = -1

function onEndFrame()
  if modActivating > 0 and os.time() > modActivating + 2 then
    print("Trying to activate the mods...");
    Events.FrontEndPopup("Activating the mods");
    modActivating = 0;
  end
  Automation.SetEventFunction("EndFrame", nil);
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