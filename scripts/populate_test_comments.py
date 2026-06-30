import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    host = os.getenv("DB_HOST", "localhost")
    database = os.getenv("DB_NAME", "Incoming-error-data")
    user = os.getenv("DB_USER", "postgres")
    port = os.getenv("DB_PORT", "5432")
    
    passwords = [
        os.getenv("DB_PASSWORD"),
        "y7UMhWmLcqSJzmhTGDyK",
        "geopitsaidata",
        "postgres"
    ]
    
    for pwd in passwords:
        if pwd is None:
            continue
        try:
            conn = psycopg2.connect(
                host=host,
                database=database,
                user=user,
                password=pwd,
                port=port
            )
            return conn
        except Exception:
            continue
            
    return psycopg2.connect(
        host=host,
        database=database,
        user=user,
        port=port
    )

def populate():
    print("Populating test comments and audit logs in PostgreSQL...")
    conn = get_connection()
    try:
        cur = conn.cursor()
        
        # Clear existing comments first
        cur.execute("DELETE FROM ticket_comments;")
        
        # Get active tickets
        cur.execute("SELECT id FROM tickets;")
        ticket_ids = [row[0] for row in cur.fetchall()]
        
        if not ticket_ids:
            print("No tickets found in database to attach comments to.")
            return
            
        for ticket_id in ticket_ids:
            # 1. System Log
            cur.execute("""
                INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
                VALUES (%s, 'System', 'log', 'Ticket modified: Status set to "IN PROGRESS", Priority to "High", Agent to "sanjay"', '');
            """, (ticket_id,))
            
            # 2. Vishaal Public Note
            cur.execute("""
                INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
                VALUES (%s, 'Vishaal', 'note', 'Sanjay shared the report in the group. I have attached the report to the ticket.\nTicket details need to be added.\nHO to Gopal.', 'cnergee_mysql_report_2026_05_4.docx');
            """, (ticket_id,))
            
            # 3. Admin Reply
            cur.execute("""
                INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
                VALUES (%s, 'admin', 'reply', 'Received the MySQL report. Restoring port connectivity and validating schemas now.', '');
            """, (ticket_id,))
            
        conn.commit()
        print("SUCCESS: Database comments and audit logs populated successfully!")
    except Exception as e:
        conn.rollback()
        print("Error populating database comments:", e)
    finally:
        conn.close()

if __name__ == "__main__":
    populate()
