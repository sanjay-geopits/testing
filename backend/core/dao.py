"""
core/dao.py — Centralized Data Access Object (DAO) layer
Provides unified interface for executing database operations, eliminating redundant raw SQL queries.
"""
from typing import Optional, List, Dict, Any, Tuple
import psycopg2
import psycopg2.extras
from datetime import datetime

# ==============================================================================
# USER OPERATIONS
# ==============================================================================

def get_user_by_username(cur, username: str) -> Optional[Dict[str, Any]]:
    cur.execute(
        "SELECT id, username, email, role, full_name, profile_pic FROM users WHERE username = %s;",
        (username,)
    )
    row = cur.fetchone()
    return dict(row) if row else None

def get_user_by_id(cur, user_id: int) -> Optional[Dict[str, Any]]:
    cur.execute(
        "SELECT id, username, email, role, full_name, profile_pic FROM users WHERE id = %s;",
        (user_id,)
    )
    row = cur.fetchone()
    return dict(row) if row else None

def list_users(cur) -> List[Dict[str, Any]]:
    cur.execute("SELECT id, username, email, full_name, role, profile_pic, last_active_at FROM users ORDER BY id;")
    return [dict(r) for r in cur.fetchall()]

def create_user(cur, username: str, hashed_password_str: str, email: Optional[str], full_name: Optional[str], role: str = "user") -> int:
    cur.execute(
        "INSERT INTO users (username, hashed_password, email, full_name, role) VALUES (%s,%s,%s,%s,%s) RETURNING id;",
        (username, hashed_password_str, email, full_name, role)
    )
    return cur.fetchone()[0]

def update_user(cur, user_id: int, updates: Dict[str, Any]) -> int:
    if not updates:
        return 0
    fields, params = [], []
    for k, v in updates.items():
        fields.append(f"{k} = %s")
        params.append(v)
    params.append(user_id)
    cur.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = %s;", params)
    return cur.rowcount

def delete_user(cur, user_id: int) -> int:
    cur.execute("DELETE FROM users WHERE id = %s AND username != 'admin';", (user_id,))
    return cur.rowcount

def check_user_access(cur, username: str) -> Tuple[bool, str]:
    """Check user assignment privilege in user_clients or leads."""
    # Check if admin
    cur.execute("SELECT role, email FROM users WHERE username = %s;", (username,))
    row = cur.fetchone()
    if not row:
        return False, "restricted"
    role, email = row[0], (row[1] or "").lower()
    
    if role == "admin" or email == "admin@geomon.com":
        return True, "admin"
        
    # Check leads
    cur.execute("SELECT id FROM leads WHERE LOWER(email) = LOWER(%s) AND status = 'active';", (email,))
    if cur.fetchone():
        return True, "lead"
        
    # Check user_clients
    cur.execute("SELECT uc.id FROM user_clients uc JOIN users u ON uc.user_id = u.id WHERE u.username = %s;", (username,))
    if cur.fetchone():
        return True, "user"
        
    return False, "restricted"

# ==============================================================================
# TICKET OPERATIONS
# ==============================================================================

def create_ticket(
    cur,
    business_unit: Optional[str],
    company: Optional[str],
    contact: Optional[str],
    ticket_name: str,
    category: str = "General",
    status: str = "OPEN",
    priority: str = "Medium",
    agent: str = "Unassigned",
    description: Optional[str] = None,
    created_by: str = "System",
    created_at: Optional[datetime] = None
) -> int:
    if created_at is None:
        created_at = datetime.now()
    cur.execute("""
        INSERT INTO tickets 
            (business_unit, company, contact, ticket_name, category, status, priority, agent, description, created_by, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
    """, (business_unit, company, contact, ticket_name, category, status, priority, agent, description, created_by, created_at))
    return cur.fetchone()[0]

def get_ticket(cur, ticket_id: int) -> Optional[Dict[str, Any]]:
    cur.execute("SELECT * FROM tickets WHERE id = %s;", (ticket_id,))
    row = cur.fetchone()
    return dict(row) if row else None

def list_tickets(cur, conditions: List[str], params: List[Any], page: int = 1, page_size: int = 50) -> Tuple[List[Dict[str, Any]], int]:
    where_clause = " AND ".join(conditions) if conditions else "1=1"
    offset = (page - 1) * page_size
    
    cur.execute(
        f"SELECT * FROM tickets WHERE {where_clause} ORDER BY created_at DESC LIMIT %s OFFSET %s;",
        params + [page_size, offset]
    )
    rows = [dict(r) for r in cur.fetchall()]
    
    cur.execute(f"SELECT COUNT(*) FROM tickets WHERE {where_clause};", params)
    total = cur.fetchone()[0] if isinstance(cur.fetchone(), tuple) else cur.fetchone().get('count', 0)
    
    return rows, total

def update_ticket(cur, ticket_id: int, updates: Dict[str, Any]) -> int:
    if not updates:
        return 0
    fields, params = [], []
    for k, v in updates.items():
        fields.append(f"{k} = %s")
        params.append(v)
    params.append(ticket_id)
    cur.execute(f"UPDATE tickets SET {', '.join(fields)} WHERE id = %s;", params)
    return cur.rowcount

def delete_ticket(cur, ticket_id: int) -> int:
    cur.execute("DELETE FROM tickets WHERE id = %s;", (ticket_id,))
    return cur.rowcount

def add_ticket_comment(
    cur,
    ticket_id: int,
    author: str,
    comment_type: str,
    content: str,
    attachments: Optional[str] = ""
) -> int:
    cur.execute("""
        INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
        VALUES (%s, %s, %s, %s, %s) RETURNING id;
    """, (ticket_id, author, comment_type, content, attachments or ""))
    return cur.fetchone()[0]

def get_ticket_comments(cur, ticket_id: int) -> List[Dict[str, Any]]:
    cur.execute("SELECT * FROM ticket_comments WHERE ticket_id = %s ORDER BY created_at ASC;", (ticket_id,))
    return [dict(r) for r in cur.fetchall()]

# ==============================================================================
# CLIENT OPERATIONS
# ==============================================================================

def list_clients(cur) -> List[Dict[str, Any]]:
    cur.execute("SELECT * FROM admin_clients ORDER BY client_name;")
    return [dict(r) for r in cur.fetchall()]

def create_client(cur, client_name: str, db_type: str, client_email: str, server_name: str, phone_number: Optional[str] = None) -> int:
    cur.execute("""
        INSERT INTO admin_clients (client_name, db_type, client_email, server_name, phone_number)
        VALUES (%s, %s, %s, %s, %s) RETURNING id;
    """, (client_name, db_type, client_email, server_name, phone_number))
    return cur.fetchone()[0]

def update_client(cur, client_id: int, updates: Dict[str, Any]) -> int:
    if not updates:
        return 0
    fields, params = [], []
    for k, v in updates.items():
        fields.append(f"{k} = %s")
        params.append(v)
    params.append(client_id)
    cur.execute(f"UPDATE admin_clients SET {', '.join(fields)} WHERE id = %s;", params)
    return cur.rowcount

def delete_client(cur, client_id: int) -> int:
    cur.execute("DELETE FROM admin_clients WHERE id = %s;", (client_id,))
    return cur.rowcount
