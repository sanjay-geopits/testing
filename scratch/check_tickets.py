import sys
sys.path.append("/Users/sanjay/Documents/GeoVexSight-App-main 2")
from email_extracter import get_connection

conn = get_connection()
cur = conn.cursor()
cur.execute("SELECT id, ticket_name, status, created_at FROM tickets WHERE created_at::date = '2026-06-29';")
rows = cur.fetchall()
print(f"Found {len(rows)} tickets for today:")
for r in rows:
    print(r)
cur.close()
conn.close()
