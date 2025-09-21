@echo off
setlocal EnableDelayedExpansion

:: Vox Deorum Installation Script for Windows
:: Installs Steam, checks Civilization V, and sets up Vox Deorum with pre-built DLL

title Vox Deorum Installation

:: Configuration
set "SCRIPT_VERSION=2.1.0"
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "CIV5_APP_ID=8930"
set "TEMP_DIR=%TEMP%\VoxDeorumInstall"

:: Check for --debug argument
set "DEBUG_MODE=0"
if "%~1"=="--debug" (
    set "DEBUG_MODE=1"
    set "BUILD_DIR=%SCRIPT_DIR%\debug"
) else (
    set "BUILD_DIR=%SCRIPT_DIR%\release"
)

:: Set file paths based on build mode
set "PREBUILT_DLL=%BUILD_DIR%\CvGameCore_Expansion2.dll"
set "PREBUILT_PDB=%BUILD_DIR%\CvGameCore_Expansion2.pdb"
set "LUA_DLL=%BUILD_DIR%\lua51_win32.dll"
set "LUA_PDB=%BUILD_DIR%\lua51_win32.pdb"

:: Color codes removed - not reliably supported

:: Banner
echo.
echo =========================================echo      Vox Deorum Installation Script     echo            Version %SCRIPT_VERSION%              if "%DEBUG_MODE%"=="1" (
    echo           [DEBUG MODE ENABLED]          )
echo =========================================echo.

:: Create temp directory
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"

:: Check for pre-built files
echo [1/7] Checking for pre-built files...if not exist "%PREBUILT_DLL%" (
    echo Error: Pre-built DLL not found at:    echo   %PREBUILT_DLL%
    echo.
    if "%DEBUG_MODE%"=="1" (
        echo Please ensure CvGameCore_Expansion2.dll is in the scripts\debug folder.
    ) else (
        echo Please ensure CvGameCore_Expansion2.dll is in the scripts\release folder.
    )
    pause
    exit /b 1
)
echo   [OK] Pre-built DLL found
:: Check for Lua DLL
if not exist "%LUA_DLL%" (
    echo   Warning: lua51_win32.dll not found in %BUILD_DIR%) else (
    echo   [OK] Lua DLL found)

:: Check for PDB files (always check for debug symbols)
if exist "%PREBUILT_PDB%" (
    echo   [OK] Debug symbols (PDB) found for CvGameCore
) else (
    echo   Warning: CvGameCore_Expansion2.pdb not found
)
if exist "%LUA_PDB%" (
    echo   [OK] Debug symbols (PDB) found for Lua
) else (
    echo   Warning: lua51_win32.pdb not found
)

:: Check/Install Steam
echo.
echo [2/7] Checking for Steam...set "STEAM_FOUND=0"

:: Check registry for Steam path
for /f "tokens=2*" %%a in ('reg query "HKEY_CURRENT_USER\Software\Valve\Steam" /v SteamPath 2^>nul ^| findstr SteamPath') do (
    set "STEAM_PATH=%%b"
    set "STEAM_PATH=!STEAM_PATH:/=\!"
    set "STEAM_FOUND=1"
)

if "%STEAM_FOUND%"=="0" (
    for /f "tokens=2*" %%a in ('reg query "HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Valve\Steam" /v InstallPath 2^>nul ^| findstr InstallPath') do (
        set "STEAM_PATH=%%b"
        set "STEAM_FOUND=1"
    )
)

if "%STEAM_FOUND%"=="1" (
    echo   [OK] Steam found at: %STEAM_PATH%) else (
    echo   Steam not found. Installing...
    :: Try winget first
    winget --version >nul 2>&1
    if !errorlevel! equ 0 (
        echo   Installing via winget...
        winget install Valve.Steam --accept-package-agreements --accept-source-agreements
    ) else (
        :: Download and run Steam installer
        echo   Downloading Steam installer...
        powershell -Command "try { Invoke-WebRequest -Uri 'https://cdn.cloudflare.steamstatic.com/client/installer/SteamSetup.exe' -OutFile '%TEMP_DIR%\SteamSetup.exe' } catch { exit 1 }"
        if exist "%TEMP_DIR%\SteamSetup.exe" (
            echo   Running Steam installer...
            echo   Please complete the Steam installation and login.
            "%TEMP_DIR%\SteamSetup.exe"
            echo.
            pause
        ) else (
            echo   Failed to download Steam installer            echo   Please install Steam manually from: https://store.steampowered.com/
            pause
            exit /b 1
        )
    )

    :: Re-check for Steam after installation
    for /f "tokens=2*" %%a in ('reg query "HKEY_CURRENT_USER\Software\Valve\Steam" /v SteamPath 2^>nul ^| findstr SteamPath') do (
        set "STEAM_PATH=%%b"
        set "STEAM_PATH=!STEAM_PATH:/=\!"
    )
)

:: Download and setup SteamCMD
echo.
echo [3/7] Setting up SteamCMD...set "STEAMCMD_DIR=%TEMP_DIR%\steamcmd"
set "STEAMCMD_EXE=%STEAMCMD_DIR%\steamcmd.exe"

if not exist "%STEAMCMD_EXE%" (
    echo   Downloading SteamCMD...
    if not exist "%STEAMCMD_DIR%" mkdir "%STEAMCMD_DIR%"
    powershell -Command "try { Invoke-WebRequest -Uri 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip' -OutFile '%TEMP_DIR%\steamcmd.zip' } catch { exit 1 }"

    if exist "%TEMP_DIR%\steamcmd.zip" (
        echo   Extracting SteamCMD...
        powershell -Command "Expand-Archive -Path '%TEMP_DIR%\steamcmd.zip' -DestinationPath '%STEAMCMD_DIR%' -Force"
    ) else (
        echo   Failed to download SteamCMD        pause
        exit /b 1
    )
)
echo   [OK] SteamCMD ready
:: Check for Civ 5 installation using SteamCMD
echo.
echo [4/7] Checking for Civilization V installation...echo   Running SteamCMD to check app %CIV5_APP_ID%...

:: Create SteamCMD script to check installation
echo @ShutdownOnFailedCommand 0 > "%TEMP_DIR%\check_civ5.txt"
echo @NoPromptForPassword 1 >> "%TEMP_DIR%\check_civ5.txt"
echo login anonymous >> "%TEMP_DIR%\check_civ5.txt"
echo app_info_print %CIV5_APP_ID% >> "%TEMP_DIR%\check_civ5.txt"
echo quit >> "%TEMP_DIR%\check_civ5.txt"

"%STEAMCMD_EXE%" +runscript "%TEMP_DIR%\check_civ5.txt" > "%TEMP_DIR%\steamcmd_output.txt" 2>&1

:: Check common installation paths
set "CIV5_FOUND=0"
set "CIV5_PATH="

:: Check default Steam library
if exist "%STEAM_PATH%\steamapps\common\Sid Meier's Civilization V\CivilizationV_DX11.exe" (
    set "CIV5_PATH=%STEAM_PATH%\steamapps\common\Sid Meier's Civilization V"
    set "CIV5_FOUND=1"
)

:: Check other common drives
if "%CIV5_FOUND%"=="0" (
    for %%D in (C D E F G) do (
        if exist "%%D:\SteamLibrary\steamapps\common\Sid Meier's Civilization V\CivilizationV_DX11.exe" (
            set "CIV5_PATH=%%D:\SteamLibrary\steamapps\common\Sid Meier's Civilization V"
            set "CIV5_FOUND=1"
        )
        if exist "%%D:\Program Files (x86)\Steam\steamapps\common\Sid Meier's Civilization V\CivilizationV_DX11.exe" (
            set "CIV5_PATH=%%D:\Program Files (x86)\Steam\steamapps\common\Sid Meier's Civilization V"
            set "CIV5_FOUND=1"
        )
        if exist "%%D:\Steam\steamapps\common\Sid Meier's Civilization V\CivilizationV_DX11.exe" (
            set "CIV5_PATH=%%D:\Steam\steamapps\common\Sid Meier's Civilization V"
            set "CIV5_FOUND=1"
        )
    )
)

if "%CIV5_FOUND%"=="1" (
    echo   [OK] Civilization V found at:    echo     %CIV5_PATH%
) else (
    echo   Civilization V not found    echo.
    echo   Please install Civilization V through Steam:
    echo   1. Open Steam and log in
    echo   2. Go to Library or Store
    echo   3. Install Civilization V (any edition)
    echo   4. Note: Complete Edition recommended for all DLCs
    echo.
    echo   Opening Steam...
    start steam://install/%CIV5_APP_ID%
    echo.
    echo   After installation, please run this script again.
    pause
    exit /b 1
)

:: Setup MODS directory
echo.
echo [5/7] Setting up MODS directory...:: Get the actual Documents folder path using PowerShell (handles OneDrive/redirected folders)
for /f "usebackq tokens=*" %%i in (`powershell -Command "[Environment]::GetFolderPath('MyDocuments')"`) do set "DOCUMENTS=%%i"
set "MODS_DIR=%DOCUMENTS%\My Games\Sid Meier's Civilization 5\MODS"
if not exist "%MODS_DIR%" (
    echo   Creating MODS directory...
    mkdir "%MODS_DIR%"
)
echo   [OK] MODS directory: %MODS_DIR%
:: Check for existing Vox Populi installation
echo.
echo [6/7] Installing Vox Populi Community Patch...set "VP_INSTALLED=0"
set "CP_PATH=%MODS_DIR%\(1) Community Patch"
set "VD_PATH=%MODS_DIR%\(1b) Vox Deorum"
set "VP_PATH=%MODS_DIR%\(2) Vox Populi"

if exist "%CP_PATH%" (
    if exist "%VP_PATH%" (
        echo   [OK] Vox Populi already installed        set "VP_INSTALLED=1"
    )
)

if "%VP_INSTALLED%"=="1" (
    :: Only copy the DLL and Lua files
    echo   Updating DLL and Lua files...

    :: Copy main DLL
    copy /Y "%PREBUILT_DLL%" "%CP_PATH%\CvGameCore_Expansion2.dll" >nul 2>&1
    if !errorlevel! equ 0 (
        echo   [OK] CvGameCore DLL updated    ) else (
        echo   Warning: Could not update CvGameCore DLL    )

    :: Copy Lua DLL to Civ5 folder if it exists
    if exist "%LUA_DLL%" (
        copy /Y "%LUA_DLL%" "%CIV5_PATH%\lua51_win32.dll" >nul 2>&1
        if !errorlevel! equ 0 (
            echo   [OK] Lua DLL copied to Civ5 folder        ) else (
            echo   Warning: Could not copy Lua DLL to Civ5 folder        )
    )

    :: Copy PDB files (always copy debug symbols if available)
    if exist "%PREBUILT_PDB%" (
        copy /Y "%PREBUILT_PDB%" "%CP_PATH%\CvGameCore_Expansion2.pdb" >nul 2>&1
        if !errorlevel! equ 0 (
            echo   [OK] CvGameCore PDB copied (debug symbols)
        )
    )
    if exist "%LUA_PDB%" (
        copy /Y "%LUA_PDB%" "%CIV5_PATH%\lua51_win32.pdb" >nul 2>&1
        if !errorlevel! equ 0 (
            echo   [OK] Lua PDB copied (debug symbols)
        )
    )
) else (
    :: Copy full Community Patch, Vox Deorum, and Vox Populi
    echo   Installing Community Patch, Vox Deorum, and Vox Populi...

    :: Check if source folders exist
    set "SOURCE_CP=%SCRIPT_DIR%\..\civ5-dll\(1) Community Patch"
    set "SOURCE_VD=%SCRIPT_DIR%\..\civ5-mod"
    set "SOURCE_VP=%SCRIPT_DIR%\..\civ5-dll\(2) Vox Populi"

    if exist "%SOURCE_CP%" (
        echo   Copying (1) Community Patch...
        xcopy /E /I /Y "%SOURCE_CP%" "%CP_PATH%" >nul 2>&1

        :: Copy the pre-built DLL
        echo   Copying pre-built DLL...
        copy /Y "%PREBUILT_DLL%" "%CP_PATH%\CvGameCore_Expansion2.dll" >nul 2>&1

        :: Copy Lua DLL to Civ5 folder
        if exist "%LUA_DLL%" (
            echo   Copying Lua DLL...
            copy /Y "%LUA_DLL%" "%CIV5_PATH%\lua51_win32.dll" >nul 2>&1
        )

        :: Copy PDB files (always copy debug symbols if available)
        if exist "%PREBUILT_PDB%" (
            echo   Copying CvGameCore debug symbols...
            copy /Y "%PREBUILT_PDB%" "%CP_PATH%\CvGameCore_Expansion2.pdb" >nul 2>&1
        )
        if exist "%LUA_PDB%" (
            echo   Copying Lua debug symbols...
            copy /Y "%LUA_PDB%" "%CIV5_PATH%\lua51_win32.pdb" >nul 2>&1
        )

        :: Copy Vox Deorum mod
        if exist "%SOURCE_VD%" (
            echo   Copying (1b) Vox Deorum...
            xcopy /E /I /Y "%SOURCE_VD%" "%VD_PATH%" >nul 2>&1
            :: Don't copy .bat files
            del "%VD_PATH%\*.bat" >nul 2>&1
        )

        if exist "%SOURCE_VP%" (
            echo   Copying (2) Vox Populi...
            xcopy /E /I /Y "%SOURCE_VP%" "%VP_PATH%" >nul 2>&1
        )

        echo   [OK] Mods installed successfully    ) else (
        echo   Warning: Source mod folders not found        echo   Expected at: %SOURCE_CP%
        echo   Please manually copy:
        echo     - (1) Community Patch folder to %CP_PATH%
        echo     - (1b) Vox Deorum folder to %VD_PATH%
        echo     - (2) Vox Populi folder to %VP_PATH%
        echo     - CvGameCore_Expansion2.dll to %CP_PATH%\
    )
)

:: Verification
echo.
echo [7/7] Verification...
set "SUCCESS=1"

:: Check Steam
if exist "%STEAM_PATH%\steam.exe" (
    echo   [OK] Steam installed) else (
    echo   [FAIL] Steam not found    set "SUCCESS=0"
)

:: Check Civ 5
if "%CIV5_FOUND%"=="1" (
    echo   [OK] Civilization V installed) else (
    echo   [FAIL] Civilization V not found    set "SUCCESS=0"
)

:: Check Community Patch
if exist "%CP_PATH%\CvGameCore_Expansion2.dll" (
    echo   [OK] Community Patch DLL installed) else (
    echo   [FAIL] Community Patch DLL not found    set "SUCCESS=0"
)

:: Check Vox Deorum
if exist "%VD_PATH%" (
    echo   [OK] Vox Deorum installed) else (
    echo   [WARN] Vox Deorum not found)

:: Check Vox Populi
if exist "%VP_PATH%" (
    echo   [OK] Vox Populi installed) else (
    echo   [WARN] Vox Populi not found (optional))

:: Check Lua DLL
if exist "%CIV5_PATH%\lua51_win32.dll" (
    echo   [OK] Lua DLL installed) else (
    echo   [WARN] Lua DLL not installed)

:: Check debug symbols (always check if installed)
if exist "%CP_PATH%\CvGameCore_Expansion2.pdb" (
    echo   [OK] CvGameCore debug symbols installed
)
if exist "%CIV5_PATH%\lua51_win32.pdb" (
    echo   [OK] Lua debug symbols installed
)

:: Final message
echo.
echo =========================================if "%SUCCESS%"=="1" (
    echo        Installation Complete!    echo.
    echo Next steps:
    echo   1. Launch Civilization V from Steam
    echo   2. Go to MODS from the main menu
    echo   3. Enable the following mods in order:
    echo      - (1) Community Patch
    echo      - (1b) Vox Deorum
    echo      - (2) Vox Populi (if desired)
    echo   4. Click "Next" and start a new game
    echo.
    echo The Vox Deorum DLL has been installed.
    echo Debug symbols will be copied if available.
) else (
    echo      Installation Partially Complete    echo.
    echo Please resolve any issues above and run again.
)
echo =========================================
:: Cleanup
echo.
echo Cleaning up...
if exist "%TEMP_DIR%\steamcmd.zip" del "%TEMP_DIR%\steamcmd.zip"
if exist "%TEMP_DIR%\SteamSetup.exe" del "%TEMP_DIR%\SteamSetup.exe"
if exist "%TEMP_DIR%\check_civ5.txt" del "%TEMP_DIR%\check_civ5.txt"
if exist "%TEMP_DIR%\steamcmd_output.txt" del "%TEMP_DIR%\steamcmd_output.txt"

echo.
pause