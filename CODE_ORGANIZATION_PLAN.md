# 📐 GeoMon Architecture & Code Organization Plan

This guide outlines the architectural blueprint, refactoring roadmap, and best practices to ensure that the **GeoMon** codebase is clean, performant, scalable, and highly expandable.

---

## 📂 1. Directory Structure Blueprint

To maintain a clean division of responsibilities, we will organize the project into distinct, decoupled packages.

### Backend Reorganization:
```
backend/
├── api/                    # 🚀 Route Handlers (FastAPI Routers)
│   ├── __init__.py         # Imports and exposes api_router
│   ├── auth.py             # User authentication, Microsoft SSO OAuth
│   ├── clients.py          # Client registration and env routes
│   ├── logs.py             # Telemetry log filtering, detail, & bulk actions
│   ├── reports.py          # Report document storage, metadata, and sharing
│   ├── telemetry.py        # CPU, Mem, Disk, IO metrics endpoints
│   ├── tickets.py          # Ticket CRUD operations and comments
│   ├── users.py            # Operator list, profile updates, page tracking
│   ├── scheduler.py        # [New Module] Ingestion cron controls
│   └── observability.py    # [New Module] Server status overview and health metrics
│
├── core/                   # ⚙️ Core Infrastructure
│   ├── config.py           # Configuration manager and environment values
│   ├── database.py         # Threaded DB connection pool manager
│   ├── deps.py             # JWT token dependencies, role checkers
│   ├── security.py         # Bcrypt hashing & OAuth helper utilities
│   └── dao.py              # Data Access Object (DAO) query layer
│
├── services/               # 🔄 Decoupled Background Workers
│   ├── alert_threshold_service.py   # CPU/Mem threshold loop checks
│   ├── email_extracter.py           # Inbound telemetry mail parsing
│   ├── email_service.py             # Outbound alert/report dispatch
│   └── utilization_sync.py          # Utilization log synchronizer
│
├── parsers/                # 📝 Ingestion Parsers
│   ├── json_parser.py               # Telemetry email JSON extractor
│   ├── severity_classifier.py       # Log message severity classifier
│   └── subject_parser.py            # Subject string metadata parser
│
└── app.py                  # 🏁 Core Application Entrypoint (Thin Bootstrapper)
```

---

## 🛠️ 2. Step-by-Step Refactoring Roadmap

### Phase 1: Route Decoupling (Reducing `app.py`)
Currently, `app.py` is an oversized monolith containing direct route mappings. We will migrate them to separate routers:

1. **Extract Scheduler Controls:** Create `backend/api/scheduler.py` and move endpoints like `/api/admin/scheduler/*` and `/api/admin/scheduler/daily-alerts/*` there.
2. **Extract Observability & Health:** Create `backend/api/observability.py` and move `/api/observability/overview` and `/api/observability/client-health` there.
3. **Register Routers in `backend/api/__init__.py`:**
   ```python
   from api import scheduler, observability
   api_router.include_router(scheduler.router, prefix="/api/admin/scheduler", tags=["Scheduler"])
   api_router.include_router(observability.router, prefix="/api/observability", tags=["Observability"])
   ```
4. **Bootstrapping `app.py`:** Clean up `app.py` so it only initializes the FastAPI app, registers CORSMiddleware, mount static directories, and imports `api_router`.

### Phase 2: Database Layer Abstraction (Using `dao.py`)
All endpoints in `backend/api/` should avoid raw cursor executes and delegate to functions in `core/dao.py`.

* **Raw SQL pattern (Avoid):**
  ```python
  cur.execute("SELECT * FROM users WHERE id = %s;", (user_id,))
  ```
* **DAO pattern (Adopt):**
  ```python
  from core import dao
  user = dao.get_user_by_id(cur, user_id)
  ```

---

## 🚀 3. Guidelines for Adding New API Routes

When adding new routes (e.g. under `backend/api/`), follow this standard pattern to ensure expandability:

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core.database import get_connection
from core.deps import get_current_user
from core import dao

router = APIRouter()

class ItemRequest(BaseModel):
    name: str
    value: float

@router.post("/new-feature")
def create_item(req: ItemRequest, user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # 1. Use the DAO layer
            new_id = dao.create_telemetry_item(cur, req.name, req.value, user["username"])
            conn.commit()
            return {"id": new_id, "status": "success"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
```

---

## ⚡ 4. Frontend Componentization Guidelines

Currently, pages like `TicketsHub.jsx` and `ReportsHub.jsx` are monolithic and contain thousands of lines. 

### Recommended Action Plan:
1. **Deconstruct layout elements:** Split pages into small, stateless presentational components in a dedicated subdirectory (e.g., `frontend/src/components/tickets/`).
   * `TicketListTable.jsx` (displays rows and pagination controls)
   * `TicketCommentSection.jsx` (displays thread list and comment form)
   * `TicketFilterHeader.jsx` (dropdown filters and search)
2. **Container-Presenter Pattern:** Keep state management, API data fetching, and sidebar hooks in `TicketsHub.jsx` and pass the state down to these sub-components via props.
3. **Benefits:** Decreases compile times, improves reuse, and permits independent UI changes without risk of affecting unrelated sections.
