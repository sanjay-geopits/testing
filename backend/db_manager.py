import os
import sys
# Add backend directory to path for absolute imports resolution
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import psycopg2
from migrations import get_connection as get_mig_conn

def get_connection():
    """Returns a database connection from migrations."""
    return get_mig_conn()

def get_alert_contacts(cursor, client_name, db_type):
    """
    Centralized contact resolution function.
    Queries client-specific contacts first (admin_clients then client_access),
    falls back to technology-specific configurations, and finally to safety fallback.
    Normalizes all database lookup parameters using LOWER(TRIM()).
    """
    import re
    c_name = client_name.strip() if client_name else ""
    d_type = db_type.strip() if db_type else ""
    
    client_email = None
    phone_number = None
    routing_path = None
    
    # 1. Look up client contact in admin_clients
    if c_name and d_type:
        try:
            cursor.execute("""
                SELECT client_email, phone_number 
                FROM admin_clients 
                WHERE LOWER(TRIM(client_name)) = LOWER(TRIM(%s)) 
                  AND LOWER(TRIM(%s)) = ANY(string_to_array(REPLACE(LOWER(db_type), ' ', ''), ','))
                LIMIT 1;
            """, (c_name, d_type))
            row = cursor.fetchone()
            if row and row[0] and row[0].strip():
                client_email = row[0].strip()
                phone_number = row[1]
                routing_path = "Client Contact (admin_clients)"
        except Exception as e:
            print(f"[CONTACT RESOLVER] Error querying admin_clients: {e}")
            
    # 2. Look up client contact in client_access as fallback
    if not client_email and c_name and d_type:
        try:
            cursor.execute("""
                SELECT client_email, phone_number 
                FROM client_access 
                WHERE LOWER(TRIM(client_name)) = LOWER(TRIM(%s)) 
                  AND LOWER(TRIM(technology)) = LOWER(TRIM(%s))
                LIMIT 1;
            """, (c_name, d_type))
            row = cursor.fetchone()
            if row and row[0] and row[0].strip():
                client_email = row[0].strip()
                phone_number = row[1]
                routing_path = "Client Contact (client_access)"
        except Exception as e:
            print(f"[CONTACT RESOLVER] Error querying client_access: {e}")
            
    # 3. Look up technology contact in technology_alerts_config
    tech_email = None
    if d_type:
        try:
            cursor.execute("""
                SELECT alert_email 
                FROM technology_alerts_config 
                WHERE LOWER(TRIM(technology)) = LOWER(TRIM(%s))
                LIMIT 1;
            """, (d_type,))
            row = cursor.fetchone()
            if row and row[0] and row[0].strip():
                tech_email = row[0].strip()
        except Exception as e:
            print(f"[CONTACT RESOLVER] Error querying technology_alerts_config: {e}")
            
    # 4. Enforce strict routing fallbacks and dual-recipient list construction
    to_list = ["dccagent@geopits.com"]
    
    if client_email:
        for email in re.split(r'[;,]', client_email):
            email = email.strip()
            if email and email not in to_list:
                to_list.append(email)
                
    if tech_email:
        for email in re.split(r'[;,]', tech_email):
            email = email.strip()
            if email and email not in to_list:
                to_list.append(email)
                
    if not client_email:
        if tech_email:
            routing_path = "Technology Fallback"
        else:
            routing_path = "System Safety Fallback"
    else:
        if tech_email:
            routing_path = f"{routing_path} + Technology Alert"
        else:
            routing_path = f"{routing_path}"
            
    to_emails = ", ".join(to_list)
    
    # Enhanced log observability: explicitly trace and report the routing path taken
    print(f"[CONTACT RESOLVER] Routed '{c_name}' ({d_type}) via [{routing_path}]. Recipients: {to_emails}")
    
    return {
        "client_email": client_email,
        "tech_email": tech_email,
        "routing_path": routing_path,
        "to_emails": to_emails,
        "to_list": to_list,
        "phone_number": phone_number
    }

