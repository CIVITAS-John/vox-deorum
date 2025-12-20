@echo off
setlocal enabledelayedexpansion

:: Vox Deorum Services Manager
:: Usage: vox-deorum.cmd [vox-agents-mode] [additional-args...]
:: Default mode: webui (launches web interface)
:: Available modes: webui, briefer, strategist
:: Example: vox-deorum.cmd --strategist --verbose --debug

:: Check if npm is in PATH
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm not found in PATH. Checking for local node/ folder...

    :: Check if node/ folder exists in the script directory
    if exist "%~dp0..\node\" (
        echo [INFO] Found local node/ folder. Adding to PATH temporarily...
        set "PATH=%~dp0..\node;%PATH%"

        :: Verify npm is now accessible
        where npm >nul 2>&1
        if !errorlevel! neq 0 (
            echo [ERROR] npm not found in local node/ folder.
            echo [ERROR] Please ensure Node.js is installed or a portable node/ folder exists.
            pause
            exit /b 1
        )
        echo [INFO] Successfully added local node/ to PATH.
    ) else (
        echo [ERROR] Local node/ folder not found at: %~dp0..\node\
        echo [ERROR] Please install Node.js or provide a portable Node.js installation in the node/ folder.
        pause
        exit /b 1
    )
)

set "VOX_MODE=%~1"
if "%VOX_MODE%"=="" set "VOX_MODE=webui"

:: Remove -- prefix if present
set "VOX_MODE=%VOX_MODE:--=-%"

:: Check if vox-agents/src exists to determine dev vs dist mode
if not exist "%~dp0..\vox-agents\src\index.ts" (
    echo [INFO] Source directory not found, using compiled distribution...

    :: Map modes to dist commands
    if "%VOX_MODE%"=="webui" set "VOX_MODE=start:dist"
    if "%VOX_MODE%"=="briefer" set "VOX_MODE=briefer:dist"
    if "%VOX_MODE%"=="strategist" set "VOX_MODE=strategist:dist"
) else (
    :: Map modes to dev commands
    if "%VOX_MODE%"=="webui" set "VOX_MODE=start"
    if "%VOX_MODE%"=="briefer" set "VOX_MODE=briefer"
    if "%VOX_MODE%"=="strategist" set "VOX_MODE=strategist"
)

:: Capture all arguments after the first one
set "ADDITIONAL_ARGS="
set "ARG_COUNT=0"
for %%a in (%*) do (
    set /a "ARG_COUNT+=1"
    if !ARG_COUNT! GTR 1 (
        set "ADDITIONAL_ARGS=!ADDITIONAL_ARGS! %%a"
    )
)

echo.
echo ========================================
echo     Vox Deorum Services Manager
echo ========================================
echo.
echo [INFO] Mode: %VOX_MODE%
echo [INFO] Starting services in order...
echo.

:: Determine bridge-service command based on source availability
set "BRIDGE_COMMAND=start"
if not exist "%~dp0..\bridge-service\src\index.ts" (
    set "BRIDGE_COMMAND=start:dist"
)

:: Determine mcp-server command based on source availability
set "MCP_COMMAND=start"
if not exist "%~dp0..\mcp-server\src\index.ts" (
    set "MCP_COMMAND=start:dist"
)

:: Start Bridge Service and get PID
echo [1/3] Starting Bridge Service (%BRIDGE_COMMAND%)...
powershell -Command "$p = Start-Process cmd -ArgumentList '/k','cd','/d','%~dp0..\bridge-service','&&','npm','run','%BRIDGE_COMMAND%' -PassThru; $p.Id" > "%TEMP%\bridge.pid"
set /p BRIDGE_PID=<"%TEMP%\bridge.pid"
echo        Started with PID: %BRIDGE_PID%

:: Start MCP Server and get PID
echo [2/3] Starting MCP Server (%MCP_COMMAND%)...
powershell -Command "$p = Start-Process cmd -ArgumentList '/k','cd','/d','%~dp0..\mcp-server','&&','npm','run','%MCP_COMMAND%' -PassThru; $p.Id" > "%TEMP%\mcp.pid"
set /p MCP_PID=<"%TEMP%\mcp.pid"
echo        Started with PID: %MCP_PID%

:: Start Vox Agents and get PID
echo [3/3] Starting Vox Agents (mode: %VOX_MODE%!ADDITIONAL_ARGS!)...
if "!ADDITIONAL_ARGS!"=="" (
    powershell -Command "$p = Start-Process cmd -ArgumentList '/k','cd','/d','%~dp0..\vox-agents','&&','npm','run','%VOX_MODE%' -PassThru; $p.Id" > "%TEMP%\vox.pid"
) else (
    set "NPM_COMMAND=npm run %VOX_MODE% -- !ADDITIONAL_ARGS!"
    powershell -Command "$p = Start-Process cmd -ArgumentList '/k','cd','/d','%~dp0..\vox-agents','&&','!NPM_COMMAND!' -PassThru; $p.Id" > "%TEMP%\vox.pid"
)
set /p VOX_PID=<"%TEMP%\vox.pid"
echo        Started with PID: %VOX_PID%

echo ========================================
echo All services started successfully!
echo ========================================"
echo.
echo Services running:
echo   - Bridge Service (Port 5000, PID: %BRIDGE_PID%)
echo   - MCP Server (Port 4000, PID: %MCP_PID%)
echo   - Vox Agents (Port 5555, Mode: %VOX_MODE%, PID: %VOX_PID%)
echo.
echo Press ENTER to STOP all services...
set /p "STOP_CONFIRM="

echo.
echo [INFO] Shutting down services...

:: First attempt graceful shutdown (without /F flag) in reverse order
echo [1/3] Stopping Vox Agents (PID: %VOX_PID%)...
taskkill /PID %VOX_PID% /T /F >nul 2>&1

echo [2/3] Stopping MCP Server (PID: %MCP_PID%)...
taskkill /PID %MCP_PID% /T /F >nul 2>&1

echo [3/3] Stopping Bridge Service (PID: %BRIDGE_PID%)...
taskkill /PID %BRIDGE_PID% /T /F >nul 2>&1

:: Clean up temp files
del "%TEMP%\bridge.pid" 2>nul
del "%TEMP%\mcp.pid" 2>nul
del "%TEMP%\vox.pid" 2>nul

echo.
echo ========================================
echo All services stopped.
echo ========================================
echo.

endlocal