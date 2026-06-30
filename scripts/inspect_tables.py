import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def inspect():
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        database=os.getenv("DB_NAME", "geomon"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "2025"),
        port=os.getenv("DB_PORT", "5432")
    )
    cur = conn.cursor()
    cur.execute("""
        SELECT client_name, server_name, db_type, log_message, email_subject, email_received_time 
        FROM db_monitoring_logs 
        WHERE log_type = 'db_uptime' AND date(log_time_ist) = '2026-06-15'
        LIMIT 5;
    """)
    for r in cur.fetchall():
        print(f"Client: {r[0]} | Server: {r[1]} | DB: {r[2]} | Message: {r[3]} | Subject: {r[4]} | Received: {r[5]}")
    cur.close()
    conn.close()

if __name__ == "__main__":
    inspect()
