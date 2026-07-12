"""
GeoMon Database Connection Pool
Single connection pool shared across all modules.
"""
import psycopg2
import psycopg2.pool
from contextlib import contextmanager
from core.config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

_pool: psycopg2.pool.ThreadedConnectionPool | None = None


def init_pool(minconn: int = 2, maxconn: int = 20) -> None:
    """Initialize the connection pool. Called once at app startup."""
    global _pool
    _pool = psycopg2.pool.ThreadedConnectionPool(
        minconn, maxconn,
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )


def get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    if _pool is None:
        init_pool()
    return _pool


@contextmanager
def get_db():
    """Context manager that yields a connection and returns it to the pool."""
    pool = get_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def get_connection():
    """Direct connection for non-FastAPI contexts (daemons, migrations)."""
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT, database=DB_NAME,
        user=DB_USER, password=DB_PASSWORD,
    )
