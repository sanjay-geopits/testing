# GeoMon Observability Platform: Architecture Diagrams

This document contains the complete database entity relationship structure and the system-wide data flow/automation pipeline diagram.

---

## 1. Full Project Entity Relationship (ER) Diagram

This diagram visualizes the PostgreSQL database schemas, constraints, and relationships.

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

## 2. Ingestion & Alert Pipeline Flow Diagram

This flow diagram illustrates the end-to-end processing pipeline, showing how automated system events are ingested, verified, classified, and turned into active ticket alerts or AI-driven DBA suggestions.

```mermaid
flowchart TD
    %% Define Styles
    classDef source fill:#fef3c7,stroke:#d97706,stroke-width:2px;
    classDef daemon fill:#e0f2fe,stroke:#0284c7,stroke-width:2px;
    classDef parser fill:#f3e8ff,stroke:#7c3aed,stroke-width:2px;
    classDef database fill:#ecfdf5,stroke:#059669,stroke-width:2px;
    classDef notify fill:#fee2e2,stroke:#dc2626,stroke-width:2px;
    classDef interface fill:#fafafa,stroke:#27272a,stroke-width:2px;

    %% Inbound Sources Group
    subgraph Sources ["Inbound Mailboxes (Microsoft Graph API / EWS)"]
        A1["MSSQL Alert Folder"]:::source
        A2["Ai-report-automation Folder"]:::source
        A3["MySQL-Mongo-Postgres-DB Sizing Folder"]:::source
        A4["Inbox Replies & Bounces"]:::source
    end

    %% Daemons and Ingestion Engine
    subgraph Engine ["Processing & Ingestion Engine"]
        B1["MailReaderDaemon (email_extracter.py)"]:::daemon
        B2["Watermark Check & Deduplication (processed_emails)"]:::daemon
        B3["AlertSettingsDaemon (app.py)"]:::daemon
    end

    %% Parsing & Normalization
    subgraph Parsers ["Parsing & Telemetry Classification"]
        C1["subject_parser.py"]:::parser
        C2["severity_classifier.py"]:::parser
        C3["telemetry_parser.py (HTML to Bytes)"]:::parser
    end

    %% Storage & Persistence
    subgraph Storage ["Central Database (PostgreSQL)"]
        D1[("Telemetry Logs (db_monitoring_logs)")]:::database
        D2[("Uptime & Health (db_uptime_history)")]:::database
        D3[("Size History (database_size_history / table_size_history)")]:::database
        D4[("Ticketing System (tickets & ticket_comments)")]:::database
        D5[("Utilization History (server_utilization_history)")]:::database
    end

    %% Alerting & Outbound Dispatch
    subgraph Action ["Alert Routing & Automation"]
        E1["Contact Resolver (db_manager.py)"]:::notify
        E2["RCA Diagnostic Scanner"]:::notify
        E3["send_email_outlook()"]:::notify
    end

    %% Frontend & AI Chat UI
    subgraph ClientUI ["GeoMon UI & Diagnostics"]
        F1["FastAPI REST Endpoints (app.py / routes.py)"]:::interface
        F2["GeoMon React Dashboard"]:::interface
        F3["Node.js Express AI Chat Server (server.js)"]:::interface
        F4["OpenAI API (gpt-4o-mini)"]:::interface
    end

    %% Flow Connections
    A1 & A2 & A3 & A4 -->|Hourly Poll / Fetch| B1
    B1 --> B2
    B2 -->|New Unprocessed Emails| C1 & C3
    
    C1 -->|Extract Client, Server, DB Type| C2
    C2 -->|Assign Severity Level| D1
    C3 -->|Parse HTML Tables| D3

    %% Scheduling
    B3 -->|Every 5 Mins Sweep| D5 & D1
    
    %% Ticket & Notification Logic
    D1 & D5 -->|Threshold Breached?| D4
    D4 -->|Trigger Incident| E1
    
    %% RCA & Contact Lookup
    E1 -->|Lookup client_access & tech configs| E2
    E2 -->|Fetch slow queries & deadlocks within +-1 hr| E3
    E3 -->|Dispatch Styled HTML Email| ClientEmail["Client & DBA Inbox"]:::source
    
    %% Reply Processing
    A4 -->|Thread Replies using [Ticket #ID]| D4
    
    %% UI Integration
    D1 & D2 & D3 & D4 & D5 --> F1
    F1 -->|REST WebSockets / Notifications| F2
    F2 -->|AI Chat Requests| F3
    F3 -->|SSE Streaming Completions| F2
    F3 <-->|Query LLM Heuristics| F4

    %% Archiving
    D1 -->|Hourly Archive Sweep (migrate_top_logs.py)| D6[("Archive DB (AI_SUMMARY_MSSQL)")]:::database
