"""
GeoMon Production Database Consolidation Migration
===================================================
Run ONCE to consolidate 53 → 25 tables:
  - Merge db_archived_logs → db_monitoring_logs (is_archived flag)
  - Merge 20 reportdata_*/diagnosticdata_* → telemetry_records
  - Drop critical_error_logs (derived data, redundant)
  - Drop system_admins (role lives in users.role)
  - Drop all empty unused tables
  - Create compatibility views & rules for db_archived_logs & system_admins
"""
import os
import sys
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def get_conn():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        database=os.getenv("DB_NAME", "geomon"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "2025"),
        port=os.getenv("DB_PORT", "5432")
    )

TELEMETRY_TABLES = [
    "reportdata_restart",
    "reportdata_backup",
    "reportdata_server",
    "reportdata_disk_drive",
    "reportdata_size_growth",
    "reportdata_top_cpu",
    "reportdata_memory_ple",
    "reportdata_memory_snapshot",
    "reportdata_cpu_daily_summary",
    "reportdata_cpu_spike_analysis",
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
]

EMPTY_TABLES_TO_DROP = [
    "workers",
    "ai_summary_history",
    "share_history",
    "report_audit_log",
    "report_sharing_history",
    "combined_logs_mv",  # materialized view
]

def run():
    conn = get_conn()
    cur = conn.cursor()
    print("=" * 60)
    print("GeoMon Production DB Consolidation Migration (with Compatibility)")
    print("=" * 60)

    # ── STEP 1: Add is_archived to db_monitoring_logs ─────────
    print("\n[1/8] Adding is_archived column to db_monitoring_logs...")
    cur.execute("""
        ALTER TABLE db_monitoring_logs
        ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
    """)
    print("  ✓ Done")

    # ── STEP 2: Create unified telemetry_records table ─────────
    print("\n[2/8] Creating unified telemetry_records table...")
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
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_telemetry_client_server
        ON telemetry_records (client_name, server_name, captured_at DESC);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_telemetry_type
        ON telemetry_records (report_type, captured_at DESC);
    """)
    print("  ✓ Done")

    # ── STEP 3: Migrate data from 20 tables → telemetry_records ─
    print("\n[3/8] Migrating data from 20 telemetry tables → telemetry_records...")
    total_migrated = 0
    for tbl in TELEMETRY_TABLES:
        try:
            cur.execute(f"""
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema='public' AND table_name='{tbl}' AND table_type='BASE TABLE';
            """)
            if cur.fetchone()[0] == 0:
                print(f"  ⚠  {tbl}: table does not exist, skipping")
                continue
            cur.execute(f"""
                INSERT INTO telemetry_records
                    (report_type, client_name, server_name, captured_at, raw_data, log_hash, created_at)
                SELECT
                    '{tbl}', client_name, server_name, captured_at,
                    raw_data::jsonb, log_hash, created_at
                FROM {tbl}
                WHERE log_hash IS NOT NULL
                ON CONFLICT (log_hash) DO NOTHING;
            """)
            migrated = cur.rowcount
            total_migrated += migrated
            print(f"  ✓ {tbl}: migrated {migrated} rows")
        except Exception as e:
            print(f"  ✗ {tbl}: ERROR — {e}")
            conn.rollback()
    print(f"  → Total rows migrated: {total_migrated}")

    # ── STEP 4: Drop 20 old telemetry tables ──────────────────
    print("\n[4/8] Dropping 20 old telemetry tables...")
    for tbl in TELEMETRY_TABLES:
        try:
            cur.execute(f"DROP TABLE IF EXISTS {tbl} CASCADE;")
            print(f"  ✓ Dropped {tbl}")
        except Exception as e:
            print(f"  ✗ {tbl}: ERROR — {e}")
            conn.rollback()

    # ── STEP 5: Merge db_archived_logs → monitoring (is_archived)
    print("\n[5/8] Merging db_archived_logs into db_monitoring_logs...")
    try:
        cur.execute("""
            SELECT COUNT(*) FROM information_schema.tables
            WHERE table_schema='public' AND table_name='db_archived_logs' AND table_type='BASE TABLE';
        """)
        if cur.fetchone()[0] > 0:
            cur.execute("SELECT COUNT(*) FROM db_archived_logs;")
            archived_count = cur.fetchone()[0]
            if archived_count > 0:
                cur.execute("""
                    INSERT INTO db_monitoring_logs
                    SELECT *, TRUE as is_archived FROM db_archived_logs
                    ON CONFLICT (log_hash) DO UPDATE SET is_archived = TRUE;
                """)
                print(f"  ✓ Migrated {archived_count} archived rows into db_monitoring_logs")
            else:
                print(f"  ✓ db_archived_logs was empty — nothing to migrate")
            cur.execute("DROP TABLE IF EXISTS db_archived_logs CASCADE;")
            print("  ✓ Dropped db_archived_logs table")
        else:
            print("  ✓ db_archived_logs table already handled")
    except Exception as e:
        print(f"  ✗ ERROR merging archived logs: {e}")
        conn.rollback()

    # ── STEP 6: Drop critical_error_logs (derived/redundant) ──
    print("\n[6/8] Dropping redundant tables...")
    try:
        cur.execute("DROP TABLE IF EXISTS critical_error_logs CASCADE;")
        print("  ✓ Dropped critical_error_logs")
    except Exception as e:
        print(f"  ✗ critical_error_logs: {e}")

    # Drop system_admins — role now lives in users.role only
    try:
        cur.execute("""
            SELECT COUNT(*) FROM information_schema.tables
            WHERE table_schema='public' AND table_name='system_admins' AND table_type='BASE TABLE';
        """)
        if cur.fetchone()[0] > 0:
            cur.execute("""
                UPDATE users SET role = 'admin'
                WHERE LOWER(email) IN (
                    SELECT LOWER(email) FROM system_admins WHERE status = 'active'
                )
                AND role != 'admin';
            """)
            promoted = cur.rowcount
            print(f"  ✓ Promoted {promoted} users to admin role from system_admins")
            cur.execute("DROP TABLE IF EXISTS system_admins CASCADE;")
            print("  ✓ Dropped system_admins table")
    except Exception as e:
        print(f"  ✗ system_admins: {e}")
        conn.rollback()

    # Drop ticket_agents (superseded by users query)
    try:
        cur.execute("DROP TABLE IF EXISTS ticket_agents CASCADE;")
        print("  ✓ Dropped ticket_agents")
    except Exception as e:
        print(f"  ✗ ticket_agents: {e}")

    # Drop all empty unused tables
    for tbl in EMPTY_TABLES_TO_DROP:
        try:
            cur.execute(f"DROP TABLE IF EXISTS {tbl} CASCADE;")
            print(f"  ✓ Dropped {tbl}")
        except Exception as e:
            print(f"  ✗ {tbl}: {e}")
            conn.rollback()

    # ── STEP 7: Create compatibility views & rules ────────────
    print("\n[7/8] Deploying database compatibility view and rule layers...")
    try:
        # 1. db_archived_logs View & Rules
        cur.execute("DROP VIEW IF EXISTS db_archived_logs CASCADE;")
        cur.execute("""
            CREATE OR REPLACE VIEW db_archived_logs AS
            SELECT * FROM db_monitoring_logs WHERE is_archived = TRUE;
        """)
        
        cur.execute("""
            CREATE OR REPLACE RULE db_archived_logs_insert AS
            ON INSERT TO db_archived_logs DO INSTEAD
            INSERT INTO db_monitoring_logs (
                client_name, server_name, db_type, log_type, log_source, log_time, log_time_utc, log_time_ist, log_level, log_message, occurrence_count, raw_log, email_subject, email_received_time, log_hash, severity, status, owner, client_visibility, ticket_status, next_action, is_archived, is_semantic, semantic_count, semantic_hash, time_bucket, ticket_id, status_updated_at, created_at
            ) VALUES (
                NEW.client_name, NEW.server_name, NEW.db_type, NEW.log_type, NEW.log_source, NEW.log_time, NEW.log_time_utc, NEW.log_time_ist, NEW.log_level, NEW.log_message, NEW.occurrence_count, NEW.raw_log, NEW.email_subject, NEW.email_received_time, NEW.log_hash, NEW.severity, NEW.status, NEW.owner, NEW.client_visibility, NEW.ticket_status, NEW.next_action, TRUE, NEW.is_semantic, NEW.semantic_count, NEW.semantic_hash, NEW.time_bucket, NEW.ticket_id, NEW.status_updated_at, NEW.created_at
            )
            ON CONFLICT (log_hash) DO UPDATE SET
                is_archived = TRUE,
                ticket_status = EXCLUDED.ticket_status,
                status = EXCLUDED.status,
                owner = EXCLUDED.owner;
        """)
        
        cur.execute("""
            CREATE OR REPLACE RULE db_archived_logs_update AS
            ON UPDATE TO db_archived_logs DO INSTEAD
            UPDATE db_monitoring_logs SET
                client_name = NEW.client_name,
                server_name = NEW.server_name,
                db_type = NEW.db_type,
                log_type = NEW.log_type,
                log_source = NEW.log_source,
                log_time = NEW.log_time,
                log_time_utc = NEW.log_time_utc,
                log_time_ist = NEW.log_time_ist,
                log_level = NEW.log_level,
                log_message = NEW.log_message,
                occurrence_count = NEW.occurrence_count,
                raw_log = NEW.raw_log,
                email_subject = NEW.email_subject,
                email_received_time = NEW.email_received_time,
                severity = NEW.severity,
                status = NEW.status,
                owner = NEW.owner,
                client_visibility = NEW.client_visibility,
                ticket_status = NEW.ticket_status,
                next_action = NEW.next_action,
                is_archived = NEW.is_archived,
                is_semantic = NEW.is_semantic,
                semantic_count = NEW.semantic_count,
                semantic_hash = NEW.semantic_hash,
                time_bucket = NEW.time_bucket,
                ticket_id = NEW.ticket_id,
                status_updated_at = NEW.status_updated_at
            WHERE log_hash = OLD.log_hash;
        """)
        
        cur.execute("""
            CREATE OR REPLACE RULE db_archived_logs_delete AS
            ON DELETE TO db_archived_logs DO INSTEAD
            DELETE FROM db_monitoring_logs WHERE log_hash = OLD.log_hash;
        """)

        # 2. system_admins View & Rules
        cur.execute("DROP VIEW IF EXISTS system_admins CASCADE;")
        cur.execute("""
            CREATE OR REPLACE VIEW system_admins AS
            SELECT
                id,
                email,
                'active'::varchar(50) AS status,
                last_active_at AS created_at,
                last_active_at AS updated_at
            FROM users
            WHERE role = 'admin';
        """)
        
        cur.execute("""
            CREATE OR REPLACE RULE system_admins_insert AS
            ON INSERT TO system_admins DO INSTEAD
            UPDATE users SET role = 'admin' WHERE LOWER(email) = LOWER(NEW.email);
        """)
        
        cur.execute("""
            CREATE OR REPLACE RULE system_admins_update AS
            ON UPDATE TO system_admins DO INSTEAD
            UPDATE users SET role = CASE WHEN NEW.status = 'active' THEN 'admin'::varchar ELSE 'user'::varchar END WHERE LOWER(email) = LOWER(OLD.email);
        """)
        
        cur.execute("""
            CREATE OR REPLACE RULE system_admins_delete AS
            ON DELETE TO system_admins DO INSTEAD
            UPDATE users SET role = 'user' WHERE LOWER(email) = LOWER(OLD.email);
        """)
        print("  ✓ Done")
    except Exception as e:
        print(f"  ✗ View/Rule creation: {e}")
        conn.rollback()

    # ── STEP 8: Final commit ───────────────────────────────────
    print("\n[8/8] Committing all changes...")
    conn.commit()
    cur.close()
    conn.close()
    print("\n✅ Database consolidation compatibility layer successfully deployed!")

if __name__ == "__main__":
    run()
