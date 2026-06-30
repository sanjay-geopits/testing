import os
from dotenv import load_dotenv

load_dotenv()

APP_CLIENT = os.getenv("APP_CLIENT")
APP_SECRET = os.getenv("APP_SECRET")
APP_TENANT = os.getenv("APP_TENANT")
USER_EMAIL = os.getenv("USER_EMAIL")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_NAME = os.getenv("DB_NAME", "Incoming-error-data")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "y7UMhWmLcqSJzmhTGDyK")
DB_PORT = os.getenv("DB_PORT", "5432")
