@echo off
TITLE GeoMon Server Restarter

echo Stopping GeoMon Processes...
taskkill /F /IM nginx.exe /T 2>nul
taskkill /F /IM python.exe /T 2>nul

echo.
echo All processes stopped. Starting server...
echo.

call start_server.bat
