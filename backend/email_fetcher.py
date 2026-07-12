from services.email_fetcher import *
if __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.INFO)
    sync_mssql_telemetry()
