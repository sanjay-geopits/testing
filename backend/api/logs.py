"""
api/logs.py — Database Monitoring Logs Endpoints
Handles: log listing, filtering, archiving, bulk-archive, metadata, severity stats
"""
from fastapi import APIRouter, Query, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
import psycopg2.extras

from core.database import get_connection
from core.deps import get_current_user

router = APIRouter()


class BulkArchiveRequest(BaseModel):
    log_hashes: List[str]
    archive: bool = True


class LogMetadataRequest(BaseModel):
    log_hash: str
    status: Optional[str] = None
    owner: Optional[str] = None
    client_visibility: Optional[str] = None
    ticket_status: Optional[str] = None
    next_action: Optional[str] = None


@router.get("/")
def list_logs(
    client: Optional[str] = None,
    db_type: Optional[str] = None,
    severity: Optional[str] = None,
    archived: bool = False,
    page: int = 1,
    page_size: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """List monitoring logs with optional filters and pagination."""
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        conditions = ["is_archived = %s"]
        params = [archived]

        if client:
            conditions.append("LOWER(client_name) = LOWER(%s)")
            params.append(client)
        if db_type:
            conditions.append("LOWER(db_type) = LOWER(%s)")
            params.append(db_type)
        if severity:
            conditions.append("LOWER(severity) = LOWER(%s)")
            params.append(severity)

        where = " AND ".join(conditions)
        offset = (page - 1) * page_size

        cur.execute(
            f"SELECT * FROM db_monitoring_logs WHERE {where} "
            f"ORDER BY log_time_ist DESC LIMIT %s OFFSET %s;",
            params + [page_size, offset]
        )
        rows = cur.fetchall()
        cur.execute(f"SELECT COUNT(*) FROM db_monitoring_logs WHERE {where};", params)
        total = cur.fetchone()["count"]
        return {"total": total, "page": page, "page_size": page_size, "data": [dict(r) for r in rows]}
    finally:
        conn.close()


@router.post("/bulk-archive")
def bulk_archive(req: BulkArchiveRequest, current_user: dict = Depends(get_current_user)):
    """Archive or unarchive multiple logs by their hash."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE db_monitoring_logs SET is_archived = %s WHERE log_hash = ANY(%s);",
            (req.archive, req.log_hashes)
        )
        conn.commit()
        return {"updated": cur.rowcount, "archived": req.archive}
    finally:
        conn.close()


@router.put("/metadata")
def update_log_metadata(req: LogMetadataRequest, current_user: dict = Depends(get_current_user)):
    """Update triage metadata on a single log record."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        updates = []
        params = []
        for field in ["status", "owner", "client_visibility", "ticket_status", "next_action"]:
            val = getattr(req, field)
            if val is not None:
                updates.append(f"{field} = %s")
                params.append(val)
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        params.append(req.log_hash)
        cur.execute(
            f"UPDATE db_monitoring_logs SET {', '.join(updates)}, status_updated_at = CURRENT_TIMESTAMP "
            f"WHERE log_hash = %s;",
            params
        )
        conn.commit()
        return {"updated": cur.rowcount}
    finally:
        conn.close()


@router.get("/stats")
def log_stats(
    client: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Returns severity breakdown counts for dashboard cards."""
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cond = "WHERE is_archived = FALSE"
        params = []
        if client:
            cond += " AND LOWER(client_name) = LOWER(%s)"
            params.append(client)
        cur.execute(
            f"SELECT severity, COUNT(*) as count FROM db_monitoring_logs {cond} GROUP BY severity;",
            params
        )
        return {row["severity"] or "Unknown": row["count"] for row in cur.fetchall()}
    finally:
        conn.close()
