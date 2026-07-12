import os
import sys
# Ensure backend root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import time
import logging
from email_fetcher import sync_mssql_telemetry

# Set up logging to stdout and optionally to file
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("sync_service")

def main():
    logger.info("Initializing GeoMon Telemetry Sync Scheduler...")
    
    # Check arguments
    run_loop = "--loop" in sys.argv
    
    if run_loop:
        logger.info("Running sync service in persistent loop mode (Interval: 1 hour).")
        while True:
            try:
                sync_mssql_telemetry()
            except Exception as e:
                logger.error(f"Error occurred during telemetry sync: {e}")
            logger.info("Sleeping for 1 hour before next sync cycle...")
            time.sleep(3600)
    else:
        logger.info("Running sync service in single-execution mode.")
        try:
            sync_mssql_telemetry()
            logger.info("Telemetry sync execution completed successfully.")
        except Exception as e:
            logger.error(f"Telemetry sync failed: {e}")
            sys.exit(1)

if __name__ == "__main__":
    main()
