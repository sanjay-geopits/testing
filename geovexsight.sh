#!/bin/bash
# ==========================================================
#  GeoMon Service Manager
#  Usage: ./geovexsight.sh [start|stop|restart|status|logs]
# ==========================================================

APP_DIR="/Users/sanjay/Documents/GeoVexSight-App-main 2"
LOG_DIR="$APP_DIR/logs"
PID_DIR="$APP_DIR/logs"   # store PIDs alongside logs

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}     GeoMon Service Manager           ${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
}

is_running() {
    local pidfile="$PID_DIR/$1.pid"
    if [ -f "$pidfile" ]; then
        local pid=$(cat "$pidfile")
        kill -0 "$pid" 2>/dev/null && echo "$pid" && return 0
    fi
    return 1
}

cmd_start() {
    print_header
    mkdir -p "$LOG_DIR"

    # ── 1. FastAPI (uvicorn) ──────────────────────────────
    if pid=$(is_running "app"); then
        echo -e "  ${YELLOW}⚡ App already running${NC} (PID $pid)"
    else
        cd "$APP_DIR"
        nohup python3 -u -m uvicorn backend.app:app \
            --host 0.0.0.0 --port 8000 --workers 1 \
            > "$LOG_DIR/app.log" 2>&1 &
        echo $! > "$PID_DIR/app.pid"
        echo -e "  ${GREEN}✓ FastAPI App started${NC} (PID $!)"
    fi
    sleep 2

    # ── 2. Mail Monitor ──────────────────────────────────
    if pid=$(is_running "mail"); then
        echo -e "  ${YELLOW}⚡ Mail monitor already running${NC} (PID $pid)"
    else
        cd "$APP_DIR"
        nohup python3 -u backend/email_extracter.py \
            > "$LOG_DIR/mail.log" 2>&1 &
        echo $! > "$PID_DIR/mail.pid"
        echo -e "  ${GREEN}✓ Mail Monitor started${NC} (PID $!)"
    fi
    sleep 2

    # ── 3. Log Migrator ──────────────────────────────────
    if pid=$(is_running "migrator"); then
        echo -e "  ${YELLOW}⚡ Log migrator already running${NC} (PID $pid)"
    else
        cd "$APP_DIR"
        nohup python3 -u backend/migrate_top_logs.py \
            > "$LOG_DIR/migrator.log" 2>&1 &
        echo $! > "$PID_DIR/migrator.pid"
        echo -e "  ${GREEN}✓ Log Migrator started${NC} (PID $!)"
    fi
    sleep 2

    # ── 4. Telemetry Sync ────────────────────────────────
    if pid=$(is_running "sync"); then
        echo -e "  ${YELLOW}⚡ Telemetry Sync already running${NC} (PID $pid)"
    else
        cd "$APP_DIR"
        nohup python3 -u backend/sync_service.py --loop \
            > "$LOG_DIR/sync_service.log" 2>&1 &
        echo $! > "$PID_DIR/sync.pid"
        echo -e "  ${GREEN}✓ Telemetry Sync started${NC} (PID $!)"
    fi

    echo ""
    echo -e "  ${CYAN}All services started. Run './geovexsight.sh status' to verify.${NC}"
    echo ""
}


cmd_stop() {
    print_header
    for svc in app mail migrator sync; do
        pidfile="$PID_DIR/$svc.pid"
        if [ -f "$pidfile" ]; then
            pid=$(cat "$pidfile")
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid" 2>/dev/null
                sleep 1
                # Force kill if still alive
                kill -9 "$pid" 2>/dev/null
                echo -e "  ${GREEN}✓ Stopped${NC} $svc (was PID $pid)"
            else
                echo -e "  ${YELLOW}○ Already stopped${NC} $svc"
            fi
            rm -f "$pidfile"
        else
            echo -e "  ${YELLOW}○ Not running${NC} $svc (no pidfile)"
        fi
    done

    # Also kill any stragglers by name
    pkill -f backend/email_extracter.py 2>/dev/null
    pkill -f email_extracter.py 2>/dev/null
    pkill -f backend/migrate_top_logs.py 2>/dev/null
    pkill -f migrate_top_logs.py 2>/dev/null
    pkill -f backend/sync_service.py 2>/dev/null
    pkill -f sync_service.py 2>/dev/null
    pkill -f "uvicorn backend.app:app" 2>/dev/null
    pkill -f "uvicorn app:app" 2>/dev/null
    echo ""
}

cmd_restart() {
    echo -e "${YELLOW}Restarting all GeoMon services...${NC}"
    cmd_stop
    sleep 3
    cmd_start
}

cmd_status() {
    print_header
    echo -e "  ${BLUE}Service Status:${NC}"
    echo ""

    svc_name() {
        case "$1" in
            app)      echo "FastAPI App     (port 8000)" ;;
            mail)     echo "Mail Monitor    (email_extracter)" ;;
            migrator) echo "Log Migrator    (migrate_top_logs)" ;;
            sync)     echo "Telemetry Sync   (sync_service)" ;;
        esac
    }
    svc_log() {
        case "$1" in
            app)      echo "app.log" ;;
            mail)     echo "mail.log" ;;
            migrator) echo "migrator.log" ;;
            sync)     echo "sync_service.log" ;;
        esac
    }

    for svc in app mail migrator sync; do
        label=$(svc_name "$svc")
        if pid=$(is_running "$svc"); then
            echo -e "  ${GREEN}● RUNNING${NC}  $label  (PID: $pid)"
        else
            echo -e "  ${RED}○ STOPPED${NC}  $label"
        fi
    done

    echo ""
    echo -e "  ${BLUE}Log files:${NC}"
    for svc in app mail migrator sync; do
        logname=$(svc_log "$svc")
        f="$LOG_DIR/$logname"
        if [ -f "$f" ]; then
            lines=$(wc -l < "$f" | tr -d ' ')
            size=$(du -sh "$f" 2>/dev/null | cut -f1)
            last=$(tail -1 "$f" 2>/dev/null | cut -c1-80)
            echo -e "    ${CYAN}→${NC} $logname  ($lines lines, $size)  $last"
        fi
    done
    echo ""

    # Check port 8000
    echo -e "  ${BLUE}Port status:${NC}"
    if nc -z 127.0.0.1 8000 2>/dev/null; then
        echo -e "    ${GREEN}● Port 8000 is OPEN${NC} (API reachable)"
    else
        echo -e "    ${RED}○ Port 8000 is CLOSED${NC}"
    fi
    echo ""
}

cmd_logs() {
    local svc="${1:-mail}"
    case "$svc" in
        app)      tail -f "$LOG_DIR/app.log" ;;
        mail)     tail -f "$LOG_DIR/mail.log" ;;
        migrator) tail -f "$LOG_DIR/migrator.log" ;;
        sync)     tail -f "$LOG_DIR/sync_service.log" ;;
        *)
            echo "Usage: $0 logs [app|mail|migrator|sync]"
            ;;
    esac
}

# ── Main ──────────────────────────────────────────────────
case "${1:-status}" in
    start)   cmd_start ;;
    stop)    cmd_stop ;;
    restart) cmd_restart ;;
    status)  cmd_status ;;
    logs)    cmd_logs "${2:-mail}" ;;
    *)
        echo ""
        echo "Usage: $0 [start|stop|restart|status|logs [app|mail|migrator|sync]]"
        echo ""
        echo "  start    — Start all services"
        echo "  stop     — Stop all services"
        echo "  restart  — Restart all services"
        echo "  status   — Show running status + log summary"
        echo "  logs     — Tail live log (app / mail / migrator / sync)"
        echo ""
        exit 1
        ;;
esac
