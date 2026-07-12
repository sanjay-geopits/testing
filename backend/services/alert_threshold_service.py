"""
services/alert_threshold_service.py — Background alert threshold checking daemon
"""
import psycopg2
import psycopg2.extras
import json
import os
import time
import threading
from datetime import datetime, timedelta
from typing import List

from core.config import DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, DB_PORT
from services.email_service import send_email_outlook


def check_client_alert_thresholds():
    print("[ALERT DAEMON] Starting client alert threshold checking sweep...")
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT
        )
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # 1. Fetch all alert settings
        cur.execute("SELECT * FROM client_alert_settings;")
        settings = cur.fetchall()

        now = datetime.now()
        one_hour_ago = now - timedelta(hours=1)

        for setting in settings:
            client = setting["client_name"]
            db_type = setting["db_type"]
            last_sent = setting["last_summary_sent"]

            # If last summary sent was within the last hour, skip to avoid double alerting
            if last_sent and (now - last_sent) < timedelta(hours=1):
                continue

            # Check CPU, Memory, Disk, IO spikes
            cur.execute("""
                SELECT log_type, log_message, log_time_ist, server_name
                FROM db_monitoring_logs
                WHERE LOWER(TRIM(client_name)) = LOWER(TRIM(%s)) 
                  AND LOWER(TRIM(db_type)) = LOWER(TRIM(%s))
                  AND log_time_ist >= %s;
            """, (client, db_type, one_hour_ago))
            logs = cur.fetchall()

            # Fallback to server_utilization_history for servers
            cur.execute("""
                SELECT DISTINCT server_name FROM admin_clients 
                WHERE LOWER(TRIM(client_name)) = LOWER(TRIM(%s)) 
                  AND LOWER(TRIM(%s)) = ANY(string_to_array(REPLACE(LOWER(db_type), ' ', ''), ','));
            """, (client, db_type))
            servers = [r["server_name"] for r in cur.fetchall() if r["server_name"]]

            util_logs = []
            if servers:
                cur.execute("""
                    SELECT server_name, cpu_utilization, memory_utilization, disk_utilization, io_utilization, captured_at
                    FROM server_utilization_history
                    WHERE server_name = ANY(%s) AND captured_at >= %s;
                """, (servers, one_hour_ago))
                util_logs = cur.fetchall()

            max_cpu = 0.0
            max_mem = 0.0
            max_disk = 0.0
            max_io = 0.0

            def parse_val(val_str):
                if not val_str:
                    return 0.0
                try:
                    return float(str(val_str).replace("%", "").strip())
                except:
                    return 0.0

            for l in logs:
                lt = l["log_type"].lower()
                val = parse_val(l["log_message"])
                if "cpu" in lt:
                    max_cpu = max(max_cpu, val)
                elif "memory" in lt or "mem" in lt:
                    max_mem = max(max_mem, val)
                elif "disk" in lt:
                    max_disk = max(max_disk, val)
                elif "io" in lt:
                    max_io = max(max_io, val)

            for u in util_logs:
                if u["cpu_utilization"]:
                    max_cpu = max(max_cpu, float(u["cpu_utilization"]))
                if u["memory_utilization"]:
                    max_mem = max(max_mem, float(u["memory_utilization"]))
                if u["disk_utilization"]:
                    max_disk = max(max_disk, float(u["disk_utilization"]))
                if u["io_utilization"]:
                    max_io = max(max_io, float(u["io_utilization"]))

            cpu_breach = max_cpu > float(setting["cpu_threshold"])
            mem_breach = max_mem > float(setting["memory_threshold"])
            disk_breach = max_disk > float(setting["disk_threshold"])
            io_breach = max_io > float(setting["io_threshold"])

            spiked_resources = []
            if cpu_breach: spiked_resources.append(f"CPU (Max: {max_cpu}%, Threshold: {setting['cpu_threshold']}%)")
            if mem_breach: spiked_resources.append(f"Memory (Max: {max_mem}%, Threshold: {setting['memory_threshold']}%)")
            if disk_breach: spiked_resources.append(f"Disk (Max: {max_disk}%, Threshold: {setting['disk_threshold']}%)")
            if io_breach: spiked_resources.append(f"IO (Max: {max_io}%, Threshold: {setting['io_threshold']}%)")

            # 2. Server Down Alert
            server_down_triggered = False
            offline_servers = []
            if setting["server_down_alert"]:
                cur.execute("""
                    SELECT DISTINCT server_name, service_name, status, captured_at
                    FROM db_uptime_history
                    WHERE LOWER(TRIM(client_name)) = LOWER(TRIM(%s))
                      AND LOWER(TRIM(db_type)) = LOWER(TRIM(%s))
                      AND captured_at >= %s
                      AND status IN ('OFFLINE', 'STOPPED');
                """, (client, db_type, one_hour_ago))
                offline_rows = cur.fetchall()
                if offline_rows:
                    server_down_triggered = True
                    for row in offline_rows:
                        offline_servers.append(f"{row['server_name']} - {row['service_name']} is {row['status']} at {row['captured_at']}")

            # 3. Critical Error Logs Alert
            critical_errors_found = []
            if setting["critical_error_alert"]:
                cur.execute("""
                    SELECT log_message, log_time_ist, severity, server_name
                    FROM db_monitoring_logs
                    WHERE LOWER(TRIM(client_name)) = LOWER(TRIM(%s))
                      AND LOWER(TRIM(db_type)) = LOWER(TRIM(%s))
                      AND log_time_ist >= %s
                      AND LOWER(log_type) = 'error_log'
                      AND LOWER(severity) IN ('critical', 'error', 'fatal', 'high');
                """, (client, db_type, one_hour_ago))
                crit_rows = cur.fetchall()
                for row in crit_rows:
                    critical_errors_found.append(f"[{row['severity']}] {row['server_name']}: {row['log_message']} ({row['log_time_ist']})")

            # Resolve client-specific contact details
            cur.execute("""
                SELECT client_email, phone_number FROM admin_clients 
                WHERE LOWER(TRIM(client_name)) = LOWER(TRIM(%s)) 
                  AND LOWER(TRIM(%s)) = ANY(string_to_array(REPLACE(LOWER(db_type), ' ', ''), ','))
                LIMIT 1;
            """, (client, db_type))
            client_row = cur.fetchone()
            client_email_val = client_row["client_email"] if (client_row and client_row["client_email"]) else None

            default_cc = ""
            try:
                cur.execute("SELECT alert_email FROM technology_alerts_config WHERE LOWER(technology) = LOWER(%s) AND alert_email IS NOT NULL AND alert_email <> '';", (db_type,))
                row = cur.fetchone()
                if row and row.get("alert_email"):
                    default_cc = row["alert_email"]
            except Exception as db_err:
                print(f"Error querying technology_alerts_config: {db_err}")

            client_emails_str = setting["client_emails"] or client_email_val or ""
            if not client_emails_str:
                print("[ALERT ROUTING] there is no client mail")
            if not default_cc:
                print("[ALERT ROUTING] there is no technology alert mail")

            import re
            to_list = ["dccagent@geopits.com"]
            if client_emails_str:
                for email in re.split(r'[;,]', client_emails_str):
                    email = email.strip()
                    if email and email not in to_list:
                        to_list.append(email)
            if default_cc:
                for email in re.split(r'[;,]', default_cc):
                    email = email.strip()
                    if email and email not in to_list:
                        to_list.append(email)

            to_emails = ", ".join(to_list)

            cc_list = []
            if setting["cc_emails"]:
                for email in re.split(r'[;,]', setting["cc_emails"]):
                    email = email.strip()
                    if email and email not in to_list and email not in cc_list:
                        cc_list.append(email)
            cc_emails = ", ".join(cc_list) if cc_list else None

            # Process Spikes Summary
            if spiked_resources:
                peak_time = now
                max_val = 0.0
                for u in util_logs:
                    try:
                        cu = float(u["cpu_utilization"] or 0)
                        mu = float(u["memory_utilization"] or 0)
                        du = float(u["disk_utilization"] or 0)
                        iu = float(u["io_utilization"] or 0)
                        total_u = cu + mu + du + iu
                        if total_u > max_val:
                            max_val = total_u
                            peak_time = u["captured_at"]
                    except:
                        pass

                if isinstance(peak_time, str):
                    try:
                        peak_time = datetime.fromisoformat(peak_time)
                    except:
                        peak_time = now
                if peak_time.tzinfo is not None:
                    peak_time = peak_time.replace(tzinfo=None)

                start_window = peak_time - timedelta(hours=1)
                end_window = peak_time + timedelta(hours=1)

                parsed_long_queries = []
                parsed_error_logs = []
                parsed_blocking = []

                def safe_load_json(val):
                    if not val:
                        return []
                    if isinstance(val, dict):
                        return [val]
                    if isinstance(val, list):
                        return val
                    try:
                        loaded = json.loads(val)
                        if isinstance(loaded, dict):
                            return [loaded]
                        if isinstance(loaded, list):
                            return loaded
                    except:
                        pass
                    return []

                # Query diagnosticdata_long_queries
                try:
                    cur.execute("""
                        SELECT captured_at, raw_data, server_name 
                        FROM diagnosticdata_long_queries 
                        WHERE LOWER(TRIM(client_name)) = LOWER(TRIM(%s)) 
                          AND captured_at BETWEEN %s AND %s
                        ORDER BY captured_at DESC LIMIT 50;
                    """, (client, start_window, end_window))
                    for r in cur.fetchall():
                        for item in safe_load_json(r["raw_data"]):
                            parsed_long_queries.append({
                                "time": r["captured_at"],
                                "server_name": r["server_name"],
                                "duration_ms": item.get("duration") or item.get("duration_ms") or (item.get("duration_us", 0)/1000) or item.get("Duration") or 0,
                                "cpu_ms": item.get("cpu") or item.get("cpu_time") or item.get("CPU") or 0,
                                "reads": item.get("reads") or item.get("logical_reads") or item.get("Reads") or 0,
                                "writes": item.get("writes") or item.get("logical_writes") or item.get("Writes") or 0,
                                "sql": item.get("sql_text") or item.get("query_text") or item.get("statement_text") or item.get("SQLText") or item.get("sql") or "N/A"
                            })
                except Exception as e:
                    print(f"Error querying diagnosticdata_long_queries: {e}")

                # Query diagnosticdata_error_logs
                try:
                    cur.execute("""
                        SELECT captured_at, raw_data, server_name 
                        FROM diagnosticdata_error_logs 
                        WHERE LOWER(TRIM(client_name)) = LOWER(TRIM(%s)) 
                          AND captured_at BETWEEN %s AND %s
                        ORDER BY captured_at DESC LIMIT 50;
                    """, (client, start_window, end_window))
                    for r in cur.fetchall():
                        for item in safe_load_json(r["raw_data"]):
                            parsed_error_logs.append({
                                "time": r["captured_at"],
                                "server_name": r["server_name"],
                                "process": item.get("process_info") or item.get("ProcessInfo") or item.get("process") or "System",
                                "message": item.get("text") or item.get("message") or item.get("LogText") or item.get("LogMessage") or item.get("raw_text") or "N/A"
                            })
                except Exception as e:
                    print(f"Error querying diagnosticdata_error_logs: {e}")

                # Query diagnosticdata_blocking
                try:
                    cur.execute("""
                        SELECT captured_at, raw_data, server_name 
                        FROM diagnosticdata_blocking 
                        WHERE LOWER(TRIM(client_name)) = LOWER(TRIM(%s)) 
                          AND captured_at BETWEEN %s AND %s
                        ORDER BY captured_at DESC LIMIT 50;
                    """, (client, start_window, end_window))
                    for r in cur.fetchall():
                        for item in safe_load_json(r["raw_data"]):
                            parsed_blocking.append({
                                "time": r["captured_at"],
                                "server_name": r["server_name"],
                                "blocking_spid": item.get("blocking_session_id") or item.get("blocking_spid") or 0,
                                "blocked_spid": item.get("blocked_session_id") or item.get("blocked_spid") or 0,
                                "wait_time_ms": item.get("wait_time") or item.get("wait_time_ms") or item.get("duration") or 0,
                                "sql": item.get("sql_text") or item.get("blocking_sql_text") or item.get("sql") or "N/A"
                            })
                except Exception as e:
                    print(f"Error querying diagnosticdata_blocking: {e}")

                slow_queries = []
                cur.execute("""
                    SELECT ticket_name, description, created_at FROM tickets
                    WHERE LOWER(TRIM(company)) = LOWER(TRIM(%s))
                      AND LOWER(TRIM(business_unit)) = LOWER(TRIM(%s))
                      AND created_at >= %s
                      AND (ticket_name ILIKE '%%Long Running%%' or ticket_name ILIKE '%%Slow Query%%' or ticket_name ILIKE '%%Transaction%%' or description ILIKE '%%Executing SQL%%');
                """, (client, db_type, one_hour_ago))
                ticket_slows = cur.fetchall()
                for ts in ticket_slows:
                    slow_queries.append({
                        "source": "Ticket",
                        "title": ts["ticket_name"],
                        "details": ts["description"],
                        "time": ts["created_at"]
                    })

                cur.execute("""
                    SELECT tc.content, tc.created_at, t.ticket_name FROM ticket_comments tc
                    JOIN tickets t ON tc.ticket_id = t.id
                    WHERE LOWER(TRIM(t.company)) = LOWER(TRIM(%s))
                      AND LOWER(TRIM(t.business_unit)) = LOWER(TRIM(%s))
                      AND tc.created_at >= %s
                      AND tc.comment_type = 'log'
                      AND tc.content LIKE 'MSSQL_LOG_DATA:%%';
                """, (client, db_type, one_hour_ago))
                log_comments = cur.fetchall()
                for lc in log_comments:
                    try:
                        raw_data = lc["content"].replace("MSSQL_LOG_DATA:", "", 1)
                        parsed = json.loads(raw_data)
                        slow_queries.append({
                            "source": "Log Comment",
                            "title": lc["ticket_name"],
                            "details": f"SPID: {parsed.get('spid')}\nSQL: {parsed.get('executing_sql') or parsed.get('sql_text')}",
                            "time": lc["created_at"]
                        })
                    except:
                        pass

                rca_findings = []
                if cpu_breach:
                    high_cpu_query = None
                    max_c = 0.0
                    for q in parsed_long_queries:
                        try:
                            c_val = float(q.get("cpu_ms") or 0)
                        except:
                            c_val = 0.0
                        if c_val > max_c:
                            max_c = c_val
                            high_cpu_query = q
                    if high_cpu_query:
                        sql_trunc = str(high_cpu_query['sql'])[:300] + "..." if len(str(high_cpu_query['sql'])) > 300 else str(high_cpu_query['sql'])
                        reason = f"High CPU utilization of {max_c} ms detected. This query is likely causing the resource starvation due to high compilation costs, lack of index, or heavy CPU-bound operations."
                        rca_findings.append(f"🔴 <strong>CPU Spike Suspect:</strong> Query on server '{high_cpu_query['server_name']}' consumed {max_c} ms CPU.<br/><strong>Reason:</strong> {reason}<br/><strong>Query:</strong> <code>{sql_trunc}</code>")
                    else:
                        rca_findings.append("⚠️ <strong>CPU Spike:</strong> CPU threshold was breached, but no specific long-running queries with high CPU time were found in this window.")

                if mem_breach:
                    high_read_query = None
                    max_r = 0
                    for q in parsed_long_queries:
                        try:
                            r_val = int(q.get("reads") or 0)
                        except:
                            r_val = 0
                        if r_val > max_r:
                            max_r = r_val
                            high_read_query = q
                    if high_read_query:
                        sql_trunc = str(high_read_query['sql'])[:300] + "..." if len(str(high_read_query['sql'])) > 300 else str(high_read_query['sql'])
                        reason = f"Heavy memory utilization detected. Query generated {max_r} page reads, forcing buffer pool eviction and memory grant pressure."
                        rca_findings.append(f"🔴 <strong>Memory Spike Suspect:</strong> Query on server '{high_read_query['server_name']}' performed {max_r} logical reads.<br/><strong>Reason:</strong> {reason}<br/><strong>Query:</strong> <code>{sql_trunc}</code>")
                    else:
                        mem_err = None
                        for err in parsed_error_logs:
                            msg = str(err["message"]).lower()
                            if "memory" in msg or "buffer pool" in msg or "allocate" in msg or "out of memory" in msg:
                                mem_err = err
                                break
                        if mem_err:
                            rca_findings.append(f"🔴 <strong>Memory Spike Suspect:</strong> Memory pressure warning/error: '{mem_err['message']}' logged on '{mem_err['server_name']}' at {mem_err['time']}")
                        else:
                            rca_findings.append("⚠️ <strong>Memory Spike:</strong> Memory threshold breached, but no heavy read queries or memory allocation errors were isolated.")

                if io_breach or disk_breach:
                    high_io_query = None
                    max_io_score = 0
                    for q in parsed_long_queries:
                        try:
                            score = int(q.get("writes") or 0) + int(q.get("reads") or 0)
                        except:
                            score = 0
                        if score > max_io_score:
                            max_io_score = score
                            high_io_query = q
                    if high_io_query:
                        sql_trunc = str(high_io_query['sql'])[:300] + "..." if len(str(high_io_query['sql'])) > 300 else str(high_io_query['sql'])
                        reason = f"Disk I/O / space pressure detected. Query generated heavy page transfer score ({max_io_score}) leading to storage queue congestion."
                        rca_findings.append(f"🔴 <strong>IO/Disk Spike Suspect:</strong> Query on server '{high_io_query['server_name']}' generated heavy read/write score ({max_io_score}).<br/><strong>Reason:</strong> {reason}<br/><strong>Query:</strong> <code>{sql_trunc}</code>")
                    else:
                        latency_err = None
                        for err in parsed_error_logs:
                            msg = str(err["message"]).lower()
                            if "taking longer than" in msg or "io requests" in msg or "latency" in msg:
                                latency_err = err
                                break
                        if latency_err:
                            rca_findings.append(f"🔴 <strong>IO/Disk Spike Suspect:</strong> Storage I/O alert logged: '{latency_err['message']}'")
                        else:
                            rca_findings.append("⚠️ <strong>IO/Disk Spike:</strong> Threshold breached, but no heavy read/write query or disk latency error was isolated.")

                spikes_html = "".join([f"<li><strong>{r}</strong></li>" for r in spiked_resources])

                rca_html = ""
                if rca_findings:
                    rca_html = "<h3>Automated Root Cause Analysis (RCA):</h3>"
                    rca_html += "<div style='background-color:#fffbeb; border:1px solid #fef3c7; border-radius:8px; padding:16px; margin-bottom:16px;'>"
                    rca_html += "<ul style='margin:0; padding-left:20px;'>" + "".join([f"<li style='margin-bottom:10px;'>{r}</li>" for r in rca_findings]) + "</ul>"
                    rca_html += "</div>"

                long_queries_html = ""
                if parsed_long_queries:
                    long_queries_html += "<h3>Slow / Long Running Queries (within +-1 hr of peak):</h3>"
                    long_queries_html += "<table border='1' cellpadding='8' style='border-collapse:collapse; width:100%; border-color:#e2e8f0; margin-bottom:16px; font-size:12px;'>"
                    long_queries_html += "<tr style='background-color:#f8fafc; text-align:left;'><th>Time</th><th>Server</th><th>Duration (ms)</th><th>CPU (ms)</th><th>Reads/Writes</th><th>Query SQL</th></tr>"
                    for sq in parsed_long_queries[:5]:
                        sql_clean = str(sq["sql"]).replace("\n", "<br/>")
                        long_queries_html += f"<tr><td>{sq['time']}</td><td>{sq['server_name']}</td><td>{sq['duration_ms']}</td><td>{sq['cpu_ms']}</td><td>{sq['reads']} / {sq['writes']}</td><td><code style='font-family:monospace; color:#0f172a;'>{sql_clean}</code></td></tr>"
                    long_queries_html += "</table>"

                err_logs_html = ""
                if parsed_error_logs:
                    err_logs_html += "<h3>Critical Database Error Logs (within +-1 hr of peak):</h3>"
                    err_logs_html += "<table border='1' cellpadding='8' style='border-collapse:collapse; width:100%; border-color:#e2e8f0; margin-bottom:16px; font-size:12px;'>"
                    err_logs_html += "<tr style='background-color:#f8fafc; text-align:left;'><th>Time</th><th>Server</th><th>Process</th><th>Log Message</th></tr>"
                    for err in parsed_error_logs[:5]:
                        msg_clean = str(err["message"]).replace("\n", "<br/>")
                        err_logs_html += f"<tr><td>{err['time']}</td><td>{err['server_name']}</td><td>{err['process']}</td><td>{msg_clean}</td></tr>"
                    err_logs_html += "</table>"

                blocking_html = ""
                if parsed_blocking:
                    blocking_html += "<h3>Active Blocking / Locking Sessions (within +-1 hr of peak):</h3>"
                    blocking_html += "<table border='1' cellpadding='8' style='border-collapse:collapse; width:100%; border-color:#e2e8f0; margin-bottom:16px; font-size:12px;'>"
                    blocking_html += "<tr style='background-color:#f8fafc; text-align:left;'><th>Time</th><th>Server</th><th>Blocking SPID</th><th>Blocked SPID</th><th>Wait Time (ms)</th><th>Query</th></tr>"
                    for bl in parsed_blocking[:5]:
                        sql_clean = str(bl["sql"]).replace("\n", "<br/>")
                        blocking_html += f"<tr><td>{bl['time']}</td><td>{bl['server_name']}</td><td>{bl['blocking_spid']}</td><td>{bl['blocked_spid']}</td><td>{bl['wait_time_ms']}</td><td><code style='font-family:monospace; color:#0f172a;'>{sql_clean}</code></td></tr>"
                    blocking_html += "</table>"

                legacy_slows_html = ""
                if slow_queries:
                    legacy_slows_html += "<h3>Slow Queries / Long Running Queries from Legacy Logs:</h3>"
                    legacy_slows_html += "<table border='1' cellpadding='8' style='border-collapse:collapse; width:100%; border-color:#e2e8f0; margin-bottom:16px; font-size:12px;'>"
                    legacy_slows_html += "<tr style='background-color:#f8fafc; text-align:left;'><th>Time</th><th>Source</th><th>Incident Info</th><th>Details</th></tr>"
                    for sq in slow_queries[:5]:
                        details_clean = str(sq["details"]).replace("\n", "<br/>")
                        legacy_slows_html += f"<tr><td>{sq['time']}</td><td>{sq['source']}</td><td><strong>{sq['title']}</strong></td><td><code style='font-family:monospace;'>{details_clean}</code></td></tr>"
                    legacy_slows_html += "</table>"

                ticket_desc = f"Resource Spike Summary Alert:\n\nSpiked Resources:\n" + "\n".join(spiked_resources)
                if rca_findings:
                    ticket_desc += "\n\nAutomated Root Cause Analysis:\n" + "\n".join([f"- {r.replace('<strong>', '').replace('</strong>', '').replace('<br/>', ' ').replace('<code>', '').replace('</code>', '')}" for r in rca_findings])
                ticket_desc += f"\n\nDetails:\n- Slow Queries in window (+-1hr): {len(parsed_long_queries)}\n- Error Logs in window (+-1hr): {len(parsed_error_logs)}\n- Blocking Sessions in window (+-1hr): {len(parsed_blocking)}\n- Legacy Slow Queries: {len(slow_queries)}\n\nAssigned Agent: SYSTEM"
                
                ticket_name = f"{client} - {db_type} Resource Spike Alert Summary"
                cur.execute("""
                    INSERT INTO tickets (business_unit, company, contact, ticket_name, category, status, priority, agent, description, created_by, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'System', NOW())
                    RETURNING id;
                """, (db_type, client, to_emails, ticket_name, 'Alert', 'OPEN', 'High', 'SYSTEM', ticket_desc))
                new_t_id = cur.fetchone()[0]

                subject = f"[Ticket #{new_t_id}] [Spike Notification] {client} ({db_type}) - Resource Threshold Exceeded"
                email_body = f"""
                <html>
                <body style="font-family:-apple-system, BlinkMacSystemFont, sans-serif; color:#1e293b; line-height:1.6; max-width:900px; margin:0 auto; padding:20px;">
                    <div style="background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); padding:24px; border-radius:12px; color:white;">
                        <h2 style="margin:0; font-size:24px;">⚠️ Resource Spike Alert Summary</h2>
                        <p style="margin:8px 0 0 0; font-size:14px; opacity:0.9;">Ticket #{new_t_id} | Hourly Diagnostic Telemetry Report for {client} - {db_type}</p>
                    </div>
                    <div style="margin-top:24px; background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:24px;">
                        <p>Hello,</p>
                        <p>This is an automated diagnostic summary indicating that one or more system resource thresholds have been exceeded in the last hour:</p>
                        <ul>{spikes_html}</ul>
                        
                        <p><strong>Ticket ID:</strong> #{new_t_id}<br/><strong>Assigned Agent:</strong> SYSTEM</p>
                        
                        {rca_html}
                        {long_queries_html}
                        {err_logs_html}
                        {blocking_html}
                        {legacy_slows_html}
                        
                        <p style="margin-top:24px; font-size:12px; color:#64748b; border-top:1px solid #e2e8f0; padding-top:12px;">
                            This alert was triggered automatically by the GeoMon monitoring service. Please log in to the GeoMon Incident Center for real-time analytics. Always from mailbox: dccagent@geopits.com.
                        </p>
                    </div>
                </body>
                </html>
                """

                if to_emails:
                    send_email_outlook(to_emails, cc_emails, subject, email_body, sender_email="dccagent@geopits.com")
                else:
                    print(f"[ALERT DAEMON] No recipient configured for {client} ({db_type}) — spike alert email skipped.")

                cur.execute("""
                    INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
                    VALUES (%s, 'System', 'log', %s, '');
                """, (new_t_id, f"Resource Spike Alert: " + ", ".join(spiked_resources)))

                if to_emails:
                    email_log_msg = f"Alert email sent to: {to_emails}"
                    if cc_emails:
                        email_log_msg += f" (CC: {cc_emails})"
                else:
                    email_log_msg = f"Email alert skipped: No recipient email configured for client {client} or database technology {db_type}."
                cur.execute("""
                    INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
                    VALUES (%s, 'System', 'log', %s, '');
                """, (new_t_id, email_log_msg))

                cur.execute("UPDATE client_alert_settings SET last_summary_sent = NOW() WHERE id = %s;", (setting["id"],))
                conn.commit()
                print(f"[ALERT DAEMON] Generated spike alert ticket #{new_t_id} for {client} ({db_type}).")

            # 2. Process Server Down alerts
            if server_down_triggered and offline_servers:
                ticket_name = f"{client} - {db_type} Database Services Down Alert"
                ticket_desc = f"Critical Alert: One or more database services for client {client} ({db_type}) are detected offline:\n\n" + "\n".join(offline_servers) + "\n\nAssigned Agent: SYSTEM"
                
                cur.execute("""
                    INSERT INTO tickets (business_unit, company, contact, ticket_name, category, status, priority, agent, description, created_by, created_at)
                    VALUES (%s, %s, %s, %s, 'Alert', 'OPEN', 'High', 'SYSTEM', %s, 'System', NOW())
                    RETURNING id;
                """, (db_type, client, to_emails, ticket_name, ticket_desc))
                new_down_id = cur.fetchone()[0]

                email_down_body = f"""
                <html>
                <body style="font-family:-apple-system, BlinkMacSystemFont, sans-serif; color:#1e293b; line-height:1.6; max-width:600px; margin:0 auto; padding:20px;">
                    <div style="background:#dc2626; padding:24px; border-radius:12px; color:white;">
                        <h2 style="margin:0; font-size:20px;">🔴 Database Services Down Alert</h2>
                        <p style="margin:8px 0 0 0; font-size:14px; opacity:0.9;">Ticket #{new_down_id} | Client: {client} ({db_type})</p>
                    </div>
                    <div style="margin-top:24px; background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:24px;">
                        <p>Hello,</p>
                        <p>The monitoring daemon has detected offline services:</p>
                        <ul>{"".join([f"<li>{s}</li>" for s in offline_servers])}</ul>
                        <p><strong>Ticket ID:</strong> #{new_down_id}<br/><strong>Assigned Agent:</strong> SYSTEM</p>
                        <p>An incident ticket #{new_down_id} has been opened automatically. Please check immediately.</p>
                        <p style="margin-top:24px; font-size:12px; color:#64748b; border-top:1px solid #e2e8f0; padding-top:12px;">
                            This alert was triggered automatically by the GeoMon monitoring service. Always from mailbox: dccagent@geopits.com.
                        </p>
                    </div>
                </body>
                </html>
                """
                if to_emails:
                    send_email_outlook(to_emails, cc_emails, f"[Ticket #{new_down_id}] {ticket_name}", email_down_body, sender_email="dccagent@geopits.com")
                else:
                    print(f"[ALERT DAEMON] No recipient configured for {client} ({db_type}) — down alert email skipped.")

                if to_emails:
                    email_log_msg = f"Alert email sent to: {to_emails}"
                    if cc_emails:
                        email_log_msg += f" (CC: {cc_emails})"
                else:
                    email_log_msg = f"Email alert skipped: No recipient email configured for client {client} or database technology {db_type}."
                cur.execute("""
                    INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
                    VALUES (%s, 'System', 'log', %s, '');
                """, (new_down_id, email_log_msg))

                cur.execute("UPDATE client_alert_settings SET last_summary_sent = NOW() WHERE id = %s;", (setting["id"],))
                conn.commit()
                print(f"[ALERT DAEMON] Created services down ticket #{new_down_id} for {client} ({db_type}).")

            # 3. Process Critical Error Logs alert
            if critical_errors_found:
                ticket_name = f"{client} - {db_type} Critical Errors Logged"
                ticket_desc = f"Critical Alert: One or more critical errors or fatal events have been logged in the database logs:\n\n" + "\n".join(critical_errors_found) + "\n\nAssigned Agent: SYSTEM"

                cur.execute("""
                    INSERT INTO tickets (business_unit, company, contact, ticket_name, category, status, priority, agent, description, created_by, created_at)
                    VALUES (%s, %s, %s, %s, 'Alert', 'OPEN', 'High', 'SYSTEM', %s, 'System', NOW())
                    RETURNING id;
                """, (db_type, client, to_emails, ticket_name, ticket_desc))
                new_err_id = cur.fetchone()[0]

                email_err_body = f"""
                <html>
                <body style="font-family:-apple-system, BlinkMacSystemFont, sans-serif; color:#1e293b; line-height:1.6; max-width:600px; margin:0 auto; padding:20px;">
                    <div style="background:#e11d48; padding:24px; border-radius:12px; color:white;">
                        <h2 style="margin:0; font-size:20px;">🔴 Database Critical Errors Logged</h2>
                        <p style="margin:8px 0 0 0; font-size:14px; opacity:0.9;">Ticket #{new_err_id} | Client: {client} ({db_type})</p>
                    </div>
                    <div style="margin-top:24px; background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:24px;">
                        <p>Hello,</p>
                        <p>The monitoring daemon has detected critical/fatal errors logged in the database monitoring logs:</p>
                        <ul>{"".join([f"<li>{e}</li>" for e in critical_errors_found])}</ul>
                        <p><strong>Ticket ID:</strong> #{new_err_id}<br/><strong>Assigned Agent:</strong> SYSTEM</p>
                        <p>An incident ticket #{new_err_id} has been opened automatically. Please check immediately.</p>
                        <p style="margin-top:24px; font-size:12px; color:#64748b; border-top:1px solid #e2e8f0; padding-top:12px;">
                            This alert was triggered automatically by the GeoMon monitoring service. Always from mailbox: dccagent@geopits.com.
                        </p>
                    </div>
                </body>
                </html>
                """
                if to_emails:
                    send_email_outlook(to_emails, cc_emails, f"[Ticket #{new_err_id}] {ticket_name}", email_err_body, sender_email="dccagent@geopits.com")
                else:
                    print(f"[ALERT DAEMON] No recipient configured for {client} ({db_type}) — critical error email skipped.")

                if to_emails:
                    email_log_msg = f"Alert email sent to: {to_emails}"
                    if cc_emails:
                        email_log_msg += f" (CC: {cc_emails})"
                else:
                    email_log_msg = f"Email alert skipped: No recipient email configured for client {client} or database technology {db_type}."
                cur.execute("""
                    INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
                    VALUES (%s, 'System', 'log', %s, '');
                """, (new_err_id, email_log_msg))
                conn.commit()
                print(f"[ALERT DAEMON] Created critical error ticket #{new_err_id} & sent email for {client} ({db_type}).")

        cur.close()
        conn.close()
    except Exception as sweep_err:
        print(f"[ALERT DAEMON] Exception in alert checking sweep: {sweep_err}")


def client_alert_settings_loop():
    print("[ALERT DAEMON] Daemon thread running every 5 minutes...")
    while True:
        try:
            check_client_alert_thresholds()
        except Exception as e:
            print(f"[ALERT DAEMON] Loop error: {e}")
        time.sleep(300)
