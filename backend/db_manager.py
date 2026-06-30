import os
import sys
# Add backend directory to path for absolute imports resolution
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import psycopg2
from migrations import get_connection as get_mig_conn

def get_connection():
    """Returns a database connection from migrations."""
    return get_mig_conn()
