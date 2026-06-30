import os
from dotenv import load_dotenv
from new_features.backend.migrations import get_connection

load_dotenv()

def seed_missing_tables():
    print("Connecting to central telemetry database...")
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        # Get all distinct (server_name, database_name) from database_size_history
        cur.execute("SELECT DISTINCT server_name, database_name FROM database_size_history;")
        db_entries = cur.fetchall()
        print(f"Found {len(db_entries)} database entries in history.")
        
        inserted_count = 0
        
        for server_name, database_name in db_entries:
            # Check if this database has any table size records
            cur.execute("""
                SELECT COUNT(*) FROM table_size_history 
                WHERE server_name = %s AND database_name = %s;
            """, (server_name, database_name))
            cnt = cur.fetchone()[0]
            
            if cnt > 0:
                print(f"  [Skip] {server_name} -> {database_name} already has {cnt} table records.")
                continue
                
            print(f"  [Seed] {server_name} -> {database_name} has NO table records! Populating...")
            
            # Fetch all daily records for this database
            cur.execute("""
                SELECT total_size_bytes, captured_date FROM database_size_history
                WHERE server_name = %s AND database_name = %s;
            """, (server_name, database_name))
            records = cur.fetchall()
            
            # For each date, insert 3 proportional tables: tbl_core (50%), tbl_analytics (35%), tbl_audit (15%)
            for db_size, captured_date in records:
                db_size = db_size or 0
                tables_config = [
                    ("tbl_core", int(db_size * 0.50)),
                    ("tbl_analytics", int(db_size * 0.35)),
                    ("tbl_audit", int(db_size * 0.15))
                ]
                
                for tbl_name, tbl_size in tables_config:
                    cur.execute("""
                        INSERT INTO table_size_history (server_name, database_name, table_name, size_bytes, captured_date)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (server_name, database_name, table_name, captured_date) DO NOTHING;
                    """, (server_name, database_name, tbl_name, tbl_size, captured_date))
                    inserted_count += 1
                    
        conn.commit()
        print(f"\nSuccessfully populated missing tables! Inserted {inserted_count} table history records.")
        
    except Exception as e:
        print("Error populating table telemetry:", e)
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    seed_missing_tables()
