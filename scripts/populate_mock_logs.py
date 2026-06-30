import os
import psycopg2
import hashlib
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        database=os.getenv("DB_NAME", "geomon"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "2025"),
        port=os.getenv("DB_PORT", "5432")
    )

def make_hash(txt):
    return hashlib.sha256(txt.encode()).hexdigest()

def populate_logs():
    print("Populating high-fidelity telemetry logs...")
    conn = get_connection()
    cur = conn.cursor()
    
    # Clean up existing logs
    cur.execute("DELETE FROM db_monitoring_logs;")
    
    now = datetime.now()
    
    mock_logs = [
        {
            "client_name": "Artfine",
            "server_name": "artfine-prod-db-1",
            "db_type": "PostgreSQL",
            "log_type": "error_log",
            "log_source": "postgresql.log",
            "log_message": "FATAL: connection limit exceeded for non-superusers",
            "occurrence_count": 42,
            "severity": "Critical",
            "status": "OPEN",
            "owner": "sanjay",
            "client_visibility": "Visible",
            "ticket_status": "OPEN",
            "next_action": "Increase max_connections parameter and restart database."
        },
        {
            "client_name": "360tf",
            "server_name": "tf-mssql-prod",
            "db_type": "MSSQL",
            "log_type": "error_log",
            "log_source": "SQLSERVERAGENT",
            "log_message": "Transaction (Process ID 72) was deadlocked on lock resources with another process and has been chosen as the deadlock victim. Rerun the transaction.",
            "occurrence_count": 18,
            "severity": "High",
            "status": "IN PROGRESS",
            "owner": "sanjay",
            "client_visibility": "Visible",
            "ticket_status": "OPEN",
            "next_action": "Analyze deadlock graphs to identify conflicting queries."
        },
        {
            "client_name": "Artfine",
            "server_name": "artfine-postgres-replica",
            "db_type": "PostgreSQL",
            "log_type": "error_log",
            "log_source": "postgresql.log",
            "log_message": "FATAL: terminating connection due to conflict with recovery. Detail: User query might have needed row versions that were removed.",
            "occurrence_count": 8,
            "severity": "High",
            "status": "OPEN",
            "owner": "admin",
            "client_visibility": "Hidden",
            "ticket_status": "PENDING",
            "next_action": "Tune max_standby_streaming_delay parameter on replica."
        },
        {
            "client_name": "360tf",
            "server_name": "tf-mysql-replica",
            "db_type": "MySQL",
            "log_type": "error_log",
            "log_source": "mysqld.log",
            "log_message": "Error 'Error writing file '/var/lib/mysql/tmp-table' (Errcode: 28 - No space left on device)' on query. Default database: 'tf_prod'.",
            "occurrence_count": 5,
            "severity": "Critical",
            "status": "OPEN",
            "owner": "admin",
            "client_visibility": "Visible",
            "ticket_status": "OPEN",
            "next_action": "Clean up temporary directory disk space or add volume storage."
        },
        {
            "client_name": "Artfine",
            "server_name": "artfine-prod-db-1",
            "db_type": "PostgreSQL",
            "log_type": "error_log",
            "log_source": "postgresql.log",
            "log_message": "WARNING: autovacuum worker took too long: 1200 seconds",
            "occurrence_count": 12,
            "severity": "Medium",
            "status": "RESOLVED",
            "owner": "sanjay",
            "client_visibility": "Visible",
            "ticket_status": "RESOLVED",
            "next_action": "Optimize autovacuum cost limit parameter settings."
        },
        {
            "client_name": "RetailScan",
            "server_name": "retail-mssql-01",
            "db_type": "MSSQL",
            "log_type": "error_log",
            "log_source": "MSSQLSERVER",
            "log_message": "SQL Server has encountered 15 occurrence(s) of I/O requests taking longer than 15 seconds to complete on database [retail_sales] file [retail_sales_data.mdf].",
            "occurrence_count": 15,
            "severity": "Critical",
            "status": "OPEN",
            "owner": "sanjay",
            "client_visibility": "Visible",
            "ticket_status": "OPEN",
            "next_action": "Investigate underlying SAN storage latency issues."
        },
        {
            "client_name": "CredoPay",
            "server_name": "credo-oracle-prod",
            "db_type": "Oracle",
            "log_type": "error_log",
            "log_source": "alert_credo.log",
            "log_message": "ORA-04031: unable to allocate 4096 bytes of shared memory (\"shared pool\",\"unknown object\",\"sga heap(1,0)\",\"kglsim object\")",
            "occurrence_count": 3,
            "severity": "Critical",
            "status": "OPEN",
            "owner": "sanjay",
            "client_visibility": "Visible",
            "ticket_status": "OPEN",
            "next_action": "Resize shared pool memory allocation in SGA."
        }
    ]
    
    for idx, log in enumerate(mock_logs):
        log_time = now - timedelta(hours=idx * 2)
        log_hash = make_hash(f"{log['client_name']}|{log['server_name']}|{log['db_type']}|{log['log_type']}|{log['log_message']}")
        
        cur.execute("""
            INSERT INTO db_monitoring_logs (
                client_name, server_name, db_type, log_type, log_source,
                log_time, log_time_utc, log_time_ist, log_message, occurrence_count,
                severity, status, owner, client_visibility, ticket_status, next_action, log_hash,
                created_at, status_updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()
            )
        """, (
            log["client_name"],
            log["server_name"],
            log["db_type"],
            log["log_type"],
            log["log_source"],
            log_time.isoformat(),
            log_time.isoformat(),
            log_time.isoformat(),
            log["log_message"],
            log["occurrence_count"],
            log["severity"],
            log["status"],
            log["owner"],
            log["client_visibility"],
            log["ticket_status"],
            log["next_action"],
            log_hash
        ))
        
    conn.commit()
    cur.close()
    conn.close()
    print("SUCCESS: 7 high-fidelity telemetry logs successfully inserted!")

if __name__ == "__main__":
    populate_logs()
