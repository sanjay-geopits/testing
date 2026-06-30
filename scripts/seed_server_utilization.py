import os
import random
from datetime import datetime, timedelta
from dotenv import load_dotenv
from new_features.backend.migrations import get_connection

load_dotenv()

def seed_server_utilization():
    print("Connecting to Central Telemetry Database...")
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        # Clear existing server utilization data
        print("Clearing historical server utilization registries...")
        cur.execute("DELETE FROM server_utilization_history;")
        conn.commit()
        servers = [
            # Cnergee
            "172.17.1.1", "172.17.1.11", "172.17.1.2",
            # Credopay
            "MARSPRODDB-01", "vm-cp-dr-marsdb",
            # Cropin
            "WSFCNODE1", "WSFCNODE2", "productionmysql-new",
            # Geojit
            "DRP-BOSRV03", "DRP-BOSRV04", "DRP-DIST03", "DRP-FLIPDB03", "DRP-FLIPDB04",
            # HPCL
            "AADHARVAULTDBHA\\ADVHA", "CDCMSPRODDB1\\HPGASPRODDB1", "CDCMSPRODDB2\\HPGASPRODDB2", "CDCMSPRODDB5\\HPGASPRODDB5", "CDCMSPRODDB6\\HPGASPRODDB6", "CDCMSPRODDB7\\HPGASPRODDB7",
            # Intentwise
            "amsservice2", "amsservice2_pi_system", "amsservice2_snapshots_final", "amsservice2_snapshots_raw",
            # Pepper Advantage
            "prod-lg-ci-mssql-mi-1.8b554cd229a5.database.windows.net",
            # RetailScan
            "EC2AMAZ-IC6PG05",
            # RunLoyal
            "restart_events", "rl-prod-cluster-instance-1", "rl-prod-cluster-instance-1-reader", "rl-prod-cluster-instance-1-reader-2", "rl-uat-dbcluster", "snapshot_inventory",
            # Shemaroo
            "EC2AMAZ-A1O1M2J",
            # Fallbacks / Other Clients
            "Artfine", "360tf", "Flowglobal", "VisibleTestClient"
        ]
        
        # We will generate hourly data for the last 7 days
        # 7 days * 24 hours = 168 hours of data points per server
        now = datetime.now()
        start_time = now - timedelta(days=7)
        
        # Base disk utilization per server to show gradual growth
        server_base_disk = {
            "172.17.1.1": 33.8,
            "172.17.1.11": 35.0,
            "172.17.1.2": 32.5,
            "MARSPRODDB-01": 47.3,
            "vm-cp-dr-marsdb": 45.0,
            "WSFCNODE1": 51.6,
            "WSFCNODE2": 52.0,
            "productionmysql-new": 50.5,
            "DRP-BOSRV03": 60.0,
            "DRP-BOSRV04": 62.0,
            "DRP-DIST03": 58.0,
            "DRP-FLIPDB03": 65.0,
            "DRP-FLIPDB04": 64.0,
            "Artfine": 42.5,
            "360tf": 59.9,
            "Flowglobal": 29.4,
            "Shemaroo": 55.1,
            "Intentwise": 81.4
        }
        
        inserted_count = 0
        
        print("Generating 7 days of hourly performance metrics...")
        for server in servers:
            base_disk = server_base_disk.get(server, 50.0)
            
            for hour_offset in range(168):
                captured_at = start_time + timedelta(hours=hour_offset)
                hour_of_day = captured_at.hour
                day_of_week = captured_at.weekday() # 0 is Monday, 6 is Sunday
                
                # 1. CPU Utilization (Day/Night pattern + Business hour peaks + Weekend lower activity)
                is_weekend = day_of_week >= 5
                
                # Base load
                if is_weekend:
                    base_cpu = 10.0 + random.uniform(5.0, 15.0) # 15-25%
                else:
                    if 9 <= hour_of_day <= 18: # Work hours (9 AM - 6 PM)
                        base_cpu = 45.0 + random.uniform(15.0, 30.0) # 60-75%
                    else: # Off-work hours
                        base_cpu = 15.0 + random.uniform(10.0, 20.0) # 25-35%
                        
                # Add random noise/spikes
                if random.random() < 0.05: # 5% chance of a high load spike
                    cpu = min(98.5, base_cpu + random.uniform(15.0, 25.0))
                else:
                    cpu = max(5.0, min(95.0, base_cpu + random.uniform(-5.0, 5.0)))
                    
                # 2. Memory Utilization (Fairly stable, slight day rise, some leaks reset periodically)
                base_mem = 55.0 + (hour_offset % 48) * 0.15 # Simulate a tiny memory leak reset every 2 days
                if 9 <= hour_of_day <= 18 and not is_weekend:
                    mem_active = random.uniform(5.0, 12.0)
                else:
                    mem_active = random.uniform(0.0, 4.0)
                mem = min(94.2, base_mem + mem_active)
                
                # 3. Disk Utilization (Slowly and steadily increasing over the week)
                # Max growth of ~0.5% over the 7 days
                disk_growth = (hour_offset / 168.0) * random.uniform(0.3, 0.8)
                disk = min(99.0, base_disk + disk_growth + random.uniform(-0.05, 0.05))
                
                # 4. I/O Utilization (IOPS Saturation % based on work hours and batch processes at night)
                if is_weekend:
                    base_io = 8.0 + random.uniform(2.0, 8.0)
                else:
                    if 9 <= hour_of_day <= 18:
                        base_io = 35.0 + random.uniform(15.0, 30.0) # Daytime active read/writes
                    elif 1 <= hour_of_day <= 3: # 1 AM - 3 AM nightly batch jobs
                        base_io = 60.0 + random.uniform(15.0, 25.0)
                    else:
                        base_io = 10.0 + random.uniform(5.0, 10.0)
                io = max(2.0, min(96.0, base_io + random.uniform(-4.0, 4.0)))
                
                # Round values to 2 decimal places
                cpu = round(cpu, 2)
                mem = round(mem, 2)
                disk = round(disk, 2)
                io = round(io, 2)
                
                cur.execute("""
                    INSERT INTO server_utilization_history (server_name, cpu_utilization, memory_utilization, disk_utilization, io_utilization, captured_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (server_name, captured_at) DO NOTHING;
                """, (server, cpu, mem, disk, io, captured_at))
                inserted_count += 1
                
        conn.commit()
        print(f"Seeding Successful! Inserted {inserted_count} Server Utilization logs across 7 days hourly!")
        
    except Exception as e:
        print("Seeding transaction rolled back due to error:", e)
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    seed_server_utilization()
