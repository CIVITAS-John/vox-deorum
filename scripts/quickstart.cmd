@echo off
setlocal EnableDelayedExpansion

:: Vox Deorum Quick Start Script
:: Downloads Git, clones repository, and runs installation

title Vox Deorum Quick Start

:: Configuration
set "REPO_URL=https://github.com/CIVITAS-John/vox-deorum.git"
:: Install in a vox-deorum subfolder next to this script
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "INSTALL_DIR=%SCRIPT_DIR%\vox-deorum"
set "TEMP_DIR=%TEMP%\VoxDeorumQuickStart"
set "GIT_VERSION=2.51.0"

:: Enable ANSI color codes in Windows 10+
for /f "tokens=3" %%a in ('reg query "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion" /v CurrentBuild 2^>nul ^| findstr CurrentBuild') do set BUILD=%%a
if !BUILD! GEQ 10586 (
    :: Windows 10 TH2 and later support ANSI codes
    :: Enable virtual terminal processing
    reg add HKCU\Console /v VirtualTerminalLevel /t REG_DWORD /d 1 /f >nul 2>&1
)

:: Color codes (ANSI escape sequences)
set "ESC="
set "RED=%ESC%[91m"
set "GREEN=%ESC%[92m"
set "YELLOW=%ESC%[93m"
set "BLUE=%ESC%[94m"
set "RESET=%ESC%[0m"

:: Banner
echo.
echo %BLUE%============================================%RESET%
echo %BLUE%      Vox Deorum Quick Start Script        %RESET%
echo %BLUE%============================================%RESET%
echo.
echo This script will:
echo   1. Install Git for Windows (if needed)
echo   2. Clone the Vox Deorum repository
echo   3. Initialize submodules
echo   4. Run the installation script
echo.

:: Create temp directory
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"

:: Check for Git
echo %YELLOW%[1/4] Checking for Git...%RESET%
where git >nul 2>&1
if %errorlevel% equ 0 (
    echo %GREEN%  ✓ Git is already installed%RESET%
    for /f "delims=" %%i in ('git --version') do echo     %%i
    goto :CloneRepo
)

echo %YELLOW%  Git not found. Installing Git for Windows...%RESET%

:: Try winget first
winget --version >nul 2>&1
if %errorlevel% equ 0 (
    echo   Attempting installation via winget...
    winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
    if !errorlevel! equ 0 (
        echo %GREEN%  ✓ Git installed via winget%RESET%
        goto :RefreshPath
    )
)

:: Fall back to direct download
echo   Downloading Git for Windows...
set "GIT_INSTALLER=%TEMP_DIR%\Git-%GIT_VERSION%-64-bit.exe"
powershell -Command "& { try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/git-for-windows/git/releases/download/v%GIT_VERSION%.windows.1/Git-%GIT_VERSION%-64-bit.exe' -OutFile '%GIT_INSTALLER%' -UseBasicParsing } catch { exit 1 } }"

if not exist "%GIT_INSTALLER%" (
    echo %RED%  ✗ Failed to download Git installer%RESET%
    echo.
    echo   Please install Git manually from: https://git-scm.com/download/win
    echo   Then run this script again.
    pause
    exit /b 1
)

echo   Running Git installer (please follow the installer prompts)...
"%GIT_INSTALLER%" /VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS /COMPONENTS="icons,ext\reg\shellhere,assoc,assoc_sh"

if %errorlevel% neq 0 (
    echo %YELLOW%  ⚠ Git installation may have failed%RESET%
    echo   If Git is not installed, please install manually and run this script again.
    pause
)

:RefreshPath
:: Refresh PATH to include Git
echo   Refreshing system PATH...
for /f "delims=" %%i in ('powershell -Command "[System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')"') do set "PATH=%%i"

:: Verify Git is now available
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo %RED%  ✗ Git still not found in PATH%RESET%
    echo   You may need to:
    echo   1. Close this window
    echo   2. Open a new command prompt
    echo   3. Run this script again
    pause
    exit /b 1
)

echo %GREEN%  ✓ Git installed successfully%RESET%

:CloneRepo
:: Check if installation directory already exists
echo.
echo %YELLOW%[2/4] Cloning repository...%RESET%

if exist "%INSTALL_DIR%" (
    echo %YELLOW%  ⚠ Installation directory already exists: %INSTALL_DIR%%RESET%
    choice /C YN /M "Delete existing directory and reinstall?"
    if errorlevel 2 (
        echo   Using existing directory...
        cd /d "%INSTALL_DIR%"

        :: Check if it's a git repository
        git rev-parse --git-dir >nul 2>&1
        if %errorlevel% equ 0 (
            echo   Updating existing repository...
            git fetch origin
            git pull origin main
            if %errorlevel% neq 0 (
                echo %YELLOW%  ⚠ Failed to update repository. Continuing anyway...%RESET%
            )
        ) else (
            echo %RED%  ✗ Directory exists but is not a Git repository%RESET%
            echo   Please delete or rename: %INSTALL_DIR%
            pause
            exit /b 1
        )
        goto :InitSubmodules
    ) else (
        echo   Removing existing directory...
        rd /s /q "%INSTALL_DIR%" 2>nul
        timeout /t 2 /nobreak >nul
    )
)

:: Clone the repository
echo   Cloning from: %REPO_URL%
echo   Destination: %INSTALL_DIR%
git clone "%REPO_URL%" "%INSTALL_DIR%"

if %errorlevel% neq 0 (
    echo %RED%  ✗ Failed to clone repository%RESET%
    echo.
    echo   Please check:
    echo   1. Internet connection
    echo   2. Repository URL is correct: %REPO_URL%
    echo   3. You have access to the repository
    echo.
    echo   You can manually clone with:
    echo   git clone %REPO_URL% %INSTALL_DIR%
    pause
    exit /b 1
)

echo %GREEN%  ✓ Repository cloned successfully%RESET%
cd /d "%INSTALL_DIR%"

:InitSubmodules
:: Initialize and update submodules
echo.
echo %YELLOW%[3/4] Initializing submodules...%RESET%

:: Initialize submodules
git submodule init
if %errorlevel% neq 0 (
    echo %YELLOW%  ⚠ Failed to initialize submodules%RESET%
)

:: Update submodules
echo   Downloading submodule content (this may take a few minutes)...
git submodule update --recursive
if %errorlevel% neq 0 (
    echo %YELLOW%  ⚠ Some submodules may have failed to download%RESET%
    echo   You can manually update them later with:
    echo   git submodule update --init --recursive
) else (
    echo %GREEN%  ✓ Submodules initialized%RESET%
)

:: Run installation script
echo.
echo %YELLOW%[4/4] Running installation script...%RESET%

set "INSTALL_SCRIPT=%INSTALL_DIR%\scripts\installation.cmd"
if not exist "%INSTALL_SCRIPT%" (
    echo %RED%  ✗ Installation script not found at:%RESET%
    echo   %INSTALL_SCRIPT%
    echo.
    echo   Repository structure may be incorrect.
    pause
    exit /b 1
)

echo.
echo %BLUE%============================================%RESET%
echo %BLUE%   Starting Vox Deorum Installation...     %RESET%
echo %BLUE%============================================%RESET%
echo.

:: Run the installation script
call "%INSTALL_SCRIPT%"

:: Check if installation was successful
if %errorlevel% equ 0 (
    echo.
    echo %GREEN%============================================%RESET%
    echo %GREEN%      Quick Start Completed Successfully!   %RESET%
    echo %GREEN%============================================%RESET%
    echo.
    echo Repository location: %INSTALL_DIR%
    echo.
    echo You can now:
    echo   1. Launch Civilization V
    echo   2. Enable the Vox Deorum mods
    echo   3. Start playing with AI enhancements!
) else (
    echo.
    echo %YELLOW%============================================%RESET%
    echo %YELLOW%    Quick Start Completed with Warnings    %RESET%
    echo %YELLOW%============================================%RESET%
    echo.
    echo Some components may need manual configuration.
    echo Repository location: %INSTALL_DIR%
)

:: Cleanup
echo.
echo Cleaning up temporary files...
if exist "%TEMP_DIR%" (
    rd /s /q "%TEMP_DIR%" 2>nul
)

:: Create desktop shortcut to repository
echo.
choice /C YN /M "Create desktop shortcut to Vox Deorum folder?"
if errorlevel 1 (
    powershell -Command "& { $ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%USERPROFILE%\Desktop\Vox Deorum.lnk'); $s.TargetPath = '%INSTALL_DIR%'; $s.IconLocation = '%SystemRoot%\System32\shell32.dll,3'; $s.Save() }"
    echo %GREEN%  ✓ Desktop shortcut created%RESET%
)

echo.
pause