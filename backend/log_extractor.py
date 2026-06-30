import re
import io
import gzip
import json
import zipfile
from datetime import datetime, timezone
from typing import Optional

from exchangelib import FileAttachment
from log_utils import (
    parse_time, normalize_for_hash, make_hash, insert_log, 
    get_12h_bucket, get_db_connection
)
from severity_classifier import classify_severity


_SAMPLE_LOG_TYPES = {
    "cpu_samples", "disk_samples", "io_samples",
    "memory_samples", "error_log_history", "slow_query_log",
}

CLIENT_ALLOWED_METRICS: dict[str, set[str]] = {
    "Intentwise": {"CPUUtilization", "ReadIOPS", "WriteIOPS", "postgres_logs"},
    "RunLoyal":   {"CPUUtilization", "ReadIOPS", "WriteIOPS", "rds_error", "rds_slowquery"},
    "Cropin":     {"CPUUtilization", "ReadIOPS", "WriteIOPS"},
    "Shemaroo":   {"cpu_hourly", "disk_hourly", "io_hourly", "memory_hourly", "slow_queries"},
    "RetailScan": _SAMPLE_LOG_TYPES,
    "Cnergee":    _SAMPLE_LOG_TYPES,
    "FlowGlobal": _SAMPLE_LOG_TYPES,
}


_EVENTS_LOG_TYPES = {"postgres_logs", "rds_error", "rds_slowquery"}


_CW_METRIC_TYPES = {"CPUUtilization", "ReadIOPS", "WriteIOPS"}


_SAMPLE_METRIC_TYPES = {"cpu_samples", "disk_samples", "io_samples", "memory_samples"}

# ─────────────────────────────────────────────────────────────────────────────
# Known RunLoyal server names — longest-first for prefix-match priority
# ─────────────────────────────────────────────────────────────────────────────

RL_KNOWN_SERVERS: list[str] = sorted([
    "rl-prod-cluster-instance-1-reader-2",
    "rl-prod-cluster-instance-1-reader",
    "rl-prod-cluster-instance-1",
    "rl-uat-dbcluster",
    "rl-pre-prod-instance",
], key=len, reverse=True)

RL_DEFAULT_SERVER = "rl-prod-cluster-instance-1"

_IP_RE = re.compile(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$")


def _canonical_server(raw: str) -> Optional[str]:
    
    if not raw:
        return None
    # IP address → keep as-is (RetailScan / Cnergee servers are IPs)
    if _IP_RE.match(raw):
        return raw
    # RunLoyal — longest-first so reader-2 beats reader beats base instance
    for inst in RL_KNOWN_SERVERS:
        if raw == inst or raw.startswith(inst + ".") or raw.startswith(inst + "_"):
            return inst
    # Intentwise streams: "amsservice2.0", "amsservice2.2" → "amsservice2"
    dot = raw.find(".")
    if dot != -1:
        return raw[:dot]
    return raw



_EXT_RE = re.compile(r"(\.json|\.gz|\.zip|\.log|\.txt)+$", re.IGNORECASE)
_TS_RE  = re.compile(r"_\d{8}_\d{6}(\s+\S+)?$|_\d{14}$")


def _name_core(fname: str) -> str:
    
    base = fname.split("/")[-1].split("\\")[-1]
    base = _EXT_RE.sub("", base)
    base = _TS_RE.sub("", base)
    return base




def _to_utc_aware(ts) -> Optional[datetime]:
    
    if not ts:
        return None

    if isinstance(ts, (int, float)):
        try:
            if ts > 1_000_000_000_000:
                return datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
            else:
                return datetime.fromtimestamp(ts, tz=timezone.utc)
        except Exception:
            return None

    if not isinstance(ts, str) or not ts.strip():
        return None

    ts = ts.strip()

    
    if ts.endswith("Z"):
        clean = ts[:-1]
        for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
            try:
                return datetime.strptime(clean, fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                pass

    
    if "+" in ts or (ts.count("-") > 2 and "T" in ts):
        try:
            return datetime.fromisoformat(ts).astimezone(timezone.utc)
        except Exception:
            pass

    
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(ts, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            pass

    return None




def _identify_client(subject: str) -> Optional[str]:
    
    s = subject.lower()
    if "cropin"     in s: return "Cropin"
    if "runloyal"   in s: return "RunLoyal"
    if "intentwise" in s: return "Intentwise"
    if "shemaroo"   in s: return "Shemaroo"
    if "retailscan" in s: return "RetailScan"
    if "cnergee"    in s: return "Cnergee"
    if "flowglobal" in s: return "FlowGlobal"
    return None


_CLIENT_DB = {
    "Cropin":     "MySQL",
    "RunLoyal":   "MySQL",
    "Intentwise": "PostgreSQL",
    "Shemaroo":   "MongoDB",
    "RetailScan": "PostgreSQL",   
    "Cnergee":    "MySQL",
    "FlowGlobal": "MySQL",
}



def _parse_cropin(nc: str) -> tuple[Optional[str], Optional[str]]:
    PREFIX = "cloudwatch_productionmysql-new_"
    if not nc.startswith(PREFIX):
        return None, None
    metric = nc[len(PREFIX):]
    if metric not in CLIENT_ALLOWED_METRICS["Cropin"]:
        return None, None
    return "productionmysql-new", metric


def _parse_runloyal(nc: str) -> tuple[Optional[str], Optional[str]]:
    if nc.startswith("cloudwatch_"):
        after = nc[len("cloudwatch_"):]
        for inst in RL_KNOWN_SERVERS:
            if after.startswith(inst + "_"):
                metric = after[len(inst) + 1:]
                if metric not in CLIENT_ALLOWED_METRICS["RunLoyal"]:
                    return None, None
                return inst, metric
        return None, None
    if nc.startswith("rds_error"):
        return RL_DEFAULT_SERVER, "rds_error"
    if nc.startswith("rds_slowquery"):
        return RL_DEFAULT_SERVER, "rds_slowquery"
    return None, None


def _parse_intentwise(nc: str) -> tuple[Optional[str], Optional[str]]:
    sep = nc.find("_")
    if sep == -1:
        return None, None
    server = nc[:sep]
    rest   = nc[sep + 1:]
    if rest.startswith("cloudwatch_"):
        metric = rest[len("cloudwatch_"):]
        if metric not in CLIENT_ALLOWED_METRICS["Intentwise"]:
            return None, None
        return server, metric
    if rest.startswith("postgres_logs"):
        return server, "postgres_logs"
    return None, None


def _parse_shemaroo(nc: str) -> tuple[Optional[str], Optional[str]]:
    for lt in CLIENT_ALLOWED_METRICS["Shemaroo"]:
        if nc.startswith(lt):
            return "Standalone", lt
    return None, None


def _parse_sample_client(nc: str, client: str) -> tuple[Optional[str], Optional[str]]:
    """
    RetailScan and Cnergee share identical file naming:
      error_log_history_{ts}.json  → log_type = "error_log_history"
      slow_query_log_{ts}.json     → log_type = "slow_query_log"
      cpu_samples_{ts}.json        → log_type = "cpu_samples"
      disk_samples_{ts}.json       → log_type = "disk_samples"
      io_samples_{ts}.json         → log_type = "io_samples"
      memory_samples_{ts}.json     → log_type = "memory_samples"

    Server lives inside each JSON record — use sentinel so extractor reads it.
    """
    for lt in CLIENT_ALLOWED_METRICS[client]:
        if nc.startswith(lt) or nc == lt:
            return "__FROM_RECORD__", lt
    return None, None


_CLIENT_PARSER = {
    "Cropin":     _parse_cropin,
    "RunLoyal":   _parse_runloyal,
    "Intentwise": _parse_intentwise,
    "Shemaroo":   _parse_shemaroo,
    "RetailScan": lambda nc: _parse_sample_client(nc, "RetailScan"),
    "Cnergee":    lambda nc: _parse_sample_client(nc, "Cnergee"),
    "FlowGlobal": lambda nc: _parse_sample_client(nc, "FlowGlobal"),
}



def _extract_events_log(data, filename_server: str) -> list[dict]:
    """
    {"events": [...]} with epoch_ms timestamps.
    Used by: rds_error, rds_slowquery, postgres_logs.
    """
    raw_events = (data.get("events", []) if isinstance(data, dict)
                  else (data if isinstance(data, list) else []))
    events = []
    for evt in raw_events:
        if not isinstance(evt, dict):
            continue
        msg = evt.get("message", "").strip()
        if not msg:
            continue
        logstream = str(evt.get("logStreamName", "")).strip()
        server    = _canonical_server(logstream) or filename_server
        time_dt   = _to_utc_aware(evt.get("timestamp"))
        events.append({
            "msg": msg, "time_dt": time_dt, "time_str": None,
            "server": server, "raw": evt,
        })
    return events


def _extract_cloudwatch(data: dict, log_type: str) -> list[dict]:
    
    label      = data.get("Label", log_type)
    datapoints = data.get("Datapoints", [])
    events     = []
    for dp in datapoints:
        if not isinstance(dp, dict):
            continue
        ts_raw  = dp.get("Timestamp", "")
        time_dt = _to_utc_aware(ts_raw)
        if not time_dt:
            continue
        msg = json.dumps({
            "Label":     label,
            "Timestamp": ts_raw,
            "Average":   dp.get("Average"),
            "Minimum":   dp.get("Minimum"),
            "Maximum":   dp.get("Maximum"),
            "Unit":      dp.get("Unit"),
        })
        events.append({
            "msg": msg, "time_dt": time_dt, "time_str": None,
            "server": None, "raw": dp,
        })
    return events


def _extract_shemaroo(data) -> list[dict]:
    """
    Plain list with IST "time" field.
    [{"time": "2026-05-11 17:00:01.937000", ...}]
    """
    events = []
    for item in (data if isinstance(data, list) else []):
        if not isinstance(item, dict):
            continue
        events.append({
            "msg":      json.dumps(item),
            "time_dt":  None,
            "time_str": str(item.get("time", "")),   # IST string
            "server":   None,
            "raw":      item,
        })
    return events


def _extract_retailscan(data, log_type: str, ts_is_utc: bool = True) -> list[dict]:
    
    events = []
    for item in (data if isinstance(data, list) else
                 ([data] if isinstance(data, dict) else [])):
        if not isinstance(item, dict):
            continue

        
        raw_server = (
            item.get("server_name") or
            item.get("serve_name") or
            item.get("server") or
            item.get("instance") or
            "Unknown"
        )
        server = str(raw_server).strip()

        
        msg = (
            item.get("log_message") or
            item.get("query_text") or
            item.get("log_text") or
            json.dumps(item)
        )
        msg = str(msg).strip()

        
        raw_ts = str(
            item.get("log_time") or
            item.get("captured_time") or
            item.get("time") or
            ""
        ).strip()

        if ts_is_utc:
            
            time_dt  = _to_utc_aware(raw_ts)
            time_str = None
        else:
            
            time_dt  = None
            time_str = raw_ts

        events.append({
            "msg":      msg,
            "time_dt":  time_dt,
            "time_str": time_str,
            "server":   server,
            "raw":      item,
        })
    return events




def _decompress(inner_name: str, raw: bytes) -> Optional[str]:
    try:
        if inner_name.lower().endswith(".gz"):
            with gzip.GzipFile(fileobj=io.BytesIO(raw)) as f:
                return f.read().decode("utf-8", errors="ignore")
        return raw.decode("utf-8", errors="ignore")
    except Exception as exc:
        print(f"  [ERROR] decompress '{inner_name}': {exc}")
        return None




def _parse_inner_file(
    inner_name: str,
    inner_bytes: bytes,
    client: str,
    db: str,
    fallback_dt: datetime,
) -> list[dict]:

    nc = _name_core(inner_name)
    filename_server, log_type = _CLIENT_PARSER[client](nc)

    if filename_server is None:
        return []    # not in allowed list → hard skip

    text = _decompress(inner_name, inner_bytes)
    if not text or not text.strip():
        print(f"  [WARN] empty content: {inner_name}")
        return []

    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        print(f"  [WARN] JSON parse failed '{inner_name}': {exc}")
        return [{
            "client": client, "server": filename_server if filename_server != "__FROM_RECORD__" else "Unknown",
            "db": db, "log_type": log_type, "msg": text.strip(),
            "time_dt": fallback_dt, "time_str": None, "raw": {"content": text.strip()},
        }]

    # ── Route to correct extractor ────────────────────────────────────────────
    if log_type in _EVENTS_LOG_TYPES:
        raw_events = _extract_events_log(data, filename_server)
        print(f"  [OK] {inner_name} -> {len(raw_events)} events  log_type={log_type}")

    elif isinstance(data, dict) and "Datapoints" in data:
        raw_events = _extract_cloudwatch(data, log_type)
        print(f"  [OK] {inner_name} -> {len(raw_events)} datapoints  log_type={log_type}")

    elif log_type in CLIENT_ALLOWED_METRICS.get("Shemaroo", set()):
        raw_events = _extract_shemaroo(data)
        print(f"  [OK] {inner_name} -> {len(raw_events)} items  log_type={log_type}")

    elif log_type in _SAMPLE_LOG_TYPES:
        # RetailScan: timestamps are UTC  → ts_is_utc=True  → +5:30 applied correctly
        # Cnergee:    timestamps are IST  → ts_is_utc=False → no extra offset added
        ts_is_utc = (client == "RetailScan")
        raw_events = _extract_retailscan(data, log_type, ts_is_utc=ts_is_utc)
        print(f"  [OK] {inner_name} → {len(raw_events)} records  log_type={log_type}  ts_is_utc={ts_is_utc}")

    else:
        print(f"  [WARN] unhandled structure '{inner_name}'  log_type={log_type}")
        return []

    # ── Build final log dicts ─────────────────────────────────────────────────
    logs = []
    for evt in raw_events:
        # Resolve server — sentinel means read from event data
        server = evt.get("server") or (
            filename_server if filename_server != "__FROM_RECORD__" else "Unknown"
        )
        curr_log_type = log_type
        if log_type == "postgres_logs":
            if "duration:" in evt["msg"].lower():
                curr_log_type = "slow_query_log"
            else:
                curr_log_type = "error_log"

        logs.append({
            "client":   client,
            "server":   server,
            "db":       db,
            "log_type": curr_log_type,
            "msg":      evt["msg"],
            "time_dt":  evt.get("time_dt") or fallback_dt,
            "time_str": evt.get("time_str"),
            "raw":      evt["raw"],
        })
    return logs




def process_rds_mail(item) -> None:
    subject = item.subject or ""
    client  = _identify_client(subject)

    print(f"\n{'='*60}")
    print(f"[MAIL]   {subject!r}")
    print(f"[CLIENT] {client}")

    if client is None:
        print("[SKIP] subject matched no known client")
        return

    db          = _CLIENT_DB[client]
    received    = item.datetime_received
    fallback_dt = received if received.tzinfo else received.replace(tzinfo=timezone.utc)
    found_logs: list[dict] = []

    for attachment in item.attachments:
        if not (hasattr(attachment, "name") and hasattr(attachment, "content")):
            continue

        fname   = attachment.name or ""
        content = attachment.content

        if not content:
            print(f"[WARN] empty attachment: {fname}")
            continue

        print(f"\n[ATTACHMENT] {fname}  ({len(content):,} bytes)")

       
        if fname.lower().endswith(".zip"):
            try:
                with zipfile.ZipFile(io.BytesIO(content)) as zf:
                    entries = [e for e in zf.infolist() if not e.is_dir()]
                    print(f"  [ZIP] {len(entries)} files inside")
                    for entry in entries:
                        inner_name  = entry.filename.split("/")[-1]
                        if not inner_name:
                            continue
                        inner_bytes = zf.read(entry.filename)
                        found_logs.extend(
                            _parse_inner_file(inner_name, inner_bytes, client, db, fallback_dt)
                        )
            except zipfile.BadZipFile as exc:
                print(f"  [ERROR] bad ZIP: {exc}")
            continue

        
        found_logs.extend(
            _parse_inner_file(fname, content, client, db, fallback_dt)
        )

    print(f"\n[TOTAL] {len(found_logs)} events to insert")

    
    inserted = skipped = 0

    # ── Consolidate Performance Metrics ───────────────────────────────────────
    final_to_insert = []
    perf_buckets = {}  # (client, server, log_type, hour, severity) -> (metric_val, log_record)

    for log in found_logs:
        # Pre-calculate time and severity
        try:
            if log["time_dt"] is not None:
                log_time, utc, ist = parse_time(log["time_dt"])
            elif log["time_str"]:
                log_time, utc, ist = parse_time(log["time_str"])
            else:
                log_time, utc, ist = parse_time(fallback_dt)
        except Exception:
            continue

        severity = classify_severity(log["db"], log["msg"])
        
        # Check if it's a performance log for consolidation
        from severity_classifier import is_performance_log, extract_metric_value
        if is_performance_log(log["log_type"]):
            # Use 12-hour bucket for consolidation (8 AM / 8 PM)
            time_bucket = get_12h_bucket(log_time)
            bucket_key = (log["client"], log["server"], log["log_type"], time_bucket, severity)
            
            metric_val = extract_metric_value(log["db"], log["log_type"], log["msg"])
            if metric_val is None: metric_val = 0.0 # Fallback for comparison
            
            if bucket_key not in perf_buckets:
                perf_buckets[bucket_key] = (metric_val, (log, log_time, utc, ist, severity))
            else:
                existing_val, _ = perf_buckets[bucket_key]
                if severity == "Low":
                    # Keep MIN for Low
                    if metric_val < existing_val:
                        perf_buckets[bucket_key] = (metric_val, (log, log_time, utc, ist, severity))
                else:
                    # Keep MAX for Critical, High, Medium
                    if metric_val > existing_val:
                        perf_buckets[bucket_key] = (metric_val, (log, log_time, utc, ist, severity))
        else:
            # Non-performance logs are always included
            final_to_insert.append((log, log_time, utc, ist, severity))

    # Add consolidated performance logs
    for val, (log, log_time, utc, ist, severity) in perf_buckets.values():
        final_to_insert.append((log, log_time, utc, ist, severity))

    # ── Database Insertion ────────────────────────────────────────────────────
    inserted = skipped = 0

    for log, log_time, utc, ist, severity in final_to_insert:
        if "Login succeeded for user" in log["msg"]:
            skipped += 1
            continue    

        n_msg = normalize_for_hash(log["msg"])
        
        # Always use 12-hour bucket for persistent hashing (consistent with log_utils)
        time_bucket = get_12h_bucket(log_time)

        h = make_hash(
            f"{log['client']}_{log['server']}_{log['log_type']}"
            f"_{n_msg}_{time_bucket}"
        )

        try:
            insert_log((
                log["client"],        # client_name
                log["server"],        # server_name
                log["db"],            # db_type
                log["log_type"],      # log_type
                "RDS_CloudWatch",     # log_source
                log_time, utc, ist,
                log["msg"],           # log_message
                json.dumps(log["raw"]),
                subject,
                item.datetime_received,
                h, 1, severity,
            ))
            inserted += 1
        except Exception as exc:
            print(f"  [ERROR] insert_log: {exc}")
            skipped += 1

    print(f"[DONE] inserted={inserted}  skipped={skipped}")
    
    # Trigger analytics refresh (Materialized View + Filter Cache)
    try:
        import requests
        # We hit the local endpoint. Since it requires auth, but this is a backend script, 
        # we might need an internal token or just refresh directly via a function if possible.
        # However, for simplicity here, I will just call the refresh function directly if imported, 
        # but log_extractor is a separate process. 
        # Best approach: Trigger refresh directly in DB from here.
        with get_db_connection() as conn:
            conn.set_isolation_level(0) # AUTOCOMMIT
            with conn.cursor() as cur:
                cur.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY combined_logs_mv;")
        print("[REFRESH] Success: Materialized View updated.")
    except Exception as re:
        print(f"[REFRESH] Error: {re}")
        
    print(f"{'='*60}\n")
