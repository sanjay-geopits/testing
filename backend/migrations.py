"""
GeoMon Database Schema — Canonical Migrations
=============================================
Single source of truth for ALL table creation and index definitions.
Safe to re-run on an existing database (all statements are idempotent).
"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()


def _get_connection():
    """Bootstrap connection (used before the pool is available)."""
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        database=os.getenv("DB_NAME", "geomon"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "2025"),
    )


def get_connection():
    from core.database import get_connection as get_db_conn
    return get_db_conn()


def run_migrations() -> None:
    """Apply all schema migrations. Called once at app startup."""
    print("[MIGRATIONS] Applying schema...")
    conn = _get_connection()
    cur = conn.cursor()
    try:
        # ── Authentication & Users (4 tables) ────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id              SERIAL PRIMARY KEY,
                username        VARCHAR(50)  NOT NULL UNIQUE,
                hashed_password VARCHAR(255) NOT NULL,
                role            VARCHAR(50)  NOT NULL DEFAULT 'user',
                full_name       VARCHAR(255),
                email           VARCHAR(255),
                profile_pic     TEXT,
                last_active_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS user_clients (
                id           SERIAL PRIMARY KEY,
                user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
                client_id    INTEGER,
                access_level VARCHAR(50) DEFAULT 'view',
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_user_client UNIQUE (user_id, client_id)
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS user_page_activity (
                id               SERIAL PRIMARY KEY,
                username         TEXT,
                page_path        TEXT,
                duration_seconds INTEGER DEFAULT 0,
                last_active_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_user_page UNIQUE (username, page_path)
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS online_users (
                id         SERIAL PRIMARY KEY,
                username   TEXT NOT NULL UNIQUE,
                units      TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # ── Incident Management (3 tables) ────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS tickets (
                id            SERIAL PRIMARY KEY,
                business_unit TEXT,
                company       TEXT,
                contact       TEXT,
                ticket_name   TEXT,
                category      TEXT,
                status        TEXT DEFAULT 'OPEN',
                priority      TEXT DEFAULT 'Medium',
                agent         TEXT,
                description   TEXT,
                created_by    TEXT,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_by   TEXT,
                resolved_at   TIMESTAMP
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS ticket_comments (
                id           SERIAL PRIMARY KEY,
                ticket_id    INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
                author       TEXT,
                comment_type TEXT,
                content      TEXT,
                attachments  TEXT,
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS ticket_business_units (
                id   SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE
            );
        """)

        # ── Client Configuration (4 tables) ───────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS admin_clients (
                id           SERIAL PRIMARY KEY,
                client_name  TEXT NOT NULL,
                db_type      TEXT NOT NULL,
                server_name  TEXT NOT NULL,
                client_email TEXT,
                phone_number TEXT,
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_admin_clients_combo UNIQUE (client_name, db_type, server_name)
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS client_access (
                id           SERIAL PRIMARY KEY,
                client_email VARCHAR(255) NOT NULL,
                technology   VARCHAR(100) NOT NULL,
                client_name  VARCHAR(100) NOT NULL,
                server_name  VARCHAR(100) NOT NULL,
                status       VARCHAR(20)  DEFAULT 'enabled',
                phone_number VARCHAR(100),
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_client_access_combo
                    UNIQUE (client_email, technology, client_name, server_name)
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS client_alert_settings (
                id                       SERIAL PRIMARY KEY,
                client_name              VARCHAR(255) NOT NULL,
                db_type                  VARCHAR(100) NOT NULL,
                cpu_threshold            NUMERIC(5,2) DEFAULT 80,
                memory_threshold         NUMERIC(5,2) DEFAULT 80,
                disk_threshold           NUMERIC(5,2) DEFAULT 80,
                io_threshold             NUMERIC(5,2) DEFAULT 80,
                slow_query_threshold_ms  INTEGER      DEFAULT 5000,
                long_running_threshold_sec INTEGER     DEFAULT 3600,
                client_emails            TEXT,
                cc_emails                TEXT,
                server_down_alert        BOOLEAN      DEFAULT TRUE,
                critical_error_alert     BOOLEAN      DEFAULT TRUE,
                last_summary_sent        TIMESTAMP,
                created_at               TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_client_tech UNIQUE (client_name, db_type)
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS technology_alerts_config (
                technology  VARCHAR(100) PRIMARY KEY,
                alert_email VARCHAR(255) NOT NULL,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # ── Telemetry & Logs (5 tables) ───────────────────────────
        # Unified log table — is_archived replaces db_archived_logs
        cur.execute("""
            CREATE TABLE IF NOT EXISTS db_monitoring_logs (
                id                  BIGSERIAL PRIMARY KEY,
                client_name         TEXT        NOT NULL,
                server_name         TEXT        NOT NULL,
                db_type             TEXT        NOT NULL,
                log_type            TEXT        NOT NULL,
                log_source          TEXT,
                log_time            TIMESTAMP,
                log_time_utc        TIMESTAMP,
                log_time_ist        TIMESTAMP,
                log_level           TEXT,
                log_message         TEXT,
                occurrence_count    INTEGER     DEFAULT 1,
                raw_log             JSONB,
                email_subject       TEXT,
                email_received_time TIMESTAMP,
                log_hash            TEXT        UNIQUE,
                severity            VARCHAR(50),
                status              VARCHAR(100) DEFAULT '',
                owner               VARCHAR(100) DEFAULT '',
                client_visibility   VARCHAR(100) DEFAULT '',
                ticket_status       VARCHAR(100) DEFAULT '',
                next_action         TEXT         DEFAULT '',
                is_archived         BOOLEAN      DEFAULT FALSE,
                is_semantic         BOOLEAN      DEFAULT FALSE,
                semantic_count      INTEGER      DEFAULT 1,
                semantic_hash       TEXT,
                time_bucket         TEXT,
                ticket_id           INTEGER,
                status_updated_at   TIMESTAMPTZ,
                created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS db_uptime_history (
                id               SERIAL PRIMARY KEY,
                client_name      VARCHAR(255),
                server_name      VARCHAR(255),
                db_type          VARCHAR(100) DEFAULT 'MSSQL',
                service_name     VARCHAR(255),
                status           VARCHAR(100),
                uptime_desc      VARCHAR(255),
                last_restart_time TIMESTAMP,
                captured_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_db_uptime UNIQUE (client_name, server_name, service_name, captured_at)
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS database_size_history (
                id             SERIAL PRIMARY KEY,
                server_name    VARCHAR(255),
                database_name  VARCHAR(255),
                total_size_bytes BIGINT,
                captured_date  DATE,
                CONSTRAINT uq_db_size UNIQUE (server_name, database_name, captured_date)
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS table_size_history (
                id             SERIAL PRIMARY KEY,
                server_name    VARCHAR(255),
                database_name  VARCHAR(255),
                table_name     VARCHAR(255),
                size_bytes     BIGINT,
                captured_date  DATE,
                CONSTRAINT uq_table_size UNIQUE (server_name, database_name, table_name, captured_date)
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS server_utilization_history (
                id                 SERIAL PRIMARY KEY,
                server_name        VARCHAR(255),
                cpu_utilization    NUMERIC(5,2),
                memory_utilization NUMERIC(5,2),
                disk_utilization   NUMERIC(5,2),
                io_utilization     NUMERIC(5,2),
                read_iops          NUMERIC(10,2),
                write_iops         NUMERIC(10,2),
                captured_at        TIMESTAMP,
                CONSTRAINT uq_server_utilization UNIQUE (server_name, captured_at)
            );
        """)

        # ── Ingestion Control (2 tables) ──────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS processed_emails (
                message_id   VARCHAR(500) PRIMARY KEY,
                subject      VARCHAR(500),
                sender       VARCHAR(255),
                processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                received_at  TIMESTAMP
            );
        """)

        # Unified telemetry records (replaces 20 reportdata_*/diagnosticdata_* tables)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS telemetry_records (
                id          SERIAL PRIMARY KEY,
                report_type VARCHAR(100) NOT NULL,
                client_name VARCHAR(255) NOT NULL,
                server_name VARCHAR(255) NOT NULL,
                captured_at TIMESTAMP   NOT NULL,
                raw_data    JSONB,
                log_hash    VARCHAR(255),
                created_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_telemetry_hash UNIQUE (log_hash)
            );
        """)

        # ── Reports & Feedback (3 tables) ─────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS client_reports (
                id          SERIAL PRIMARY KEY,
                client_name TEXT,
                title       TEXT,
                month       TEXT,
                year        TEXT,
                file_name   TEXT,
                file_data   TEXT,
                notes       TEXT,
                uploaded_by TEXT,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS report_reviews (
                id        SERIAL PRIMARY KEY,
                report_id INTEGER REFERENCES client_reports(id) ON DELETE CASCADE,
                username  TEXT,
                rating    INTEGER CHECK (rating >= 1 AND rating <= 5),
                comment   TEXT,
                mom       TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS feedbacks (
                id            SERIAL PRIMARY KEY,
                username      TEXT,
                email         TEXT,
                feedback_text TEXT,
                rating        INTEGER,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # ── Report Sharing History ─────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS report_sharing_history (
                id             SERIAL PRIMARY KEY,
                report_id      INTEGER REFERENCES client_reports(id) ON DELETE SET NULL,
                report_title   TEXT,
                shared_by      TEXT,
                share_platform TEXT,
                recipient      TEXT,
                created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # ── Archived Logs view (backed by db_monitoring_logs WHERE is_archived=TRUE)
        # This view is created once; DML rules make it writable for bidirectional sync.
        cur.execute("""
            CREATE OR REPLACE VIEW db_archived_logs AS
            SELECT id, client_name, server_name, db_type, log_type, log_source,
                   log_time, log_time_utc, log_time_ist, log_level, log_message,
                   occurrence_count, raw_log, email_subject, email_received_time,
                   log_hash, created_at, status, owner, client_visibility,
                   ticket_status, next_action, severity, status_updated_at,
                   is_semantic, semantic_count, semantic_hash, time_bucket,
                   ticket_id, is_archived
            FROM db_monitoring_logs
            WHERE is_archived = TRUE;
        """)

        # Create rewrite rules so UPDATE/INSERT/DELETE on the view pass through
        cur.execute("""
            CREATE OR REPLACE RULE db_archived_logs_update AS
            ON UPDATE TO db_archived_logs DO INSTEAD
                UPDATE db_monitoring_logs
                SET status = NEW.status, owner = NEW.owner,
                    client_visibility = NEW.client_visibility,
                    ticket_status = NEW.ticket_status,
                    next_action = NEW.next_action,
                    is_archived = NEW.is_archived,
                    status_updated_at = NEW.status_updated_at
                WHERE id = OLD.id;
        """)

        cur.execute("""
            CREATE OR REPLACE RULE db_archived_logs_insert AS
            ON INSERT TO db_archived_logs DO INSTEAD
                INSERT INTO db_monitoring_logs (
                    client_name, server_name, db_type, log_type, log_source,
                    log_time, log_time_utc, log_time_ist, log_level, log_message,
                    occurrence_count, raw_log, email_subject, email_received_time,
                    log_hash, severity, status, owner, client_visibility,
                    ticket_status, next_action, is_archived, is_semantic,
                    semantic_count, semantic_hash, time_bucket, ticket_id, status_updated_at
                ) VALUES (
                    NEW.client_name, NEW.server_name, NEW.db_type, NEW.log_type, NEW.log_source,
                    NEW.log_time, NEW.log_time_utc, NEW.log_time_ist, NEW.log_level, NEW.log_message,
                    NEW.occurrence_count, NEW.raw_log, NEW.email_subject, NEW.email_received_time,
                    NEW.log_hash, NEW.severity, NEW.status, NEW.owner, NEW.client_visibility,
                    NEW.ticket_status, NEW.next_action, TRUE, NEW.is_semantic,
                    NEW.semantic_count, NEW.semantic_hash, NEW.time_bucket, NEW.ticket_id, NEW.status_updated_at
                );
        """)

        cur.execute("""
            CREATE OR REPLACE RULE db_archived_logs_delete AS
            ON DELETE TO db_archived_logs DO INSTEAD
                DELETE FROM db_monitoring_logs WHERE id = OLD.id;
        """)

        # ── Monitoring Logs Backup (AI context / reference table) ──
        cur.execute("""
            CREATE TABLE IF NOT EXISTS db_monitoring_logs_backup (
                id          BIGSERIAL PRIMARY KEY,
                client_name TEXT,
                server_name TEXT,
                db_type     TEXT,
                log_type    TEXT,
                log_time    TIMESTAMP,
                log_message TEXT,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # ── Share History (WhatsApp/Teams audit trail) ─────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS share_history (
                id               SERIAL PRIMARY KEY,
                username         TEXT,
                platform         TEXT,
                content_type     TEXT,
                client_name      TEXT,
                server_name      TEXT,
                log_message      TEXT,
                notes            TEXT,
                status           VARCHAR(100) DEFAULT '',
                owner            VARCHAR(100) DEFAULT '',
                ticket_status    VARCHAR(100) DEFAULT '',
                next_action      TEXT         DEFAULT '',
                client_visibility VARCHAR(100) DEFAULT '',
                db_type          TEXT,
                shared_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # ── System (4 tables) ─────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS system_settings (
                key   TEXT PRIMARY KEY,
                value TEXT
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS leads (
                id         SERIAL PRIMARY KEY,
                email      VARCHAR(255),
                technology VARCHAR(100),
                is_lead    BOOLEAN DEFAULT TRUE,
                status     VARCHAR(50) DEFAULT 'active'
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id         SERIAL PRIMARY KEY,
                username   TEXT,
                message    TEXT,
                is_read    BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS admin_agents (
                id            SERIAL PRIMARY KEY,
                agent_name    TEXT,
                company_name  TEXT,
                business_unit TEXT,
                technology    TEXT,
                email         TEXT,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # ── Schema Evolution (ADD COLUMN IF NOT EXISTS) ───────────
        _safe_alters(cur)

        # ── Indexes ───────────────────────────────────────────────
        _create_indexes(cur)

        conn.commit()
        print("[MIGRATIONS] ✅ Schema applied successfully.")
    except Exception as e:
        conn.rollback()
        print(f"[MIGRATIONS] ❌ Error: {e}")
        raise
    finally:
        cur.close()
        conn.close()


def _safe_alters(cur) -> None:
    """Idempotent column additions for existing databases."""
    alters = [
        "ALTER TABLE server_utilization_history ADD COLUMN IF NOT EXISTS read_iops NUMERIC(10,2);",
        "ALTER TABLE server_utilization_history ADD COLUMN IF NOT EXISTS write_iops NUMERIC(10,2);",
        "ALTER TABLE admin_clients ADD COLUMN IF NOT EXISTS client_email TEXT;",
        "ALTER TABLE admin_clients ADD COLUMN IF NOT EXISTS phone_number TEXT;",
        "ALTER TABLE client_access ADD COLUMN IF NOT EXISTS phone_number VARCHAR(100);",
        "ALTER TABLE db_monitoring_logs ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE db_monitoring_logs ADD COLUMN IF NOT EXISTS is_semantic BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE db_monitoring_logs ADD COLUMN IF NOT EXISTS semantic_count INTEGER DEFAULT 1;",
        "ALTER TABLE db_monitoring_logs ADD COLUMN IF NOT EXISTS semantic_hash TEXT;",
        "ALTER TABLE db_monitoring_logs ADD COLUMN IF NOT EXISTS time_bucket TEXT;",
        "ALTER TABLE db_monitoring_logs ADD COLUMN IF NOT EXISTS ticket_id INTEGER;",
        "ALTER TABLE db_monitoring_logs ADD COLUMN IF NOT EXISTS log_level TEXT;",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolved_by TEXT;",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;",
        "ALTER TABLE report_reviews ADD COLUMN IF NOT EXISTS mom TEXT;",
        "ALTER TABLE processed_emails ADD COLUMN IF NOT EXISTS received_at TIMESTAMP;",
        "ALTER TABLE admin_agents ADD COLUMN IF NOT EXISTS email TEXT;",
        # db_type column needed on sizing tables for technology-based filtering in routes.py
        "ALTER TABLE database_size_history ADD COLUMN IF NOT EXISTS db_type VARCHAR(100);",
        "ALTER TABLE table_size_history ADD COLUMN IF NOT EXISTS db_type VARCHAR(100);",
        # status_updated_at for archived logs sync
        "ALTER TABLE db_archived_logs ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;",
    ]
    for sql in alters:
        try:
            cur.execute(sql)
        except Exception:
            pass  # Column already exists


def _create_indexes(cur) -> None:
    """Create all performance indexes (idempotent)."""
    indexes = [
        # users
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users (LOWER(email)) WHERE email IS NOT NULL;",
        "CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));",
        "CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);",
        "CREATE INDEX IF NOT EXISTS idx_users_login ON users (username, LOWER(email));",
        # db_monitoring_logs
        "CREATE INDEX IF NOT EXISTS idx_db_mon_logs_ist ON db_monitoring_logs (log_time_ist DESC);",
        "CREATE INDEX IF NOT EXISTS idx_db_mon_logs_hash ON db_monitoring_logs (log_hash);",
        "CREATE INDEX IF NOT EXISTS idx_db_mon_logs_client_server ON db_monitoring_logs (client_name, server_name);",
        "CREATE INDEX IF NOT EXISTS idx_db_mon_logs_composite ON db_monitoring_logs (db_type, client_name, server_name, log_time_ist DESC);",
        "CREATE INDEX IF NOT EXISTS idx_db_mon_logs_archived ON db_monitoring_logs (is_archived, log_time_ist DESC);",
        "CREATE INDEX IF NOT EXISTS idx_db_mon_logs_severity ON db_monitoring_logs (severity, log_time_ist DESC);",
        # tickets
        "CREATE INDEX IF NOT EXISTS idx_tickets_company ON tickets (company, created_at DESC);",
        "CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status, created_at DESC);",
        # ticket_comments
        "CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments (ticket_id, created_at ASC);",
        # notifications
        "CREATE INDEX IF NOT EXISTS idx_notifications_username ON notifications (LOWER(username), is_read, created_at DESC);",
        # leads
        "CREATE INDEX IF NOT EXISTS idx_leads_email_lower ON leads (LOWER(email));",
        # client_access
        "CREATE INDEX IF NOT EXISTS idx_client_access_combo ON client_access (LOWER(client_email), LOWER(technology), client_name);",
        # telemetry_records
        "CREATE INDEX IF NOT EXISTS idx_telemetry_client_server ON telemetry_records (client_name, server_name, captured_at DESC);",
        "CREATE INDEX IF NOT EXISTS idx_telemetry_type ON telemetry_records (report_type, captured_at DESC);",
        # sizing history
        "CREATE INDEX IF NOT EXISTS idx_db_size_history_lookup ON database_size_history (server_name, database_name, captured_date DESC);",
        "CREATE INDEX IF NOT EXISTS idx_tbl_size_history_lookup ON table_size_history (server_name, database_name, table_name, captured_date DESC);",
        "CREATE INDEX IF NOT EXISTS idx_server_util_lookup ON server_utilization_history (server_name, captured_at DESC);",
        # uptime
        "CREATE INDEX IF NOT EXISTS idx_db_uptime_history_lookup ON db_uptime_history (client_name, server_name, captured_at DESC);",
        # archived logs
        "CREATE INDEX IF NOT EXISTS idx_db_archived_logs_hash ON db_archived_logs (log_hash);",
        "CREATE INDEX IF NOT EXISTS idx_db_archived_logs_client ON db_archived_logs (client_name, server_name);",
        "CREATE INDEX IF NOT EXISTS idx_db_archived_logs_ticket ON db_archived_logs (ticket_id);",
        # report sharing
        "CREATE INDEX IF NOT EXISTS idx_report_sharing_report ON report_sharing_history (report_id, created_at DESC);",
        # share history
        "CREATE INDEX IF NOT EXISTS idx_share_history_client ON share_history (client_name, shared_at DESC);",
    ]
    for sql in indexes:
        try:
            cur.execute(sql)
        except Exception:
            pass  # Index already exists


if __name__ == "__main__":
    run_migrations()
