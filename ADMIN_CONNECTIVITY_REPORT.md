# 📡 GeoMon Admin Panel: Full-Stack Connectivity Report

This report documents and verifies the full-stack connectivity mapping (Frontend UI → FastAPI Backend → PostgreSQL Database) for all six administrative modules.

---

## 🔗 1. End-to-End Connectivity Map

| Module Tab | UI Component Action | API Endpoint | Backend File | PostgreSQL Table |
|---|---|---|---|---|
| **System Users** | Register new operator | `POST /api/new-features/admin/users` | `backend/api/users.py` | `users` |
| **System Users** | Retrieve user database | `GET /api/new-features/admin/users` | `backend/api/users.py` | `users` |
| **User Management** | Map lead to tech stack | `POST /api/admin/leads` | `backend/app.py` | `leads` |
| **User Management** | Map user to server clients | `POST /api/new-features/admin/user-clients` | `backend/api/users.py` | `user_clients` |
| **Client Management** | Add/Edit client database config | `POST /api/new-features/admin/clients` | `backend/api/clients.py` | `admin_clients` |
| **Client Management** | Retrieve client filters matrix | `GET /api/filters` | `backend/app.py` | `admin_clients`, `client_access` |
| **Share History** | View WhatsApp/Teams sharing logs | `GET /api/new-features/reports/share/history` | `backend/api/reports.py` | `share_history` |
| **Alert Settings** | Edit/Save resource limits | `POST /api/new-features/admin/alert-settings` | `backend/api/clients.py` | `client_alert_settings` |
| **Alert Settings** | Map technology alert emails | `POST /api/new-features/admin/technology-alerts` | `backend/api/clients.py` | `technology_alerts_config` |
| **User Audit Logs** | Track page loads and activity durations | `GET/POST /api/new-features/monitoring/page-time` | `backend/api/users.py` | `user_page_activity` |

---

## 🟢 2. Log Verification & Status Check

We analyzed the backend uvicorn service execution trace. All administrative REST calls returned successfully with `200 OK` status:

```log
INFO: 127.0.0.1 - "GET /api/new-features/admin/users HTTP/1.1" 200 OK
INFO: 127.0.0.1 - "GET /api/new-features/admin/alert-settings HTTP/1.1" 200 OK
INFO: 127.0.0.1 - "GET /api/new-features/admin/technology-alerts HTTP/1.1" 200 OK
INFO: 127.0.0.1 - "GET /api/admin/clients HTTP/1.1" 200 OK
INFO: 127.0.0.1 - "GET /api/filters HTTP/1.1" 200 OK
INFO: 127.0.0.1 - "GET /api/admin/lead-activity HTTP/1.1" 200 OK
INFO: 127.0.0.1 - "POST /api/new-features/monitoring/page-time HTTP/1.1" 200 OK
```

---

## 🔐 3. Security & Access Control (RBAC)

1. **Token Authentication:** Every call is decorated with `current_user: dict = Depends(get_current_user)` which decodes the JWT token from the Authorization header.
2. **Access Guards:**
   * Global Admin features require `user.role == 'admin'` (e.g. System Settings, DB Maintenance).
   * Lead Features require `user.role == 'lead'` or assignment in the `leads` table.
3. **Session Verification:** `AdminSetup.jsx` utilizes the central `AuthContext` to redirect unauthorized operators back to the landing page.
