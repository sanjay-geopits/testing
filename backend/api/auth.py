"""
api/auth.py — Authentication & Session Endpoints
Handles: login, logout, SSO (Microsoft OAuth), password management
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional
import psycopg2.extras

from core.database import get_connection
from core.security import hash_password, verify_password, create_access_token
from core.config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_MINS, APP_REDIRECT_URI
from datetime import timedelta

router = APIRouter()

class LoginRequest(BaseModel):
    username: str
    password: str

class ChangePasswordRequest(BaseModel):
    username: str
    old_password: str
    new_password: str

@router.post("/login")
def login(req: LoginRequest):
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT id, username, email, hashed_password, role, full_name, profile_pic "
            "FROM users WHERE LOWER(username) = LOWER(%s) OR LOWER(email) = LOWER(%s);",
            (req.username, req.username)
        )
        user = cur.fetchone()
        if not user or not verify_password(req.password, user["hashed_password"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        token = create_access_token(
            {"sub": user["username"]},
            expires_delta=timedelta(minutes=JWT_EXPIRE_MINS)
        )
        return {
            "access_token": token,
            "token_type": "bearer",
            "username": user["username"],
            "role": user["role"],
            "full_name": user["full_name"],
            "profile_pic": user["profile_pic"],
        }
    finally:
        conn.close()

@router.post("/change-password")
def change_password(req: ChangePasswordRequest):
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT hashed_password FROM users WHERE LOWER(username) = LOWER(%s);", (req.username,))
        user = cur.fetchone()
        if not user or not verify_password(req.old_password, user["hashed_password"]):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
        new_hash = hash_password(req.new_password)
        cur.execute("UPDATE users SET hashed_password = %s WHERE LOWER(username) = LOWER(%s);",
                    (new_hash, req.username))
        conn.commit()
        return {"message": "Password changed successfully"}
    finally:
        conn.close()
