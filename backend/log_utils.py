import os
import re
import json
import time
import hashlib
import psycopg2
import logging
import requests
import difflib
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from dotenv import load_dotenv
from severity_classifier import is_performance_log, extract_metric_value

load_dotenv()

IST = ZoneInfo("Asia/Kolkata")

def setup_audit_logger():
    logger = logging.getLogger("audit")
    logger.setLevel(logging.INFO)
    if not logger.handlers:
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        log_dir = os.path.join(project_root, "logs")
        os.makedirs(log_dir, exist_ok=True)
        log_path = os.path.join(log_dir, "audit.log")
        fh = logging.FileHandler(log_path)
        fh.setFormatter(logging.Formatter('%(asctime)s - %(message)s'))
        logger.addHandler(fh)
    return logger

audit_logger = setup_audit_logger()

def sync_internet_time():
    providers = [
        {
            "url": "http://worldtimeapi.org/api/timezone/Asia/Kolkata",
            "parse": lambda r: r.json().get("unixtime")  # returns Unix epoch ✓
        },
        {
            "url": "https://timeapi.io/api/Time/current/zone?timeZone=Asia/Kolkata",
            # BUG WAS HERE: dateTime is a local time string, not Unix epoch
            # Must convert to Unix timestamp correctly
            "parse": lambda r: datetime.fromisoformat(
                r.json().get("dateTime")
            ).replace(tzinfo=ZoneInfo("Asia/Kolkata")).timestamp()
        },
        {
            "url": "https://www.google.com",
            "parse": lambda r: datetime.strptime(
                r.headers['Date'], '%a, %d %b %Y %H:%M:%S GMT'
            ).replace(tzinfo=ZoneInfo("UTC")).timestamp()
        }
    ]

    for provider in providers:
        try:
            print(f"Attempting time sync via {provider['url']}...")
            r = requests.get(provider['url'], timeout=5)
            if r.status_code == 200:
                internet_unix = provider['parse'](r)
                local_unix = time.time()
                drift = internet_unix - local_unix

                # Sanity check — drift > 1 hour is almost certainly a parse bug
                if abs(drift) > 3600:
                    print(f"[WARN] Suspiciously large drift {drift:.1f}s from {provider['url']} — skipping")
                    continue

                print(f"Time sync SUCCESS via {provider['url']}. Drift: {round(drift, 2)}s")
                return drift
        except Exception as e:
            print(f"Sync failed for {provider['url']}: {e}")

    print("All time sync providers failed. Using system time (drift=0).")
    return 0

time_drift_seconds = sync_internet_time()

def get_accurate_ist():
    accurate_unix = time.time() + time_drift_seconds
    true_utc = datetime.fromtimestamp(accurate_unix, ZoneInfo("UTC"))
    return true_utc.astimezone(IST)

def get_db_connection():
    from core.config import DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, DB_PORT
    return psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        port=DB_PORT
    )

# Global connection object
conn = None

def get_connection():
    global conn
    if conn is None or conn.closed != 0:
        try:
            conn = get_db_connection()
            print("Connected to PostgreSQL")
        except Exception as e:
            print("PostgreSQL connection failed:", e)
            raise
    return conn

def make_hash(txt):
    return hashlib.sha256(txt.encode()).hexdigest()

def normalize_for_hash(msg):
    s = str(msg)
    s = re.sub(r'\d{4}[-/]\d{2}[-/]\d{2}[\sT]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?', '', s)
    s = re.sub(r'\d{1,2}[-/]\d{1,2}[-/]\d{4}\s+\d{1,2}:\d{2}:\d{2}(?:\s+[aApP][mM])?', '', s, flags=re.IGNORECASE)
    s = re.sub(r'\bspid\d+[a-zA-Z]*\b', '', s, flags=re.IGNORECASE)
    s = re.sub(r'\b0x[0-9a-fA-F]+\b', '', s)
    s = re.sub(r'\b\d{6,}\b', '', s)
    return s.strip()

def parse_time(t):
    if isinstance(t, datetime):
        if t.tzinfo is None:
            ist_aware = t.replace(tzinfo=IST)
        else:
            ist_aware = t.astimezone(IST)
        utc_aware = ist_aware.astimezone(ZoneInfo("UTC"))
        return ist_aware.replace(tzinfo=None), utc_aware.replace(tzinfo=None), ist_aware.replace(tzinfo=None)

    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%m/%d/%Y %I:%M:%S %p",
        "%d/%m/%Y %I:%M:%S %p",
        "%Y/%m/%d %I:%M:%S %p"
    ]

    dt = None
    for f in formats:
        try:
            dt = datetime.strptime(t.strip(), f)
            break
        except:
            pass

    if dt is None:
        print(f"Warning: Could not parse time '{t}'. Using accurate IST.")
        ist_aware = get_accurate_ist()
        utc_aware = ist_aware.astimezone(ZoneInfo("UTC"))
        return ist_aware.replace(tzinfo=None), utc_aware.replace(tzinfo=None), ist_aware.replace(tzinfo=None)

    ist_aware = dt.replace(tzinfo=IST)
    utc_aware = ist_aware.astimezone(ZoneInfo("UTC"))
    return ist_aware.replace(tzinfo=None), utc_aware.replace(tzinfo=None), ist_aware.replace(tzinfo=None)

def get_12h_bucket(dt: datetime) -> str:
    """
    Returns a string identifier for the 12-hour bucket: 
    - 08:00 AM to 07:59 PM today -> [Today]_08PM slot
    - 08:00 PM today to 07:59 AM next day -> [NextDay]_08AM slot
    """
    if 8 <= dt.hour < 20:
        # Day shift -> belongs to the 8 PM load
        return dt.strftime("%Y-%m-%d") + "_08PM"
    else:
        # Night shift -> belongs to the 8 AM load (today or tomorrow)
        if dt.hour >= 20:
            target_date = dt + timedelta(days=1)
            return target_date.strftime("%Y-%m-%d") + "_08AM"
        else:
            return dt.strftime("%Y-%m-%d") + "_08AM"

_semantic_group_cache = {}
_semantic_cache_expiry = {}

def add_semantic_group_to_cache(client, server, log_type, time_bucket, message, semantic_hash):
    cache_key = (client, server, log_type, time_bucket)
    if cache_key in _semantic_group_cache:
        if not any(x[1] == semantic_hash for x in _semantic_group_cache[cache_key]):
            _semantic_group_cache[cache_key].append((message, semantic_hash))

def get_semantic_group(client, server, log_type, time_bucket, message):
    """Finds an existing semantic group for the given log."""
    cache_key = (client, server, log_type, time_bucket)
    now = time.time()
    
    if cache_key in _semantic_group_cache and (now - _semantic_cache_expiry[cache_key]) < 10:
        rows = _semantic_group_cache[cache_key]
    else:
        db_conn = get_connection()
        try:
            cur = db_conn.cursor()
            # Find distinct semantic groups in this bucket (any log could be a leader)
            cur.execute("""
                SELECT DISTINCT ON (semantic_hash) log_message, semantic_hash
                FROM db_monitoring_logs
                WHERE client_name = %s AND server_name = %s AND log_type = %s 
                  AND time_bucket = %s
            """, (client, server, log_type, time_bucket))
            
            rows = cur.fetchall()
            cur.close()
            _semantic_group_cache[cache_key] = list(rows)
            _semantic_cache_expiry[cache_key] = now
        except Exception as e:
            print(f"Error in get_semantic_group: {e}")
            return None
            
    for ref_msg, sem_hash in rows:
        similarity = difflib.SequenceMatcher(None, ref_msg, message).ratio()
        if similarity >= 0.85:
            return sem_hash
    return None

def insert_log(row):
    # row = (client, server, db, type, source, time, utc, ist, msg, raw, subject, received, h, occ, severity)
    client, server, db, l_type, source, l_time, utc, ist, msg, raw, subject, received, h, occ, severity = row
    
    db_conn = get_connection()
    max_retries = 3
    
    # 1. Performance Log Handling
    is_perf = is_performance_log(l_type)
    metric_val = extract_metric_value(db, l_type, msg)
    
    # Consistent 12-hour time bucket for grouping (8 AM / 8 PM)
    time_bucket = get_12h_bucket(l_time)
    
    # For performance logs, we want to group by severity and bucket to keep only the MAX/MIN
    if is_perf and severity != "Unknown":
        h = make_hash(f"{client}_{server}_{l_type}_{severity}_{time_bucket}_perf")

    # 2. Semantic Grouping Handling (Skip for performance metrics to keep severities separate)
    sem_hash = None
    if not is_perf:
        sem_hash = get_semantic_group(client, server, l_type, time_bucket, msg)
    
    is_semantic = False
    sem_count = 1
    
    # target_h is the record we will update if we find a match
    target_h = sem_hash if sem_hash else h
    
    if sem_hash:
        is_semantic = True
        sem_count = occ
    
    for attempt in range(max_retries):
        try:
            cur = db_conn.cursor()
            cur.execute("SET timezone TO 'Asia/Kolkata';")
            
            # Helper to create a ticket
            def create_auto_ticket(sev, l_msg):
                # Deduplicate: check if a ticket with this log hash already exists and is not resolved/closed
                try:
                    cur.execute("""
                        SELECT id FROM tickets 
                        WHERE description LIKE %s 
                          AND UPPER(status) NOT IN ('RESOLVED', 'CLOSED') 
                        LIMIT 1
                    """, (f"%Log Hash: {target_h}%",))
                    row_ex_t = cur.fetchone()
                    if row_ex_t and row_ex_t[0]:
                        print(f"[DEDUPLICATE] Existing ticket found: {row_ex_t[0]} for hash {target_h}")
                        return row_ex_t[0]

                    # Also check if there's an active ticket with the same client, db, and containing the log message
                    cur.execute("""
                        SELECT id FROM tickets 
                        WHERE LOWER(TRIM(company)) = LOWER(TRIM(%s)) 
                          AND LOWER(TRIM(business_unit)) = LOWER(TRIM(%s)) 
                          AND UPPER(status) NOT IN ('RESOLVED', 'CLOSED') 
                          AND description LIKE %s 
                        LIMIT 1
                    """, (client, db, f"%{l_msg}%"))
                    row_ex_msg = cur.fetchone()
                    if row_ex_msg and row_ex_msg[0]:
                        print(f"[DEDUPLICATE] Existing active ticket found by message: {row_ex_msg[0]}")
                        return row_ex_msg[0]
                except Exception as ex_dedup:
                    print(f"Error checking existing ticket: {ex_dedup}")

                from db_manager import get_alert_contacts
                resolved = get_alert_contacts(cur, client, db)
                contact_emails = resolved["to_emails"]

                
                cur.execute("""
                    INSERT INTO tickets (
                        business_unit, company, contact, ticket_name, category, 
                        status, priority, agent, description, created_by, created_at
                    )
                    VALUES (%s, %s, %s, %s, %s, 'OPEN', %s, 'Unassigned', %s, 'System', %s)
                    RETURNING id;
                """, (
                    db, client, contact_emails, f"[AUTO] {sev} Alert: {l_type} on {server}", 'Logs',
                    sev, f"Auto-generated ticket for log event.\nMessage: {l_msg}\nLog Hash: {target_h}", ist
                ))
                t_id = cur.fetchone()[0]

                # Send email notification with Ticket ID in subject (Disabled per user request for consolidated 8 AM / 8 PM emails)
                pass

                return t_id

            # Check if record exists in db_monitoring_logs
            cur.execute("SELECT log_message, occurrence_count, is_semantic, semantic_count, severity, ticket_id, ticket_status FROM db_monitoring_logs WHERE log_hash = %s", (target_h,))
            existing = cur.fetchone()
            
            sev_clean = (severity or "").strip().capitalize()
            t_id = None
            t_status = ""

            if existing:
                ex_msg, ex_occ, ex_is_sem, ex_sem_count, ex_sev, ex_ticket_id, ex_ticket_status = existing
                target_table = "db_monitoring_logs"
                
                t_id = ex_ticket_id
                t_status = ex_ticket_status

                if sev_clean in ["High", "Critical"] and not ex_ticket_id:
                    t_id = create_auto_ticket(sev_clean, msg)
                    t_status = "OPEN"
                    cur.execute(f"UPDATE {target_table} SET ticket_id = %s, ticket_status = %s WHERE log_hash = %s", (t_id, t_status, target_h))

                # Performance Comparison
                should_update = True
                if is_perf and metric_val is not None:
                    ex_metric_val = extract_metric_value(db, l_type, ex_msg)
                    if ex_metric_val is not None:
                        if severity in ["Critical", "High", "Medium"] and metric_val <= ex_metric_val:
                            should_update = False
                        elif severity == "Low" and metric_val >= ex_metric_val:
                            should_update = False
                
                # If we are merging a semantic log, we mark the group leader as is_semantic=True
                new_is_semantic = True if sem_hash else ex_is_sem
                
                if should_update and not sem_hash:
                    # Update everything for standard hash-match where new log is "fresher" or "better"
                    cur.execute(f"""
                        UPDATE {target_table}
                        SET occurrence_count = occurrence_count + %s,
                            log_message = %s,
                            raw_log = %s,
                            log_time = %s,
                            log_time_utc = %s,
                            log_time_ist = %s,
                            email_received_time = %s,
                            is_semantic = %s,
                            semantic_count = semantic_count + %s
                        WHERE log_hash = %s
                    """, (occ, msg, raw, l_time, utc, ist, received, new_is_semantic, occ, target_h))
                else:
                    # Just increase occurrence count and update semantic info
                    cur.execute(f"""
                        UPDATE {target_table}
                        SET occurrence_count = occurrence_count + %s,
                            is_semantic = %s,
                            semantic_count = semantic_count + %s
                        WHERE log_hash = %s
                    """, (occ, new_is_semantic, occ, target_h))
            else:
                if sev_clean in ["High", "Critical"]:
                    t_id = create_auto_ticket(sev_clean, msg)
                    t_status = "OPEN"

                cur.execute("""
                INSERT INTO db_monitoring_logs(
                    client_name, server_name, db_type, log_type, log_source,
                    log_time, log_time_utc, log_time_ist,
                    log_message, raw_log,
                    email_subject, email_received_time,
                    log_hash, occurrence_count, severity,
                    is_semantic, semantic_count, semantic_hash, time_bucket,
                    ticket_id, ticket_status
                )
                VALUES(%s,%s,%s,%s,%s, %s,%s,%s, %s,%s, %s,%s, %s,%s,%s, %s,%s,%s,%s, %s,%s)
                ON CONFLICT (log_hash) DO UPDATE SET
                    occurrence_count = db_monitoring_logs.occurrence_count + EXCLUDED.occurrence_count,
                    semantic_count = db_monitoring_logs.semantic_count + EXCLUDED.semantic_count,
                    log_message = EXCLUDED.log_message,
                    log_time = EXCLUDED.log_time,
                    log_time_utc = EXCLUDED.log_time_utc,
                    log_time_ist = EXCLUDED.log_time_ist,
                    email_received_time = EXCLUDED.email_received_time,
                    ticket_id = COALESCE(db_monitoring_logs.ticket_id, EXCLUDED.ticket_id),
                    ticket_status = COALESCE(db_monitoring_logs.ticket_status, EXCLUDED.ticket_status);
                """, (
                    client, server, db, l_type, source,
                    l_time, utc, ist, msg, raw,
                    subject, received, h, occ, severity,
                    is_semantic, sem_count, h, time_bucket,
                    t_id, t_status
                ))
                
                # Add to cache if it's a new potential semantic leader
                if not sem_hash and not is_perf:
                    add_semantic_group_to_cache(client, server, l_type, time_bucket, msg, h)
            
            db_conn.commit()
            print(f"[{'PERF' if is_perf else 'LOG'}] Processed -> {client} | {server} | {l_type} | {str(msg)[:80]}")
            cur.close()
            break 
            
        except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
            if attempt < max_retries - 1:
                print(f"Database connection error: {e}. Reconnecting (Attempt {attempt + 1}/{max_retries})...")
                try: db_conn = get_connection()
                except Exception: pass
                time.sleep(2)
            else:
                print("Failed to insert log after max retries:", e)
        except Exception as e:
            db_conn.rollback()
            print("Insert error:", e)
            try: cur.close()
            except: pass
            break
 