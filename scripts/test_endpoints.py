import os
import requests
from dotenv import load_dotenv

load_dotenv()

# We can bypass auth check or login as admin first to get the token
def test_backend_telemetry():
    print("==========================================")
    print("   TESTING BACKEND TELEMETRY ENDPOINTS")
    print("==========================================")
    
    # 1. Log in to get token
    login_url = "http://localhost:8000/api/login"
    login_data = {
        "username": "admin",
        "password": "adminpassword"
    }
    
    try:
        r = requests.post(login_url, data=login_data, timeout=5)
        if r.status_code != 200:
            print(f"Login failed ({r.status_code}): {r.text}")
            return
        
        token = r.json().get("access_token")
        print("✓ Authenticated successfully! Token acquired.")
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Get Telemetry Clients list
        url_clients = "http://localhost:8000/api/new-features/telemetry/clients"
        r = requests.get(url_clients, headers=headers, timeout=5)
        if r.status_code == 200:
            print(f"✓ Clients endpoint: {r.json()}")
        else:
            print(f"✗ Clients endpoint failed ({r.status_code}): {r.text}")
            
        # 3. Get Telemetry Databases for Artfine
        url_dbs = "http://localhost:8000/api/new-features/telemetry/databases/Artfine"
        r = requests.get(url_dbs, headers=headers, timeout=5)
        if r.status_code == 200:
            data = r.json()
            print("✓ Databases endpoint returned successfully.")
            for db in data.get("databases", []):
                print(f"  • DB: {db['database_name']} | Size: {db['latest_size']} bytes | 7D Growth: {db['growth_bytes']} bytes ({db['growth_pct']}%)")
        else:
            print(f"✗ Databases endpoint failed ({r.status_code}): {r.text}")
            
        # 4. Get Telemetry Tables for Artfine
        url_tbls = "http://localhost:8000/api/new-features/telemetry/tables/Artfine"
        r = requests.get(url_tbls, headers=headers, timeout=5)
        if r.status_code == 200:
            data = r.json()
            print("✓ Tables endpoint returned successfully.")
            for tbl in data.get("tables", []):
                print(f"  • Table: {tbl['table_name']} (DB: {tbl['database_name']}) | Size: {tbl['latest_size']} bytes | Growth: {tbl['growth_bytes']} bytes")
        else:
            print(f"✗ Tables endpoint failed ({r.status_code}): {r.text}")
            
        # 5. Get Telemetry Chart data for artfine_prod database
        url_chart = "http://localhost:8000/api/new-features/telemetry/database-detail-chart?client_name=Artfine&database_name=artfine_prod"
        r = requests.get(url_chart, headers=headers, timeout=5)
        if r.status_code == 200:
            data = r.json()
            print(f"✓ Chart endpoint returned {len(data.get('chart_data', []))} historical data points.")
        else:
            print(f"✗ Chart endpoint failed ({r.status_code}): {r.text}")

    except Exception as e:
        print(f"Exception during testing: {e}")

if __name__ == "__main__":
    test_backend_telemetry()
