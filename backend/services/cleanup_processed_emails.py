import sys
import os
import psycopg2

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from config import DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, DB_PORT

def run_cleanup():
    print("[CLEANUP] Connecting to database to prune processed_emails table...")
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT
        )
        cur = conn.cursor()
        cur.execute("SET timezone TO 'Asia/Kolkata';")
        cur.execute("DELETE FROM processed_emails WHERE processed_at < NOW() - INTERVAL '30 days';")
        deleted_count = cur.rowcount
        conn.commit()
        print(f"[CLEANUP] Successfully pruned {deleted_count} old processed email records (older than 30 days).")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[CLEANUP ERROR] Failed to execute cleanup script: {e}")

if __name__ == "__main__":
    run_cleanup()
