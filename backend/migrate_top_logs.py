import os
import sys
# Add backend directory to path for absolute imports resolution
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import psycopg2
import psycopg2.extras
from datetime import datetime
from zoneinfo import ZoneInfo
from dotenv import load_dotenv
# Load environment variables from .env
load_dotenv()
SOURCE_DB = {
    "host": os.getenv("DB_HOST", "localhost"),
    "database": os.getenv("DB_NAME", "Incoming-error-data"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "y7UMhWmLcqSJzmhTGDyK"),
    "port": os.getenv("DB_PORT", "5432")
}

# Destination Database Name (on the same server)
DEST_DB_NAME = "AI_SUMMARY_MSSQL"

def get_connection(db_name=SOURCE_DB["database"]):
    """Establishes a connection to a specific database on the same server."""
    return psycopg2.connect(
        host=SOURCE_DB["host"],
        database=db_name,
        user=SOURCE_DB["user"],
        password=SOURCE_DB["password"],
        port=SOURCE_DB["port"]
    )

def migrate_prioritized_logs(last_timestamp):
    """
    Fetches MSSQL logs (Critical and High severity)
    that are newer than last_timestamp and stores them.
    Returns (new_last_timestamp, count_migrated)
    """
    source_conn = None
    dest_conn = None
    new_last_timestamp = last_timestamp
    logs = []
    
    try:
        source_conn = get_connection(SOURCE_DB["database"])
        source_cur = source_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # 1. Fetch MSSQL error logs (Critical and High) newer than last_timestamp
        source_cur.execute("""
            SELECT id, log_time_ist, client_name, server_name, log_message, severity, occurrence_count, db_type, log_hash, log_type
            FROM db_monitoring_logs
            WHERE severity IN ('Critical', 'High') 
              AND db_type = 'MSSQL' 
              AND log_type = 'error_log'
              AND log_time_ist > %s
            ORDER BY log_time_ist ASC
            LIMIT 500
        """, (last_timestamp,))
        logs = source_cur.fetchall()

        # 2. Connect to Destination Database and perform cleanup
        try:
            dest_conn = get_connection(DEST_DB_NAME)
            dest_cur = dest_conn.cursor()

            dest_cur.execute("""
                CREATE TABLE IF NOT EXISTS critical_error_logs (
                    id SERIAL PRIMARY KEY,
                    source_log_id INTEGER UNIQUE,
                    timestamp_ist TIMESTAMP,
                    client_name TEXT,
                    server_name TEXT,
                    db_type TEXT,
                    log_type TEXT,
                    log_message TEXT,
                    severity TEXT,
                    occurrence_count INTEGER,
                    log_hash TEXT,
                    migrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            # Ensure log_hash and log_type columns exist
            dest_cur.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                   WHERE table_name='critical_error_logs' AND column_name='log_hash') THEN
                        ALTER TABLE critical_error_logs ADD COLUMN log_hash TEXT;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                   WHERE table_name='critical_error_logs' AND column_name='log_type') THEN
                        ALTER TABLE critical_error_logs ADD COLUMN log_type TEXT;
                    END IF;
                END $$;
            """)

            # Cleanup: Remove any logs that are not MSSQL or not of type error_log
            dest_cur.execute("""
                DELETE FROM critical_error_logs 
                WHERE db_type IS NULL 
                   OR db_type != 'MSSQL'
                   OR log_type IS NULL
                   OR log_type != 'error_log';
            """)
            dest_conn.commit()

            if not logs:
                dest_cur.close()
                dest_conn.close()
                return last_timestamp, 0

            # Update the last timestamp to the latest one found
            new_last_timestamp = max(log['log_time_ist'] for log in logs)

            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Migrating {len(logs)} logs...")

            for log in logs:
                dest_cur.execute("""
                    INSERT INTO critical_error_logs
                    (source_log_id, timestamp_ist, client_name, server_name, db_type, log_type, log_message, severity, occurrence_count, log_hash)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (source_log_id) DO UPDATE 
                    SET log_hash = EXCLUDED.log_hash,
                        log_type = EXCLUDED.log_type
                """, (
                    log['id'],
                    log['log_time_ist'],
                    log['client_name'],
                    log['server_name'],
                    log['db_type'],
                    log['log_type'],
                    log['log_message'],
                    log['severity'],
                    log['occurrence_count'],
                    log['log_hash']
                ))

            dest_conn.commit()
            print(f"SUCCESS: Migrated {len(logs)} logs.")
            dest_cur.close()

        except Exception as e:
            print(f"DESTINATION ERROR: {e}")
        finally:
            if dest_conn: dest_conn.close()

        source_cur.close()

    except Exception as e:
        print(f"SOURCE ERROR: {e}")
    finally:
        if source_conn: source_conn.close()
        if dest_conn: dest_conn.close()
    
    return new_last_timestamp, len(logs)

if __name__ == "__main__":
    import time
    
    # Initialize with an old timestamp to pick up historical logs
    from datetime import timedelta
    last_processed_time = datetime.now() - timedelta(days=365)
    
    print(f"Starting MSSQL log migration service from {last_processed_time}...")
    
    while True:
        last_processed_time, count = migrate_prioritized_logs(last_processed_time)
        
        if count >= 500:
            print(f"Batch full ({count} logs). Processing next batch immediately...")
            continue
            
        print(f"No more logs to process for now (migrated {count} in last batch). Sleeping for 1 hour...")
        time.sleep(3600)

