import os
import bcrypt
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    host = os.getenv("DB_HOST", "localhost")
    database = os.getenv("DB_NAME", "geomon")
    user = os.getenv("DB_USER", "postgres")
    port = os.getenv("DB_PORT", "5432")
    password = os.getenv("DB_PASSWORD", "2025")
    
    return psycopg2.connect(
        host=host,
        database=database,
        user=user,
        password=password,
        port=port
    )

def create_users():
    print("Initializing test users in PostgreSQL (with conflict clearing)...")
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()

        # Clean existing test accounts to avoid unique constraint violations
        cur.execute("""
            DELETE FROM users WHERE username IN ('admin', 'testuser') OR email IN ('admin@geomon.com', 'testuser@geomon.com');
        """)
        cur.execute("""
            DELETE FROM system_admins WHERE email IN ('admin@geomon.com', 'testuser@geomon.com');
        """)
        cur.execute("""
            DELETE FROM leads WHERE email IN ('admin@geomon.com', 'testuser@geomon.com');
        """)
        conn.commit()

        # Credentials definitions
        users_to_create = [
            {
                "username": "admin",
                "email": "admin@geomon.com",
                "password": "adminpassword",
                "full_name": "Local Test Admin",
                "role": "admin",
                "is_admin_email": True,
                "technology": "Global"
            },
            {
                "username": "testuser",
                "email": "testuser@geomon.com",
                "password": "userpassword",
                "full_name": "Local Test User",
                "role": "user",
                "is_admin_email": False,
                "technology": "MySQL"
            }
        ]

        for u in users_to_create:
            hashed_pwd = bcrypt.hashpw(u["password"].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            # 1. Insert in 'users' table
            cur.execute("""
                INSERT INTO users (username, hashed_password, full_name, email, role)
                VALUES (%s, %s, %s, %s, %s);
            """, (u["username"], hashed_pwd, u["full_name"], u["email"], u["role"]))

            # 2. Insert in 'system_admins' table if admin
            if u["is_admin_email"]:
                cur.execute("""
                    INSERT INTO system_admins (email, status)
                    VALUES (%s, 'active')
                    ON CONFLICT (email) DO NOTHING;
                """, (u["email"],))
            
            # 3. Setup technology access permissions in 'leads' to bypass access restrictions
            # Standard user needs to be in 'leads' with status = 'active'
            cur.execute("""
                INSERT INTO leads (email, technology, status)
                VALUES (%s, %s, 'active');
            """, (u["email"], u["technology"]))
                
        conn.commit()
        print("\nSUCCESS: Local test users provisioned successfully!")
        print("-" * 50)
        print("👤 ADMIN USER:")
        print("   • Username: admin")
        print("   • Password: adminpassword")
        print("   • Email:    admin@geomon.com")
        print("   • Role:     Administrator")
        print("-" * 50)
        print("👤 STANDARD USER:")
        print("   • Username: testuser")
        print("   • Password: userpassword")
        print("   • Email:    testuser@geomon.com")
        print("   • Role:     User (Access verified for all dashboard features)")
        print("-" * 50)
    except Exception as e:
        print("Error provisioning local test users:", e)
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    create_users()
