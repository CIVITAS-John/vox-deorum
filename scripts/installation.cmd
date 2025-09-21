@echo off
setlocal EnableDelayedExpansion

:: Vox Deorum Installation Script for Windows
:: Installs Steam, checks Civilization V, and sets up Vox Deorum with pre-built DLL

title Vox Deorum Installation

:: Configuration
set "SCRIPT_VERSION=2.0.0"
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "CIV5_APP_ID=8930"
set "TEMP_DIR=%TEMP%\VoxDeorumInstall"
set "PREBUILT_DLL=%SCRIPT_DIR%\CvGameCore_Expansion2.dll"

:: Color codes
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "RESET=[0m"

:: Banner
echo.
echo %BLUE%=========================================%RESET%
echo %BLUE%     Vox Deorum Installation Script     %RESET%
echo %BLUE%           Version %SCRIPT_VERSION%              %RESET%
echo %BLUE%=========================================%RESET%
echo.

:: Create temp directory
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"

:: Check for pre-built DLL
echo %YELLOW%[1/7] Checking for pre-built DLL...%RESET%
if not exist "%PREBUILT_DLL%" (
    echo %RED%Error: Pre-built DLL not found at:%RESET%
    echo   %PREBUILT_DLL%
    echo.
    echo Please ensure CvGameCore_Expansion2.dll is in the scripts folder.
    pause
    exit /b 1
)
echo %GREEN%  ✓ Pre-built DLL found%RESET%

:: Check/Install Steam
echo.
echo %YELLOW%[2/7] Checking for Steam...%RESET%
set "STEAM_FOUND=0"

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
    echo %GREEN%  ✓ Steam found at: %STEAM_PATH%%RESET%
) else (
    echo %YELLOW%  Steam not found. Installing...%RESET%

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
            echo %RED%  Failed to download Steam installer%RESET%
            echo   Please install Steam manually from: https://store.steampowered.com/
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
echo %YELLOW%[3/7] Setting up SteamCMD...%RESET%
set "STEAMCMD_DIR=%TEMP_DIR%\steamcmd"
set "STEAMCMD_EXE=%STEAMCMD_DIR%\steamcmd.exe"

if not exist "%STEAMCMD_EXE%" (
    echo   Downloading SteamCMD...
    if not exist "%STEAMCMD_DIR%" mkdir "%STEAMCMD_DIR%"
    powershell -Command "try { Invoke-WebRequest -Uri 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip' -OutFile '%TEMP_DIR%\steamcmd.zip' } catch { exit 1 }"

    if exist "%TEMP_DIR%\steamcmd.zip" (
        echo   Extracting SteamCMD...
        powershell -Command "Expand-Archive -Path '%TEMP_DIR%\steamcmd.zip' -DestinationPath '%STEAMCMD_DIR%' -Force"
    ) else (
        echo %RED%  Failed to download SteamCMD%RESET%
        pause
        exit /b 1
    )
)
echo %GREEN%  ✓ SteamCMD ready%RESET%

:: Check for Civ 5 installation using SteamCMD
echo.
echo %YELLOW%[4/7] Checking for Civilization V installation...%RESET%
echo   Running SteamCMD to check app %CIV5_APP_ID%...

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
    echo %GREEN%  ✓ Civilization V found at:%RESET%
    echo     %CIV5_PATH%
) else (
    echo %RED%  Civilization V not found%RESET%
    echo.
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
echo %YELLOW%[5/7] Setting up MODS directory...%RESET%
:: Get the actual Documents folder path using PowerShell (handles OneDrive/redirected folders)
for /f "usebackq tokens=*" %%i in (`powershell -Command "[Environment]::GetFolderPath('MyDocuments')"`) do set "DOCUMENTS=%%i"
set "MODS_DIR=%DOCUMENTS%\My Games\Sid Meier's Civilization 5\MODS"
if not exist "%MODS_DIR%" (
    echo   Creating MODS directory...
    mkdir "%MODS_DIR%"
)
echo %GREEN%  ✓ MODS directory: %MODS_DIR%%RESET%

:: Check for existing Vox Populi installation
echo.
echo %YELLOW%[6/7] Installing Vox Populi Community Patch...%RESET%
set "VP_INSTALLED=0"
set "CP_PATH=%MODS_DIR%\(1) Community Patch"
set "VD_PATH=%MODS_DIR%\(1b) Vox Deorum"
set "VP_PATH=%MODS_DIR%\(2) Vox Populi"

if exist "%CP_PATH%" (
    if exist "%VP_PATH%" (
        echo %GREEN%  ✓ Vox Populi already installed%RESET%
        set "VP_INSTALLED=1"
    )
)

if "%VP_INSTALLED%"=="1" (
    :: Only copy the DLL
    echo   Updating DLL only...
    copy /Y "%PREBUILT_DLL%" "%CP_PATH%\CvGameCore_Expansion2.dll" >nul 2>&1
    if !errorlevel! equ 0 (
        echo %GREEN%  ✓ DLL updated successfully%RESET%
    ) else (
        echo %YELLOW%  Warning: Could not update DLL. Manual copy may be required.%RESET%
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

        echo %GREEN%  ✓ Mods installed successfully%RESET%
    ) else (
        echo %YELLOW%  Warning: Source mod folders not found%RESET%
        echo   Expected at: %SOURCE_CP%
        echo   Please manually copy:
        echo     - (1) Community Patch folder to %CP_PATH%
        echo     - (1b) Vox Deorum folder to %VD_PATH%
        echo     - (2) Vox Populi folder to %VP_PATH%
        echo     - CvGameCore_Expansion2.dll to %CP_PATH%\
    )
)

:: Verification
echo.
echo %YELLOW%[7/7] Verification...%RESET%

set "SUCCESS=1"

:: Check Steam
if exist "%STEAM_PATH%\steam.exe" (
    echo %GREEN%  ✓ Steam installed%RESET%
) else (
    echo %RED%  ✗ Steam not found%RESET%
    set "SUCCESS=0"
)

:: Check Civ 5
if "%CIV5_FOUND%"=="1" (
    echo %GREEN%  ✓ Civilization V installed%RESET%
) else (
    echo %RED%  ✗ Civilization V not found%RESET%
    set "SUCCESS=0"
)

:: Check Community Patch
if exist "%CP_PATH%\CvGameCore_Expansion2.dll" (
    echo %GREEN%  ✓ Community Patch DLL installed%RESET%
) else (
    echo %RED%  ✗ Community Patch DLL not found%RESET%
    set "SUCCESS=0"
)

:: Check Vox Deorum
if exist "%VD_PATH%" (
    echo %GREEN%  ✓ Vox Deorum installed%RESET%
) else (
    echo %YELLOW%  ⚠ Vox Deorum not found%RESET%
)

:: Check Vox Populi
if exist "%VP_PATH%" (
    echo %GREEN%  ✓ Vox Populi installed%RESET%
) else (
    echo %YELLOW%  ⚠ Vox Populi not found (optional)%RESET%
)

:: Final message
echo.
echo %BLUE%=========================================%RESET%
if "%SUCCESS%"=="1" (
    echo %GREEN%       Installation Complete!%RESET%
    echo.
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
) else (
    echo %YELLOW%     Installation Partially Complete%RESET%
    echo.
    echo Please resolve any issues above and run again.
)
echo %BLUE%=========================================%RESET%

:: Cleanup
echo.
echo Cleaning up...
if exist "%TEMP_DIR%\steamcmd.zip" del "%TEMP_DIR%\steamcmd.zip"
if exist "%TEMP_DIR%\SteamSetup.exe" del "%TEMP_DIR%\SteamSetup.exe"
if exist "%TEMP_DIR%\check_civ5.txt" del "%TEMP_DIR%\check_civ5.txt"
if exist "%TEMP_DIR%\steamcmd_output.txt" del "%TEMP_DIR%\steamcmd_output.txt"

echo.
pause