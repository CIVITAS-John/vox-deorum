@echo off
setlocal enabledelayedexpansion

:: Vox Deorum Services Manager
:: Usage: vox-deorum.cmd [vox-agents-mode] [additional-args...]
:: Default mode: webui (launches web interface)
:: Supports any mode matching an npm script in vox-agents (e.g. briefer, strategist)
:: Example: vox-deorum.cmd --strategist --verbose --debug

:: Configure Node.js (prefer bundled over system)
set "BUNDLED_NODE=%~dp0..\node"
set "NODE_FOUND="

:: Try bundled Node.js first
if exist "%BUNDLED_NODE%\npm.cmd" (
    echo [DEBUG] Found bundled npm.cmd at %BUNDLED_NODE%\npm.cmd
    call "%BUNDLED_NODE%\npm.cmd" --version >nul 2>&1
    if !errorlevel! equ 0 (
        set "PATH=%BUNDLED_NODE%;%PATH%"
        set "NODE_FOUND=bundled"
        echo [INFO] Using bundled Node.js
    ) else (
        echo [DEBUG] Bundled npm.cmd test failed with errorlevel !errorlevel!
    )
)

:: Fall back to system Node.js
if not defined NODE_FOUND (
    where npm >nul 2>&1
    if !errorlevel! equ 0 (
        set "NODE_FOUND=system"
        echo [INFO] Using system Node.js
    )
)

:: Exit if no Node.js found
if not defined NODE_FOUND (
    echo [ERROR] Node.js not found. Install it or place a portable version in: %BUNDLED_NODE%
    pause
    exit /b 1
)

set "VOX_MODE=%~1"
if "%VOX_MODE%"=="" set "VOX_MODE=webui"

:: Remove -- prefix if present
set "VOX_MODE=%VOX_MODE:--=-%"

:: Check if vox-agents/src exists to determine dev vs dist mode
if not exist "%~dp0..\vox-agents\src\index.ts" (
    echo [INFO] Source directory not found, using compiled distribution...

    :: Map webui to start:dist; all other modes get :dist suffix
    if "%VOX_MODE%"=="webui" (
        set "VOX_MODE=start:dist"
    ) else (
        set "VOX_MODE=%VOX_MODE%:dist"
    )
) else (
    :: Map webui to start; all other modes pass through as-is
    if "%VOX_MODE%"=="webui" set "VOX_MODE=start"
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