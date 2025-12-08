@echo off
setlocal EnableDelayedExpansion

:: Vox Deorum Mod Uninstaller
:: Removes installed mods from Civilization V

:: Get Documents folder
for /f "usebackq tokens=*" %%i in (`powershell -Command "[Environment]::GetFolderPath('MyDocuments')"`) do set "DOCUMENTS=%%i"
set "MODS_DIR=%DOCUMENTS%\My Games\Sid Meier's Civilization 5\MODS"

:: Remove mod folders if they exist
if exist "%MODS_DIR%\(1) Community Patch" (
    rmdir /S /Q "%MODS_DIR%\(1) Community Patch" 2>nul
)

if exist "%MODS_DIR%\(1b) Vox Deorum" (
    rmdir /S /Q "%MODS_DIR%\(1b) Vox Deorum" 2>nul
)

if exist "%MODS_DIR%\(2) Vox Populi" (
    rmdir /S /Q "%MODS_DIR%\(2) Vox Populi" 2>nul
)

if exist "%MODS_DIR%\(3a) EUI Compatibility Files" (
    rmdir /S /Q "%MODS_DIR%\(3a) EUI Compatibility Files" 2>nul
)

:: Try to remove UI mods from common Civ5 locations
set "LOCATIONS[0]=%ProgramFiles(x86)%\Steam\steamapps\common\Sid Meier's Civilization V"
set "LOCATIONS[1]=C:\SteamLibrary\steamapps\common\Sid Meier's Civilization V"
set "LOCATIONS[2]=D:\SteamLibrary\steamapps\common\Sid Meier's Civilization V"
set "LOCATIONS[3]=E:\SteamLibrary\steamapps\common\Sid Meier's Civilization V"
set "LOCATIONS[4]=F:\SteamLibrary\steamapps\common\Sid Meier's Civilization V"

for /L %%i in (0,1,4) do (
    if exist "!LOCATIONS[%%i]!\Assets\DLC\VPUI" (
        rmdir /S /Q "!LOCATIONS[%%i]!\Assets\DLC\VPUI" 2>nul
    )
    if exist "!LOCATIONS[%%i]!\Assets\DLC\UI_bc1" (
        rmdir /S /Q "!LOCATIONS[%%i]!\Assets\DLC\UI_bc1" 2>nul
    )
)

exit /b 0