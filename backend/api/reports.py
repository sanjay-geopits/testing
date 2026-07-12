"""
api/reports.py — Client Report & Review Endpoints
Handles: upload, download, list, review/rating
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import psycopg2.extras

from core.database import get_connection
from core.deps import get_current_user

router = APIRouter()


class ReportCreate(BaseModel):
    client_name: str
    title: str
    month: Optional[str] = None
    year: Optional[str] = None
    file_name: Optional[str] = None
    file_data: Optional[str] = None  # base64 or URL
    notes: Optional[str] = None


class ReviewCreate(BaseModel):
    report_id: int
    rating: int
    comment: Optional[str] = None
    mom: Optional[str] = None


@router.get("/")
def list_reports(
    client: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        if client:
            cur.execute(
                "SELECT * FROM client_reports WHERE LOWER(client_name) = LOWER(%s) ORDER BY uploaded_at DESC;",
                (client,)
            )
        else:
            cur.execute("SELECT * FROM client_reports ORDER BY uploaded_at DESC;")
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


@router.post("/")
def upload_report(req: ReportCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO client_reports (client_name, title, month, year, file_name, file_data, notes, uploaded_by)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id;
        """, (
            req.client_name, req.title, req.month, req.year,
            req.file_name, req.file_data, req.notes, current_user["username"]
        ))
        report_id = cur.fetchone()[0]
        conn.commit()
        return {"id": report_id, "message": "Report uploaded"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()


@router.get("/{report_id}")
def get_report(report_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM client_reports WHERE id = %s;", (report_id,))
        report = cur.fetchone()
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        cur.execute("SELECT * FROM report_reviews WHERE report_id = %s ORDER BY created_at DESC;", (report_id,))
        reviews = cur.fetchall()
        return {"report": dict(report), "reviews": [dict(r) for r in reviews]}
    finally:
        conn.close()


@router.post("/reviews")
def add_review(req: ReviewCreate, current_user: dict = Depends(get_current_user)):
    if req.rating < 1 or req.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO report_reviews (report_id, username, rating, comment, mom)
            VALUES (%s,%s,%s,%s,%s) RETURNING id;
        """, (req.report_id, current_user["username"], req.rating, req.comment, req.mom))
        review_id = cur.fetchone()[0]
        conn.commit()
        return {"id": review_id, "message": "Review submitted"}
    finally:
        conn.close()
