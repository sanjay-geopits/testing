"""
GeoMon Core Configuration
All environment variables resolved here — single source of truth.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ── Database ──────────────────────────────────────────────────────
DB_HOST     = os.getenv("DB_HOST", "localhost")
DB_PORT     = os.getenv("DB_PORT", "5432")
DB_NAME     = os.getenv("DB_NAME", "geovexsight")
DB_USER     = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "2025")

# ── Security ──────────────────────────────────────────────────────
JWT_SECRET      = os.getenv("JWT_SECRET", "super-secret-key-geopits")
JWT_ALGORITHM   = "HS256"
JWT_EXPIRE_MINS = 60 * 24 * 7     # 7 days

# ── Mail / Exchange ───────────────────────────────────────────────
USER_EMAIL    = os.getenv("USER_EMAIL", "")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
APP_CLIENT    = os.getenv("APP_CLIENT", "")
APP_SECRET    = os.getenv("APP_SECRET", "")
APP_TENANT    = os.getenv("APP_TENANT", "")
APP_REDIRECT_URI = os.getenv(
    "APP_REDIRECT_URI",
    "https://api.geomon.geopits.com/api/auth/callback/microsoft"
)

# ── OpenAI ───────────────────────────────────────────────────────
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# ── Network / Access ─────────────────────────────────────────────
ALLOWED_IP_NETWORKS = [
    n.strip()
    for n in os.getenv("ALLOWED_IP_NETWORKS", "127.0.0.1,::1,localhost").split(",")
    if n.strip()
]
DEV_SSO_BYPASS = os.getenv("DEV_SSO_BYPASS", "false").lower() == "true"
