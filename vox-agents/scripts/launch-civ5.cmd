@echo off
setlocal enabledelayedexpansion
:: Launch Civilization V with Vox Deorum automation
:: Usage: launch-civ5.cmd [lua_script_name]
:: Example: launch-civ5.cmd StartGame.lua
:: Default: StartGame.lua

:: Set default Lua script name if not provided
set "LUA_SCRIPT=%~1"
if "%LUA_SCRIPT%"=="" set "LUA_SCRIPT=LoadMods.lua"

:: Get Steam installation path from registry
for /f "tokens=2*" %%a in ('reg query "HKLM\SOFTWARE\WOW6432Node\Valve\Steam" /v InstallPath 2^>nul') do set "STEAM_PATH=%%b"
if "%STEAM_PATH%"=="" (
    for /f "tokens=2*" %%a in ('reg query "HKLM\SOFTWARE\Valve\Steam" /v InstallPath 2^>nul') do set "STEAM_PATH=%%b"
)

if "%STEAM_PATH%"=="" (
    echo ERROR: Could not find Steam installation in registry
    echo Trying default paths...
    set "STEAM_PATH=C:\Program Files (x86)\Steam"
)

:: Find Civ 5 in Steam library
set "CIV5_PATH=%STEAM_PATH%\steamapps\common\Sid Meier's Civilization V"

:: Check other common drives if not found
if not exist "!CIV5_PATH!\CivilizationV.exe" (
    for %%D in (D E F G) do (
        set "TEST_PATH=%%D:\Steam\steamapps\common\Sid Meier's Civilization V"
        if exist "!TEST_PATH!\CivilizationV.exe" (
            set "CIV5_PATH=%%D:\Steam\steamapps\common\Sid Meier's Civilization V"
            goto :found
        )
        set "TEST_PATH=%%D:\SteamLibrary\steamapps\common\Sid Meier's Civilization V"
        if exist "!TEST_PATH!\CivilizationV.exe" (
            set "CIV5_PATH=%%D:\SteamLibrary\steamapps\common\Sid Meier's Civilization V"
            goto :found
        )
    )
)

:found
if not exist "!CIV5_PATH!\CivilizationV.exe" (
    echo ERROR: Could not find CivilizationV.exe
    echo Searched in: !CIV5_PATH!
    echo Please ensure Civilization V is installed
    pause
    exit /b 1
)

echo Found Civ 5 at: !CIV5_PATH!

:: Create Automation directory if it doesn't exist
if not exist "!CIV5_PATH!\Assets\Automation" (
    echo Creating Automation directory...
    mkdir "!CIV5_PATH!\Assets\Automation"
)

:: Create UI/FrontEnd directory if it doesn't exist
if not exist "!CIV5_PATH!\Assets\UI\FrontEnd" (
    echo Creating UI/FrontEnd directory...
    mkdir "!CIV5_PATH!\Assets\UI\FrontEnd"
)

:: Copy Lua script to game directory
echo Copying !LUA_SCRIPT! to game directory...
copy /Y "%~dp0!LUA_SCRIPT!" "!CIV5_PATH!\Assets\Automation\!LUA_SCRIPT!" >nul
if %errorlevel% neq 0 (
    echo ERROR: Failed to copy !LUA_SCRIPT!
    echo Make sure !LUA_SCRIPT! exists in: %~dp0
    pause
    exit /b 1
)

:: Copy FrontEnd.lua if it exists
if exist "%~dp0FrontEnd.lua" (
    echo Copying FrontEnd.lua to UI/FrontEnd directory...
    copy /Y "%~dp0FrontEnd.lua" "!CIV5_PATH!\Assets\UI\FrontEnd\FrontEnd.lua" >nul
    if %errorlevel% neq 0 (
        echo WARNING: Failed to copy FrontEnd.lua
    )
)

:: Copy MainMenu.lua if it exists
if exist "%~dp0MainMenu.lua" (
    echo Copying MainMenu.lua to UI/FrontEnd directory...
    copy /Y "%~dp0MainMenu.lua" "!CIV5_PATH!\Assets\UI\FrontEnd\MainMenu.lua" >nul
    if %errorlevel% neq 0 (
        echo WARNING: Failed to copy MainMenu.lua
    )
)

echo Launching Civilization V with automation script: !LUA_SCRIPT!
"!CIV5_PATH!\CivilizationV.exe" "-Automation !LUA_SCRIPT!"