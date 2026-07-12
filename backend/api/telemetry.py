"""
api/telemetry.py — Telemetry & Server Utilization Endpoints
Handles: telemetry records, server utilization history, db uptime, size history
"""
from fastapi import APIRouter, Query, Depends
from typing import Optional, List
import psycopg2.extras

from core.database import get_connection
from core.deps import get_current_user

router = APIRouter()


@router.get("/records")
def get_telemetry_records(
    client: Optional[str] = None,
    server: Optional[str] = None,
    report_type: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Query unified telemetry_records table (all 22 report types)."""
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cond = ["1=1"]
        params = []
        if client:
            cond.append("LOWER(client_name) = LOWER(%s)")
            params.append(client)
        if server:
            cond.append("LOWER(server_name) = LOWER(%s)")
            params.append(server)
        if report_type:
            cond.append("LOWER(report_type) = LOWER(%s)")
            params.append(report_type)
        where = " AND ".join(cond)
        offset = (page - 1) * page_size
        cur.execute(
            f"SELECT * FROM telemetry_records WHERE {where} ORDER BY captured_at DESC LIMIT %s OFFSET %s;",
            params + [page_size, offset]
        )
        rows = cur.fetchall()
        cur.execute(f"SELECT COUNT(*) FROM telemetry_records WHERE {where};", params)
        total = cur.fetchone()["count"]
        return {"total": total, "page": page, "data": [dict(r) for r in rows]}
    finally:
        conn.close()


@router.get("/utilization")
def get_utilization(
    server: Optional[str] = None,
    hours: int = 24,
    current_user: dict = Depends(get_current_user)
):
    """Server CPU/Memory/Disk/IO utilization over a time window."""
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cond = ["captured_at >= NOW() - INTERVAL '%s hours'"]
        params = [hours]
        if server:
            cond.append("LOWER(server_name) = LOWER(%s)")
            params.append(server)
        where = " AND ".join(cond)
        cur.execute(
            f"SELECT * FROM server_utilization_history WHERE {where} ORDER BY captured_at DESC LIMIT 500;",
            params
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


@router.get("/uptime")
def get_uptime(
    client: Optional[str] = None,
    server: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """DB uptime and last restart history."""
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cond = ["1=1"]
        params = []
        if client:
            cond.append("LOWER(client_name) = LOWER(%s)")
            params.append(client)
        if server:
            cond.append("LOWER(server_name) = LOWER(%s)")
            params.append(server)
        where = " AND ".join(cond)
        cur.execute(
            f"SELECT * FROM db_uptime_history WHERE {where} ORDER BY captured_at DESC LIMIT 200;",
            params
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


@router.get("/report-types")
def get_report_types(current_user: dict = Depends(get_current_user)):
    """Returns all distinct report_type values in telemetry_records."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT report_type FROM telemetry_records ORDER BY report_type;")
        return [r[0] for r in cur.fetchall()]
    finally:
        conn.close()
