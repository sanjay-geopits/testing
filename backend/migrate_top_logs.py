"""
migrate_top_logs.py  (proxy — real logic lives in services/migrate_top_logs.py)
"""
from services.migrate_top_logs import migrate_prioritized_logs

if __name__ == "__main__":
    import time
    from datetime import datetime, timedelta

    last = datetime.now() - timedelta(days=365)
    print(f"[MIGRATOR] Starting log migration from {last}...")
    while True:
        last, count = migrate_prioritized_logs(last)
        if count >= 500:
            print(f"[MIGRATOR] Batch full ({count} logs). Processing next batch immediately...")
            continue
        print(f"[MIGRATOR] No more logs to process now (migrated {count} in last batch). Sleeping 1 hour...")
        time.sleep(3600)
