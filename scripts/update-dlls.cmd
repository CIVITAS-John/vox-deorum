@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Vox Deorum DLL Update Script
echo ========================================
echo.
echo This script will:
echo 1. Push changes to GitHub
echo 2. Wait for GitHub Actions to build
echo 3. Pull the built DLLs
echo 4. Copy to Community Patch folder
echo.

REM Push to origin
echo Step 1: Pushing to origin...
echo ----------------------------------------
git push origin
if !ERRORLEVEL! neq 0 (
    echo Error: Failed to push to origin
    exit /b 1
)
echo Push successful!
echo.

REM Wait for GitHub Actions to build (60 seconds)
echo Step 2: Waiting 60 seconds for GitHub Actions to build...
echo ----------------------------------------
echo Started waiting at: %time%
timeout /t 60 /nobreak
echo Finished waiting at: %time%
echo.

REM Pull from origin
echo Step 3: Pulling from origin...
echo ----------------------------------------
git pull origin
if !ERRORLEVEL! neq 0 (
    echo Error: Failed to pull from origin
    exit /b 1
)
echo Pull successful!
echo.

REM Get the Documents folder path
for /f "usebackq tokens=*" %%i in (`powershell -Command "[Environment]::GetFolderPath('MyDocuments')"`) do set "DOCUMENTS=%%i"

REM Set paths
set "DEST_DIR=!DOCUMENTS!\My Games\Sid Meier's Civilization 5\MODS\(1) Community Patch"
set "SOURCE_DLL=scripts\release\CvGameCore_Expansion2.dll"
set "SOURCE_PDB=scripts\release\CvGameCore_Expansion2.pdb"

REM Check if source DLL exists
if not exist "!SOURCE_DLL!" (
    echo Error: Release DLL not found at !SOURCE_DLL!
    echo Make sure the GitHub Actions build completed successfully.
    exit /b 1
)

REM Create destination directory if it doesn't exist
if not exist "!DEST_DIR!" (
    echo Creating directory: "!DEST_DIR!"
    mkdir "!DEST_DIR!" 2>nul
)

REM Copy the DLL
echo Step 4: Copying Release DLL to Community Patch folder...
echo ----------------------------------------
echo Source: "!SOURCE_DLL!"
echo Destination: "!DEST_DIR!"
copy /Y "!SOURCE_DLL!" "!DEST_DIR!" >nul

if !ERRORLEVEL! equ 0 (
    echo Release DLL successfully copied!
    echo Location: "!DEST_DIR!\CvGameCore_Expansion2.dll"
) else (
    echo Error: Failed to copy Release DLL to destination
    exit /b 1
)

REM Copy the PDB file if it exists
if exist "!SOURCE_PDB!" (
    echo Copying Release PDB file for debugging...
    copy /Y "!SOURCE_PDB!" "!DEST_DIR!" >nul
    if !ERRORLEVEL! equ 0 (
        echo Release PDB file successfully copied!
    ) else (
        echo Warning: Failed to copy Release PDB file
    )
) else (
    echo Note: Release PDB file not found, skipping debug symbols copy
)

echo.
echo ========================================
echo DLL Update Complete!
echo ========================================
echo.
echo The latest Release build has been deployed to:
echo "!DEST_DIR!"
echo.
echo You can now launch Civilization 5 with the updated DLL.
echo.

pause