import os
import csv
import sys
import time
import hashlib
import logging
import traceback
import configparser
from datetime import datetime, timezone

import boto3
import psycopg2
from psycopg2.extras import DictCursor
from severity_classifier import classify_severity

# ═══════════════════════════════ CONFIG ══════════════════════════════

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = sys.argv[1] if len(sys.argv) > 1 \
    else os.path.join(SCRIPT_DIR, "pg_loader_config.ini")

config = configparser.ConfigParser()
if not config.read(CONFIG_PATH):
    raise FileNotFoundError(f"Config not found: {CONFIG_PATH}")

# ── AWS ──────────────────────────────────────────────────────────────
AWS_ACCESS_KEY = config["aws"]["aws_access_key_id"].strip()
AWS_SECRET_KEY = config["aws"]["aws_secret_access_key"].strip()
AWS_REGION     = config["aws"]["aws_region"].strip()
S3_BUCKET      = config["aws"]["s3_bucket"].strip()

# ── S3 prefixes for both clients ─────────────────────────────────────
S3_PREFIXES = {
    "360tf":   config["aws"]["s3_prefix_360tf"].strip().rstrip("/") + "/",
    "Artfine": config["aws"]["s3_prefix_artfine"].strip().rstrip("/") + "/",
}

# ── PostgreSQL ───────────────────────────────────────────────────────
DB_HOST     = config["postgres"]["host"].strip()
DB_PORT     = config["postgres"]["port"].strip()
DB_NAME     = config["postgres"]["dbname"].strip()
DB_USER     = config["postgres"]["user"].strip()
DB_PASSWORD = config["postgres"]["password"].strip()
DB_TABLE    = config["postgres"].get("table", "db_monitoring_logs").strip()

# ── Paths ─────────────────────────────────────────────────────────────
TEMP_DIR         = config["paths"]["temp_download_dir"].strip()
TRACK_FILE       = config["paths"]["track_file"].strip()
PROCESS_LOG_FILE = config["paths"]["process_log_file"].strip()

CHECK_INTERVAL   = int(config["general"].get("interval_hours", 4)) * 3600

os.makedirs(os.path.expanduser(TEMP_DIR),
            exist_ok=True)
os.makedirs(os.path.dirname(os.path.expanduser(PROCESS_LOG_FILE)),
            exist_ok=True)
os.makedirs(os.path.dirname(os.path.expanduser(TRACK_FILE)),
            exist_ok=True)


# ═══════════════════════════════ LOGGER ══════════════════════════════

def setup_logger(log_file: str) -> logging.Logger:
    log_file = os.path.expanduser(log_file)
    logger   = logging.getLogger("pg_s3_loader")
    logger.setLevel(logging.DEBUG)
    fmt = logging.Formatter(
        "%(asctime)s  %(levelname)-8s  %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    if not logger.handlers:
        fh = logging.FileHandler(log_file, encoding="utf-8")
        fh.setFormatter(fmt)
        ch = logging.StreamHandler(sys.stdout)
        ch.setFormatter(fmt)
        logger.addHandler(fh)
        logger.addHandler(ch)
    return logger


logger = setup_logger(PROCESS_LOG_FILE)


# ═══════════════════════════ TRACK FILE ══════════════════════════════

def load_processed_files() -> set:
    path = os.path.expanduser(TRACK_FILE)
    if not os.path.exists(path):
        return set()
    with open(path, "r") as fh:
        return {line.strip() for line in fh if line.strip()}


def mark_file_processed(s3_key: str) -> None:
    path = os.path.expanduser(TRACK_FILE)
    with open(path, "a") as fh:
        fh.write(f"{s3_key}\n")


# ═══════════════════════════ DB CONNECTION ════════════════════════════

def get_db_conn():
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )
    conn.autocommit = False
    return conn


# ═══════════════════════════ HASH ════════════════════════════════════

def generate_hash(
    client_name: str,
    server_name: str,
    db_type: str,
    log_type: str,
    log_message: str,
) -> str:
    raw = (
        f"{client_name}|{server_name}|"
        f"{db_type}|{log_type}|{log_message}"
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


# ═══════════════════════════ S3 CLIENT ════════════════════════════════

def get_s3():
    return boto3.client(
        "s3",
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY,
        region_name=AWS_REGION,
    )


# ═══════════════════════════ LIST CSV FILES ════════════════════════════

def list_csv_files(s3_prefix: str) -> list:
    """Return all .csv keys under the given S3 prefix."""
    s3        = get_s3()
    paginator = s3.get_paginator("list_objects_v2")
    files     = []

    for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=s3_prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if key.endswith(".csv"):
                files.append(key)

    return files


# ═══════════════════════════ DOWNLOAD ════════════════════════════════

def download_csv(s3_key: str, local_path: str) -> None:
    get_s3().download_file(S3_BUCKET, s3_key, local_path)


# ═══════════════════════════ INSERT / UPDATE ══════════════════════════

def insert_or_update(conn, row: dict) -> str:
    """
    Insert a new record or increment occurrence_count if hash exists.
    Returns 'inserted' or 'updated'.
    """
    client_name  = row.get("client_name",  "").strip()
    server_name  = row.get("server_name",  "").strip()
    db_type      = row.get("db_type",      "").strip()
    log_type     = row.get("log_type",     "").strip()
    log_source   = row.get("log_source",   "").strip()
    log_time     = row.get("log_time",     "").strip() or None
    log_time_utc = row.get("log_time_utc", "").strip() or None
    log_time_ist = row.get("log_time_ist", "").strip() or None
    log_message  = row.get("log_message",  "").strip()

    log_hash = generate_hash(
        client_name, server_name, db_type, log_type, log_message
    )
    severity = classify_severity(db_type or "PostgreSQL",log_message)

    with conn.cursor(cursor_factory=DictCursor) as cur:

        # ── Check existing ────────────────────────────────────────────
        cur.execute(
            """
            SELECT id, occurrence_count
            FROM   db_monitoring_logs
            WHERE  log_hash = %s
            """,
            (log_hash,),
        )
        existing = cur.fetchone()

        if existing:
            # ── Update occurrence count ───────────────────────────────
            new_count = (existing["occurrence_count"] or 1) + 1
            cur.execute(
                """
                UPDATE db_monitoring_logs
                SET    occurrence_count  = %s,
                       status_updated_at = NOW()
                WHERE  id = %s
                """,
                (new_count, existing["id"]),
            )
            conn.commit()
            return "updated"

        else:
            # ── Insert new record ─────────────────────────────────────
            cur.execute(
                f"""
                INSERT INTO {DB_TABLE} (
                    client_name,
                    server_name,
                    db_type,
                    log_type,
                    log_source,
                    log_time,
                    log_time_utc,
                    log_time_ist,
                    log_message,
                    occurrence_count,
                    raw_log,
                    email_subject,
                    email_received_time,
                    log_hash,
                    created_at,
                    status,
                    owner,
                    client_visibility,
                    ticket_status,
                    next_action,
                    severity,
                    status_updated_at
                )
                VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s,
                    %s,
                    %s, %s, %s,
                    %s,
                    NOW(),
                    %s, %s, %s, %s, %s, %s,
                    NOW()
                )
                """,
                (
                    client_name,
                    server_name,
                    db_type,
                    log_type,
                    log_source,
                    log_time,
                    log_time_utc,
                    log_time_ist,
                    log_message,
                    1,
                    None,   # raw_log         (json column → NULL)
                    "",     # email_subject
                    None,   # email_received_time
                    log_hash,
                    "",     # status
                    "",     # owner
                    "",     # client_visibility
                    "",     # ticket_status
                    "",     # next_action
                    severity,     # severity
                ),
            )
            conn.commit()
            return "inserted"


# ═══════════════════════════ PROCESS CSV ══════════════════════════════

def process_csv(conn, csv_path: str, client_label: str) -> dict:
    """Read CSV and upsert every row. Returns counts."""
    inserted = 0
    updated  = 0
    errors   = 0

    logger.info(f"  Reading CSV: {os.path.basename(csv_path)}")
    csv.field_size_limit(sys.maxsize)
    with open(csv_path, "r", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            try:
                result = insert_or_update(conn, row)
                if result == "inserted":
                    inserted += 1
                else:
                    updated += 1
            except Exception as exc:
                conn.rollback()
                errors += 1
                logger.error(f"  Row error: {exc}")
                logger.debug(traceback.format_exc())

    logger.info(
        f"  [{client_label}] inserted={inserted:,}  "
        f"updated={updated:,}  errors={errors}"
    )
    return {"inserted": inserted, "updated": updated, "errors": errors}


# ═══════════════════════════ CLIENT RUNNER ════════════════════════════

def run_client(
    conn,
    client_label: str,
    s3_prefix: str,
    processed_files: set,
) -> dict:
    """
    Process all unprocessed CSV files for one client.
    Returns summary dict.
    """
    logger.info(f"── Client: {client_label} {'─'*40}")

    csv_files = list_csv_files(s3_prefix)
    logger.info(
        f"  Found {len(csv_files)} CSV file(s) under "
        f"s3://{S3_BUCKET}/{s3_prefix}"
    )

    totals = {"files": 0, "inserted": 0, "updated": 0, "errors": 0}

    for s3_key in csv_files:

        if s3_key in processed_files:
            logger.info(f"  Skipping (already processed): {s3_key}")
            continue

        filename   = os.path.basename(s3_key)
        local_path = os.path.join(
            os.path.expanduser(TEMP_DIR), filename
        )

        try:
            # ── Download ──────────────────────────────────────────────
            logger.info(f"  Downloading: {s3_key}")
            download_csv(s3_key, local_path)

            # ── Load into DB ──────────────────────────────────────────
            counts = process_csv(conn, local_path, client_label)

            totals["files"]    += 1
            totals["inserted"] += counts["inserted"]
            totals["updated"]  += counts["updated"]
            totals["errors"]   += counts["errors"]

            # ── Delete temp CSV ───────────────────────────────────────
            try:
                os.remove(local_path)
                logger.info(f"  Deleted temp file: {filename}")
            except OSError as exc:
                logger.warning(f"  Could not delete temp file: {exc}")

            # ── Mark as done (even if some rows had errors) ───────────
            mark_file_processed(s3_key)
            processed_files.add(s3_key)
            logger.info(f"  Marked processed: {filename}")

        except Exception as exc:
            conn.rollback()
            logger.error(f"  Failed {s3_key}: {exc}")
            logger.debug(traceback.format_exc())
            # Clean up partial download
            if os.path.exists(local_path):
                try:
                    os.remove(local_path)
                except OSError:
                    pass

    return totals


# ═══════════════════════════ MAIN LOOP ════════════════════════════════

def run_loader() -> None:
    run_start = datetime.now(timezone.utc)
    logger.info("━" * 70)
    logger.info(
        f"Loader run started at "
        f"{run_start.strftime('%Y-%m-%d %H:%M:%S UTC')}"
    )

    processed_files = load_processed_files()
    logger.info(
        f"Already-processed files tracked: {len(processed_files)}"
    )

    try:
        conn = get_db_conn()
        logger.info(
            f"DB connected: {DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
        )
    except Exception as exc:
        logger.error(f"DB connection FAILED: {exc}")
        return

    all_totals = {}

    try:
        for client_label, s3_prefix in S3_PREFIXES.items():
            try:
                totals = run_client(
                    conn, client_label, s3_prefix, processed_files
                )
                all_totals[client_label] = totals
            except Exception as exc:
                logger.error(
                    f"Unhandled error for client {client_label}: {exc}"
                )
                logger.debug(traceback.format_exc())
    finally:
        conn.close()
        logger.info("DB connection closed.")

    # ── Run summary ───────────────────────────────────────────────────
    run_end  = datetime.now(timezone.utc)
    duration = (run_end - run_start).total_seconds()
    logger.info("─" * 70)
    logger.info(f"Run finished in {duration:.1f}s")
    for client, t in all_totals.items():
        logger.info(
            f"  {client:<10}  Files: {t['files']:>3}  "
            f"Inserted: {t['inserted']:>8,}  "
            f"Updated: {t['updated']:>8,}  "
            f"Errors: {t['errors']:>4}"
        )
    logger.info("━" * 70)


def main():
    logger.info("═" * 70)
    logger.info(
        f"S3 → PostgreSQL Loader (360tf + Artfine) starting  |  "
        f"interval: every "
        f"{CHECK_INTERVAL // 3600}h"
    )
    logger.info(f"Config : {CONFIG_PATH}")
    logger.info(f"Target : {DB_USER}@{DB_HOST}/{DB_NAME} → {DB_TABLE}")
    logger.info("═" * 70)

    while True:
        try:
            run_loader()
        except Exception as exc:
            logger.critical(f"Fatal error: {exc}")
            logger.debug(traceback.format_exc())

        next_run = datetime.now(timezone.utc).timestamp() + CHECK_INTERVAL
        next_str = datetime.fromtimestamp(
            next_run, tz=timezone.utc
        ).strftime("%Y-%m-%d %H:%M:%S UTC")
        logger.info(f"Next run at {next_str}")
        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    main()
