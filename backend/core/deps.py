"""
GeoMon FastAPI Dependency Injection
Reusable auth dependencies for all API routes.
"""
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from core.database import get_db
from core.security import decode_access_token
import psycopg2.extras

from typing import Optional

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def _resolve_user_from_token(token: Optional[str], conn) -> dict:
    """Decode JWT and load user record from DB."""
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT id, username, email, role, full_name, profile_pic FROM users WHERE username = %s;",
            (username,)
        )
        user = cur.fetchone()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {
        **dict(user),
        "isAdmin": user["role"] in ("admin",),
        "isLead":  user["role"] in ("lead", "admin"),
    }


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
) -> dict:
    """Auth dependency — any authenticated user."""
    from core.database import get_connection
    conn = get_connection()
    try:
        return _resolve_user_from_token(token, conn)
    finally:
        conn.close()


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Auth dependency — admin-only endpoints."""
    if not user.get("isAdmin"):
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user


def get_client_user(request: Request, token: Optional[str] = Depends(oauth2_scheme)) -> dict:
    """Auth dependency — accepts both internal JWT and cookie-based session."""
    from core.database import get_connection
    # Prefer header token, fall back to session cookie
    if not token:
        token = request.cookies.get("access_token")
    conn = get_connection()
    try:
        return _resolve_user_from_token(token, conn)
    finally:
        conn.close()
