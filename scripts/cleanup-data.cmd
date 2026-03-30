@echo off
REM Clean up data files
echo Cleaning up data files...
if exist "%~dp0..\mcp-server\data" recycle /q "%~dp0..\mcp-server\data\*.*" 2>nul
if exist "%~dp0..\vox-agents\telemetry" recycle /s /q "%~dp0..\vox-agents\telemetry\*.*" 2>nul
echo Data files cleaned.