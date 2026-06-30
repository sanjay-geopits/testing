#!/bin/bash

# GeoMon Dashboard - Production

echo "=========================================="
echo "   GeoMon Dashboard - Production"
echo "=========================================="
echo ""

APP_DIR="/home/ubuntu/GeoMon-App"
VENV_DIR="/home/ubuntu/venv"
LOG_DIR="$APP_DIR/logs"

mkdir -p "$LOG_DIR"
cd "$APP_DIR" || exit 1

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Start nginx
sudo systemctl start nginx

# Kill old processes (if any)
pkill -f gunicorn 2>/dev/null || true
pkill -f backend/email_extracter.py 2>/dev/null || true
pkill -f email_extracter.py 2>/dev/null || true
pkill -f backend/migrate_top_logs.py 2>/dev/null || true
pkill -f migrate_top_logs.py 2>/dev/null || true

sleep 2

# Background jobs
nohup python3 backend/email_extracter.py > "$LOG_DIR/mail.log" 2>&1 &
nohup python3 backend/migrate_top_logs.py > "$LOG_DIR/migrator.log" 2>&1 &

sleep 3

# Start FastAPI with gunicorn
nohup "$VENV_DIR/bin/gunicorn" \
  -k uvicorn.workers.UvicornWorker \
  backend.app:app \
  --workers 4 \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --access-logfile "$LOG_DIR/access.log" \
  --error-logfile "$LOG_DIR/error.log" \
  > "$LOG_DIR/gunicorn.log" 2>&1 &

echo "All services started 🚀"
