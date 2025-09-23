@echo off
setlocal enabledelayedexpansion

:: Vox Deorum Services Manager
:: Usage: vox-deorum.cmd [vox-agents-mode]
:: Example: vox-deorum.cmd --strategist

set "VOX_MODE=%~1"
if "%VOX_MODE%"=="" set "VOX_MODE=strategist"

:: Remove -- prefix if present
set "VOX_MODE=%VOX_MODE:--=-%"

echo.
echo ========================================
echo     Vox Deorum Services Manager
echo ========================================
echo.

echo [INFO] Starting services in order...
echo.

:: Start Bridge Service and get PID
echo [1/3] Starting Bridge Service...
powershell -Command "$p = Start-Process cmd -ArgumentList '/k','cd','/d','%~dp0..\bridge-service','&&','npm','run','start' -PassThru; $p.Id" > "%TEMP%\bridge.pid"
set /p BRIDGE_PID=<"%TEMP%\bridge.pid"
echo        Started with PID: %BRIDGE_PID%

:: Wait for bridge service to initialize
timeout /t 3 /nobreak >nul

:: Start MCP Server and get PID
echo [2/3] Starting MCP Server...
powershell -Command "$p = Start-Process cmd -ArgumentList '/k','cd','/d','%~dp0..\mcp-server','&&','npm','run','start' -PassThru; $p.Id" > "%TEMP%\mcp.pid"
set /p MCP_PID=<"%TEMP%\mcp.pid"
echo        Started with PID: %MCP_PID%

:: Wait for MCP server to initialize
timeout /t 3 /nobreak >nul

:: Start Vox Agents and get PID
echo [3/3] Starting Vox Agents (mode: %VOX_MODE%)...
powershell -Command "$p = Start-Process cmd -ArgumentList '/k','cd','/d','%~dp0..\vox-agents','&&','npm','run','%VOX_MODE%' -PassThru; $p.Id" > "%TEMP%\vox.pid"
set /p VOX_PID=<"%TEMP%\vox.pid"
echo        Started with PID: %VOX_PID%

echo.
echo ========================================
echo All services started successfully!
echo ========================================
echo.
echo Services running:
echo   - Bridge Service (Port 5000, PID: %BRIDGE_PID%)
echo   - MCP Server (Port 4000, PID: %MCP_PID%)
echo   - Vox Agents (Mode: %VOX_MODE%, PID: %VOX_PID%)
echo.
echo Press ENTER to STOP all services...
set /p "STOP_CONFIRM="

echo.
echo [INFO] Shutting down services...

:: Kill services in reverse order using their PIDs
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