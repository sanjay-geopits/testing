"""
api/clients.py — Client Configuration Endpoints
Handles: admin_clients, client_access, client_alert_settings
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import psycopg2.extras

from core.database import get_connection
from core.deps import get_current_user, require_admin

router = APIRouter()


class ClientCreate(BaseModel):
    client_name: str
    db_type: str
    server_name: str
    client_email: Optional[str] = None
    phone_number: Optional[str] = None


class AlertSettingsUpdate(BaseModel):
    client_name: str
    db_type: str
    cpu_threshold: Optional[float] = 80
    memory_threshold: Optional[float] = 80
    disk_threshold: Optional[float] = 80
    io_threshold: Optional[float] = 80
    client_emails: Optional[str] = None
    cc_emails: Optional[str] = None


@router.get("/")
def list_clients(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM admin_clients ORDER BY client_name, db_type;")
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


@router.post("/")
def create_client(req: ClientCreate, current_user: dict = Depends(require_admin)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO admin_clients (client_name, db_type, server_name, client_email, phone_number)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT ON CONSTRAINT uq_admin_clients_combo DO NOTHING
            RETURNING id;
        """, (req.client_name, req.db_type, req.server_name, req.client_email, req.phone_number))
        result = cur.fetchone()
        conn.commit()
        return {"id": result[0] if result else None, "message": "Client saved"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()


@router.get("/access")
def list_client_access(current_user: dict = Depends(require_admin)):
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM client_access ORDER BY client_name, technology;")
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


@router.get("/alert-settings")
def list_alert_settings(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM client_alert_settings ORDER BY client_name;")
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


@router.post("/alert-settings")
def upsert_alert_settings(req: AlertSettingsUpdate, current_user: dict = Depends(require_admin)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO client_alert_settings
                (client_name, db_type, cpu_threshold, memory_threshold, disk_threshold,
                 io_threshold, client_emails, cc_emails)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT ON CONSTRAINT uq_client_tech DO UPDATE SET
                cpu_threshold    = EXCLUDED.cpu_threshold,
                memory_threshold = EXCLUDED.memory_threshold,
                disk_threshold   = EXCLUDED.disk_threshold,
                io_threshold     = EXCLUDED.io_threshold,
                client_emails    = EXCLUDED.client_emails,
                cc_emails        = EXCLUDED.cc_emails;
        """, (
            req.client_name, req.db_type, req.cpu_threshold, req.memory_threshold,
            req.disk_threshold, req.io_threshold, req.client_emails, req.cc_emails
        ))
        conn.commit()
        return {"message": "Alert settings saved"}
    finally:
        conn.close()
