import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
from new_features.backend.migrations import get_connection

load_dotenv()

def seed_telemetry():
    print("Connecting to Central Telemetry Database...")
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        # Clear existing telemetry sizes to start fresh
        print("Clearing historical size registries...")
        cur.execute("DELETE FROM database_size_history;")
        cur.execute("DELETE FROM table_size_history;")
        conn.commit()
        
        clients_data = {
            "Artfine": {
                "dbs": {
                    "artfine_prod": {
                        "base_size": 35 * 1024 * 1024 * 1024, # 35 GB
                        "growth_per_day": 340 * 1024 * 1024, # 340 MB
                        "tables": {
                            "orders": {"base_size": 18 * 1024 * 1024 * 1024, "growth": 210 * 1024 * 1024},
                            "payments": {"base_size": 12 * 1024 * 1024 * 1024, "growth": 90 * 1024 * 1024},
                            "users": {"base_size": 5 * 1024 * 1024 * 1024, "growth": 40 * 1024 * 1024}
                        }
                    },
                    "artfine_reporting": {
                        "base_size": 115 * 1024 * 1024 * 1024, # 115 GB
                        "growth_per_day": 850 * 1024 * 1024, # 850 MB
                        "tables": {
                            "audit_log": {"base_size": 75 * 1024 * 1024 * 1024, "growth": 610 * 1024 * 1024},
                            "event_stream": {"base_size": 40 * 1024 * 1024 * 1024, "growth": 240 * 1024 * 1024}
                        }
                    }
                }
            },
            "Runloyal": {
                "dbs": {
                    "runloyal_mysql": {
                        "base_size": 185 * 1024 * 1024 * 1024, # 185 GB
                        "growth_per_day": 1.2 * 1024 * 1024 * 1024, # 1.2 GB
                        "tables": {
                            "booking_logs": {"base_size": 110 * 1024 * 1024 * 1024, "growth": 820 * 1024 * 1024},
                            "pet_profiles": {"base_size": 55 * 1024 * 1024 * 1024, "growth": 310 * 1024 * 1024},
                            "customer_auth": {"base_size": 20 * 1024 * 1024 * 1024, "growth": 70 * 1024 * 1024}
                        }
                    }
                }
            },
            "Intentwise": {
                "dbs": {
                    "amazon_advertising": {
                        "base_size": 1.8 * 1024 * 1024 * 1024 * 1024, # 1.8 TB
                        "growth_per_day": 18.5 * 1024 * 1024 * 1024, # 18.5 GB
                        "tables": {
                            "public.campaign_metrics": {"base_size": 1.2 * 1024 * 1024 * 1024 * 1024, "growth": 12.4 * 1024 * 1024 * 1024},
                            "public.keyword_reports": {"base_size": 600 * 1024 * 1024 * 1024, "growth": 6.1 * 1024 * 1024 * 1024}
                        }
                    }
                }
            },
            "Shemaroo": {
                "dbs": {
                    "shemaroo_mongo": {
                        "base_size": 420 * 1024 * 1024 * 1024, # 420 GB
                        "growth_per_day": 4.6 * 1024 * 1024 * 1024, # 4.6 GB
                        "tables": {
                            "media_catalog": {"base_size": 280 * 1024 * 1024 * 1024, "growth": 3.1 * 1024 * 1024 * 1024},
                            "user_activities": {"base_size": 140 * 1024 * 1024 * 1024, "growth": 1.5 * 1024 * 1024 * 1024}
                        }
                    }
                }
            }
        }
        
        today = datetime.now().date()
        inserted_db = 0
        inserted_tbl = 0
        
        # Seed 7 days of daily records (from 6 days ago up to today)
        for day_offset in range(6, -1, -1):
            target_date = today - timedelta(days=day_offset)
            
            for client_name, client_conf in clients_data.items():
                for db_name, db_conf in client_conf["dbs"].items():
                    # Calculate cumulative daily size
                    db_daily_size = int(db_conf["base_size"] + (6 - day_offset) * db_conf["growth_per_day"])
                    
                    cur.execute("""
                        INSERT INTO database_size_history (server_name, database_name, total_size_bytes, captured_date)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (server_name, database_name, captured_date) DO NOTHING;
                    """, (client_name, db_name, db_daily_size, target_date))
                    inserted_db += 1
                    
                    for tbl_name, tbl_conf in db_conf["tables"].items():
                        tbl_daily_size = int(tbl_conf["base_size"] + (6 - day_offset) * tbl_conf["growth"])
                        
                        cur.execute("""
                            INSERT INTO table_size_history (server_name, database_name, table_name, size_bytes, captured_date)
                            VALUES (%s, %s, %s, %s, %s)
                            ON CONFLICT (server_name, database_name, table_name, captured_date) DO NOTHING;
                        """, (client_name, db_name, tbl_name, tbl_daily_size, target_date))
                        inserted_tbl += 1
                        
        conn.commit()
        print(f"\nSeeding Successful! Inserted {inserted_db} Database size records and {inserted_tbl} Table size records across 7 days!")
        
    except Exception as e:
        print("Seeding transaction rolled back due to error:", e)
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    seed_telemetry()
