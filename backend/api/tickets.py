"""
api/tickets.py — Incident Ticket Endpoints
Handles: CRUD, comments, status updates, assignment
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
import psycopg2.extras
from datetime import datetime

from core.database import get_connection
from core.deps import get_current_user

router = APIRouter()


class TicketCreate(BaseModel):
    business_unit: Optional[str] = None
    company: Optional[str] = None
    contact: Optional[str] = None
    ticket_name: str
    category: Optional[str] = "General"
    priority: Optional[str] = "Medium"
    agent: Optional[str] = "Unassigned"
    description: Optional[str] = None


class TicketUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    agent: Optional[str] = None
    description: Optional[str] = None


class CommentCreate(BaseModel):
    content: str
    comment_type: Optional[str] = "internal"
    attachments: Optional[str] = None


@router.get("/")
def list_tickets(
    status: Optional[str] = None,
    company: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    current_user: dict = Depends(get_current_user)
):
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cond = ["1=1"]
        params = []
        if status:
            cond.append("UPPER(status) = UPPER(%s)")
            params.append(status)
        if company:
            cond.append("LOWER(company) = LOWER(%s)")
            params.append(company)
        where = " AND ".join(cond)
        offset = (page - 1) * page_size
        cur.execute(
            f"SELECT * FROM tickets WHERE {where} ORDER BY created_at DESC LIMIT %s OFFSET %s;",
            params + [page_size, offset]
        )
        rows = cur.fetchall()
        cur.execute(f"SELECT COUNT(*) FROM tickets WHERE {where};", params)
        total = cur.fetchone()["count"]
        return {"total": total, "page": page, "page_size": page_size, "data": [dict(r) for r in rows]}
    finally:
        conn.close()


@router.post("/")
def create_ticket(req: TicketCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO tickets
                (business_unit, company, contact, ticket_name, category, status, priority, agent, description, created_by)
            VALUES (%s, %s, %s, %s, %s, 'OPEN', %s, %s, %s, %s)
            RETURNING id;
        """, (
            req.business_unit, req.company, req.contact, req.ticket_name,
            req.category, req.priority, req.agent, req.description,
            current_user["username"]
        ))
        ticket_id = cur.fetchone()[0]
        conn.commit()
        return {"id": ticket_id, "message": "Ticket created successfully"}
    finally:
        conn.close()


@router.get("/{ticket_id}")
def get_ticket(ticket_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM tickets WHERE id = %s;", (ticket_id,))
        ticket = cur.fetchone()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        cur.execute(
            "SELECT * FROM ticket_comments WHERE ticket_id = %s ORDER BY created_at ASC;",
            (ticket_id,)
        )
        comments = cur.fetchall()
        return {"ticket": dict(ticket), "comments": [dict(c) for c in comments]}
    finally:
        conn.close()


@router.put("/{ticket_id}")
def update_ticket(ticket_id: int, req: TicketUpdate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        updates, params = [], []
        for field in ["status", "priority", "agent", "description"]:
            val = getattr(req, field)
            if val is not None:
                updates.append(f"{field} = %s")
                params.append(val)
                if field == "status" and val.upper() in ("RESOLVED", "CLOSED"):
                    updates.append("resolved_at = CURRENT_TIMESTAMP")
                    updates.append("resolved_by = %s")
                    params.append(current_user["username"])
        if not updates:
            raise HTTPException(status_code=400, detail="Nothing to update")
        params.append(ticket_id)
        cur.execute(f"UPDATE tickets SET {', '.join(updates)} WHERE id = %s;", params)
        conn.commit()
        return {"updated": cur.rowcount}
    finally:
        conn.close()


@router.post("/{ticket_id}/comments")
def add_comment(ticket_id: int, req: CommentCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
            VALUES (%s, %s, %s, %s, %s) RETURNING id;
        """, (ticket_id, current_user["username"], req.comment_type, req.content, req.attachments))
        comment_id = cur.fetchone()[0]
        conn.commit()
        return {"id": comment_id, "message": "Comment added"}
    finally:
        conn.close()
