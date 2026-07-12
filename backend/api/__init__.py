# backend/api/__init__.py
from fastapi import APIRouter
from api import auth, logs, tickets, telemetry, users, clients, reports

api_router = APIRouter()
api_router.include_router(auth.router,      prefix="/api/auth",      tags=["Auth"])
api_router.include_router(logs.router,      prefix="/api/logs",      tags=["Logs"])
api_router.include_router(tickets.router,   prefix="/api/tickets",   tags=["Tickets"])
api_router.include_router(telemetry.router, prefix="/api/telemetry", tags=["Telemetry"])
api_router.include_router(users.router,     prefix="/api/users",     tags=["Users"])
api_router.include_router(clients.router,   prefix="/api/clients",   tags=["Clients"])
api_router.include_router(reports.router,   prefix="/api/reports",   tags=["Reports"])
