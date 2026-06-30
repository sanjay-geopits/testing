import os
import sys
# Add backend directory to path for absolute imports resolution
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import re
import json
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import psycopg2
from migrations import get_connection

IST = ZoneInfo("Asia/Kolkata")

def parse_utc_timestamp(ts_str):
    if not ts_str:
        return None
    try:
        ts_str = ts_str.strip()
        if ts_str.endswith("Z"):
            ts_str = ts_str[:-1]
        for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
            try:
                dt = datetime.strptime(ts_str[:19], fmt[:19])
                return dt.replace(tzinfo=timezone.utc)
            except ValueError:
                pass
    except Exception:
        pass
    return None

def sync_utilization_history(lookback_days=30, force=False):
    print(f"\n==========================================")
    print(f"   STARTING SERVER UTILIZATION METRICS SYNC")
    print(f"==========================================")
    
    conn = get_connection()
    cur = conn.cursor()
    
    # 1. Fetch total memory and total disk space per server to calculate utilization percentages
    # A) From memory_samples
    server_total_mem = {}
    try:
        cur.execute("""
            SELECT server_name, log_message 
            FROM db_monitoring_logs 
            WHERE log_type = 'memory_samples' AND log_message IS NOT NULL AND log_message != '';
        """)
        for s_name, msg in cur.fetchall():
            try:
                d = json.loads(msg)
                tot = d.get("total_memory_mb")
                if tot:
                    server_total_mem[s_name] = tot * 1024 * 1024
            except:
                continue
    except Exception as e:
        print(f"[SYNC] Error loading memory samples totals: {e}")
        
    # B) From disk_samples
    server_total_disk = {}
    try:
        cur.execute("""
            SELECT server_name, log_message 
            FROM db_monitoring_logs 
            WHERE log_type = 'disk_samples' AND log_message IS NOT NULL AND log_message != '';
        """)
        for s_name, msg in cur.fetchall():
            try:
                d = json.loads(msg)
                tot = d.get("total_gb")
                if tot:
                    server_total_disk[s_name] = tot * 1024 * 1024 * 1024
            except:
                continue
    except Exception as e:
        print(f"[SYNC] Error loading disk samples totals: {e}")

    # C) Dynamic estimation from CloudWatch FreeableMemory & FreeStorageSpace/FreeLocalStorage max values
    try:
        cur.execute("""
            SELECT server_name, log_message 
            FROM db_monitoring_logs 
            WHERE (log_type = 'FreeableMemory' OR log_message LIKE '%FreeableMemory%') 
              AND log_message IS NOT NULL AND log_message != '';
        """)
        for s_name, msg in cur.fetchall():
            try:
                d = json.loads(msg)
                dps = d.get("Datapoints", [d])
                for dp in dps:
                    avg = dp.get("Average") or dp.get("Maximum")
                    if avg:
                        # Estimate total memory as 1.25x the maximum free memory seen to prevent division issues
                        server_total_mem[s_name] = max(server_total_mem.get(s_name, 0), float(avg) * 1.25)
            except:
                continue
    except Exception as e:
        print(f"[SYNC] Error estimating memory from CloudWatch: {e}")

    try:
        cur.execute("""
            SELECT server_name, log_message 
            FROM db_monitoring_logs 
            WHERE (log_type IN ('FreeStorageSpace', 'FreeLocalStorage') 
                   OR log_message LIKE '%FreeStorageSpace%' 
                   OR log_message LIKE '%FreeLocalStorage%') 
              AND log_message IS NOT NULL AND log_message != '';
        """)
        for s_name, msg in cur.fetchall():
            try:
                d = json.loads(msg)
                dps = d.get("Datapoints", [d])
                for dp in dps:
                    avg = dp.get("Average") or dp.get("Maximum")
                    if avg:
                        server_total_disk[s_name] = max(server_total_disk.get(s_name, 0), float(avg) * 1.25)
            except:
                continue
    except Exception as e:
        print(f"[SYNC] Error estimating storage from CloudWatch: {e}")

    # Set reasonable fallback defaults for memory and disk totals if they are still 0 or empty
    for s_name in list(server_total_mem.keys()):
        if server_total_mem[s_name] <= 0:
            server_total_mem[s_name] = 16 * 1024 * 1024 * 1024 # 16 GB
            
    for s_name in list(server_total_disk.keys()):
        if server_total_disk[s_name] <= 0:
            server_total_disk[s_name] = 100 * 1024 * 1024 * 1024 # 100 GB

    # 2. Determine lookup/start timestamp to query logs since the last sync
    cur.execute("SELECT MAX(captured_at) FROM server_utilization_history;")
    max_history = cur.fetchone()[0]
    
    target_types = (
        'cloudwatch_log', 'CPUUtilization', 'ReadIOPS', 'WriteIOPS', 'FreeableMemory', 
        'FreeStorageSpace', 'FreeLocalStorage', 'cpu_samples', 'cpu_daily_metrics', 
        'memory_samples', 'memory_daily_metrics', 'disk_samples', 'disk_daily_metrics', 
        'io_samples', 'io_daily_metrics'
    )

    if max_history and not force:
        # Pull logs starting slightly before the last sync time to handle late-arriving records
        start_time = max_history - timedelta(hours=2)
        print(f"[SYNC] Existing history found. Incremental sync starting from {start_time}")
    else:
        cur.execute("SELECT MIN(log_time) FROM db_monitoring_logs WHERE log_type IN %s AND log_time IS NOT NULL;", (target_types,))
        min_log = cur.fetchone()[0]
        start_time = min_log if min_log else (datetime.now() - timedelta(days=lookback_days))
        print(f"[SYNC] Force sync / No history. Sync starting from {start_time}")
    
    cur.execute("""
        SELECT id, client_name, server_name, log_type, log_message, log_time
        FROM db_monitoring_logs
        WHERE log_type IN %s AND log_time >= %s
        ORDER BY log_time ASC;
    """, (target_types, start_time))
    
    logs = cur.fetchall()
    print(f"[SYNC] Fetched {len(logs)} log records to process.")
    
    # 4. Process logs and group them into (server_name, hour_timestamp) buckets
    hourly_metrics = {} # Key: (server_name, hour_dt), Value: {'cpu': [], 'memory': [], 'disk': [], 'io': []}
    
    for log_id, client_name, server_name, log_type, log_message, log_time in logs:
        if not server_name or server_name.lower() in ("unknown", "standalone"):
            continue
            
        try:
            data = json.loads(log_message)
        except Exception:
            continue
            
        # Parse datapoints from either a direct list or a single JSON object representation
        datapoints = []
        if isinstance(data, dict):
            if "Datapoints" in data:
                datapoints = data["Datapoints"]
            else:
                datapoints = [data]
        elif isinstance(data, list):
            datapoints = data
            
        for dp in datapoints:
            if not isinstance(dp, dict):
                continue
                
            # Determine correct timestamp
            ts_str = dp.get("Timestamp") or dp.get("captured_time") or dp.get("time") or dp.get("metric_date")
            ts_dt = parse_utc_timestamp(ts_str)
            if ts_dt:
                # Convert UTC to naive timestamp for database comparison
                local_dt = ts_dt.astimezone(IST).replace(tzinfo=None)
            else:
                local_dt = log_time
                
            if not local_dt:
                continue
                
            # Truncate to hour
            hour_dt = local_dt.replace(minute=0, second=0, microsecond=0)
            bucket_key = (server_name, hour_dt)
            
            if bucket_key not in hourly_metrics:
                hourly_metrics[bucket_key] = {'cpu': [], 'memory': [], 'disk': [], 'io': [], 'read_iops': [], 'write_iops': []}
                
            # Extract CPU
            if log_type == 'CPUUtilization' or (isinstance(data, dict) and data.get("Label") == 'CPUUtilization'):
                avg = dp.get("Average")
                if avg is not None:
                    hourly_metrics[bucket_key]['cpu'].append(float(avg))
            elif log_type in ('cpu_samples', 'cpu_daily_metrics', 'cpu_daily', 'cpu_hourly'):
                avg = dp.get("cpu_avg") or dp.get("Average")
                if avg is not None:
                    hourly_metrics[bucket_key]['cpu'].append(float(avg))
                else:
                    sql_cpu = dp.get("sql_cpu_percent", 0.0)
                    sys_cpu = dp.get("system_cpu_percent", 0.0)
                    oth_cpu = dp.get("other_cpu_percent", 0.0)
                    if sql_cpu or sys_cpu or oth_cpu:
                        hourly_metrics[bucket_key]['cpu'].append(float(sql_cpu + sys_cpu + oth_cpu))
                        
            # Extract Memory
            elif log_type == 'FreeableMemory' or (isinstance(data, dict) and data.get("Label") == 'FreeableMemory'):
                avg = dp.get("Average") or dp.get("Maximum")
                if avg is not None:
                    tot_mem = server_total_mem.get(server_name, 16 * 1024 * 1024 * 1024)
                    used_pct = 100.0 * (1.0 - float(avg) / tot_mem)
                    hourly_metrics[bucket_key]['memory'].append(max(0.0, min(100.0, used_pct)))
            elif log_type in ('memory_samples', 'memory_daily_metrics', 'memory_daily', 'memory_hourly'):
                avg_pct = dp.get("memory_avg_percent")
                if avg_pct is not None:
                    hourly_metrics[bucket_key]['memory'].append(float(avg_pct))
                else:
                    used = dp.get("used_memory_mb")
                    tot = dp.get("total_memory_mb") or server_total_mem.get(server_name, 16384 * 1024 * 1024) / (1024*1024)
                    if used and tot:
                        hourly_metrics[bucket_key]['memory'].append(max(0.0, min(100.0, (float(used) / float(tot)) * 100.0)))
                        
            # Extract Disk Storage
            elif log_type in ('FreeStorageSpace', 'FreeLocalStorage') or (isinstance(data, dict) and data.get("Label") in ('FreeStorageSpace', 'FreeLocalStorage')):
                avg = dp.get("Average") or dp.get("Maximum")
                if avg is not None:
                    tot_disk = server_total_disk.get(server_name, 100 * 1024 * 1024 * 1024)
                    used_pct = 100.0 * (1.0 - float(avg) / tot_disk)
                    hourly_metrics[bucket_key]['disk'].append(max(0.0, min(100.0, used_pct)))
            elif log_type in ('disk_samples', 'disk_daily_metrics', 'disk_daily', 'disk_hourly'):
                avg_pct = dp.get("disk_avg_percent") or dp.get("disk_usage_percent")
                if avg_pct is not None:
                    hourly_metrics[bucket_key]['disk'].append(float(avg_pct))
                else:
                    used = dp.get("used_gb")
                    tot = dp.get("total_gb")
                    if used and tot:
                        hourly_metrics[bucket_key]['disk'].append(max(0.0, min(100.0, (float(used) / float(tot)) * 100.0)))
                        
            # Extract I/O Saturation
            elif log_type in ('ReadIOPS', 'WriteIOPS', 'cloudwatch_log') or (isinstance(data, dict) and data.get("Label") in ('ReadIOPS', 'WriteIOPS')):
                label = dp.get("Label") or log_type
                avg = dp.get("Average")
                if avg is not None:
                    val = float(avg)
                    if label == 'ReadIOPS':
                        hourly_metrics[bucket_key]['read_iops'].append(val)
                    elif label == 'WriteIOPS':
                        hourly_metrics[bucket_key]['write_iops'].append(val)
                    # Convert raw IOPS average to a utilization metric (divide by 10 as scaling factor, capped at 100%)
                    hourly_metrics[bucket_key]['io'].append(max(0.0, min(100.0, val / 10.0)))
            elif log_type in ('io_samples', 'io_daily_metrics', 'io_daily', 'io_hourly'):
                avg_pct = dp.get("io_avg_percent")
                if avg_pct is not None:
                    hourly_metrics[bucket_key]['io'].append(float(avg_pct))
                
                read_val = dp.get("read_iops") or dp.get("read_latency_avg")
                if read_val is not None:
                    hourly_metrics[bucket_key]['read_iops'].append(float(read_val))
                write_val = dp.get("write_iops") or dp.get("write_latency_avg")
                if write_val is not None:
                    hourly_metrics[bucket_key]['write_iops'].append(float(write_val))
                
                if avg_pct is None:
                    r_val = float(read_val or 0.0)
                    w_val = float(write_val or 0.0)
                    if r_val or w_val:
                        hourly_metrics[bucket_key]['io'].append(max(0.0, min(100.0, (r_val + w_val) / 10.0)))

    # 5. Insert / Upsert the hourly aggregated utilization values
    inserted = 0
    updated = 0
    
    for (s_name, hour_dt), vals in hourly_metrics.items():
        cpu_val = round(sum(vals['cpu']) / len(vals['cpu']), 2) if vals['cpu'] else None
        mem_val = round(sum(vals['memory']) / len(vals['memory']), 2) if vals['memory'] else None
        disk_val = round(sum(vals['disk']) / len(vals['disk']), 2) if vals['disk'] else None
        io_val = round(sum(vals['io']) / len(vals['io']), 2) if vals['io'] else None
        read_val = round(sum(vals['read_iops']) / len(vals['read_iops']), 2) if vals['read_iops'] else None
        write_val = round(sum(vals['write_iops']) / len(vals['write_iops']), 2) if vals['write_iops'] else None
        
        if cpu_val is None and mem_val is None and disk_val is None and io_val is None and read_val is None and write_val is None:
            continue
            
        try:
            cur.execute("""
                INSERT INTO server_utilization_history (
                    server_name, cpu_utilization, memory_utilization, disk_utilization, io_utilization, 
                    read_iops, write_iops, captured_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (server_name, captured_at) DO UPDATE 
                SET cpu_utilization = COALESCE(EXCLUDED.cpu_utilization, server_utilization_history.cpu_utilization),
                    memory_utilization = COALESCE(EXCLUDED.memory_utilization, server_utilization_history.memory_utilization),
                    disk_utilization = COALESCE(EXCLUDED.disk_utilization, server_utilization_history.disk_utilization),
                    io_utilization = COALESCE(EXCLUDED.io_utilization, server_utilization_history.io_utilization),
                    read_iops = COALESCE(EXCLUDED.read_iops, server_utilization_history.read_iops),
                    write_iops = COALESCE(EXCLUDED.write_iops, server_utilization_history.write_iops);
            """, (s_name, cpu_val, mem_val, disk_val, io_val, read_val, write_val, hour_dt))
            inserted += 1
        except Exception as e:
            print(f"[SYNC] Error upserting metrics for {s_name} at {hour_dt}: {e}")
            
    conn.commit()
    cur.close()
    conn.close()
    
    print(f"[SYNC] Ingestion complete. Processed {inserted} unique server hourly records into server_utilization_history.")
    print(f"==========================================\n")
    return {"inserted": inserted}

if __name__ == "__main__":
    sync_utilization_history(force=True)
