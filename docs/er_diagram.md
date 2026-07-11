# GeoVexSight Observability Platform: Entity Relationship (ER) Diagram

This document provides a complete database schema catalog and Entity Relationship (ER) diagram for the **GeoVexSight** database persistence layer.

---

## 1. Entity Relationship Diagram

Below is the Mermaid representation of the GeoVexSight PostgreSQL database. The diagram groups entities by function (Authentication & Permissions, Incident Management, Alerts Config, Logging/Uptime, and Telemetry/Performance).

```mermaid
erDiagram
    %% Core Authentication & Permissions
    users {
        int id PK
        string username UNIQUE
        string hashed_password
        string full_name
        string email
        string role
        string profile_pic
        timestamp last_active_at
    }
    system_admins {
        string email PK
        string status
    }
    leads {
        int id PK
        string email
        string technology
        boolean is_lead
        string status
    }
    user_page_activity {
        int id PK
        string username
        string page_path
        int duration_seconds
        timestamp last_active_at
    }
    online_users {
        int id PK
        string username UNIQUE
        string units
        timestamp created_at
    }

    %% Incident Management
    tickets {
        int id PK
        string business_unit
        string company
        string contact
        string ticket_name
        string category
        string status
        string priority
        string agent
        string description
        string created_by
        timestamp created_at
        string resolved_by
        timestamp resolved_at
    }
    ticket_comments {
        int id PK
        int ticket_id FK
        string author
        string comment_type
        string content
        string attachments
        timestamp created_at
    }
    ticket_agents {
        int id PK
        string name UNIQUE
    }
    ticket_business_units {
        int id PK
        string name UNIQUE
    }
    notifications {
        int id PK
        string username
        string message
        boolean is_read
        timestamp created_at
    }
    share_history {
        int id PK
        string username
        string notes
        string platform
        string content_type
        string client_name
        string server_name
        string log_message
        string status
        string owner
        string client_visibility
        string ticket_status
        string next_action
        string db_type
        timestamp shared_at
    }

    %% Configuration & Alert Mappings
    admin_clients {
        int id PK
        string client_name
        string db_type
        string server_name
        string client_email
        string phone_number
        timestamp created_at
    }
    client_access {
        int id PK
        string client_email
        string technology
        string client_name
        string server_name
        string status
        string phone_number
        timestamp created_at
    }
    client_alert_settings {
        int id PK
        string client_name
        string db_type
        numeric cpu_threshold
        numeric memory_threshold
        numeric disk_threshold
        numeric io_threshold
        int slow_query_threshold_ms
        int long_running_threshold_sec
        text client_emails
        text cc_emails
        boolean server_down_alert
        boolean critical_error_alert
        timestamp last_summary_sent
        timestamp created_at
    }
    technology_alerts_config {
        string technology PK
        string alert_email
        timestamp created_at
    }
    user_clients {
        int id PK
        int user_id FK
        int client_id FK
        string access_level
        timestamp created_at
    }

    %% Telemetry Logs & Mail Ingestion
    db_monitoring_logs {
        int id PK
        string client_name
        string server_name
        string db_type
        string log_type
        string log_source
        timestamp log_time
        timestamp log_time_utc
        timestamp log_time_ist
        string log_message
        int occurrence_count
        jsonb raw_log
        string email_subject
        timestamp email_received_time
        string log_hash UNIQUE
        timestamp created_at
        string status
        string owner
        string client_visibility
        string ticket_status
        string next_action
        string severity
        timestamp status_updated_at
        int ticket_id FK
    }
    db_archived_logs {
        int id PK
        string client_name
        string server_name
        string db_type
        string log_type
        string log_source
        timestamp log_time
        timestamp log_time_utc
        timestamp log_time_ist
        string log_message
        int occurrence_count
        jsonb raw_log
        string email_subject
        timestamp email_received_time
        string log_hash UNIQUE
        timestamp created_at
        string status
        string owner
        string client_visibility
        string ticket_status
        string next_action
        string severity
        timestamp status_updated_at
        int ticket_id FK
    }
    db_uptime_history {
        int id PK
        string client_name
        string server_name
        string db_type
        string service_name
        string status
        string uptime_desc
        timestamp last_restart_time
        timestamp captured_at
    }
    processed_emails {
        string message_id PK
        string subject
        string sender
        timestamp processed_at
        timestamp received_at
    }

    %% Sizing & Resource Telemetry
    database_size_history {
        int id PK
        string server_name
        string database_name
        bigint total_size_bytes
        date captured_date
    }
    table_size_history {
        int id PK
        string server_name
        string database_name
        string table_name
        bigint size_bytes
        date captured_date
    }
    server_utilization_history {
        int id PK
        string server_name
        numeric cpu_utilization
        numeric memory_utilization
        numeric disk_utilization
        numeric io_utilization
        numeric read_iops
        numeric write_iops
        timestamp captured_at
    }
    client_reports {
        int id PK
        string client_name
        string title
        string month
        string year
        string file_name
        string file_data
        string notes
        string uploaded_by
        timestamp uploaded_at
    }
    report_reviews {
        int id PK
        int report_id FK
        string username
        int rating
        string comment
        timestamp created_at
        string mom
    }
    feedbacks {
        int id PK
        string username
        string email
        string feedback_text
        int rating
        timestamp created_at
    }

    %% Relationships
    users ||--o{ user_clients : "has client permissions"
    admin_clients ||--o{ user_clients : "granted permission"
    tickets ||--o{ ticket_comments : "has replies/comments"
    tickets ||--o{ db_monitoring_logs : "referenced in active logs"
    tickets ||--o{ db_archived_logs : "referenced in archived logs"
    client_reports ||--o{ report_reviews : "has feedback reviews"
```

---

## 2. Table Schemas Reference

### Group A: Authentication & Permissions
* **`users`**: Tracks details of registered DBAs, Leads, and clients.
* **`system_admins`**: Tracks system administrators. Users whose emails are in this table are dynamically resolved to the `admin` role.
* **`leads`**: Tracks lead assignments by technology (e.g. MSSQL, MySQL). Leads have specialized monitoring and management privileges.
* **`user_page_activity`**: Keeps metrics on page visits per user, including active durations (for tracking dashboard utilization).
* **`online_users`**: Tracks users currently connected to the server.

### Group B: Incident Management & Workflow
* **`tickets`**: Driving incident table. Holds tickets generated automatically by background threshold daemons or created manually.
* **`ticket_comments`**: Logs comments, status transitions, DBA updates, and client email replies linked to each ticket.
* **`ticket_agents`**: Unique names of DBAs or system users eligible for ticket assignment.
* **`ticket_business_units`**: Business units/technologies mapped to tickets.
* **`notifications`**: User-specific in-app toast/alert notifications (e.g. "Ticket #123 assigned to you").
* **`share_history`**: Tracks when a DBA shares log summaries or incident diagnostics to external communication channels (e.g. Teams, Email).

### Group C: Configuration & Alerts Routing
* **`admin_clients`**: Admin database mapping linking servers to client companies, and client-specific emails/phone numbers.
* **`client_access`**: Tracks contact lists and access statuses (enabled/disabled) per client/server/technology combinations.
* **`client_alert_settings`**: Stores custom utilization and performance threshold settings (CPU, Disk, Memory, IO, Slow query duration) per client and database type.
* **`technology_alerts_config`**: Stores fallback email addresses for each database technology type (used when client contact details are missing).
* **`user_clients`**: Joins `users` and `admin_clients` to define granular, client-specific permissions (e.g. what clients a user is allowed to view).

### Group D: Telemetry Logs & Mail Ingestion
* **`db_monitoring_logs`**: Primary table containing diagnostic logs parsed from system mails. Relies on `log_hash` (unique SHA-256 of server + content + hour bucket) to deduplicate.
* **`db_archived_logs`**: Duplicate structure of `db_monitoring_logs` used to archive processed logs.
* **`db_uptime_history`**: Holds health checks (ONLINE, OFFLINE, STOPPED) parsed from automated server check-ins.
* **`processed_emails`**: De-duplication helper storing Graph API / Exchange mail IDs to ensure emails are never processed more than once.

### Group E: Sizing & Performance Metrics
* **`database_size_history`**: Contains captured databases' sizes over time to enable daily growth comparison.
* **`table_size_history`**: Contains table-level sizes (bytes, row count) to locate the fastest-growing tables.
* **`server_utilization_history`**: Numerical metrics of CPU, Memory, Disk, and IO utilization.
* **`client_reports`**: Holds monthly base64-encoded PDF report files uploaded for client reviews.
* **`report_reviews`**: Stores feedback, rating stars, comments, and minutes of meeting (MoM) strings from clients on generated reports.
* **`feedbacks`**: General app-wide feedback and ratings left by users.

### Group F: MSSQL Telemetry Tables (Dynamic Schema)
These 20 database tables store rich raw telemetry payloads from MSSQL database agents. Each table contains JSON fields, timestamps, and deduplication hashes to record detailed metrics without rigid column constraints:
* **Table List**:
  * `reportdata_restart`
  * `reportdata_backup`
  * `reportdata_server`
  * `reportdata_disk_drive`
  * `reportdata_size_growth`
  * `reportdata_top_cpu`
  * `diagnosticdata_disk_io`
  * `diagnosticdata_wait_stats`
  * `diagnosticdata_long_queries`
  * `diagnosticdata_deadlocks`
  * `diagnosticdata_tempdb`
  * `diagnosticdata_job_executions`
  * `diagnosticdata_blocking`
  * `diagnosticdata_error_logs`
  * `diagnosticdata_cpu_querystore`
  * `diagnosticdata_mem_querystore`
  * `reportdata_memory_ple`
  * `reportdata_memory_snapshot`
  * `reportdata_cpu_daily_summary`
  * `reportdata_cpu_spike_analysis`
* **Common Schema**:
  * `id` (`SERIAL PRIMARY KEY`)
  * `client_name` (`VARCHAR(255) NOT NULL`)
  * `server_name` (`VARCHAR(255) NOT NULL`)
  * `captured_at` (`TIMESTAMP NOT NULL`)
  * `raw_data` (`JSONB`)
  * `log_hash` (`VARCHAR(255)`) — Enforces `uq_[tablename]_hash` unique constraint.
  * `created_at` (`TIMESTAMP DEFAULT CURRENT_TIMESTAMP`)
