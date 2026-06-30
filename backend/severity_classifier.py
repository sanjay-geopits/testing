import re
from typing import Optional


def parse_cpu_percent(log_message: str) -> Optional[float]:
    """
    Extracts CPU percentage from various log formats:
      - CloudWatch (Intentwise/RunLoyal/Cropin): {"Average": 91.24, "Label": "CPUUtilization"}
      - MongoDB (Shemaroo): {"cpu_percent": 13.1}
      - Cnergee: {"sql_cpu_percent": 91.24}
    """
    # 1. CloudWatch/RDS format
    if "CPUUtilization" in log_message:
        match = re.search(r'"Average":\s*([\d.]+)', log_message, re.IGNORECASE)
        if match: return float(match.group(1))
    
    # 2. MongoDB format
    match = re.search(r'"cpu_percent":\s*([\d.]+)', log_message, re.IGNORECASE)
    if match: return float(match.group(1))

    # 3. Cnergee format
    match = re.search(r'"sql_cpu_percent":\s*([\d.]+)', log_message, re.IGNORECASE)
    if match: return float(match.group(1))

    return None

def get_cpu_severity_level(percent: float) -> str:
    if percent > 90: return "Critical"
    if percent > 75: return "High"
    if percent > 60: return "Medium"
    return "Low"

def get_iops_severity_level(iops: float) -> str:
    """Classifies IOPS based on count."""
    if iops > 10000: return "Critical"
    if iops > 5000:  return "High"
    if iops > 1000:  return "Medium"
    return "Low"



def parse_memory_percent(log_message: str) -> Optional[float]:
    """
    Extracts Memory usage percentage.
    Confirmed formats: 
      - {"total_mb": 126085, "usage_percent": 47.4, ...}
      - {"total_memory_mb": 15787, "used_memory_mb": 6471, ...}
    """
    # 1. Try direct usage_percent
    if "total_mb" in log_message or "used_mb" in log_message:
        match = re.search(r'"usage_percent":\s*([\d.]+)', log_message, re.IGNORECASE)
        if match: return float(match.group(1))
    
    # 2. Try calculation from absolute MB values
    total_match = re.search(r'"total_memory_mb":\s*([\d.]+)', log_message, re.IGNORECASE)
    used_match = re.search(r'"used_memory_mb":\s*([\d.]+)', log_message, re.IGNORECASE)
    if total_match and used_match:
        total = float(total_match.group(1))
        used = float(used_match.group(1))
        if total > 0:
            return round((used / total) * 100, 2)
            
    return None

def parse_disk_percent(log_message: str) -> Optional[float]:
    """
    Extracts Disk usage percentage.
    Confirmed formats: 
      - {"filesystem": "/dev/nvme0n1p16", "usage_percent": 20.0, ...}
      - {"disk_name": "/dev/root", "disk_usage_percent": 74.0, ...}
    """
    # Try generic usage_percent
    if "filesystem" in log_message or "mount" in log_message:
        match = re.search(r'"usage_percent":\s*([\d.]+)', log_message, re.IGNORECASE)
        if match: return float(match.group(1))
    
    # Try specific disk_usage_percent
    match = re.search(r'"disk_usage_percent":\s*([\d.]+)', log_message, re.IGNORECASE)
    if match: return float(match.group(1))

    return None

def get_usage_severity_level(percent: float) -> str:
    """Standard 90/80/70 threshold for Disk and Memory."""
    if percent > 90: return "Critical"
    if percent > 80: return "High"
    if percent > 70: return "Medium"
    return "Low"



def parse_io_util_percent(log_message: str) -> Optional[float]:
    """
    Extracts IO Device Utilization percentage or implied severity from latency.
    Supports MongoDB/PostgreSQL/Cnergee: 
    - {"read_iops": 0.0, "util_percent": 0.86, ...}
    - {"read_latency_ms": 6.0, "write_latency_ms": 68.0}
    """
    # 1. Direct utilization percentage
    match = re.search(r'"(?:io_)?util(?:_percent|ization)?":\s*([\d.]+)', log_message, re.IGNORECASE)
    if match: return float(match.group(1))

    # 2. Implied severity from Latency (if percentage is missing)
    # We look for read, write, or total latency and take the max.
    latencies = re.findall(r'"(?:read|write|total)_latency_ms":\s*([\d.]+)', log_message, re.IGNORECASE)
    if latencies:
        max_latency = max(float(x) for x in latencies)
        # Mapping latency to "fake" percentages for get_usage_severity_level
        if max_latency > 100: return 95.0 # Critical
        if max_latency > 50:  return 85.0 # High
        if max_latency > 20:  return 75.0 # Medium
        return 10.0 # Low (Explicitly avoid None to prevent fallback to "Medium")
        
    return None

def is_iops_log(log_message: str) -> bool:
    """Detects IOPS related logs."""
    msg_lower = log_message.lower()
    return any(k in msg_lower for k in [
        "readiops", "writeiops", "read_iops", "write_iops", 
        "io_util", "util_percent", "utilization", "io_samples"
    ])

CRITICAL_KEYWORDS = [
    "disk full", "out of memory", "data corruption", "database down", "panic",
    "fatal error", "crash", "replication stopped", "storage full", "table is full",
    "too many open files", "host is blocked", "aborted connection", "got signal 11",
    "forcing innodb recovery", "cannot allocate memory", "innodb: out of memory",
    "mysqld exited", "access denied", "gtid inconsistency",
    "ebs volume detached", "instance store full", "kernel panic", "oom-kill process",
    "filesystem read-only", "ec2 instance unreachable", "nvme timeout",
    "raid degraded", "disk failure", "hardware error", "power failure",
    "network interface down", "san path lost", "mount point unavailable",
    "rds instance restarting", "multi-az failover", "rds storage full",
    "rds instance stopped", "automated backup failed",    "rds certificate expired",
    "parameter group mismatch", r"error[:\s]+823", r"error[:\s]+824", r"error[:\s]+825",
    "page verification failed"
]

HIGH_KEYWORDS = [
    "timeout", "connection failed", "retry limit exceeded", "deadlock detected",
    "too many connections", "lock wait timeout", "waiting for metadata lock",
    "waiting for table lock", "max_connections reached", "oom killer",
    "innodb deadlock", "slave sql thread stopped", "slave io thread stopped",
    "binlog file not found", "read-only mode", "innodb: page checksum",
    "ebs throughput limit", "ebs burst balance low", "ec2 cpu credit exhausted",
    "security group change", "instance type change", "swap usage high",
    "disk read error", "disk write error", "raid rebuilding", "network packet loss",
    "high disk latency", "ups battery low", "temperature warning", "nfs timeout",
    "rds failover completed", "rds storage autoscaling", "rds cpu credit balance low",
    "enhanced monitoring alert", "rds read replica lag", "aurora writer failover",
    "rds snapshot failed", "proxy connection exhausted",
    "stuck i/o", "i/o timeout", "disk latency high", "can't create/write to file",
    "error 28"
]

MEDIUM_KEYWORDS = [
    "slow query", "long running query", "replication lag", "filesort",
    "using temporary", "full table scan", "select full join", "no index used",
    "high cpu", "read iops", "write iops", "history list length",
    "purge thread lagging", "table cache full", "auto_increment limit",
    "ebs queue depth high", "network bandwidth high", "cpu steal high",
    "instance metadata unavailable", "disk space warning", "memory usage high",
    "network utilization high", "backup job slow", "cron job failed", "ntp drift",
    "rds storage utilization", "rds connections high", "rds freeable memory low",
    "rds burst balance", "rds maintenance window", "parameter group changed",
    "rds event notification"
]

LOW_KEYWORDS = [
    "rollback", "analyze table", "optimize table", "table fragmentation",
    "slow_query_time changed", "long_query_time changed", "index missing",
    "statistics out of date", "ssl certificate expiring", "user password expiring",
    "binary log rotation", "ami backup completed", "instance scheduled restart",
    "security patch available", "cloudwatch alarm state", "backup completed",
    "log rotation completed", "firmware update available", "smart warning",
    "warranty expiring", "rds backup completed", "rds minor version upgrade",
    "rds certificate rotation", "rds reserved instance", "cloudwatch logs export"
]

def parse_mysql_slow_query_time(log_message: str) -> float:
    """Extracts query execution time in seconds from MySQL slow query logs."""
    # Pattern 1: Standard slow query log (# Query_time: 12.345678)
    match = re.search(r'Query_time:\s*([\d.]+)', log_message, re.IGNORECASE)
    if match:
        return float(match.group(1))
    
    # Pattern 2: JSON format with HH:MM:SS ("query_time": "00:05:00")
    match = re.search(r'query_time":\s*"(\d{1,2}):(\d{2}):(\d{2})"', log_message, re.IGNORECASE)
    if match:
        h, m, s = map(int, match.groups())
        return h * 3600 + m * 60 + s

    match = re.search(r'exec_ms"?:\s*([\d.]+)', log_message, re.IGNORECASE)
    if match:
        return float(match.group(1)) / 1000.0     
        
    # Pattern 3: JSON format with seconds as number ("query_time": 300.0)
    match = re.search(r'query_time":\s*([\d.]+)', log_message, re.IGNORECASE)
    if match:
        return float(match.group(1))

    return None

def classify_mysql_slow_query_severity(log_message: str) -> str:
    """Classifies MySQL slow query severity based on execution time."""
    seconds = parse_mysql_slow_query_time(log_message)
    
    if seconds is None:
        return None  # Not a slow query or time missing
        
    if seconds > 300:  # > 5 minutes
        return "Critical"
    elif seconds > 30: # > 30 seconds
        return "High"
    elif seconds > 10: # > 10 seconds
        return "Medium"
    else:              # <= 10 seconds
        return "Low"

def classify_mysql_severity(log_message: str) -> str:
    if not log_message:
        return "Unknown"
        
    msg_lower = log_message.lower()
    
    if "[warning]" in msg_lower:
        return "Medium"
    if "[error]" in msg_lower or "[fatal]" in msg_lower:
        return "High"
    if "[note]" in msg_lower or "[info]" in msg_lower:
        return "Low"
    
    # 0. Check for Metrics (CPU/Memory/Disk/IO) first
    cpu_val = parse_cpu_percent(log_message)
    if cpu_val is not None: return get_cpu_severity_level(cpu_val)

    mem_val = parse_memory_percent(log_message)
    if mem_val is not None: return get_usage_severity_level(mem_val)

    disk_val = parse_disk_percent(log_message)
    if disk_val is not None: return get_usage_severity_level(disk_val)

    io_val = parse_io_util_percent(log_message)
    if io_val is not None: return get_usage_severity_level(io_val)

    if is_iops_log(log_message):
        iops_val = extract_metric_value("mysql", "io_samples", log_message)
        if iops_val is not None: return get_iops_severity_level(iops_val)
        return "Medium"

    # 1. Check for Slow Query specific time-based severity first
    if "query_time" in msg_lower or "exec_ms" in msg_lower:
        slow_severity = classify_mysql_slow_query_severity(log_message)
        if slow_severity:
            return slow_severity

    # 2. Fallback to keyword-based classification
    for kw in CRITICAL_KEYWORDS:
        if kw in msg_lower:
            return "Critical"
            
    for kw in HIGH_KEYWORDS:
        if kw in msg_lower:
            return "High"
            
    for kw in MEDIUM_KEYWORDS:
        if kw in msg_lower:
            return "Medium"
            
    for kw in LOW_KEYWORDS:
        if kw in msg_lower:
            return "Low"
            
    # 3. Global fallback (CRITICAL/HIGH/MEDIUM/LOW lists already checked above for MySQL)
    return "Unknown"

MSSQL_CRITICAL = [
    "disk full", "out of memory", "data corruption", "database down", "panic",
    "fatal error", "crash", "replication stopped", "storage full",
    "database is in emergency mode", "checkdb found [^0]\\d* errors",
    "suspect", "i/o requests taking longer than 15 seconds",
    "a check of the backing-store hub failed",
    # NEW - error_log critical
    "sql server is terminating",
    "stack dump",
    "non-yielding scheduler",
    "non-yielding iocp listener",
    "there is insufficient system memory",
    "process cannot access the file",
    "database corruption",
    "table error",
    "page level locking is disabled",
    "operating system error",
    "could not allocate space",
    "transaction log for database .* is full",
    "database .* cannot be opened",
    "cannot open database",
    "severe error in the current command",
    r"error[:\s]+823",   # I/O error (hard error)
    r"error[:\s]+824",   # logical I/O error
    r"error[:\s]+825",   # read-retry required
    r"error[:\s]+832",   # constant page changed
    r"error[:\s]+855",   # uncorrectable hardware memory corruption
    r"error[:\s]+856",   # sql server detected hardware memory corruption
    "always on.*critical",
    "availability group.*failed",
    "forced failover",
    "automatic failover",
    "lease expired",
    "lease timeout",
    r"error[:\s]+9001",  # log for database is not available
    r"error[:\s]+9002",  # transaction log is full
    r"error[:\s]+1105",  # could not allocate space
    r"error[:\s]+1101",  # could not allocate new page
    # NEW - agent_log critical
    "sqlagent.*fatal",
    "agent is suspect",
    "alert engine.*terminated",
    "job .* failed to start",
    "cannot connect to sql server",
    "sql server agent is not running"
]

MSSQL_HIGH = [
    "timeout", "connection failed", "retry limit exceeded", "deadlock detected",
    "too many connections", "lock wait timeout", "login failed",
    "service broker endpoint is in disabled", "the step failed", "job failed",
    "sql server agent stopped",
    "hadrsession_disconnected",
    "hadr transport.*error",
    "log pool scan failed",
    "recovery fork mismatch",
    "extended recovery forks.*failed",
    # NEW - error_log high
    "deadlock",
    "error: 1205",  # deadlock victim
    "error: 1222",  # lock request timeout
    "error: 18456", # login failed
    "error: 17142", # sql server is paused
    "error: 17826", # could not start network listener
    "error: 17832", # login packet is invalid
    "error: 4060",  # cannot open database
    "error: 4064",  # cannot open user default database
    "flushcache",
    "buffer pool",
    "memory pressure",
    "resource monitor",
    "out of lock space",
    "blocking",
    "long-running transaction",
    "virtual log file",
    "availability replica.*disconnected",
    "availability group.*offline",
    "hadr.*failover",
    "redo thread.*terminated",
    "log send queue",
    "synchronization.*failed",
    "certificate.*expired",
    "endpoint.*connection failed",
    "mirroring.*error",
    # NEW - agent_log high
    "job .* failed",
    "step .* failed",
    "unable to connect",
    "alert .* fired",
    "operator notified.*failure",
    "job outcome: failed",
    "error activating",
    "schedule .* failed",
    "proxy .* failed",
    "error running job",
    "job .* encountered an error",
    "sqlagent.*error",
    "max worker threads",
    "mail session.*failed",
    "database mail.*error",
    "permission was denied on the object",      # SELECT permission denied on log_shipping_secondary
    "was killed by hostname",                   # Process ID X was killed
    "process id.*was killed",                   # alternate form
    "is not able to access the database",       # server principal access denied
    "server principal.*security context",       # broader form
    "login failed for user",
    "cannot execute as the database principal"
]

MSSQL_MEDIUM = [
    "slow query", "long running query", "replication lag", "warning: null value",
    "the step retries", "alert",
    "at least 4 extensions for file",
    "fstr: file",
    "hadrlogcapture::logpoolstartscan",
    "getting bottom recovery fork",
    "hadr_fqdr_xrf",
    "chadrsession::generateconfigmessage",
    "chadrsession::processmessage",
    "hadrsession_configuring",
    "process configure message",
    # NEW - error_log medium
    "autogrow",
    "auto-grow",
    "filegroup .* is full",
    "log file .* is full",
    "query exceeded",
    "execution plan",
    "missing index",
    "index .* disabled",
    "statistics .* out of date",
    "table .* has no statistics",
    "page split",
    "high fragmentation",
    "fill factor",
    "replication warning",
    "subscriber .* latency",
    "distributor .* latency",
    "log reader agent",
    "distribution agent",
    "merge agent",
    "snapshot agent",
    "error: 1222",  # lock timeout
    "error: 8153",  # null warning
    "error: 3271",  # non-recoverable i/o error
    "backup .* failed",
    "restore .* failed",
    "checkdb.*warning",
    "dbcc.*warning",
    "vlf count",
    "virtual log files",
    "hadr.*warning",
    "availability replica.*warning",
    "redo thread.*paused",
    "log apply thread",
    "secondary.*not synchronizing",
    "recovery pending",
    "log shipping.*warning",
    "log shipping.*threshold",
    # NEW - agent_log medium
    "job .* retried",
    "step .* retried",
    "job .* slow",
    "job duration exceeded",
    "schedule.*missed",
    "alert.*warning",
    "operator.*notified",
    "database mail.*warning",
    "log backup.*warning",
    "job .* long running",
    "maintenance plan.*warning",
    "cleanup.*warning",
    "agent.*warning",
    "proxy.*warning",
    "history cleanup",
    "deleting old log backup"
    r"\[disk_space_to_reserve_property\].*property not found",
    r"\[disk_space_to_reserve_property\].*failed to get",
    r"cfabriccommonutils::getfabricpropertyinternalwith",
    "spacetoreserveinmb.*failed",
    "endgetproperty call failed",
    "getfabricproperty.*result.*80071"
]

MSSQL_LOW = [
    "log backup completed", "index rebuilt", "statistics updated",
    "dbcc checkdb", "login successful", "backup verified",
    "[info]", "the step succeeded", "dbcc execution completed",
    "execute package utility", "process exit code 0", "sql server agent starting",
    "job succeeded", "starting up database", "recovery is complete",
    "checkdb found 0 allocation errors",
    "backup(msdb): 100 percent",
    "backup(msdb): first lsn",
    "end of transaction log backup.*exit status: 0",
    "deleting old log backup file",
    "deleting log backup file",
    "hadrsession_connected",
    "exit status: 0 (success)",
    # NEW - error_log low
    "server is listening on",
    "sql server is ready",
    "configuration option .* changed",
    "checkpoint",
    "database backed up",
    "log backed up",
    "backup database successfully",
    "restore database successfully",
    "dbcc checkalloc",
    "dbcc checktable",
    "dbcc cleantable",
    "dbcc updateusage",
    "index .* was rebuilt",
    "index .* was reorganized",
    "statistics .* updated",
    "auto update statistics",
    "starting up database",
    "hadr.*connected",
    "availability replica.*connected",
    "availability group.*online",
    "secondary replica.*synchronizing",
    "redo thread.*started",
    "log send.*completed",
    "recovery completed",
    "hadr.*role.*primary",
    "hadr.*role.*secondary",
    "chadrtransportreplica state change.*hadrsession_connected",
    "hadrsession_connected",
    "process configure message.*version",
    "generate configure message",
    "getting bottom recovery fork",
    "error: 0",  # success
    # NEW - agent_log low
    "job .* succeeded",
    "step .* succeeded",
    "job outcome: succeeded",
    "job .* started",
    "job .* completed successfully",
    "schedule .* executed",
    "sql server agent started",
    "agent starting",
    "sqlagent.*started",
    "maintenance plan.*succeeded",
    "cleanup task.*completed",
    "log backup.*completed",
    "end of transaction log backup.*success",
    "database mail.*sent",
    "operator.*notified.*success",
    "history.*purged",
    "job history.*deleted",
    "process exit code 0"
]

def classify_mssql_severity(log_message: str) -> str:
    if not log_message: return "Unknown"
    msg_lower = log_message.lower()

    # 1. Check for Metrics (CPU/Memory/Disk/IO) first
    cpu_val = parse_cpu_percent(log_message)
    if cpu_val is not None: return get_cpu_severity_level(cpu_val)

    mem_val = parse_memory_percent(log_message)
    if mem_val is not None: return get_usage_severity_level(mem_val)

    disk_val = parse_disk_percent(log_message)
    if disk_val is not None: return get_usage_severity_level(disk_val)

    io_val = parse_io_util_percent(log_message)
    if io_val is not None: return get_usage_severity_level(io_val)

    if is_iops_log(log_message):
        iops_val = extract_metric_value("mssql", "io_samples", log_message)
        if iops_val is not None: return get_iops_severity_level(iops_val)
        return "Medium"

    # 2. Try to extract explicit SQL severity level (e.g., "Severity: 14" or "Severity 14")
    severity_match = re.search(r'severity[:\s]+(\d+)', log_message, re.IGNORECASE)
    if severity_match:
        sev_level = int(severity_match.group(1))
        if sev_level >= 19: return "Critical"
        if sev_level >= 17: return "High"
        if sev_level >= 11: return "Medium"
        return "Low"

    # 2. Keyword fallback (Specific)
    for kw in MSSQL_CRITICAL:
        if re.search(kw, msg_lower): return "Critical"
    for kw in MSSQL_HIGH:
        if kw in msg_lower: return "High"
    for kw in MSSQL_MEDIUM:
        if kw in msg_lower: return "Medium"
    for kw in MSSQL_LOW:
        if kw in msg_lower: return "Low"

    # 3. Global fallback
    for kw in CRITICAL_KEYWORDS:
        if kw in msg_lower: return "Critical"
    for kw in HIGH_KEYWORDS:
        if kw in msg_lower: return "High"
    for kw in MEDIUM_KEYWORDS:
        if kw in msg_lower: return "Medium"
    for kw in LOW_KEYWORDS:
        if kw in msg_lower: return "Low"

    return "Unknown"

POSTGRES_CRITICAL = [
    "panic", "fatal", "database system is shut down", "corrupted page",
    "wal insert memory full", "could not access status of transaction",
    "invalid page in block"
]

POSTGRES_HIGH = [
    "error", "deadlock detected", "out of memory", "too many clients already",
    "terminating connection due to administrator command",
    "canceling statement due to lock timeout"
]

POSTGRES_MEDIUM = [
    "warning", "slow query", "duration:", "temporary file size exceeds",
    "checkpoints are occurring too frequently"
]

POSTGRES_LOW = [
    "info", "log", "detail", "statement", "checkpoint complete",
    "connection authorized", "disconnection"
]

def classify_postgres_severity(log_message: str) -> str:
    if not log_message: return "Unknown"
    msg_lower = log_message.lower()

    # 0. Check for Metrics (CPU/Memory/Disk/IO) first
    cpu_val = parse_cpu_percent(log_message)
    if cpu_val is not None: return get_cpu_severity_level(cpu_val)

    mem_val = parse_memory_percent(log_message)
    if mem_val is not None: return get_usage_severity_level(mem_val)

    disk_val = parse_disk_percent(log_message)
    if disk_val is not None: return get_usage_severity_level(disk_val)

    io_util = parse_io_util_percent(log_message)
    if io_util is not None: return get_usage_severity_level(io_util)

    if is_iops_log(log_message):
        iops_val = extract_metric_value("postgres", "io_samples", log_message)
        if iops_val is not None: return get_iops_severity_level(iops_val)
        return "Medium"

    # 1. Keyword fallback (Specific)
    for kw in POSTGRES_CRITICAL:
        if kw in msg_lower: return "Critical"
    for kw in POSTGRES_HIGH:
        if kw in msg_lower: return "High"
    for kw in POSTGRES_MEDIUM:
        if kw in msg_lower: return "Medium"
    for kw in POSTGRES_LOW:
        if kw in msg_lower: return "Low"

    # 3. Global fallback
    for kw in CRITICAL_KEYWORDS:
        if kw in msg_lower: return "Critical"
    for kw in HIGH_KEYWORDS:
        if kw in msg_lower: return "High"
    for kw in MEDIUM_KEYWORDS:
        if kw in msg_lower: return "Medium"
    for kw in LOW_KEYWORDS:
        if kw in msg_lower: return "Low"

    return "Unknown"

def classify_mongodb_severity(log_message: str) -> str:
    if not log_message: return "Unknown"
    msg_lower = log_message.lower()

    # 0. Check for Metrics (CPU/Memory/Disk/IO) first
    cpu_val = parse_cpu_percent(log_message)
    if cpu_val is not None: return get_cpu_severity_level(cpu_val)

    mem_val = parse_memory_percent(log_message)
    if mem_val is not None: return get_usage_severity_level(mem_val)

    disk_val = parse_disk_percent(log_message)
    if disk_val is not None: return get_usage_severity_level(disk_val)

    io_util = parse_io_util_percent(log_message)
    if io_util is not None: return get_usage_severity_level(io_util)

    # 1. Log severity field extraction (Standard for MongoDB logs)
    if '"s":"F"' in log_message: return "Critical" # Fatal
    if '"s":"E"' in log_message: return "Critical" # Error (matches Critical in this system)
    if '"s":"W"' in log_message: return "Medium"   # Warning
    if '"s":"I"' in log_message: return "Low"      # Info
    
    # 2. Duration based severity
    match = re.search(r'durationMillis":\s*(\d+)', log_message, re.IGNORECASE)
    if match:
        millis = int(match.group(1))
        if millis > 300000: # 5 min
            return "Critical"
        elif millis > 30000: # 30 sec
            return "High"
        elif millis > 10000: # 10 sec
            return "Medium"
        else:
            return "Low"

    # 3. Keyword fallback
    MONGO_CRITICAL = ["panic", "fatal", "corruption", "replication stopped", "out of memory", "oom-kill"]
    MONGO_HIGH     = ["error", "timeout", "too many connections", "deadlock"]
    MONGO_MEDIUM   = ["warning", "slow query", "replication lag"]
    MONGO_LOW      = ["info", "log", "checkpoint", "connection accepted"]

    for kw in MONGO_CRITICAL:
        if kw in msg_lower: return "Critical"
    for kw in MONGO_HIGH:
        if kw in msg_lower: return "High"
    for kw in MONGO_MEDIUM:
        if kw in msg_lower: return "Medium"
    for kw in MONGO_LOW:
        if kw in msg_lower: return "Low"
    return "Unknown"

def classify_oracle_severity(log_message: str) -> str:
    if not log_message: return "Unknown"
    msg_lower = log_message.lower()
    
    # 1. Critical priority indicators
    if "critical" in msg_lower or "fatal" in msg_lower or "panic" in msg_lower:
        return "Critical"
    
    # 2. Oracle specific error codes (High priority)
    if "ora-" in msg_lower:
        return "High"
    
    # 3. Generic failure indicators
    if "failed" in msg_lower or "failure" in msg_lower:
        return "High"
        
    # 4. Warnings and informational
    if "warning" in msg_lower or "warn" in msg_lower:
        return "Medium"
    if "succeeded" in msg_lower or "successful" in msg_lower:
        return "Low"
        
    return "Unknown"
    
def parse_mongodb_duration(log_message: str) -> Optional[float]:
    match = re.search(r'durationMillis":\s*(\d+)', log_message, re.IGNORECASE)
    if match: return float(match.group(1))
    return None

def is_performance_log(log_type: str) -> bool:
    """Checks if the log type should follow specialized retention logic."""
    if not log_type: return False
    lt = log_type.lower()
    perf_types = [
        "cpu_samples", "cpu_hourly", "cpuutilization",
        "memory_samples", "memory_hourly", "memoryusage",
        "disk_samples", "disk_hourly", "diskusage",
        "io_samples", "io_hourly", "readiops", "writeiops", "read_iops", "write_iops",
        "slow_query_log", "rds_slowquery", "postgres_slowquery", "slow_queries"
    ]
    return any(pt in lt for pt in perf_types)

def extract_metric_value(db_type: str, log_type: str, msg: str) -> Optional[float]:
    """Extracts a numeric value from metric-based logs for comparison."""
    db_lower = db_type.lower() if db_type else ""
    lt_lower = log_type.lower() if log_type else ""

    # 1. CPU
    if "cpu" in lt_lower or "cpuutilization" in lt_lower:
        return parse_cpu_percent(msg)
    
    # 2. Memory
    if "memory" in lt_lower:
        return parse_memory_percent(msg)
    
    # 3. Disk
    if "disk" in lt_lower:
        return parse_disk_percent(msg)
    
    # 4. IO
    if any(k in lt_lower for k in ["io", "readiops", "writeiops", "read_io", "write_io", "iops"]):
        # 4a. Try Latency first (highest priority for performance impact)
        latencies = re.findall(r'"(?:read|write|total)_latency_ms":\s*([\d.]+)', msg, re.IGNORECASE)
        if latencies:
            return max(float(x) for x in latencies)
            
        # 4b. Try direct utilization second
        util_match = re.search(r'"(?:io_)?util(?:_percent|ization)?":\s*([\d.]+)', msg, re.IGNORECASE)
        if util_match: return float(util_match.group(1))
        
        # 4c. Try IOPS count third (Sum of read and write)
        iops_matches = re.findall(r'"(?:read|write)_iops":\s*([\d.]+)', msg, re.IGNORECASE)
        if iops_matches:
            return sum(float(x) for x in iops_matches)
            
        # 4d. Fallback to CloudWatch "Average" for ReadIOPS/WriteIOPS
        match = re.search(r'"Average":\s*([\d.]+)', msg, re.IGNORECASE)
        if match: return float(match.group(1))
        
        # 4e. Fallback to any numeric "Average" or "Value"
        match = re.search(r'"(?:Value|Maximum|Minimum)":\s*([\d.]+)', msg, re.IGNORECASE)
        if match: return float(match.group(1))

    # 5. Slow Query
    if "slowquery" in lt_lower or "slow_query" in lt_lower or "slow_queries" in lt_lower:
        if db_lower == "mongodb":
            return parse_mongodb_duration(msg)
        return parse_mysql_slow_query_time(msg)
        
    return None

def classify_severity(db_type: str, log_message: str) -> str:
    db_lower = db_type.lower() if db_type else ""
    if db_lower == "mysql":
        return classify_mysql_severity(log_message)
    elif db_lower == "mssql":
        return classify_mssql_severity(log_message)
    elif db_lower in ["postgresql", "postgres"]:
        return classify_postgres_severity(log_message)
    elif db_lower == "mongodb":
        return classify_mongodb_severity(log_message)
    elif db_lower == "oracle":
        return classify_oracle_severity(log_message)
    return "Unknown"

