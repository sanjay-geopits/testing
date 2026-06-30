import sys
import os
import re
import datetime

# Add the workspace path
sys.path.append("/Users/sanjay/Documents/GeoVexSight-App-main 2")

from email_extracter import get_account, get_connection, process_incoming_reply

def run_test():
    account = get_account()
    if not account:
        print("Could not connect to Outlook account.")
        return

    inbox = account.inbox
    print("Fetching last 15 messages from Inbox (recent first)...")
    inbox_items = inbox.all()[:15]
    print(f"Found {len(inbox_items)} emails in Inbox.")

    for item in inbox_items:
        subject = item.subject or ""
        sender = item.sender.email_address if item.sender else "Unknown"
        received = item.datetime_received
        print(f"\nEvaluating: Subject='{subject}' | From='{sender}' | Received='{received}' | is_read={item.is_read}")

        ticket_match = re.search(r'Ticket\s*#?\s*(\d+)', subject, re.IGNORECASE)
        if ticket_match:
            print(f"-> Matches Ticket ID: {ticket_match.group(1)}")
            
            # Let's run process_incoming_reply
            try:
                processed = process_incoming_reply(item)
                print(f"-> process_incoming_reply returned: {processed}")
            except Exception as e:
                print(f"-> Error in process_incoming_reply: {e}")
        else:
            print("-> No Ticket ID match in subject.")

if __name__ == "__main__":
    run_test()
