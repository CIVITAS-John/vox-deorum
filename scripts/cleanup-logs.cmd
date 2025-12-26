@echo off
REM Clean up log files
echo Cleaning up log files...
if exist "%~dp0..\bridge-service\logs" del /q "%~dp0..\bridge-service\logs\*.*" 2>nul
if exist "%~dp0..\mcp-server\logs" del /q "%~dp0..\mcp-server\logs\*.*" 2>nul
if exist "%~dp0..\vox-agents\logs" del /q "%~dp0..\vox-agents\logs\*.*" 2>nul
echo Log files cleaned.