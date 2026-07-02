import os
import sys
# Add backend directory to path for absolute imports resolution
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import re
import requests
import pandas as pd
from datetime import datetime
from bs4 import BeautifulSoup
from io import StringIO
from dotenv import load_dotenv
from migrations import get_connection

try:
    from cache_utils import cache_manager
except ImportError:
    cache_manager = None

load_dotenv()

# ==========================================================
# CONFIG & CREDENTIALS
# ==========================================================
TENANT_ID = os.getenv("APP_TENANT")
CLIENT_ID = os.getenv("APP_CLIENT")
CLIENT_SECRET = os.getenv("APP_SECRET")
# MAILBOX_EMAIL: the Exchange/Graph mailbox account used for READING telemetry emails.
# This is the mail reader identity (dccagent@geopits.com), NOT an alert recipient.
# Must be set via USER_EMAIL in .env / environment.
MAILBOX_EMAIL = os.getenv("USER_EMAIL") or os.getenv("TO_EMAILS")

TARGET_FOLDER = "MySQL Mongo Postgres- DB Size"

# ==========================================================
# HELPER FUNCTIONS
# ==========================================================

def get_token():
    url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    data = {
        "client_id": CLIENT_ID,
        "scope": "https://graph.microsoft.com/.default",
        "client_secret": CLIENT_SECRET,
        "grant_type": "client_credentials"
    }
    try:
        r = requests.post(url, data=data, timeout=15)
        if r.status_code != 200:
            print(f"[TELEMETRY] Auth Token failed ({r.status_code}): {r.text}")
            return None
        return r.json().get("access_token")
    except Exception as e:
        print(f"[TELEMETRY] Token exception: {e}")
        return None

def get_folder_id(token):
    headers = {"Authorization": f"Bearer {token}"}
    url = f"https://graph.microsoft.com/v1.0/users/{MAILBOX_EMAIL}/mailFolders?$top=100"
    try:
        r = requests.get(url, headers=headers, timeout=15)
        if r.status_code != 200:
            print(f"[TELEMETRY] Folder list failed: {r.text}")
            return None
        folders = r.json().get("value", [])
        for f in folders:
            name = f.get("displayName", "").strip()
            if name.lower() == TARGET_FOLDER.lower():
                print(f"[TELEMETRY] Target Folder Found: {name} ({f.get('id')})")
                return f.get("id")
        print(f"[TELEMETRY] Folder '{TARGET_FOLDER}' not found. Defaulting to Inbox search.")
        return None
    except Exception as e:
        print(f"[TELEMETRY] Folder list exception: {e}")
        return None

def convert_to_bytes(size_str):
    if not size_str:
        return 0
    size_str = str(size_str).strip().upper()
    try:
        # Standard cleaning
        size_str = size_str.replace(",", "")
        if "TB" in size_str:
            return int(float(size_str.replace("TB", "").strip()) * 1024 * 1024 * 1024 * 1024)
        elif "GB" in size_str:
            return int(float(size_str.replace("GB", "").strip()) * 1024 * 1024 * 1024)
        elif "MB" in size_str:
            return int(float(size_str.replace("MB", "").strip()) * 1024 * 1024)
        elif "KB" in size_str:
            return int(float(size_str.replace("KB", "").strip()) * 1024)
        elif "B" in size_str:
            return int(float(size_str.replace("B", "").strip()))
        else:
            return int(float(size_str))
    except Exception as e:
        print(f"[TELEMETRY] Size conversion error for '{size_str}': {e}")
        return 0

def extract_client_name(subject):
    try:
        subject_lower = subject.lower()
        
        # Exact known clients dictionary matching lower -> proper title
        known_clients = {
            "cnergee": "Cnergee",
            "runloyal": "Runloyal",
            "credopay": "CredoPay",
            "cropin": "Cropin",
            "flowglobal": "Flowglobal",
            "intentwise": "Intentwise",
            "360tf": "360tf",
            "artfine": "Artfine",
            "retailscan": "Retailscan",
            "shemaroo": "Shemaroo",
            "pepper advantage": "Pepper Advantage",
            "pepper": "Pepper Advantage",
            "chennaisilks": "ChennaiSilks",
            "geojit": "Geojit",
            "hpcl": "HPCL"
        }
        
        # 1. Check if any known client is explicitly inside the subject line
        for key, val in known_clients.items():
            if key in subject_lower:
                return val
                
        # 2. Fallback logic: check for bracket pattern e.g. [Intentwise]
        bracket_match = re.match(r"^\[(.*?)\]", subject)
        if bracket_match:
            return bracket_match.group(1).strip().capitalize()
            
        # 3. Fallback: split by space/special chars and take the first word
        cleaned = subject.split("|")[0].split("-")[0].strip()
        words = cleaned.split()
        if words:
            client = words[0].strip().capitalize()
            if client.lower() not in ["daily", "mysql", "postgresql", "mongodb", "db", "table"]:
                return client
                
        return "Unknown"
    except Exception as e:
        print(f"[TELEMETRY] Client extraction error: {e}")
        return "Unknown"

# ==========================================================
# PARSE DATE COLUMNS
# ==========================================================

def get_date_columns(df_columns):
    date_cols = []
    for col in df_columns:
        col_str = str(col).strip()
        # Matches formats like: 7.6.25, 24.05.2026, 8/6/2026, 2026-05-30, etc.
        if re.search(r"\b\d{1,4}[-./]\d{1,2}[-./]\d{2,4}\b", col_str):
            date_cols.append(col_str)
    return date_cols

def parse_date_string(date_str):
    try:
        date_str = date_str.replace(".", "-").replace("/", "-").strip()
        parts = date_str.split("-")
        if len(parts) == 3:
            # Check if it is YYYY-MM-DD
            if len(parts[0]) == 4:
                year = int(parts[0])
                month = int(parts[1])
                day = int(parts[2])
                return datetime(year, month, day).date()
            else:
                day = int(parts[0])
                month = int(parts[1])
                year_str = parts[2]
                if len(year_str) == 2:
                    year = 2000 + int(year_str)
                else:
                    year = int(year_str)
                return datetime(year, month, day).date()
    except Exception as e:
        print(f"[TELEMETRY] Date parse error for '{date_str}': {e}")
    return datetime.now().date()

# ==========================================================
# DATABASE HISTORY CHECKS
# ==========================================================

def client_has_history(cursor, client_name):
    # Check if we already have records for this client_name (not server_name)
    cursor.execute("SELECT id FROM database_size_history WHERE server_name = %s LIMIT 1", (client_name,))
    has_db = cursor.fetchone() is not None
    cursor.execute("SELECT id FROM table_size_history WHERE server_name = %s LIMIT 1", (client_name,))
    has_table = cursor.fetchone() is not None
    return has_db or has_table

def database_entry_exists(cursor, server_name, database_name, captured_date):
    cursor.execute(
        "SELECT id FROM database_size_history WHERE server_name=%s AND database_name=%s AND captured_date=%s LIMIT 1",
        (server_name, database_name, captured_date)
    )
    return cursor.fetchone() is not None

def table_entry_exists(cursor, server_name, database_name, table_name, captured_date):
    cursor.execute(
        "SELECT id FROM table_size_history WHERE server_name=%s AND database_name=%s AND table_name=%s AND captured_date=%s LIMIT 1",
        (server_name, database_name, table_name, captured_date)
    )
    return cursor.fetchone() is not None

def lookup_client_contact_details(cursor, client_name, db_type):
    from db_manager import get_alert_contacts
    res = get_alert_contacts(cursor, client_name, db_type)
    return res["client_email"], res["phone_number"]

def trigger_combined_growth_alert(cursor, client_name, db_type, db_changes, table_changes):
    if not db_changes and not table_changes:
        return

    try:
        from routes import send_email_outlook
    except Exception as e:
        print(f"[ALERT DAEMON] Error importing send_email_outlook: {e}")
        return

    # 1. Resolve contact details
    from db_manager import get_alert_contacts
    resolved = get_alert_contacts(cursor, client_name, db_type)
    to_emails = resolved["to_emails"]
    cc_emails = None
    
    # 2. Build ticket title and description
    ticket_name = f"[Storage Growth Alert] {client_name} ({db_type}) - Storage Size Changes"
    
    desc_lines = []
    desc_lines.append(f"Automated daily storage audit has detected changes in storage size for client {client_name} ({db_type}).\n")
    
    if db_changes:
        desc_lines.append("--- Database Size Changes ---")
        for chg in db_changes:
            old_str = f"{chg['old_size'] / 1024 / 1024:.2f} MB"
            new_str = f"{chg['new_size'] / 1024 / 1024:.2f} MB"
            diff = chg['new_size'] - chg['old_size']
            diff_str = f"{diff / 1024 / 1024:+.2f} MB"
            desc_lines.append(f"- DB: {chg['db_name']} | Captured: {chg['captured_date']} | Prev: {old_str} | New: {new_str} | Diff: {diff_str}")
        desc_lines.append("")

    if table_changes:
        desc_lines.append("--- Table Size Changes ---")
        for chg in table_changes:
            old_str = f"{chg['old_size'] / 1024:.2f} KB"
            new_str = f"{chg['new_size'] / 1024:.2f} KB"
            diff = chg['new_size'] - chg['old_size']
            diff_str = f"{diff / 1024:+.2f} KB"
            desc_lines.append(f"- Table: {chg['db_name']}.{chg['table_name']} | Captured: {chg['captured_date']} | Prev: {old_str} | New: {new_str} | Diff: {diff_str}")
        desc_lines.append("")
        
    desc_lines.append("Assigned Agent: SYSTEM")
    desc = "\n".join(desc_lines)
    
    # Insert ticket to generate ID
    try:
        cursor.execute("""
            INSERT INTO tickets (business_unit, company, contact, ticket_name, category, status, priority, agent, description, created_by, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'System', NOW())
            RETURNING id;
        """, (db_type, client_name, to_emails, ticket_name, 'Alert', 'OPEN', 'Medium', 'SYSTEM', desc))
        ticket_id = cursor.fetchone()[0]
        
        # 3. Create ticket comment log
        cursor.execute("""
            INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
            VALUES (%s, 'System', 'log', %s, '');
        """, (ticket_id, f"Storage Growth Alert: Multiple database/table size changes detected."))

        # Log email sending outcome in the ticket comments
        if to_emails:
            email_log_msg = f"Alert email sent to: {to_emails}"
            if cc_emails:
                email_log_msg += f" (CC: {cc_emails})"
        else:
            email_log_msg = f"Email alert skipped: No recipient email configured for client {client_name} or database technology."
            
        cursor.execute("""
            INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
            VALUES (%s, 'System', 'log', %s, '');
        """, (ticket_id, email_log_msg))
        
        # 4. Standardize HTML email
        db_rows_html = ""
        if db_changes:
            for chg in db_changes:
                old_str = f"{chg['old_size'] / 1024 / 1024:.2f} MB"
                new_str = f"{chg['new_size'] / 1024 / 1024:.2f} MB"
                diff = chg['new_size'] - chg['old_size']
                diff_str = f"{diff / 1024 / 1024:+.2f} MB"
                diff_color = '#16a34a' if diff > 0 else '#ef4444'
                db_rows_html += f"""
                <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 8px;">{chg['db_name']}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px;">{chg['captured_date']}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px;">{old_str}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px;">{new_str}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; color: {diff_color}; font-weight: bold;">{diff_str}</td>
                </tr>
                """

        table_rows_html = ""
        if table_changes:
            for chg in table_changes:
                old_str = f"{chg['old_size'] / 1024:.2f} KB"
                new_str = f"{chg['new_size'] / 1024:.2f} KB"
                diff = chg['new_size'] - chg['old_size']
                diff_str = f"{diff / 1024:+.2f} KB"
                diff_color = '#16a34a' if diff > 0 else '#ef4444'
                table_rows_html += f"""
                <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 8px;">{chg['db_name']}.{chg['table_name']}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px;">{chg['captured_date']}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px;">{old_str}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px;">{new_str}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; color: {diff_color}; font-weight: bold;">{diff_str}</td>
                </tr>
                """

        db_section_html = f"""
        <h3 style="color:#0f172a; margin-top:20px; margin-bottom:8px;">Database Size Changes</h3>
        <table style="border-collapse: collapse; width: 100%; font-size: 14px; text-align: left; margin-bottom: 20px;">
            <thead>
                <tr style="background-color: #f1f5f9;">
                    <th style="border: 1px solid #cbd5e1; padding: 8px;">Database Name</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px;">Captured Date</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px;">Previous Size</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px;">New Size</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px;">Growth Difference</th>
                </tr>
            </thead>
            <tbody>
                {db_rows_html}
            </tbody>
        </table>
        """ if db_changes else ""

        table_section_html = f"""
        <h3 style="color:#0f172a; margin-top:20px; margin-bottom:8px;">Table Size Changes</h3>
        <table style="border-collapse: collapse; width: 100%; font-size: 14px; text-align: left; margin-bottom: 20px;">
            <thead>
                <tr style="background-color: #f1f5f9;">
                    <th style="border: 1px solid #cbd5e1; padding: 8px;">Table Name</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px;">Captured Date</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px;">Previous Size</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px;">New Size</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px;">Growth Difference</th>
                </tr>
            </thead>
            <tbody>
                {table_rows_html}
            </tbody>
        </table>
        """ if table_changes else ""

        email_body = f"""
        <html>
        <body style="font-family:-apple-system, BlinkMacSystemFont, sans-serif; color:#1e293b; line-height:1.6; max-width:800px; margin:0 auto; padding:20px;">
            <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding:24px; border-radius:12px; color:white;">
                <h2 style="margin:0; font-size:24px;">📊 Storage Growth Alert</h2>
                <p style="margin:8px 0 0 0; font-size:14px; opacity:0.9;">Ticket #{ticket_id} - Storage Tracking System</p>
            </div>
            <div style="margin-top:24px; background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:24px;">
                <p>Hello,</p>
                <p>An automated daily storage audit has detected size changes for client <strong>{client_name}</strong> ({db_type}):</p>
                
                {db_section_html}
                {table_section_html}

                <p>Incident Ticket <strong>#{ticket_id}</strong> has been created automatically to track these growth changes.</p>
                <p style="margin-top:24px; font-size:12px; color:#64748b; border-top:1px solid #e2e8f0; padding-top:12px;">
                    This alert was triggered automatically by the GeoMon storage telemetry engine. Always from mailbox: dccagent@geopits.com.
                </p>
            </div>
        </body>
        </html>
        """
        
        if to_emails:
            send_email_outlook(to_emails, cc_emails, f"[Ticket #{ticket_id}] {ticket_name}", email_body, sender_email="dccagent@geopits.com")
            print(f"[TELEMETRY ALERT] Created combined ticket #{ticket_id} & sent email for {client_name} ({db_type}).")
        else:
            print(f"[TELEMETRY ALERT] No recipient configured for {client_name} ({db_type}) — combined growth alert email skipped.")
    except Exception as e:
        print(f"[ALERT DAEMON] Error creating growth alert ticket: {e}")

def trigger_growth_alert(cursor, client_name, db_type, db_name, item_name, old_size_bytes, new_size_bytes, captured_date, is_table=False):
    try:
        from routes import send_email_outlook
    except Exception as e:
        print(f"[ALERT DAEMON] Error importing send_email_outlook: {e}")
        return

    # 1. Resolve contact details
    from db_manager import get_alert_contacts
    resolved = get_alert_contacts(cursor, client_name, db_type)
    to_emails = resolved["to_emails"]
    cc_emails = None
    
    # Format sizes
    old_size_str = f"{old_size_bytes / 1024 / 1024:.2f} MB" if not is_table else f"{old_size_bytes / 1024:.2f} KB"
    new_size_str = f"{new_size_bytes / 1024 / 1024:.2f} MB" if not is_table else f"{new_size_bytes / 1024:.2f} KB"
    diff_bytes = new_size_bytes - old_size_bytes
    diff_str = f"{diff_bytes / 1024 / 1024:+.2f} MB" if not is_table else f"{diff_bytes / 1024:+.2f} KB"
    
    item_type = "Table" if is_table else "Database"
    ticket_name = f"[Storage Growth Alert] {client_name} ({db_type}) - {item_type} Size Change"
    
    # Description for the ticket
    desc = f"{item_type} size change detected for client {client_name}.\n\n" \
           f"Database Name: {db_name}\n"
    if is_table:
        desc += f"Table Name: {item_name}\n"
    desc += f"Captured Date: {captured_date}\n" \
            f"Previous Size: {old_size_str}\n" \
            f"New Size: {new_size_str}\n" \
            f"Difference: {diff_str}\n" \
            f"Assigned Agent: SYSTEM"
            
    # 2. Insert ticket to generate ID
    try:
        cursor.execute("""
            INSERT INTO tickets (business_unit, company, contact, ticket_name, category, status, priority, agent, description, created_by, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'System', NOW())
            RETURNING id;
        """, (db_type, client_name, to_emails, ticket_name, 'Alert', 'OPEN', 'Medium', 'SYSTEM', desc))
        ticket_id = cursor.fetchone()[0]
        
        # 3. Create ticket comment log
        cursor.execute("""
            INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
            VALUES (%s, 'System', 'log', %s, '');
        """, (ticket_id, f"Storage Growth Alert: {item_type} {db_name} size changed from {old_size_str} to {new_size_str}"))

        # Log email sending outcome in the ticket comments
        if to_emails:
            email_log_msg = f"Alert email sent to: {to_emails}"
            if cc_emails:
                email_log_msg += f" (CC: {cc_emails})"
        else:
            email_log_msg = f"Email alert skipped: No recipient email configured for client {client_name} or database technology."
            
        cursor.execute("""
            INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
            VALUES (%s, 'System', 'log', %s, '');
        """, (ticket_id, email_log_msg))
        
        # 4. Standardize email with Ticket ID, Assigned Agent details, and CC
        email_body = f"""
        <html>
        <body style="font-family:-apple-system, BlinkMacSystemFont, sans-serif; color:#1e293b; line-height:1.6; max-width:800px; margin:0 auto; padding:20px;">
            <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding:24px; border-radius:12px; color:white;">
                <h2 style="margin:0; font-size:24px;">📊 Storage Growth Alert</h2>
                <p style="margin:8px 0 0 0; font-size:14px; opacity:0.9;">Ticket #{ticket_id} - Storage Tracking System</p>
            </div>
            <div style="margin-top:24px; background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:24px;">
                <p>Hello,</p>
                <p>An automated daily storage audit has detected a change in database/table size:</p>
                <table cellpadding="6" style="border-collapse: collapse; width: 100%; max-width: 500px; margin-bottom: 20px;">
                    <tr><td style="font-weight: bold; width: 150px;">Client Name:</td><td>{client_name}</td></tr>
                    <tr><td style="font-weight: bold;">Technology:</td><td>{db_type}</td></tr>
                    <tr><td style="font-weight: bold;">Database Name:</td><td>{db_name}</td></tr>
                    {"<tr><td style='font-weight: bold;'>Table Name:</td><td>" + item_name + "</td></tr>" if is_table else ""}
                    <tr><td style="font-weight: bold;">Captured Date:</td><td>{captured_date}</td></tr>
                    <tr><td style="font-weight: bold;">Previous Size:</td><td>{old_size_str}</td></tr>
                    <tr><td style="font-weight: bold;">New Size:</td><td>{new_size_str}</td></tr>
                    <tr><td style="font-weight: bold;">Growth Difference:</td><td style="color: {'#16a34a' if diff_bytes > 0 else '#ef4444'}; font-weight: bold;">{diff_str}</td></tr>
                    <tr><td style="font-weight: bold;">Assigned Agent:</td><td>SYSTEM</td></tr>
                </table>
                <p>Incident Ticket <strong>#{ticket_id}</strong> has been created automatically to track this growth change.</p>
                <p style="margin-top:24px; font-size:12px; color:#64748b; border-top:1px solid #e2e8f0; padding-top:12px;">
                    This alert was triggered automatically by the GeoMon storage telemetry engine. Always from mailbox: dccagent@geopits.com.
                </p>
            </div>
        </body>
        </html>
        """
        
        if to_emails:
            send_email_outlook(to_emails, cc_emails, f"[Ticket #{ticket_id}] {ticket_name}", email_body, sender_email="dccagent@geopits.com")
            print(f"[TELEMETRY ALERT] Created ticket #{ticket_id} & sent email for {client_name} ({db_type}) {item_type} growth alert.")
        else:
            print(f"[TELEMETRY ALERT] No recipient configured for {client_name} ({db_type}) — growth alert email skipped.")
    except Exception as e:
        print(f"[ALERT DAEMON] Error creating growth alert ticket: {e}")

# ==========================================================
# CORE INGESTION & DATA PARSING
# ==========================================================

def extract_date_from_subject(subject):
    try:
        # Match D-M-YY, DD-MM-YYYY, YYYY-MM-DD etc with any separator (-, ., /)
        match = re.search(r"\b(\d{1,4})[-./](\d{1,2})[-./](\d{2,4})\b", subject)
        if match:
            date_str = match.group(0)
            return parse_date_string(date_str)
    except Exception:
        pass
    return None

def extract_db_type(subject):
    subject_lower = (subject or "").lower()
    if "postgresql" in subject_lower or "postgres" in subject_lower:
        return "PostgreSQL"
    elif "mysql" in subject_lower:
        return "MySQL"
    elif "mongodb" in subject_lower or "mongo" in subject_lower:
        return "MongoDB"
    elif "mssql" in subject_lower or "sql server" in subject_lower:
        return "MSSQL"
    elif "oracle" in subject_lower:
        return "Oracle"
    return "Unknown"

def lookup_db_type(cursor, client_name):
    try:
        cursor.execute("SELECT db_type FROM admin_clients WHERE LOWER(client_name) = LOWER(%s) OR LOWER(server_name) = LOWER(%s) LIMIT 1", (client_name, client_name))
        row = cursor.fetchone()
        if row and row[0]:
            return row[0]
    except Exception:
        pass
    return None

def process_telemetry_email(cursor, subject, html_content, received_date=None):
    client_name = extract_client_name(subject)
    db_type = extract_db_type(subject)
    if db_type == "Unknown":
        db_type = lookup_db_type(cursor, client_name) or "Unknown"
        
    print(f"\n[TELEMETRY] Processing '{subject}' | Client extracted: '{client_name}' | DB Type: '{db_type}'")
    
    soup = BeautifulSoup(html_content, "html.parser")
    try:
        tables = pd.read_html(StringIO(str(soup)))
    except Exception as e:
        print(f"[TELEMETRY] pd.read_html error: {e}")
        return 0
        
    print(f"[TELEMETRY] Found {len(tables)} tables in email body.")
    inserted_count = 0
    db_changes = []
    table_changes = []
    
    # Check if this client already has history records
    has_history = client_has_history(cursor, client_name)
    print(f"[TELEMETRY] Client '{client_name}' has existing history: {has_history}")
    
    # Determine fallback date
    fallback_date = extract_date_from_subject(subject) or received_date or datetime.now().date()
    
    for idx, df in enumerate(tables, start=1):
        columns = [str(x).strip().lower() for x in df.columns]
        date_cols = get_date_columns(df.columns)
        
        is_single_column_mode = False
        if not date_cols:
            # Check for a single size column
            size_cols = [col for col in df.columns if any(x in str(col).lower() for x in ["size", "gb", "mb", "bytes", "collection size"])]
            if size_cols:
                target_date_cols = [size_cols[0]]
                is_single_column_mode = True
                print(f"[TELEMETRY] Table #{idx}: Single size column mode detected. Using column '{size_cols[0]}' as fallback for date {fallback_date}")
            else:
                continue
        else:
            # Read all date columns in the email. Existing records are skipped via existence check.
            target_date_cols = date_cols
            print(f"[TELEMETRY] Table #{idx}: Total dates found: {len(date_cols)} | Ingesting dates: {target_date_cols}")
        
        # 1. TABLE SECTION
        # Handles two layouts:
        #   A) Database | Table | date1 | date2 ...         (2 identifier cols)
        #   B) Database | Schema | Table | date1 | date2 .. (3 identifier cols – RetailScan)
        has_schema_col = (
            len(columns) >= 3
            and "database" in columns[0]
            and "schema" in columns[1]
            and any(x in columns[2] for x in ["table", "collection"])
        )
        is_table_section = (
            has_schema_col
            or (len(columns) >= 2 and "database" in columns[0]
                and any(x in columns[1] for x in ["table", "collection"]))
        )
        if is_table_section:
            db_col_idx    = 0
            table_col_idx = 2 if has_schema_col else 1
            print(f"[TELEMETRY] Table #{idx}: TABLE SIZE TELEMETRY IDENTIFIED "
                  f"({'3-col with Schema' if has_schema_col else '2-col'})")
            for _, row in df.iterrows():
                try:
                    db_name    = str(row.iloc[db_col_idx]).strip()
                    table_name = str(row.iloc[table_col_idx]).strip()
                    if not db_name or db_name.lower() in ["nan", "database"]:
                        continue
                    if not table_name or table_name.lower() in ["nan", "table", "total", "schema"]:
                        continue
 
                    for col in target_date_cols:
                        captured_date = fallback_date if is_single_column_mode else parse_date_string(col)
                        size_val  = row[col]
                        size_bytes = convert_to_bytes(size_val)
 
                        if is_single_column_mode:
                            col_lower = str(col).lower()
                            if "tb" in col_lower:
                                size_bytes = int(float(size_val) * 1024**4)
                            elif "gb" in col_lower:
                                size_bytes = int(float(size_val) * 1024**3)
                            elif "mb" in col_lower:
                                size_bytes = int(float(size_val) * 1024**2)
                            elif "kb" in col_lower:
                                size_bytes = int(float(size_val) * 1024)
 
                        if table_entry_exists(cursor, client_name, db_name, table_name, captured_date):
                            continue

                        # Check for table size growth
                        try:
                            cursor.execute("""
                                SELECT size_bytes 
                                FROM table_size_history 
                                WHERE server_name = %s AND database_name = %s AND table_name = %s AND LOWER(db_type) = LOWER(%s) AND captured_date < %s 
                                ORDER BY captured_date DESC LIMIT 1;
                            """, (client_name, db_name, table_name, db_type, captured_date))
                            prev_tbl = cursor.fetchone()
                            if prev_tbl is not None:
                                old_size = prev_tbl[0]
                                if old_size != size_bytes:
                                    table_changes.append({
                                        "db_name": db_name,
                                        "table_name": table_name,
                                        "old_size": old_size,
                                        "new_size": size_bytes,
                                        "captured_date": str(captured_date)
                                    })
                        except Exception as e_growth:
                            print(f"[ALERT DAEMON] Error checking table growth: {e_growth}")

                        # Use a SAVEPOINT so a single bad row doesn't abort
                        # the whole transaction and block every subsequent insert.
                        try:
                            cursor.execute("SAVEPOINT tbl_row")
                            cursor.execute("""
                                INSERT INTO table_size_history
                                    (server_name, database_name, table_name, size_bytes, captured_date, db_type)
                                VALUES (%s, %s, %s, %s, %s, %s)
                                ON CONFLICT (server_name, db_type, database_name, table_name, captured_date)
                                DO NOTHING
                            """, (client_name, db_name, table_name, size_bytes, captured_date, db_type))
                            cursor.execute("RELEASE SAVEPOINT tbl_row")
                            inserted_count += 1
                        except Exception as insert_ex:
                            cursor.execute("ROLLBACK TO SAVEPOINT tbl_row")
                            print(f"[TELEMETRY] Table row skipped ({db_name}.{table_name} @ {captured_date}): {insert_ex}")
                except Exception as ex:
                    print(f"[TELEMETRY] Table row parse error: {ex}")
 
        # 2. DATABASE SECTION
        # Columns: Database, Date columns... (second col must NOT be table/schema/collection)
        # We check the first 2 columns for "database" to support tables starting with "instance".
        db_col_idx_for_db = -1
        if not is_table_section and len(columns) >= 1:
            for i in range(min(2, len(columns))):
                if "database" in columns[i]:
                    db_col_idx_for_db = i
                    break

        if db_col_idx_for_db != -1:
            print(f"[TELEMETRY] Table #{idx}: DATABASE SIZE TELEMETRY IDENTIFIED (col idx: {db_col_idx_for_db})")
            for _, row in df.iterrows():
                try:
                    db_name = str(row.iloc[db_col_idx_for_db]).strip()
                    if not db_name or db_name.lower() in ["nan", "database", "total"]:
                        continue
 
                    for col in target_date_cols:
                        captured_date = fallback_date if is_single_column_mode else parse_date_string(col)
                        size_val  = row[col]
                        size_bytes = convert_to_bytes(size_val)
 
                        if is_single_column_mode:
                            col_lower = str(col).lower()
                            if "tb" in col_lower:
                                size_bytes = int(float(size_val) * 1024**4)
                            elif "gb" in col_lower:
                                size_bytes = int(float(size_val) * 1024**3)
                            elif "mb" in col_lower:
                                size_bytes = int(float(size_val) * 1024**2)
                            elif "kb" in col_lower:
                                size_bytes = int(float(size_val) * 1024)
 
                        if database_entry_exists(cursor, client_name, db_name, captured_date):
                            continue

                        # Check for database size growth
                        try:
                            cursor.execute("""
                                SELECT total_size_bytes 
                                FROM database_size_history 
                                WHERE server_name = %s AND database_name = %s AND LOWER(db_type) = LOWER(%s) AND captured_date < %s 
                                ORDER BY captured_date DESC LIMIT 1;
                            """, (client_name, db_name, db_type, captured_date))
                            prev_db = cursor.fetchone()
                            if prev_db is not None:
                                old_size = prev_db[0]
                                if old_size != size_bytes:
                                    db_changes.append({
                                        "db_name": db_name,
                                        "old_size": old_size,
                                        "new_size": size_bytes,
                                        "captured_date": str(captured_date)
                                    })
                        except Exception as e_growth:
                            print(f"[ALERT DAEMON] Error checking database growth: {e_growth}")

                        # Use a SAVEPOINT so a single bad row doesn't abort
                        # the whole transaction and block every subsequent insert.
                        try:
                            cursor.execute("SAVEPOINT db_row")
                            cursor.execute("""
                                INSERT INTO database_size_history
                                    (server_name, database_name, total_size_bytes, captured_date, db_type)
                                VALUES (%s, %s, %s, %s, %s)
                                ON CONFLICT (server_name, db_type, database_name, captured_date) DO NOTHING
                            """, (client_name, db_name, size_bytes, captured_date, db_type))
                            cursor.execute("RELEASE SAVEPOINT db_row")
                            inserted_count += 1
                        except Exception as insert_ex:
                            cursor.execute("ROLLBACK TO SAVEPOINT db_row")
                            print(f"[TELEMETRY] DB row skipped ({db_name} @ {captured_date}): {insert_ex}")
                except Exception as ex:
                    print(f"[TELEMETRY] DB row parse error: {ex}")
    if db_changes or table_changes:
        trigger_combined_growth_alert(cursor, client_name, db_type, db_changes, table_changes)
        
    return inserted_count

# ==========================================================
# MAIL SYNC CONTROLLER
# ==========================================================

def mark_email_as_read(token, email, message_id):
    """Mark a specific email as read via Microsoft Graph API."""
    url = f"https://graph.microsoft.com/v1.0/users/{email}/messages/{message_id}"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    try:
        r = requests.patch(url, headers=headers, json={"isRead": True}, timeout=10)
        if r.status_code not in (200, 204):
            print(f"[TELEMETRY] Could not mark email as read ({r.status_code}): {r.text[:200]}")
    except Exception as e:
        print(f"[TELEMETRY] mark_as_read exception: {e}")


def fetch_full_message(token, email, message_id):
    """Fetch full message body for a specific email via Microsoft Graph API."""
    url = f"https://graph.microsoft.com/v1.0/users/{email}/messages/{message_id}?$select=subject,body,receivedDateTime"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        r = requests.get(url, headers=headers, timeout=15)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        print(f"[TELEMETRY] fetch_full_message exception: {e}")
    return None


def run_telemetry_sync():
    print("\n==========================================")
    print("      DB TELEMETRY ENGINE SYNC ACTIVE")
    print("==========================================")
    
    token = get_token()
    if not token:
        print("[TELEMETRY] Authentication failed. Sync aborted.")
        return {"status": "error", "message": "Microsoft Graph Authentication Token failed."}
        
    folder_id = get_folder_id(token)
    headers = {"Authorization": f"Bearer {token}"}
    
    # ── Build initial URL ──────────────────────────────────────────────────────
    # Only read emails from the dedicated telemetry folder.
    # Falls back to the full inbox search if the folder cannot be found.
    if not MAILBOX_EMAIL:
        print("[TELEMETRY] MAILBOX_EMAIL (USER_EMAIL) not set in .env. Sync aborted.")
        return {"status": "error", "message": "USER_EMAIL not configured in environment."}

    select_fields = "subject,body,receivedDateTime,isRead,id"
    if folder_id:
        url = (
            f"https://graph.microsoft.com/v1.0/users/{MAILBOX_EMAIL}/mailFolders/{folder_id}/messages"
            f"?$top=50&$orderby=receivedDateTime desc&$select={select_fields}"
        )
        print(f"[TELEMETRY] Searching folder: '{TARGET_FOLDER}' (id={folder_id})")
    else:
        url = (
            f"https://graph.microsoft.com/v1.0/users/{MAILBOX_EMAIL}/messages"
            f"?$top=50&$orderby=receivedDateTime desc&$select={select_fields}"
        )
        print(f"[TELEMETRY] WARNING: Folder '{TARGET_FOLDER}' not found — falling back to full inbox search.")

    total_processed = 0
    total_inserted = 0
    
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        while url:
            r = requests.get(url, headers=headers, timeout=15)
            if r.status_code != 200:
                print(f"[TELEMETRY] Messages query failed: {r.text}")
                break
                
            data = r.json()
            messages = data.get("value", [])
            print(f"[TELEMETRY] Fetched {len(messages)} messages in this page.")
            
            for mail in messages:
                subject = mail.get("subject", "").strip()
                if not subject:
                    continue
                
                # ── Subject filter: only DB & Table Size report mails ──────────
                subject_lower = subject.lower()
                is_matched = any(kw in subject_lower for kw in [
                    "db & table size report",
                    "db and table size report",
                    "size report",
                    "collection size report",
                    "database size",
                    "table size",
                ])
                if not is_matched:
                    continue
                
                message_id = mail.get("id", "")
                
                # ── Get HTML body (inline preferred; fall back to full fetch) ──
                html_content = mail.get("body", {}).get("content", "")
                if not html_content and message_id:
                    print(f"[TELEMETRY] Body empty in list response – fetching full message for: {subject}")
                    full_msg = fetch_full_message(token, MAILBOX_EMAIL, message_id)
                    if full_msg:
                        html_content = full_msg.get("body", {}).get("content", "")
                
                if not html_content:
                    print(f"[TELEMETRY] Skipping (no body): {subject}")
                    continue
                    
                received_date = None
                if mail.get("receivedDateTime"):
                    try:
                        received_date = datetime.strptime(mail.get("receivedDateTime")[:10], "%Y-%m-%d").date()
                    except Exception:
                        pass
                if not received_date:
                    received_date = datetime.now().date()
                
                print(f"[TELEMETRY] ✉️ Processing: '{subject}' | Received: {received_date}")
                inserted = process_telemetry_email(cursor, subject, html_content, received_date=received_date)
                total_inserted += inserted
                total_processed += 1
                
                # ── Commit after each email to preserve partial progress ───────
                conn.commit()
                
                # ── Mark email as read so we know it has been ingested ─────────
                if message_id:
                    mark_email_as_read(token, MAILBOX_EMAIL, message_id)
                
            url = data.get("@odata.nextLink")
            
        print(f"\n[TELEMETRY] Sync completed! Processed: {total_processed} mails | Ingested: {total_inserted} records.")
        if cache_manager:
            cache_manager.invalidate("telemetry:")
        return {
            "status": "success",
            "mails_processed": total_processed,
            "records_inserted": total_inserted,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"[TELEMETRY] Sync Exception: {e}")
        conn.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

if __name__ == "__main__":
    run_telemetry_sync()
