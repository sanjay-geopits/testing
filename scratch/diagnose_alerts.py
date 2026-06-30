import os
import sys
import datetime
from zoneinfo import ZoneInfo

# Add workspace path to sys.path
sys.path.append("/Users/sanjay/Documents/GeoVexSight-App-main 2")

from email_extracter import get_account, get_connection, parse_subject, parse_mssql_subject_details

account = get_account()
if not account:
    print("Could not connect to Account")
    sys.exit(1)

print("Connected successfully to Account")
try:
    folder = account.root / "Top of Information Store" / "MSSQL Alert"
    print("Folder resolved successfully")
    
    # Fetch latest 20 items from MSSQL Alert folder
    items = list(folder.all().order_by('-datetime_received')[:20])
    print(f"Found {len(items)} items in MSSQL Alert folder:")
    
    conn = get_connection()
    cur = conn.cursor()
    
    print(f"{'RECEIVED':<20} | {'SENDER':<30} | {'SUBJECT':<50} | {'PROCESSED?':<10} | {'PARSED CLIENT/SERVER/DB/TYPE'}")
    print("-" * 150)
    
    for item in items:
        subject = (item.subject or "").strip()
        sender = "SYSTEM"
        if hasattr(item, 'sender') and item.sender and hasattr(item.sender, 'email_address') and item.sender.email_address:
            sender = item.sender.email_address
        
        msg_id = getattr(item, 'id', None) or getattr(item, 'message_id', None)
        
        # Check if in processed_emails
        cur.execute("SELECT 1 FROM processed_emails WHERE message_id = %s LIMIT 1", (str(msg_id),))
        processed = cur.fetchone() is not None
        
        parsed = parse_subject(subject)
        
        print(f"{str(item.datetime_received):<20} | {sender[:30]:<30} | {subject[:50]:<50} | {str(processed):<10} | {parsed}")
        
    cur.close()
    conn.close()

except Exception as e:
    print("Error:", e)
    import traceback
    traceback.print_exc()
