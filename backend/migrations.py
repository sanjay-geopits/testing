import os
import psycopg2
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

class PooledConnectionProxy:
    def __init__(self, conn, pool):
        self._conn = conn
        self._pool = pool
        
    def close(self):
        if self._conn and self._pool:
            try:
                self._conn.rollback()
            except Exception:
                pass
            try:
                self._pool.putconn(self._conn)
            except Exception:
                try:
                    self._conn.close()
                except Exception:
                    pass
            self._conn = None
            self._pool = None
        elif self._conn:
            try:
                self._conn.close()
            except Exception:
                pass
            self._conn = None

    def __enter__(self):
        self._conn.__enter__()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        return self._conn.__exit__(exc_type, exc_val, exc_tb)

    def __getattr__(self, name):
        return getattr(self._conn, name)

_cached_pwd = None

def get_connection():
    global _cached_pwd
    
    # 1. Attempt to reuse connection pool from app.py to eliminate TCP overhead
    try:
        from app import db_pool
        if db_pool is not None:
            conn = db_pool.getconn()
            return PooledConnectionProxy(conn, db_pool)
    except Exception:
        pass

    host = os.getenv("DB_HOST", "localhost")
    database = os.getenv("DB_NAME", "Incoming-error-data")
    user = os.getenv("DB_USER", "postgres")
    port = os.getenv("DB_PORT", "5432")
    
    # Fast path: check cached successful password first
    if _cached_pwd is not None:
        try:
            return psycopg2.connect(
                host=host,
                database=database,
                user=user,
                password=_cached_pwd,
                port=port
            )
        except Exception:
            _cached_pwd = None

    passwords = []
    env_pwd = os.getenv("DB_PASSWORD")
    if env_pwd:
        passwords.append(env_pwd)
    passwords.extend(["y7UMhWmLcqSJzmhTGDyK", "geopitsaidata", "postgres"])
    
    for pwd in passwords:
        try:
            conn = psycopg2.connect(
                host=host,
                database=database,
                user=user,
                password=pwd,
                port=port
            )
            _cached_pwd = pwd  # Cache the successful password
            return conn
        except Exception:
            continue
            
    return psycopg2.connect(
        host=host,
        database=database,
        user=user,
        port=port
    )

def run_migrations():
    print("Running database migrations for new features...")
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        # 1. Create essential telemetry logging tables if they do not exist
        cur.execute("""
            CREATE TABLE IF NOT EXISTS db_monitoring_logs (
                id SERIAL PRIMARY KEY,
                client_name TEXT,
                server_name TEXT,
                db_type TEXT,
                log_type TEXT,
                log_source TEXT,
                log_time TIMESTAMP,
                log_time_utc TIMESTAMP,
                log_time_ist TIMESTAMP,
                log_message TEXT,
                occurrence_count INTEGER DEFAULT 1,
                raw_log JSONB,
                email_subject TEXT,
                email_received_time TIMESTAMP,
                log_hash TEXT UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT '',
                owner TEXT DEFAULT '',
                client_visibility TEXT DEFAULT '',
                ticket_status TEXT DEFAULT '',
                next_action TEXT DEFAULT '',
                severity TEXT,
                status_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        cur.execute("""
            CREATE TABLE IF NOT EXISTS db_archived_logs (
                id SERIAL PRIMARY KEY,
                client_name TEXT,
                server_name TEXT,
                db_type TEXT,
                log_type TEXT,
                log_source TEXT,
                log_time TIMESTAMP,
                log_time_utc TIMESTAMP,
                log_time_ist TIMESTAMP,
                log_message TEXT,
                occurrence_count INTEGER DEFAULT 1,
                raw_log JSONB,
                email_subject TEXT,
                email_received_time TIMESTAMP,
                log_hash TEXT UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT '',
                owner TEXT DEFAULT '',
                client_visibility TEXT DEFAULT '',
                ticket_status TEXT DEFAULT '',
                next_action TEXT DEFAULT '',
                severity TEXT,
                status_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        cur.execute("""
            CREATE TABLE IF NOT EXISTS share_history (
                id SERIAL PRIMARY KEY,
                username TEXT,
                notes TEXT,
                platform TEXT,
                content_type TEXT,
                client_name TEXT,
                server_name TEXT,
                log_message TEXT,
                status TEXT,
                owner TEXT,
                client_visibility TEXT,
                ticket_status TEXT,
                next_action TEXT,
                db_type TEXT,
                shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 2. Recreate Tickets Table if not exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS tickets (
                id SERIAL PRIMARY KEY,
                business_unit TEXT,
                company TEXT,
                contact TEXT,
                ticket_name TEXT,
                category TEXT,
                status TEXT DEFAULT 'OPEN',
                priority TEXT DEFAULT 'Medium',
                agent TEXT,
                description TEXT,
                created_by TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # 3. Client Reports Table if not exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS client_reports (
                id SERIAL PRIMARY KEY,
                client_name TEXT,
                title TEXT,
                month TEXT,
                year TEXT,
                file_name TEXT,
                file_data TEXT, -- Base64 encoded document data
                notes TEXT,
                uploaded_by TEXT,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # 4. User Page Activity if not exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS user_page_activity (
                id SERIAL PRIMARY KEY,
                username TEXT,
                page_path TEXT,
                duration_seconds INTEGER DEFAULT 0,
                last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_user_page UNIQUE (username, page_path)
            );
        """)
        
        # 5. Admin Clients Table if not exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS admin_clients (
                id SERIAL PRIMARY KEY,
                client_name TEXT,
                db_type TEXT,
                server_name TEXT,
                client_email TEXT,
                phone_number TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Alter existing tables to add columns if they do not exist
        cur.execute("ALTER TABLE db_monitoring_logs ADD COLUMN IF NOT EXISTS ticket_id INTEGER;")
        cur.execute("ALTER TABLE db_archived_logs ADD COLUMN IF NOT EXISTS ticket_id INTEGER;")
        cur.execute("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolved_by TEXT;")
        cur.execute("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;")

        # 6. Notifications Table if not exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                username TEXT,
                message TEXT,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # 7. Ticket Agents Table if not exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS ticket_agents (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE
            );
        """)
            
        # 8. Ticket Business Units Table if not exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS ticket_business_units (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE
            );
        """)

        # 9. System Settings Table if not exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        """)
        
        # 10. Feedbacks Table if not exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS feedbacks (
                id SERIAL PRIMARY KEY,
                username TEXT,
                email TEXT,
                feedback_text TEXT,
                rating INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 11. Online Users Table if not exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS online_users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE,
                units TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # 12. Admin Agents Table if not exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS admin_agents (
                id SERIAL PRIMARY KEY,
                agent_name TEXT,
                company_name TEXT,
                business_unit TEXT,
                technology TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # 13. Ticket Comments/Logs Table if not exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS ticket_comments (
                id SERIAL PRIMARY KEY,
                ticket_id INTEGER,
                author TEXT,
                comment_type TEXT,
                content TEXT,
                attachments TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # 14. Database Size History Table if not exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS database_size_history (
                id SERIAL PRIMARY KEY,
                server_name VARCHAR(255),
                database_name VARCHAR(255),
                total_size_bytes BIGINT,
                captured_date DATE,
                CONSTRAINT uq_db_size UNIQUE (server_name, database_name, captured_date)
            );
        """)
        
        # 15. Table Size History Table if not exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS table_size_history (
                id SERIAL PRIMARY KEY,
                server_name VARCHAR(255),
                database_name VARCHAR(255),
                table_name VARCHAR(255),
                size_bytes BIGINT,
                captured_date DATE,
                CONSTRAINT uq_table_size UNIQUE (server_name, database_name, table_name, captured_date)
            );
        """)
        
        # 16. User Clients Permission Map Table if not exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS user_clients (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                client_id INTEGER REFERENCES admin_clients(id) ON DELETE CASCADE,
                access_level VARCHAR(50) DEFAULT 'view',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_user_client UNIQUE (user_id, client_id)
            );
        """)

        # 17. Server Utilization History Table if not exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS server_utilization_history (
                id SERIAL PRIMARY KEY,
                server_name VARCHAR(255),
                cpu_utilization NUMERIC(5,2),
                memory_utilization NUMERIC(5,2),
                disk_utilization NUMERIC(5,2),
                io_utilization NUMERIC(5,2),
                read_iops NUMERIC(10,2),
                write_iops NUMERIC(10,2),
                captured_at TIMESTAMP,
                CONSTRAINT uq_server_utilization UNIQUE (server_name, captured_at)
            );
        """)
        
        # 21. Client Alert Settings Table if not exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS client_alert_settings (
                id SERIAL PRIMARY KEY,
                client_name VARCHAR(255) NOT NULL,
                db_type VARCHAR(100) NOT NULL,
                cpu_threshold NUMERIC(5,2) DEFAULT 80.00,
                memory_threshold NUMERIC(5,2) DEFAULT 80.00,
                disk_threshold NUMERIC(5,2) DEFAULT 80.00,
                io_threshold NUMERIC(5,2) DEFAULT 80.00,
                slow_query_threshold_ms INTEGER DEFAULT 5000,
                long_running_threshold_sec INTEGER DEFAULT 3600,
                client_emails TEXT,
                cc_emails TEXT,
                server_down_alert BOOLEAN DEFAULT TRUE,
                critical_error_alert BOOLEAN DEFAULT TRUE,
                last_summary_sent TIMESTAMP DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_client_tech UNIQUE (client_name, db_type)
            );
        """)

        # 22. Technology Alerts Config Table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS technology_alerts_config (
                technology VARCHAR(100) PRIMARY KEY,
                alert_email VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Proactively ensure columns exist for existing databases
        cur.execute("ALTER TABLE server_utilization_history ADD COLUMN IF NOT EXISTS read_iops NUMERIC(10,2);")
        cur.execute("ALTER TABLE server_utilization_history ADD COLUMN IF NOT EXISTS write_iops NUMERIC(10,2);")
        cur.execute("ALTER TABLE admin_clients ADD COLUMN IF NOT EXISTS client_email TEXT;")
        cur.execute("ALTER TABLE admin_clients ADD COLUMN IF NOT EXISTS phone_number TEXT;")
        cur.execute("ALTER TABLE client_access ADD COLUMN IF NOT EXISTS phone_number VARCHAR(100);")
        
        # 18. Create database indexes for performance optimization
        cur.execute("CREATE INDEX IF NOT EXISTS idx_db_size_history_lookup ON database_size_history (server_name, database_name, captured_date DESC);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tbl_size_history_lookup ON table_size_history (server_name, database_name, table_name, captured_date DESC);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tbl_size_history_heavy ON table_size_history (server_name, database_name, size_bytes DESC);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_db_mon_logs_lookup ON db_monitoring_logs (client_name, server_name, log_time DESC);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tickets_company ON tickets (company, created_at DESC);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_server_util_lookup ON server_utilization_history (server_name, captured_at DESC);")
        
        # New critical performance indexes for high concurrency log lookup & filtering
        cur.execute("CREATE INDEX IF NOT EXISTS idx_db_mon_logs_ist ON db_monitoring_logs (log_time_ist DESC);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_db_arch_logs_ist ON db_archived_logs (log_time_ist DESC);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_db_mon_logs_hash ON db_monitoring_logs (log_hash);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_db_arch_logs_hash ON db_archived_logs (log_hash);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_db_mon_logs_client_server ON db_monitoring_logs (client_name, server_name);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_db_arch_logs_client_server ON db_archived_logs (client_name, server_name);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_db_mon_logs_composite ON db_monitoring_logs (db_type, client_name, server_name, log_time_ist DESC);")
        # 19. Report Reviews Table if not exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS report_reviews (
                id SERIAL PRIMARY KEY,
                report_id INTEGER REFERENCES client_reports(id) ON DELETE CASCADE,
                username TEXT,
                rating INTEGER CHECK (rating >= 1 AND rating <= 5),
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 20. DB Uptime History Table if not exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS db_uptime_history (
                id SERIAL PRIMARY KEY,
                client_name VARCHAR(255),
                server_name VARCHAR(255),
                db_type VARCHAR(100) DEFAULT 'MSSQL',
                service_name VARCHAR(255),
                status VARCHAR(100),
                uptime_desc VARCHAR(255),
                last_restart_time TIMESTAMP,
                captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_db_uptime UNIQUE (client_name, server_name, service_name, captured_at)
            );
        """)
        
        cur.execute("CREATE INDEX IF NOT EXISTS idx_db_uptime_history_lookup ON db_uptime_history (client_name, server_name, captured_at DESC);")
        cur.execute("ALTER TABLE report_reviews ADD COLUMN IF NOT EXISTS mom TEXT;")

        cur.execute("""
            CREATE TABLE IF NOT EXISTS processed_emails (
                message_id VARCHAR(500) PRIMARY KEY,
                subject VARCHAR(500),
                sender VARCHAR(255),
                processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                received_at TIMESTAMP
            );
        """)
        cur.execute("ALTER TABLE processed_emails ADD COLUMN IF NOT EXISTS received_at TIMESTAMP;")

        # MSSQL Diagnostic and Report telemetry tables
        mssql_tables = [
            "reportdata_restart",
            "reportdata_backup",
            "reportdata_server",
            "reportdata_disk_drive",
            "reportdata_size_growth",
            "reportdata_top_cpu",
            "diagnosticdata_disk_io",
            "diagnosticdata_wait_stats",
            "diagnosticdata_long_queries",
            "diagnosticdata_deadlocks",
            "diagnosticdata_tempdb",
            "diagnosticdata_job_executions",
            "diagnosticdata_blocking",
            "diagnosticdata_error_logs",
            "diagnosticdata_cpu_querystore",
            "diagnosticdata_mem_querystore",
            "reportdata_memory_ple",
            "reportdata_memory_snapshot",
            "reportdata_cpu_daily_summary",
            "reportdata_cpu_spike_analysis"
        ]
        for tbl in mssql_tables:
            cur.execute(f"""
                CREATE TABLE IF NOT EXISTS {tbl} (
                    id SERIAL PRIMARY KEY,
                    client_name VARCHAR(255) NOT NULL,
                    server_name VARCHAR(255) NOT NULL,
                    captured_at TIMESTAMP NOT NULL,
                    raw_data JSONB,
                    log_hash VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT uq_{tbl}_hash UNIQUE (log_hash)
                );
            """)
            cur.execute(f"CREATE INDEX IF NOT EXISTS idx_{tbl}_captured ON {tbl} (client_name, server_name, captured_at DESC);")

        conn.commit()
        print("Database migrations applied successfully!")
    except Exception as e:
        print("Error executing database migrations:", e)
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    run_migrations()
