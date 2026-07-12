import os
import csv
import time
import hashlib
import logging
import traceback
import configparser

import boto3
import psycopg2

from psycopg2.extras import DictCursor
from severity_classifier import classify_severity



# ═════════════════════════════ CONFIG LOADING ═══════════════════════════════

CONFIG_PATH = "/etc/systemd/system/config.ini"

config = configparser.ConfigParser()

if not config.read(CONFIG_PATH):
    raise FileNotFoundError(
        f"Config file not found: {CONFIG_PATH}"
    )

# ───────────────── AWS CONFIG ─────────────────

AWS_ACCESS_KEY = config["aws"]["aws_access_key_id"]
AWS_SECRET_KEY = config["aws"]["aws_secret_access_key"]
AWS_REGION     = config["aws"]["aws_region"]

S3_BUCKET      = config["aws"]["s3_bucket"]
S3_PREFIX      = config["aws"]["s3_prefix"]

# ───────────────── POSTGRES CONFIG ─────────────────

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "dbname": os.getenv("DB_NAME", "Incoming-error-data"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "y7UMhWmLcqSJzmhTGDyK"),
    "port": os.getenv("DB_PORT", "5432")
}

# ───────────────── DIRECTORIES ─────────────────

TEMP_DOWNLOAD_DIR = "/tmp/mysql_s3_csv"

TRACK_FILE = "/home/ubuntu/GeoMon-App/processed_s3_files.txt"

CHECK_INTERVAL_SECONDS = 4 * 60 * 60   # 4 hours

os.makedirs(
    TEMP_DOWNLOAD_DIR,
    exist_ok=True
)

# ═════════════════════════════ LOGGER ═══════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s"
)

logger = logging.getLogger(
    "mysql_s3_loader"
)

# ═════════════════════════════ TRACK FILE HANDLER ═══════════════════════════

def load_processed_files():

    if not os.path.exists(TRACK_FILE):
        return set()

    with open(TRACK_FILE, "r") as fh:

        return set(
            line.strip()
            for line in fh
            if line.strip()
        )


def mark_file_processed(s3_key):

    with open(TRACK_FILE, "a") as fh:
        fh.write(f"{s3_key}\n")


# ═════════════════════════════ DB CONNECTION ════════════════════════════════

def get_db_connection():

    conn = psycopg2.connect(
        host=DB_CONFIG["host"],
        port=DB_CONFIG["port"],
        dbname=DB_CONFIG["dbname"],
        user=DB_CONFIG["user"],
        password=DB_CONFIG["password"]
    )

    conn.autocommit = False

    return conn


# ═════════════════════════════ HASH GENERATOR ═══════════════════════════════

def generate_log_hash(
    client_name,
    server_name,
    db_type,
    log_type,
    log_message
):

    raw = (
        f"{client_name}|"
        f"{server_name}|"
        f"{db_type}|"
        f"{log_type}|"
        f"{log_message}"
    )

    return hashlib.sha256(
        raw.encode("utf-8")
    ).hexdigest()


# ═════════════════════════════ S3 CLIENT ════════════════════════════════════

def get_s3_client():

    return boto3.client(
        "s3",
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY,
        region_name=AWS_REGION
    )


# ═════════════════════════════ LIST CSV FILES ═══════════════════════════════

def list_csv_files():

    s3 = get_s3_client()

    paginator = s3.get_paginator(
        "list_objects_v2"
    )

    files = []

    for page in paginator.paginate(
        Bucket=S3_BUCKET,
        Prefix=S3_PREFIX
    ):

        for obj in page.get("Contents", []):

            key = obj["Key"]

            if key.endswith(".csv"):
                files.append(key)

    return files


# ═════════════════════════════ DOWNLOAD FILE ════════════════════════════════

def download_s3_file(
    s3_key,
    local_path
):

    s3 = get_s3_client()

    s3.download_file(
        S3_BUCKET,
        s3_key,
        local_path
    )


# ═════════════════════════════ INSERT OR UPDATE ═════════════════════════════

def insert_or_update_record(
    conn,
    row
):

    client_name   = row.get("client_name", "")
    server_name   = row.get("server_name", "")
    db_type       = row.get("db_type", "")
    log_type      = row.get("log_type", "")
    log_source    = row.get("log_source", "")
    log_time      = row.get("log_time", "")
    log_time_utc  = row.get("log_time_utc", "")
    log_time_ist  = row.get("log_time_ist", "")
    log_message   = row.get("log_message", "")

    log_hash = generate_log_hash(
        client_name,
        server_name,
        db_type,
        log_type,
        log_message
    )

    severity = classify_severity(db_type or "MySQL", log_message)


    cursor = conn.cursor(
        cursor_factory=DictCursor
    )

    try:

        # ───────────────── CHECK EXISTING LOG ─────────────────

        cursor.execute(
            """
            SELECT id, occurrence_count
            FROM db_monitoring_logs
            WHERE log_hash = %s
            """,
            (log_hash,)
        )

        existing = cursor.fetchone()

        # ───────────────── UPDATE EXISTING ─────────────────

        if existing:

            new_count = (
                existing["occurrence_count"] or 1
            ) + 1

            cursor.execute(
                """
                UPDATE db_monitoring_logs
                SET occurrence_count = %s,
                    status_updated_at = NOW()
                WHERE id = %s
                """,
                (
                    new_count,
                    existing["id"]
                )
            )

            logger.info(
                f"Updated occurrence_count={new_count}"
            )

        # ───────────────── INSERT NEW ─────────────────

        else:

            cursor.execute(
                """
                INSERT INTO db_monitoring_logs (

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

                    None,       # raw_log
                    "",       # email_subject
                    None,     # email_received_time

                    log_hash,

                    "",       # status
                    "",       # owner
                    "",       # client_visibility
                    "",       # ticket_status
                    "",       # next_action
                    severity  # severity
                )
            )

            logger.info(
                f"Inserted new log"
            )

        conn.commit()

    except Exception as exc:

        conn.rollback()

        logger.error(
            f"Failed row insert: {exc}"
        )

        logger.error(
            traceback.format_exc()
        )

    finally:

        cursor.close()


# ═════════════════════════════ PROCESS CSV ══════════════════════════════════

def process_csv(
    conn,
    csv_path
):

    logger.info(
        f"Reading CSV: {csv_path}"
    )

    total = 0

    with open(
        csv_path,
        "r",
        encoding="utf-8"
    ) as fh:

        reader = csv.DictReader(fh)

        for row in reader:

            insert_or_update_record(
                conn,
                row
            )

            total += 1

    logger.info(
        f"Processed {total} rows"
    )


# ═════════════════════════════ RUN LOADER ═══════════════════════════════════

def run_loader():

    logger.info(
        "Checking S3 for new CSV files..."
    )

    processed_files = load_processed_files()

    csv_files = list_csv_files()

    logger.info(
        f"Found {len(csv_files)} CSV files in S3"
    )

    conn = get_db_connection()

    for s3_key in csv_files:

        # ───────────────── SKIP DUPLICATES ─────────────────

        if s3_key in processed_files:

            logger.info(
                f"Skipping already processed file: {s3_key}"
            )

            continue

        try:

            filename = os.path.basename(
                s3_key
            )

            local_path = os.path.join(
                TEMP_DOWNLOAD_DIR,
                filename
            )

            # ───────────────── DOWNLOAD ─────────────────

            logger.info(
                f"Downloading: {s3_key}"
            )

            download_s3_file(
                s3_key,
                local_path
            )

            # ───────────────── PROCESS CSV ─────────────────

            logger.info(
                f"Processing: {filename}"
            )

            process_csv(
                conn,
                local_path
            )

            # ───────────────── DELETE TEMP CSV ─────────────────

            try:

                os.remove(local_path)

                logger.info(
                    f"Deleted temp CSV: {local_path}"
                )

            except Exception as exc:

                logger.warning(
                    f"Could not delete temp CSV: {exc}"
                )

            # ───────────────── MARK FILE PROCESSED ─────────────────

            mark_file_processed(
                s3_key
            )

            logger.info(
                f"Completed: {filename}"
            )

        except Exception as exc:

            conn.rollback()

            logger.error(
                f"Failed processing {s3_key}: {exc}"
            )

            logger.error(
                traceback.format_exc()
            )

    conn.close()

    logger.info(
        "Run completed"
    )


# ═════════════════════════════ MAIN LOOP ════════════════════════════════════

if __name__ == "__main__":

    logger.info(
        "S3 PostgreSQL Loader Started"
    )

    while True:

        try:

            run_loader()

        except Exception as exc:

            logger.error(
                f"Fatal error: {exc}"
            )

            logger.error(
                traceback.format_exc()
            )

        logger.info(
            f"Sleeping for "
            f"{CHECK_INTERVAL_SECONDS} seconds "
            f"(4 hours)"
        )

        time.sleep(
            CHECK_INTERVAL_SECONDS
        )
