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

:: Color codes removed - not reliably supported

:: Banner
echo.
echo ============================================
echo       Vox Deorum Quick Start Script
echo ============================================
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
echo [1/4] Checking for Git...
where git >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] Git is already installed
    for /f "delims=" %%i in ('git --version') do echo     %%i
    goto :CloneRepo
)

echo   Git not found. Installing Git for Windows...
:: Try winget first
winget --version >nul 2>&1
if %errorlevel% equ 0 (
    echo   Attempting installation via winget...
    winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
    if !errorlevel! equ 0 (
        echo   [OK] Git installed via winget
        goto :RefreshPath
    )
)

:: Fall back to direct download
echo   Downloading Git for Windows...
set "GIT_INSTALLER=%TEMP_DIR%\Git-%GIT_VERSION%-64-bit.exe"
powershell -Command "& { try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/git-for-windows/git/releases/download/v%GIT_VERSION%.windows.1/Git-%GIT_VERSION%-64-bit.exe' -OutFile '%GIT_INSTALLER%' -UseBasicParsing } catch { exit 1 } }"

if not exist "%GIT_INSTALLER%" (
    echo   [FAIL] Failed to download Git installer
    echo.
    echo   Please install Git manually from: https://git-scm.com/download/win
    echo   Then run this script again.
    pause
    exit /b 1
)

echo   Running Git installer (please follow the installer prompts)...
"%GIT_INSTALLER%" /VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS /COMPONENTS="icons,ext\reg\shellhere,assoc,assoc_sh"

if %errorlevel% neq 0 (
    echo   [WARN] Git installation may have failed
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
    echo   [FAIL] Git still not found in PATH
    echo   You may need to:
    echo   1. Close this window
    echo   2. Open a new command prompt
    echo   3. Run this script again
    pause
    exit /b 1
)

echo   [OK] Git installed successfully
:CloneRepo
:: Check if installation directory already exists
echo.
echo [2/4] Cloning repository...
if exist "%INSTALL_DIR%" (
    echo   [WARN] Installation directory already exists: %INSTALL_DIR%
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
                echo   [WARN] Failed to update repository. Continuing anyway...
            )
        ) else (
            echo   [FAIL] Directory exists but is not a Git repository
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

:: Clone the repository (shallow clone for faster download)
echo   Cloning from: %REPO_URL%
echo   Destination: %INSTALL_DIR%
echo   Using shallow clone for faster download...
git clone --depth 1 "%REPO_URL%" "%INSTALL_DIR%"

if %errorlevel% neq 0 (
    echo   [FAIL] Failed to clone repository.
    echo   Please check:
    echo   1. Internet connection
    echo   2. Repository URL is correct: %REPO_URL%
    echo   3. You have access to the repository.
    echo   You can manually clone with:
    echo   git clone %REPO_URL% %INSTALL_DIR%
    pause
    exit /b 1
)

echo   [OK] Repository cloned successfully
cd /d "%INSTALL_DIR%"

:InitSubmodules
:: Initialize and update submodules
echo.
echo [3/4] Initializing submodules...
:: Initialize submodules
git submodule init
if %errorlevel% neq 0 (
    echo   [WARN] Failed to initialize submodules
)

:: Check for Git LFS
echo   Checking for Git LFS support...
git lfs version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [INFO] Git LFS not installed. Installing via winget...
    winget install -e --id GitHub.GitLFS --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo   [WARN] Failed to install Git LFS via winget. Trying Git built-in LFS...
        git lfs install
        if %errorlevel% neq 0 (
            echo   [WARN] Failed to install Git LFS. Prebuilt DLLs may not download correctly.
        ) else (
            echo   [OK] Git LFS installed via Git
        )
    ) else (
        echo   [OK] Git LFS installed via winget
        :: Initialize Git LFS after winget installation
        git lfs install
    )
) else (
    echo   [OK] Git LFS is available
)

:: Update submodules (also shallow for faster download)
echo   Downloading submodule content (this may take a few minutes)...
git submodule update --init --recursive --depth 1
if %errorlevel% neq 0 (
    echo   [WARN] Some submodules may have failed to download
    echo   You can manually update them later with:
    echo   git submodule update --init --recursive
) else (
    echo   [OK] Submodules initialized

    :: Pull LFS files for prebuilt DLLs
    echo   Downloading prebuilt DLL files via Git LFS...
    git lfs pull
    if %errorlevel% neq 0 (
        echo   [WARN] Failed to download LFS files. You may need to build DLLs manually.
    ) else (
        echo   [OK] Prebuilt DLLs downloaded
    )
)

:: Run installation script
echo.
echo [4/4] Running installation script...
set "INSTALL_SCRIPT=%INSTALL_DIR%\scripts\installation.cmd"
if not exist "%INSTALL_SCRIPT%" (
    echo   [FAIL] Installation script not found at:
    echo   %INSTALL_SCRIPT%
    echo.
    echo   Repository structure may be incorrect.
    pause
    exit /b 1
)

echo.
echo ============================================
echo    Starting Vox Deorum Installation...
echo ============================================
echo.

:: Run the installation script, passing all arguments
call "%INSTALL_SCRIPT%" %*

:: Check if installation was successful
if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo       Quick Start Completed Successfully!
    echo ============================================
    echo.
    echo Repository location: %INSTALL_DIR%
    echo.
    echo You can now:
    echo   1. Launch Civilization V
    echo   2. Enable the Vox Deorum mods
    echo   3. Start playing with AI enhancements!
) else (
    echo.
    echo ============================================
    echo     Quick Start Completed with Warnings
    echo ============================================
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
    echo   [OK] Desktop shortcut created
)

echo.
pause