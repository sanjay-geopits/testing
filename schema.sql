-- ============================================================================
-- 🌍 GeoMon — Canonical PostgreSQL Database Schema
-- ============================================================================
-- Single source of truth for all table structures, constraints, indexes, 
-- views, and transactional rules in the GeoMon Database.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Authentication & User Management
-- ----------------------------------------------------------------------------

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

CREATE TABLE IF NOT EXISTS user_clients (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
    client_id    INTEGER,
    access_level VARCHAR(50) DEFAULT 'view',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_client UNIQUE (user_id, client_id)
);

CREATE TABLE IF NOT EXISTS user_page_activity (
    id               SERIAL PRIMARY KEY,
    username         TEXT,
    page_path        TEXT,
    duration_seconds INTEGER DEFAULT 0,
    last_active_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_page UNIQUE (username, page_path)
);

CREATE TABLE IF NOT EXISTS online_users (
    id         SERIAL PRIMARY KEY,
    username   TEXT NOT NULL UNIQUE,
    units      TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leads (
    id         SERIAL PRIMARY KEY,
    email      VARCHAR(255),
    technology VARCHAR(100),
    is_lead    BOOLEAN DEFAULT TRUE,
    status     VARCHAR(50) DEFAULT 'active'
);

-- ----------------------------------------------------------------------------
-- 2. Client & Environment Configuration
-- ----------------------------------------------------------------------------

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

CREATE TABLE IF NOT EXISTS client_access (
    id           SERIAL PRIMARY KEY,
    client_email VARCHAR(255) NOT NULL,
    technology   VARCHAR(100) NOT NULL,
    client_name  VARCHAR(100) NOT NULL,
    server_name  VARCHAR(100) NOT NULL,
    status       VARCHAR(20)  DEFAULT 'enabled',
    phone_number VARCHAR(100),
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_client_access_combo UNIQUE (client_email, technology, client_name, server_name)
);

CREATE TABLE IF NOT EXISTS client_alert_settings (
    id                       SERIAL PRIMARY KEY,
    client_name              VARCHAR(255) NOT NULL,
    db_type                  VARCHAR(100) NOT NULL,
    cpu_threshold            NUMERIC(5,2) DEFAULT 80.00,
    memory_threshold         NUMERIC(5,2) DEFAULT 80.00,
    disk_threshold           NUMERIC(5,2) DEFAULT 80.00,
    io_threshold             NUMERIC(5,2) DEFAULT 80.00,
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

CREATE TABLE IF NOT EXISTS technology_alerts_config (
    technology  VARCHAR(100) PRIMARY KEY,
    alert_email VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 3. Telemetry & Observability History
-- ----------------------------------------------------------------------------

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

CREATE TABLE IF NOT EXISTS database_size_history (
    id             SERIAL PRIMARY KEY,
    server_name    VARCHAR(255),
    database_name  VARCHAR(255),
    total_size_bytes BIGINT,
    db_type        VARCHAR(100),
    captured_date  DATE,
    CONSTRAINT uq_db_size UNIQUE (server_name, database_name, captured_date)
);

CREATE TABLE IF NOT EXISTS table_size_history (
    id             SERIAL PRIMARY KEY,
    server_name    VARCHAR(255),
    database_name  VARCHAR(255),
    table_name     VARCHAR(255),
    size_bytes     BIGINT,
    db_type        VARCHAR(100),
    captured_date  DATE,
    CONSTRAINT uq_table_size UNIQUE (server_name, database_name, table_name, captured_date)
);

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

-- ----------------------------------------------------------------------------
-- 4. Incident Management (Ticketing)
-- ----------------------------------------------------------------------------

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

CREATE TABLE IF NOT EXISTS ticket_comments (
    id           SERIAL PRIMARY KEY,
    ticket_id    INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
    author       TEXT,
    comment_type TEXT,
    content      TEXT,
    attachments  TEXT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ticket_business_units (
    id   SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS notifications (
    id         SERIAL PRIMARY KEY,
    username   TEXT,
    message    TEXT,
    is_read    BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 5. Email Ingestion Control & AI Reference
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS processed_emails (
    message_id   VARCHAR(500) PRIMARY KEY,
    subject      VARCHAR(500),
    sender       VARCHAR(255),
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    received_at  TIMESTAMP
);

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

-- ----------------------------------------------------------------------------
-- 6. Reports & Feedback
-- ----------------------------------------------------------------------------

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

CREATE TABLE IF NOT EXISTS report_reviews (
    id        SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES client_reports(id) ON DELETE CASCADE,
    username  TEXT,
    rating    INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment   TEXT,
    mom       TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedbacks (
    id            SERIAL PRIMARY KEY,
    username      TEXT,
    email         TEXT,
    feedback_text TEXT,
    rating        INTEGER,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 7. Audit Trail & Sharing logs
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS report_sharing_history (
    id             SERIAL PRIMARY KEY,
    report_id      INTEGER REFERENCES client_reports(id) ON DELETE SET NULL,
    report_title   TEXT,
    shared_by      TEXT,
    share_platform TEXT,
    recipient      TEXT,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS admin_agents (
    id            SERIAL PRIMARY KEY,
    agent_name    TEXT,
    company_name  TEXT,
    business_unit TEXT,
    technology    TEXT,
    email         TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);

-- ----------------------------------------------------------------------------
-- 8. Views & Rule Rewrites
-- ----------------------------------------------------------------------------

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

CREATE OR REPLACE RULE db_archived_logs_delete AS
ON DELETE TO db_archived_logs DO INSTEAD
    DELETE FROM db_monitoring_logs WHERE id = OLD.id;

-- ----------------------------------------------------------------------------
-- 9. Performance Indexes
-- ----------------------------------------------------------------------------

-- users
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users (LOWER(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_login ON users (username, LOWER(email));

-- db_monitoring_logs
CREATE INDEX IF NOT EXISTS idx_db_mon_logs_ist ON db_monitoring_logs (log_time_ist DESC);
CREATE INDEX IF NOT EXISTS idx_db_mon_logs_hash ON db_monitoring_logs (log_hash);
CREATE INDEX IF NOT EXISTS idx_db_mon_logs_client_server ON db_monitoring_logs (client_name, server_name);
CREATE INDEX IF NOT EXISTS idx_db_mon_logs_composite ON db_monitoring_logs (db_type, client_name, server_name, log_time_ist DESC);
CREATE INDEX IF NOT EXISTS idx_db_mon_logs_archived ON db_monitoring_logs (is_archived, log_time_ist DESC);
CREATE INDEX IF NOT EXISTS idx_db_mon_logs_severity ON db_monitoring_logs (severity, log_time_ist DESC);

-- tickets
CREATE INDEX IF NOT EXISTS idx_tickets_company ON tickets (company, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status, created_at DESC);

-- ticket_comments
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments (ticket_id, created_at ASC);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_username ON notifications (LOWER(username), is_read, created_at DESC);

-- leads
CREATE INDEX IF NOT EXISTS idx_leads_email_lower ON leads (LOWER(email));

-- client_access
CREATE INDEX IF NOT EXISTS idx_client_access_combo ON client_access (LOWER(client_email), LOWER(technology), client_name);

-- telemetry_records
CREATE INDEX IF NOT EXISTS idx_telemetry_client_server ON telemetry_records (client_name, server_name, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_type ON telemetry_records (report_type, captured_at DESC);

-- sizing history
CREATE INDEX IF NOT EXISTS idx_db_size_history_lookup ON database_size_history (server_name, database_name, captured_date DESC);
CREATE INDEX IF NOT EXISTS idx_tbl_size_history_lookup ON table_size_history (server_name, database_name, table_name, captured_date DESC);
CREATE INDEX IF NOT EXISTS idx_server_util_lookup ON server_utilization_history (server_name, captured_at DESC);

-- uptime
CREATE INDEX IF NOT EXISTS idx_db_uptime_history_lookup ON db_uptime_history (client_name, server_name, captured_at DESC);

-- archived logs
CREATE INDEX IF NOT EXISTS idx_db_archived_logs_hash ON db_archived_logs (log_hash);
CREATE INDEX IF NOT EXISTS idx_db_archived_logs_client ON db_archived_logs (client_name, server_name);
CREATE INDEX IF NOT EXISTS idx_db_archived_logs_ticket ON db_archived_logs (ticket_id);

-- report sharing
CREATE INDEX IF NOT EXISTS idx_report_sharing_report ON report_sharing_history (report_id, created_at DESC);

-- share history
CREATE INDEX IF NOT EXISTS idx_share_history_client ON share_history (client_name, shared_at DESC);
