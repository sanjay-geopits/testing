@echo off
TITLE GeoMon Mail Monitor
echo ==========================================
echo    GeoMon - Mail Log Monitor
echo ==========================================
echo.
echo Starting Background Mail Processor...
echo (Watches for RetailScan and RDS log emails)
echo.

python backend\email_extracter.py

pause
