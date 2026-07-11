def parse_subject(subject):
    if not subject:
        return None, None, None, "generic"
    
    import re
    
    subject = re.sub(r'^(?:fw|re|fwd|vs|fwd|aw|wg|rv):\s*', '', subject, flags=re.IGNORECASE).strip()
    
    # Normalize "MAX Healthcare" space variations to Maxhealthcare
    subject = re.sub(r'MAX\s+Healthcare', 'Maxhealthcare', subject, flags=re.IGNORECASE)
    subject = re.sub(r'Max\s+Healthcare', 'Maxhealthcare', subject, flags=re.IGNORECASE)
    subject = re.sub(r'MAXHealthcare', 'Maxhealthcare', subject, flags=re.IGNORECASE)

    # Match Azure Alerts format: Azure: Activated Severity: 3 percentage cpu - prod-lg-ci-ocr-worker-server-stands-vm-1
    azure_match = re.search(r'Azure:\s*(Activated|Deactivated)\s+Severity:\s*(\d+)\s+([^-\n]+)\s*-\s*([a-zA-Z0-9_\-\.]+)', subject, re.IGNORECASE)
    if azure_match:
        status_word = azure_match.group(1).strip() # Activated or Deactivated
        metric_name = azure_match.group(3).strip() # percentage cpu, etc.
        server_name = azure_match.group(4).strip()
        
        # Resolve client based on server name substrings
        server_lower = server_name.lower()
        client_name = "Unknown"
        if "lg" in server_lower or "pepper" in server_lower:
            client_name = "Pepper Advantage"
        elif "retailscan" in server_lower:
            client_name = "Retailscan"
        elif "cropin" in server_lower:
            client_name = "Cropin"
        elif "credopay" in server_lower or "marsdb" in server_lower:
            client_name = "CredoPay"
        elif "geojit" in server_lower or "bosrv" in server_lower or "flipdb" in server_lower:
            client_name = "Geojit"
        elif "shemaroo" in server_lower:
            client_name = "Shemaroo"
        elif "hpcl" in server_lower:
            client_name = "HPCL"
        elif "maxhealthcare" in server_lower:
            client_name = "Maxhealthcare"
            
        return client_name, server_name, "MSSQL", "mssql_alert"

    if "percentage cpu" in subject.lower() or "cpu alert" in subject.lower():
        # Try to extract server name after a hyphen
        parts = subject.split("-")
        server_name = parts[-1].strip() if len(parts) > 1 else "Unknown"
        # Extract client from server name
        server_lower = server_name.lower()
        client_name = "Unknown"
        if "lg" in server_lower or "pepper" in server_lower:
            client_name = "Pepper Advantage"
        elif "retailscan" in server_lower:
            client_name = "Retailscan"
        elif "cropin" in server_lower:
            client_name = "Cropin"
        elif "credopay" in server_lower or "marsdb" in server_lower:
            client_name = "CredoPay"
        elif "geojit" in server_lower or "bosrv" in server_lower or "flipdb" in server_lower:
            client_name = "Geojit"
        elif "shemaroo" in server_lower:
            client_name = "Shemaroo"
        elif "hpcl" in server_lower:
            client_name = "HPCL"
        elif "maxhealthcare" in server_lower:
            client_name = "Maxhealthcare"
            
        return client_name, server_name, "MSSQL", "mssql_alert"

    # Match format: Maxhealthcare BLR-MAX-SUNDB DBA_GeoPITS_LongRunningQueries_Closed Failed Alert -> Open
    job_alert_match = re.search(r'^([a-zA-Z0-9_\-]+)\s+([a-zA-Z0-9_\-]+)\s+([a-zA-Z0-9_\-]+)\s+(Failed Alert|Job Failure Alert|Failed Job Success Alert|Alert)\s*->\s*([a-zA-Z0-9_\-]+)', subject, re.IGNORECASE)
    if job_alert_match:
        client_name = job_alert_match.group(1).strip()
        server_name = job_alert_match.group(2).strip()
        if "maxhealthcare" in client_name.lower():
            client_name = "Maxhealthcare"
        return client_name, server_name, "MSSQL", "mssql_alert"

    # Match format: GEOJIT DRP-BOSRV04 - Long Running Queries: Open
    # Or GEOJIT DRP-BOSRV04 - Open Transaction Alert: Open
    alert_match = re.search(r'^([a-zA-Z0-9_\-]+)\s+([a-zA-Z0-9_\-]+)\s*-\s*([^:]+)\s*:\s*([a-zA-Z0-9_\-]+)', subject, re.IGNORECASE)
    if alert_match:
        client_name = alert_match.group(1).strip()
        server_name = alert_match.group(2).strip()
        alert_name = alert_match.group(3).strip()
        
        c_lower = client_name.lower()
        if "geojit" in c_lower:
            client_name = "Geojit"
        elif "credopay" in c_lower:
            client_name = "CredoPay"
        elif "cropin" in c_lower:
            client_name = "Cropin"
        elif "retailscan" in c_lower:
            client_name = "Retailscan"
        else:
            client_name = client_name.title()
            
        if "long running" in alert_name.lower() or "transaction" in alert_name.lower() or "mssql" in alert_name.lower() or "alert" in alert_name.lower():
            return client_name, server_name, "MSSQL", "mssql_alert"

    # Match format without colon: GEOJIT DRP-BOSRV04 - Long Running Queries
    alert_match2 = re.search(r'^([a-zA-Z0-9_\-]+)\s+([a-zA-Z0-9_\-]+)\s*-\s*(Long Running Queries|Open Transaction Alert|MSSQL Alert)', subject, re.IGNORECASE)
    if alert_match2:
        client_name = alert_match2.group(1).strip()
        server_name = alert_match2.group(2).strip()
        
        c_lower = client_name.lower()
        if "geojit" in c_lower:
            client_name = "Geojit"
        elif "credopay" in c_lower:
            client_name = "CredoPay"
        elif "cropin" in c_lower:
            client_name = "Cropin"
        elif "retailscan" in c_lower:
            client_name = "Retailscan"
        else:
            client_name = client_name.title()
            
        return client_name, server_name, "MSSQL", "mssql_alert"

    # Match format "[DBType Status] Client — Status | Date"
    status_match = re.search(r'\[(MySQL|PostgreSQL|MongoDB|MSSQL) Status\]\s*([a-zA-Z0-9_\s-]+)\s*[-—]\s*(ONLINE|OFFLINE)', subject, re.IGNORECASE)
    if status_match:
        db_type = status_match.group(1)
        raw_client = status_match.group(2).strip()
        
        c_lower = raw_client.lower()
        if c_lower == "amazon":
            client_name = "Intentwise"
            server_name = "Intentwise"
        elif "shemaroo" in c_lower:
            client_name = "Shemaroo"
            server_name = "Shemaroo"
        elif "retailscan" in c_lower:
            client_name = "Retailscan"
            server_name = "Retailscan"
        elif "cropin" in c_lower:
            client_name = "Cropin"
            server_name = "Cropin"
        elif "runloyal" in c_lower:
            client_name = "Runloyal"
            server_name = "Runloyal"
        elif "cnergee" in c_lower:
            client_name = "Cnergee"
            server_name = "Cnergee"
        elif "flowglobal" in c_lower:
            client_name = "Flowglobal"
            server_name = "Flowglobal"
        elif "360tf" in c_lower:
            client_name = "360tf"
            server_name = "360tf"
        elif "artfine" in c_lower:
            client_name = "Artfine"
            server_name = "Artfine"
        elif "intentwise" in c_lower:
            client_name = "Intentwise"
            server_name = "Intentwise"
        else:
            client_name = raw_client.title()
            server_name = client_name

        if db_type.lower() == "mysql":
            db_type = "MySQL"
        elif db_type.lower() == "postgresql":
            db_type = "PostgreSQL"
        elif db_type.lower() == "mongodb":
            db_type = "MongoDB"
        elif db_type.lower() == "mssql":
            db_type = "MSSQL"

        return client_name, server_name, db_type, "db_uptime"

    # Match format "[Client] - SQL Service Status Report - [Date]"
    if "sql service status report" in subject.lower():
        parts = re.split(r'\s*-\s*SQL Service Status Report\s*-\s*', subject, flags=re.IGNORECASE)
        if len(parts) >= 2:
            left_part = parts[0].strip()
            client_name = left_part
            c_lower = left_part.lower()
            if "shemaroo" in c_lower:
                client_name = "Shemaroo"
            elif "credopay" in c_lower:
                client_name = "CredoPay"
            elif "cropin" in c_lower:
                client_name = "Cropin"
            elif "retailscan" in c_lower:
                client_name = "Retailscan"
            elif "runloyal" in c_lower:
                client_name = "Runloyal"
            elif "cnergee" in c_lower:
                client_name = "Cnergee"
            elif "intentwise" in c_lower:
                client_name = "Intentwise"
            return client_name, None, "MSSQL", "db_uptime"

    if "RetailScan | EC2AMAZ-IC6PG05 | MSSQL | Windows Event Logs (Last 1 Hour)" in subject:
        return "Retailscan", "EC2AMAZ-IC6PG05", "MSSQL", "event_log"
    
    elif "Cropin-Node1 | WSFCNODE1 | MSSQL | Windows Event Logs (Last 1 Hour)" in subject:
        return "Cropin", "WSFCNODE1", "MSSQL", "event_log"
    
    elif "Cropin-Node2 | WSFCNODE2 | MSSQL | Windows Event Logs (Last 1 Hour)" in subject:
        return "Cropin", "WSFCNODE2", "MSSQL", "event_log"    

    elif "RetailScan | EC2AMAZ-IC6PG05 | MSSQL | SQL Agent Job Logs (Last 1 Hour)" in subject:
        return "Retailscan", "EC2AMAZ-IC6PG05", "MSSQL", "agent_log"
    
    elif "Cropin-Node1 | WSFCNODE1 | MSSQL | SQL Agent Job Logs (Last 1 Hour)" in subject:
        return "Cropin", "WSFCNODE1", "MSSQL", "agent_log"
    
    elif "Cropin-Node2 | WSFCNODE2 | MSSQL | SQL Agent Job Logs (Last 1 Hour)" in subject:
        return "Cropin", "WSFCNODE2", "MSSQL", "agent_log"

    elif "Pepper Adv | prod-lg-ci-mssql-mi-1.8b554cd229a5.database.windows.net | MSSQL | SQL Agent Job Logs (Last 1 Hour)" in subject:
        return "Pepper Advantage", "prod-lg-ci-mssql-mi-1.8b554cd229a5.database.windows.net", "MSSQL", "agent_log"

    elif "Shemaroo | EC2AMAZ-A1O1M2J | MSSQL | SQL Agent Job Logs (Last 1 Hour)" in subject:      
        return "Shemaroo", "EC2AMAZ-A1O1M2J", "MSSQL", "agent_log"  

    elif "Credopay-prod | MARSPRODDB-01 | MSSQL | SQL Agent Job Logs (Last 1 Hour)" in subject:
        return  "CredoPay", "MARSPRODDB-01", "MSSQL", "agent_log"   

    elif "Credopay-DR | vm-cp-dr-marsdb | MSSQL | SQL Agent Job Logs (Last 1 Hour)" in subject:
        return  "CredoPay", "vm-cp-dr-marsdb", "MSSQL", "agent_log" 

    elif "HPCL | CDCMSPRODDB1\\HPGASPRODDB1 | MSSQL | SQL Agent Job Logs (Last 1 Hour)" in subject:
        return "HPCL", "CDCMSPRODDB1\\HPGASPRODDB1", "MSSQL", "agent_log"  

    elif "Geojit-BOSRV03 | DRP-BOSRV03 | MSSQL | SQL Agent Job Logs (Last 1 Hour)" in subject:
        return "Geojit", "DRP-BOSRV03", "MSSQL", "agent_log"  

    elif "Geojit-FLIPDB04 | DRP-FLIPDB03 | MSSQL | SQL Agent Job Logs (Last 1 Hour)" in subject:
        return "Geojit", "DRP-FLIPDB03", "MSSQL", "agent_log" 

    elif "Geojit-FLIPDB03 | DRP-FLIPDB03 | MSSQL | SQL Agent Job Logs (Last 1 Hour)" in subject:
        return "Geojit", "DRP-FLIPDB03", "MSSQL", "agent_log" 
        
    elif "ChennaiSilks | centos7.linuxvmimages.com | Oracle | Agent Logs (Last 1 Hour)" in subject:
        return "ChennaiSilks","centos7.linuxvmimages.com","Oracle","agent_log"  

    elif "RetailScan | EC2AMAZ-IC6PG05 | MSSQL | Error Logs - Last 1 Hour" in subject:
        return "Retailscan", "EC2AMAZ-IC6PG05", "MSSQL", "error_log"
    
    elif "Cropin-Node1 | WSFCNODE1 | MSSQL | Error Logs - Last 1 Hour" in subject:
        return "Cropin", "WSFCNODE1", "MSSQL", "error_log"
    
    elif "Cropin-Node2 | WSFCNODE2 | MSSQL | Error Logs - Last 1 Hour" in subject:
        return "Cropin", "WSFCNODE2", "MSSQL", "error_log"

    elif "Pepper Adv | prod-lg-ci-mssql-mi-1.8b554cd229a5.database.windows.net | MSSQL | Error Logs - Last 1 Hour" in subject:
        return "Pepper Advantage", "prod-lg-ci-mssql-mi-1.8b554cd229a5.database.windows.net", "MSSQL", "error_log"  

    elif "Shemaroo | EC2AMAZ-A1O1M2J | MSSQL | Error Logs - Last 1 Hour" in subject:      
        return "Shemaroo", "EC2AMAZ-A1O1M2J", "MSSQL", "error_log"  

    elif "Credopay-prod | MARSPRODDB-01 | MSSQL | Error Logs - Last 1 Hour" in subject:
        return  "CredoPay", "MARSPRODDB-01", "MSSQL", "error_log"   

    elif "HPCL | CDCMSPRODDB1\\HPGASPRODDB1 | MSSQL | Error Logs - Last 1 Hour" in subject:
        return "HPCL", "CDCMSPRODDB1\\HPGASPRODDB1", "MSSQL", "error_log"    

    elif "Credopay-DR | vm-cp-dr-marsdb | MSSQL | Error Logs - Last 1 Hour" in subject:
        return  "CredoPay", "vm-cp-dr-marsdb", "MSSQL", "error_log" 

    elif "Geojit-BOSRV03 | DRP-BOSRV03 | MSSQL | Error Logs - Last 1 Hour" in subject:
        return "Geojit", "DRP-BOSRV03", "MSSQL", "error_log" 

    elif "Geojit-FLIPDB04 | DRP-FLIPDB03 | MSSQL | Error Logs - Last 1 Hour" in subject:
        return "Geojit", "DRP-FLIPDB03", "MSSQL", "error_log" 

    elif "Geojit-FLIPDB03 | DRP-FLIPDB03 | MSSQL | Error Logs - Last 1 Hour" in subject:
        return "Geojit", "DRP-FLIPDB03", "MSSQL", "error_log"    
        
    parts=[p.strip() for p in subject.split("|")]

    if len(parts) < 3:
        return None, None, None, "generic"

    client=parts[0]
    if client.startswith("Geojit-"):
        client = "Geojit"
    elif client.startswith("Cropin-") or client.startswith("CropIn-"):
        client = "Cropin"
    elif client.startswith("Credopay-") or client.lower().startswith("credopay"):
        client = "CredoPay"
    elif client.startswith("Pepper Adv"):
        client = "Pepper Advantage"

    server=parts[1]
    
    if len(parts) >= 4:
        db=parts[2]
        if db.lower() in ["mysql rds logs", "mysql rds"]:
            db = "MySQL"
        log_section=parts[3].lower()
    else:
        db="MSSQL" if "sql server" in subject.lower() else "N/A"
        log_section=parts[2].lower()

    if "windows event logs" in log_section:
        log_type="event_log"
    elif "sql agent job logs" in log_section:
        log_type="agent_log"
    elif "error logs" in log_section:
        log_type="error_log"
    else:
        # Define MSSQL report and diagnostic categories locally for classification
        report_cats = [
            (["CPU Utilization"], "cpu"),
            (["Memory Utilization"], "memory"),
            (["Restart Evidence"], "restart"),
            (["Backup Execution"], "backup"),
            (["Configuration Report"], "server"),
            (["Disk Drive Usage"], "disk_drive"),
            (["Size Growth Report", "Size & Grow", "Month Growth"], "size_growth"),
            (["Top 5 CPU Queries", "Top CPU"], "top_cpu"),
            (["Memory PLE"], "memory_ple"),
            (["Memory Snapshot"], "memory_snapshot"),
            (["CPU Daily Summary"], "cpu_daily_summary"),
            (["CPU Spike Analysis"], "cpu_spike_analysis")
        ]
        diag_cats = [
            (["Disk IO Latency", "Disk IO RCA", "Weekly Disk IO"], "disk_io"),
            (["Wait Statistics", "Wait Stats"], "wait_stats"),
            (["Long Running Queries"], "long_queries"),
            (["Deadlock"], "deadlocks"),
            (["TempDB Usage"], "tempdb"),
            (["Agent Job", "Job Failure"], "job_executions"),
            (["Blocking Sessions"], "blocking"),
            (["Error Logs"], "error_logs"),
            (["Top 10 CPU - Query Store", "Top 10 CPU Queries (IST)"], "cpu_querystore"),
            (["Top 10 Memory (Logical Reads) - Query Store", "Top 10 Memory Queries (IST)"], "mem_querystore")
        ]
        
        found_type = None
        for keywords, category_type in report_cats:
            if any(kw.lower() in log_section for kw in keywords):
                found_type = category_type
                break
        if not found_type:
            for keywords, category_type in diag_cats:
                if any(kw.lower() in log_section for kw in keywords):
                    found_type = category_type
                    break
                    
        if found_type:
            log_type = found_type
        else:
            return None, None, None, None

    if client:
        c_lower = client.lower()
        if c_lower == "retailscan":
            client = "Retailscan"
        elif c_lower == "credopay":
            client = "CredoPay"
        elif c_lower == "runloyal":
            client = "Runloyal"
        elif c_lower == "cnergee":
            client = "Cnergee"
        elif c_lower == "cropin":
            client = "Cropin"
        elif c_lower == "shemaroo":
            client = "Shemaroo"
        elif c_lower == "intentwise":
            client = "Intentwise"
        elif c_lower == "360tf":
            client = "360tf"
        elif c_lower == "artfine":
            client = "Artfine"
        elif c_lower == "maxhealthcare":
            client = "Maxhealthcare"

    return client, server, db, log_type

def is_valid_subject(subject):
    if not subject:
        return False
    
    subj_lower = subject.lower()
    if "long running queries" in subj_lower or "open transaction" in subj_lower or "mssqlalert" in subj_lower or "failed alert" in subj_lower or "job failure" in subj_lower or "failed job" in subj_lower:
        return True
    
    if "SQL Service Status Report" in subject:
        return True
    
    if any(tag in subject for tag in ["[MySQL Status]", "[PostgreSQL Status]", "[MongoDB Status]"]):
        return True
    
    if subject.count("|") >= 2:
        return True
    
    prefixes = ["RetailScan", "Cropin", "CropIn", "Pepper Adv", "Shemaroo", "Credopay", "HPCL", "Geojit","ChennaiSilks", "Maxhealthcare", "MAX Healthcare", "MAXHealthcare"]
    return any(subject.startswith(p) for p in prefixes)

def parse_time(time_str):
    from datetime import datetime
    from zoneinfo import ZoneInfo
    import re

    IST = ZoneInfo("Asia/Kolkata")
    UTC = ZoneInfo("UTC")

    if not time_str:
        now = datetime.now()
        now_ist = now.astimezone(IST)
        now_utc = now.astimezone(UTC)
        return now.replace(tzinfo=None), now_utc, now_ist

    time_str = time_str.strip()
    dt = None

    if 'T' in time_str:
        try:
            dt = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
        except:
            pass

    if not dt:
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %I:%M:%S %p",
            "%Y-%m-%d %H:%M:%S.%f",
            "%d/%m/%Y %H:%M:%S",
            "%m/%d/%Y %H:%M:%S",
            "%Y-%m-%d %H:%M"
        ]

        for fmt in formats:
            try:
                dt = datetime.strptime(time_str, fmt)
                break
            except:
                continue

    if not dt:
        match = re.search(r'(\d{4}-\d{2}-\d{2})[T\s](\d{1,2}:\d{2}:\d{2})', time_str)
        if match:
            try:
                dt = datetime.strptime(f"{match.group(1)} {match.group(2)}", "%Y-%m-%d %H:%M:%S")
            except:
                pass

    if not dt:
        dt = datetime.now()

    if dt.tzinfo is None:
        ist_dt = dt.replace(tzinfo=IST)
        utc_dt = ist_dt.astimezone(UTC)
        log_time = dt
    else:
        ist_dt = dt.astimezone(IST)
        utc_dt = dt.astimezone(UTC)
        log_time = ist_dt.replace(tzinfo=None)

    return log_time, utc_dt.replace(tzinfo=None), ist_dt.replace(tzinfo=None)

def parse_rds_filename(filename):
    import os
    import re
    
    base = os.path.basename(filename)
    # Remove all extensions
    name = re.sub(r'(\.json|\.gz|\.zip|\.log|\.txt)+$', '', base, flags=re.IGNORECASE)
    
    # Remove timestamps like _20260511_050001 or .1715370000
    name = re.sub(r'(_|\.)\d{8}(_?)\d{6}.*$', '', name)
    name = re.sub(r'(_|\.)\d{10,}.*$', '', name)

    prefixes = ["cloudwatch", "cloudtrail", "config", "pi", "logs", "rds"]
    parts = name.split("_")
    
    meaningful_parts = []
    for p in parts:
        if p.lower() in prefixes:
            continue
        meaningful_parts.append(p)
        
    if len(meaningful_parts) >= 2:
        # Most likely format: [INSTANCE]_[TYPE]
        # Or [TYPE]_[INSTANCE] (less likely but possible)
        # We assume first is server, second is type
        return meaningful_parts[0], meaningful_parts[1]
    elif len(meaningful_parts) == 1:
        return "Unknown", meaningful_parts[0]
    
    return "Unknown", name