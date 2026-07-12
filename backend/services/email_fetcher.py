import json
import logging
import os
import uuid
import datetime
import re
import hashlib
import pytz
from bs4 import BeautifulSoup
import pandas as pd
from io import StringIO

from exchangelib import (
    DELEGATE, OAUTH2, Account, Configuration, OAuth2LegacyCredentials,
)
from exchangelib.ewsdatetime import EWSTimeZone

import config
import db_manager
from json_parser import (
    extract_json_from_sql_output, 
    extract_memory_components,
    extract_xml_from_sql_output
)
from subject_parser import parse_subject, parse_time

logger = logging.getLogger(__name__)

# Category mapping — report_type values stored in unified telemetry_records table
# Format: (keywords_list, log_type_slug, report_type_value)
# log_type_slug is used internally; report_type_value is stored in telemetry_records.report_type
# None report_type = utilization-only records (cpu/memory) → server_utilization_history
_ALL_CATEGORIES = [
    (["CPU Utilization"],                                                          "cpu",              None),
    (["Memory Utilization"],                                                       "memory",           None),
    (["Restart Evidence"],                                                         "restart",          "reportdata_restart"),
    (["Backup Execution"],                                                         "backup",           "reportdata_backup"),
    (["Configuration Report"],                                                     "server",           "reportdata_server"),
    (["Disk Drive Usage"],                                                         "disk_drive",       "reportdata_disk_drive"),
    (["Size Growth Report", "Size & Grow", "Month Growth"],                       "size_growth",      "reportdata_size_growth"),
    (["Top 5 CPU Queries", "Top CPU"],                                             "top_cpu",          "reportdata_top_cpu"),
    (["Memory PLE"],                                                               "memory_ple",       "reportdata_memory_ple"),
    (["Memory Snapshot"],                                                          "memory_snapshot",  "reportdata_memory_snapshot"),
    (["CPU Daily Summary"],                                                        "cpu_daily_summary","reportdata_cpu_daily_summary"),
    (["CPU Spike Analysis"],                                                       "cpu_spike_analysis","reportdata_cpu_spike_analysis"),
    (["Disk IO Latency", "Disk IO RCA", "Weekly Disk IO"],                        "disk_io",          "diagnosticdata_disk_io"),
    (["Wait Statistics", "Wait Stats"],                                            "wait_stats",       "diagnosticdata_wait_stats"),
    (["Long Running Queries"],                                                     "long_queries",     "diagnosticdata_long_queries"),
    (["Deadlock"],                                                                 "deadlocks",        "diagnosticdata_deadlocks"),
    (["TempDB Usage"],                                                             "tempdb",           "diagnosticdata_tempdb"),
    (["Agent Job", "Job Failure"],                                                 "job_executions",   "diagnosticdata_job_executions"),
    (["Blocking Sessions"],                                                        "blocking",         "diagnosticdata_blocking"),
    (["Error Logs"],                                                               "error_logs",       "diagnosticdata_error_logs"),
    (["Top 10 CPU - Query Store", "Top 10 CPU Queries (IST)"],                    "cpu_querystore",   "diagnosticdata_cpu_querystore"),
    (["Top 10 Memory (Logical Reads) - Query Store", "Top 10 Memory Queries (IST)"], "mem_querystore", "diagnosticdata_mem_querystore"),
]
# Backwards-compatibility: keep these for code that references them
_REPORT_CATEGORIES = [(kw, lt, rt) for kw, lt, rt in _ALL_CATEGORIES if rt and rt.startswith("reportdata_")]
_DIAG_CATEGORIES   = [(kw, lt, rt) for kw, lt, rt in _ALL_CATEGORIES if rt and rt.startswith("diagnosticdata_")]

def _to_list(val):
    """Coerce a JSON value to a flat Python list of dicts."""
    if not val:
        return []
    if isinstance(val, str):
        try:
            val = json.loads(val)
        except Exception:
            return []
    if isinstance(val, list):
        return val
    if isinstance(val, dict):
        return [val]
    return []

def get_ews_account():
    """Establishes connection to the Exchange Web Services mailbox."""
    if not config.USER_EMAIL or not config.MAIL_PASSWORD:
        logger.warning("USER_EMAIL or MAIL_PASSWORD is not configured in environment. Bypassing Exchange connection.")
        return None
    try:
        credentials = OAuth2LegacyCredentials(
            client_id=config.APP_CLIENT,
            client_secret=config.APP_SECRET,
            tenant_id=config.APP_TENANT,
            username=config.USER_EMAIL,
            password=config.MAIL_PASSWORD
        )
        ews_config = Configuration(
            server="outlook.office365.com",
            credentials=credentials,
            auth_type=OAUTH2
        )
        return Account(
            primary_smtp_address=config.USER_EMAIL,
            config=ews_config,
            autodiscover=False,
            access_type=DELEGATE
        )
    except Exception as e:
        logger.error(f"Exchange mailbox connection failed: {e}")
        return None

def make_hash(txt):
    """Generates SHA-256 hash string for unique keys."""
    return hashlib.sha256(txt.encode('utf-8')).hexdigest()

def get_last_sync_time(conn):
    """Retrieves the last sync time from the system settings database."""
    with conn.cursor() as cur:
        cur.execute("SELECT value FROM system_settings WHERE key = 'last_mssql_telemetry_sync_time';")
        row = cur.fetchone()
        if row:
            try:
                # Expecting UTC ISO format
                dt = datetime.datetime.fromisoformat(row[0])
                if dt.tzinfo is None:
                    dt = pytz.utc.localize(dt)
                return dt
            except ValueError:
                pass
    # Default to 7 days ago if no sync time has been recorded
    return datetime.datetime.now(pytz.utc) - datetime.timedelta(days=7)

def update_last_sync_time(conn, dt):
    """Updates the last sync time in the system settings database."""
    if dt.tzinfo is None:
        dt = pytz.utc.localize(dt)
    val_str = dt.isoformat()
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO system_settings (key, value)
            VALUES ('last_mssql_telemetry_sync_time', %s)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
        """, (val_str,))
    conn.commit()

def parse_body_data(body, html_body=None):
    """Parses email body structure (JSON, HTML table, or key-value fields) into a list of records."""
    # 1. Try to extract JSON from body
    json_data = extract_json_from_sql_output(html_body or body)
    if json_data:
        return _to_list(json_data)
        
    # 2. Try to parse HTML tables
    if html_body:
        try:
            soup = BeautifulSoup(html_body, "html.parser")
            tables = pd.read_html(StringIO(str(soup)))
            if tables:
                df = tables[0]
                df.columns = [str(c).strip() for c in df.columns]
                df = df.fillna("")
                return df.to_dict(orient="records")
        except Exception:
            pass
            
    # 3. Try to extract key-value memory components
    mem_components = extract_memory_components(body)
    if mem_components:
        return [mem_components]
        
    return []

def extract_record_timestamp(record, default_time):
    """Extracts timestamp from record if available, otherwise falls back to default."""
    ts_keys = ["timestamp", "captured_time", "time", "metric_date", "date", "backup_start_time", "start_time", "created_at", "run_date"]
    for key in record:
        if any(ts_k in key.lower() for ts_k in ts_keys):
            ts_val = record[key]
            if ts_val:
                try:
                    # Let subject_parser parse it
                    _, _, dt = parse_time(str(ts_val))
                    return dt
                except Exception:
                    pass
    return default_time

def upsert_server_utilization(conn, server_name, captured_at, cpu=None, mem=None, disk=None, io=None):
    """Updates server utilization history for CPU, memory, disk, and IO."""
    with conn.cursor() as cur:
        # Normalize to nearest hour
        hour_dt = captured_at.replace(minute=0, second=0, microsecond=0)
        cur.execute("""
            INSERT INTO server_utilization_history (server_name, cpu_utilization, memory_utilization, disk_utilization, io_utilization, captured_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (server_name, captured_at) DO UPDATE SET
                cpu_utilization = COALESCE(EXCLUDED.cpu_utilization, server_utilization_history.cpu_utilization),
                memory_utilization = COALESCE(EXCLUDED.memory_utilization, server_utilization_history.memory_utilization),
                disk_utilization = COALESCE(EXCLUDED.disk_utilization, server_utilization_history.disk_utilization),
                io_utilization = COALESCE(EXCLUDED.io_utilization, server_utilization_history.io_utilization);
        """, (server_name, cpu, mem, disk, io, hour_dt))
    conn.commit()

def process_email_item(conn, item):
    """Processes a single email item and persists it into the target SQL tables."""
    subject = (item.subject or "").strip()
    body = (item.body or "").strip()
    html_body = getattr(item, 'html_body', None) or ""
    
    received_time = item.datetime_received
    # Convert received_time to naive datetime in UTC or IST
    if received_time.tzinfo:
        received_time = received_time.astimezone(pytz.utc).replace(tzinfo=None)
        
    client_name, server_name, db_type, log_type = parse_subject(subject)
    if not client_name or db_type != "MSSQL":
        logger.debug(f"Skipping email subject: '{subject}'. Not classified as MSSQL telemetry.")
        return False
        
    if not server_name:
        server_name = client_name
        
    # Resolve report_type from the unified category list
    report_type = None
    for keywords, cat_type, rt in _ALL_CATEGORIES:
        if cat_type == log_type:
            report_type = rt
            break

    # Extract records from email body
    records = parse_body_data(body, html_body)
    if not records:
        records = [{"raw_text": body}]

    processed_any = False

    with conn.cursor() as cur:
        for rec in records:
            rec_timestamp = extract_record_timestamp(rec, received_time)

            # CPU & Memory → update server_utilization_history
            if log_type == "cpu":
                val = rec.get("cpu_utilization") or rec.get("cpu") or rec.get("avg_cpu") or rec.get("cpu_percent")
                if val is not None:
                    try:
                        upsert_server_utilization(conn, server_name, rec_timestamp, cpu=float(val))
                    except (ValueError, TypeError):
                        pass
            elif log_type == "memory":
                val = rec.get("memory_utilization") or rec.get("memory") or rec.get("avg_memory") or rec.get("memory_percent")
                if val is not None:
                    try:
                        upsert_server_utilization(conn, server_name, rec_timestamp, mem=float(val))
                    except (ValueError, TypeError):
                        pass

            # Persist to unified telemetry_records table if report_type is mapped
            if report_type:
                rec_str  = json.dumps(rec, sort_keys=True)
                rec_hash = make_hash(f"{client_name}_{server_name}_{report_type}_{rec_timestamp.isoformat()}_{rec_str}")
                try:
                    cur.execute("""
                        INSERT INTO telemetry_records
                            (report_type, client_name, server_name, captured_at, raw_data, log_hash)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT (log_hash) DO NOTHING;
                    """, (report_type, client_name, server_name, rec_timestamp, rec_str, rec_hash))
                    processed_any = True
                except Exception as db_err:
                    logger.error(f"[TELEMETRY] Error persisting record (type={report_type}): {db_err}")

        conn.commit()
    return processed_any

def sync_mssql_telemetry():
    """Hourly sync orchestrator called by sync_service.py."""
    logger.info("Starting MSSQL Telemetry email ingestion sync...")
    conn = db_manager.get_connection()
    if not conn:
        logger.error("Could not obtain database connection. Sync aborted.")
        return
        
    try:
        last_sync = get_last_sync_time(conn)
        logger.info(f"Last sync timestamp: {last_sync.isoformat()}")
        
        account = get_ews_account()
        
        if not account:
            logger.info("Bypassed Exchange Mode: Running simulated data sync.")
            run_simulation(conn)
            return
            
        # Target folder for MSSQL telemetry reports
        folder = account.root / "Top of Information Store" / "MSSQL Alert"
        
        # Incremental filter based on received time
        # EWS requires datetime to be EWSTimeZone or tz-aware datetime
        last_sync_ews = EWSTimeZone.from_timezone(pytz.utc).localize(
            last_sync.astimezone(pytz.utc)
        )
        
        items = folder.filter(datetime_received__gt=last_sync_ews).order_by('datetime_received')
        
        logger.info(f"Found {len(items)} new telemetry emails since last sync.")
        
        max_received_time = last_sync
        success_count = 0
        
        for item in items:
            try:
                processed = process_email_item(conn, item)
                if processed:
                    success_count += 1
                
                # Mark email as read in the Exchange mailbox
                try:
                    item.is_read = True
                    item.save()
                except Exception as save_err:
                    logger.warning(f"Could not mark email '{item.subject}' as read: {save_err}")
                
                # Save progress incrementally
                item_received = item.datetime_received.astimezone(pytz.utc)
                if item_received > max_received_time:
                    max_received_time = item_received
                    update_last_sync_time(conn, max_received_time)
            except Exception as item_err:
                logger.error(f"Error processing email '{item.subject}': {item_err}")
                
        logger.info(f"MSSQL Telemetry sync complete. Successfully processed {success_count} emails.")
    except Exception as e:
        logger.error(f"Fatal error in MSSQL Telemetry Sync: {e}")
    finally:
        conn.close()

def run_simulation(conn):
    """Simulates ingestion of new telemetry emails for local testing/development."""
    logger.info("Executing telemetry sync simulation...")
    
    # Check if we have already simulated
    now = datetime.datetime.now(pytz.utc)
    
    class MockEmailItem:
        def __init__(self, subject, body, html_body, received_time):
            self.subject = subject
            self.body = body
            self.html_body = html_body
            self.datetime_received = received_time

    simulated_mails = [
        # CPU
        MockEmailItem(
            subject="Geojit | DRP-BOSRV03 | MSSQL | CPU Utilization",
            body="[{\"cpu_utilization\": 72.4, \"timestamp\": \"" + now.isoformat() + "\"}]",
            html_body="",
            received_time=now
        ),
        # Memory Snapshot
        MockEmailItem(
            subject="Geojit | DRP-BOSRV03 | MSSQL | Memory Snapshot",
            body="",
            html_body="""<table>
                <tr><th>timestamp</th><th>free_memory_mb</th><th>total_memory_mb</th></tr>
                <tr><td>""" + now.isoformat() + """</td><td>4096</td><td>16384</td></tr>
            </table>""",
            received_time=now
        ),
        # Wait stats
        MockEmailItem(
            subject="Geojit | DRP-BOSRV03 | MSSQL | Wait Statistics",
            body="[{\"wait_type\": \"CXPACKET\", \"wait_time_ms\": 10500, \"timestamp\": \"" + now.isoformat() + "\"}]",
            html_body="",
            received_time=now
        )
    ]
    
    success_count = 0
    for mail in simulated_mails:
        if process_email_item(conn, mail):
            success_count += 1
            
    # Update last sync time
    update_last_sync_time(conn, now)
    logger.info(f"Simulation completed. Ingested {success_count} mock records.")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    sync_mssql_telemetry()
