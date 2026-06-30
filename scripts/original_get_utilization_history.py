"@router.get("/telemetry/utilization/history")
def get_utilization_history(
    client_name: str,
    server_name: Optional[str] = None,
    db_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
 
<truncated 12133 bytes>