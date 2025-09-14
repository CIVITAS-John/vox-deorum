@echo off
:: Launch Civilization V with Vox Deorum automation

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
if not exist "%CIV5_PATH%\CivilizationV.exe" (
    set "CIV5_PATH=%STEAM_PATH%\steamapps\common\Civilization V"
)

:: Check other common drives if not found
if not exist "%CIV5_PATH%\CivilizationV.exe" (
    for %%D in (D E F G) do (
        if exist "%%D:\Steam\steamapps\common\Sid Meier's Civilization V\CivilizationV.exe" (
            set "CIV5_PATH=%%D:\Steam\steamapps\common\Sid Meier's Civilization V"
            goto :found
        )
        if exist "%%D:\SteamLibrary\steamapps\common\Sid Meier's Civilization V\CivilizationV.exe" (
            set "CIV5_PATH=%%D:\SteamLibrary\steamapps\common\Sid Meier's Civilization V"
            goto :found
        )
    )
)

:found
if not exist "%CIV5_PATH%\CivilizationV.exe" (
    echo ERROR: Could not find CivilizationV.exe
    echo Searched in: %CIV5_PATH%
    echo Please ensure Civilization V is installed
    pause
    exit /b 1
)

echo Found Civ 5 at: %CIV5_PATH%

:: Create Automation directory if it doesn't exist
if not exist "%CIV5_PATH%\Assets\Automation" (
    echo Creating Automation directory...
    mkdir "%CIV5_PATH%\Assets\Automation"
)

:: Copy VoxDeorum.lua to game directory
echo Copying StartGame.lua to game directory...
copy /Y "%~dp0StartGame.lua" "%CIV5_PATH%\Assets\Automation\StartGame.lua" >nul
if %errorlevel% neq 0 (
    echo ERROR: Failed to copy StartGame.lua
    pause
    exit /b 1
)

echo Launching Civilization V with automation...
start "" "%CIV5_PATH%\CivilizationV.exe" -Automation StartGame.lua