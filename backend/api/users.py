"""
api/users.py — User Management Endpoints
Handles: list users, create, update role/profile, delete
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import psycopg2.extras

from core.database import get_connection
from core.security import hash_password
from core.deps import get_current_user, require_admin

router = APIRouter()


class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = "user"


class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    profile_pic: Optional[str] = None


@router.get("/")
def list_users(current_user: dict = Depends(require_admin)):
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id, username, email, full_name, role, profile_pic, last_active_at FROM users ORDER BY id;")
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


@router.post("/")
def create_user(req: UserCreate, current_user: dict = Depends(require_admin)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO users (username, hashed_password, email, full_name, role) VALUES (%s,%s,%s,%s,%s) RETURNING id;",
            (req.username, hash_password(req.password), req.email, req.full_name, req.role)
        )
        user_id = cur.fetchone()[0]
        conn.commit()
        return {"id": user_id, "message": "User created"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()


@router.put("/{user_id}")
def update_user(user_id: int, req: UserUpdate, current_user: dict = Depends(require_admin)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        updates, params = [], []
        for field in ["email", "full_name", "role", "profile_pic"]:
            val = getattr(req, field)
            if val is not None:
                updates.append(f"{field} = %s")
                params.append(val)
        if not updates:
            raise HTTPException(status_code=400, detail="Nothing to update")
        params.append(user_id)
        cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = %s;", params)
        conn.commit()
        return {"updated": cur.rowcount}
    finally:
        conn.close()


@router.delete("/{user_id}")
def delete_user(user_id: int, current_user: dict = Depends(require_admin)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM users WHERE id = %s AND username != 'admin';", (user_id,))
        conn.commit()
        return {"deleted": cur.rowcount}
    finally:
        conn.close()


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return {k: v for k, v in current_user.items() if k != "hashed_password"}
