@echo off
TITLE GeoMon Production Server
echo ==========================================
echo    GeoMon Dashboard - Production
echo ==========================================
echo.

:: Start Nginx
echo Starting Nginx Reverse Proxy...
cd C:\nginx\nginx-1.28.3
start "" nginx.exe
timeout /t 3 /nobreak > nul
echo Nginx Started! ✓
echo.

:: Go back to app directory
cd C:\Users\kabilan\ai_log_analyzer

echo Starting Background Mail Processor...
start "GeoMon Mail Monitor" python backend\email_extracter.py
timeout /t 5 /nobreak > nul
echo Mail Processor Started! ✓
echo.

echo Starting MSSQL Log Migrator...
start "GeoMon Log Migrator" python backend\migrate_top_logs.py
timeout /t 5 /nobreak > nul
echo Log Migrator Started! ✓
echo.

echo Starting FastAPI Backend on port 8000...
echo (Accessible via https://api.geomon.geopits.com)
echo.

python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --workers 4 > uvicorn_debug.log 2>&1

pause
