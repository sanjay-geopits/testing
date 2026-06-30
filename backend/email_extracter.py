# =====================================================================
# SECTION 1: IMPORTS & GLOBAL CONFIGURATION
# =====================================================================
import os
import sys
# Add backend directory to path for absolute imports resolution
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import re
import json
import time
import hashlib
import psycopg2
import zipfile
import io
import gzip
import logging
from datetime import datetime
from zoneinfo import ZoneInfo
from collections import Counter
from dotenv import load_dotenv
from subject_parser import parse_subject, is_valid_subject, parse_rds_filename
from severity_classifier import classify_severity
from exchangelib import (
    DELEGATE,
    OAUTH2,
    Account,
    Configuration,
    OAuth2LegacyCredentials,
    FileAttachment
)
from exchangelib.protocol import Protocol

from log_utils import (
    get_connection,
    insert_log,
    make_hash,
    normalize_for_hash,
    parse_time,
    audit_logger,
    get_accurate_ist
)
from log_extractor import process_rds_mail

load_dotenv()

CLIENT_ID=os.getenv("APP_CLIENT")
CLIENT_SECRET=os.getenv("APP_SECRET")
TENANT_ID=os.getenv("APP_TENANT")

USER=os.getenv("USER_EMAIL")
PASSWORD=os.getenv("MAIL_PASSWORD")

SUBJECT_PREFIX="RetailScan"
MAIL_FOLDER="Ai-report-automation"

IST=ZoneInfo("Asia/Kolkata")


# =====================================================================
# SECTION 2: SUBJECT & TEXT PARSING UTILITIES
# =====================================================================
def strip_all_html(text):
    if not text:
        return ""
    # If it is HTML, parse with BeautifulSoup and get text
    if "<html" in text.lower() or "<body" in text.lower() or "<table" in text.lower() or "<p" in text.lower() or "<div" in text.lower() or "<br" in text.lower():
        try:
            from bs4 import BeautifulSoup
            # Parse HTML
            soup = BeautifulSoup(text, 'html.parser')
            # Remove all script and style elements
            for script in soup(["script", "style"]):
                script.decompose()
            # Replace br elements with newlines
            for br in soup.find_all("br"):
                br.replace_with("\n")
            # Replace structural block element tags with trailing newlines
            for tag in soup.find_all(["p", "tr", "td", "div", "li", "th", "h1", "h2", "h3", "h4", "h5", "h6"]):
                tag.insert_after("\n")
            cleaned = soup.get_text()
            # Collapse multiple spaces
            cleaned = re.sub(r'[ \t]+', ' ', cleaned)
            # Remove multiple consecutive blank lines
            cleaned = re.sub(r'\n\s*\n+', '\n\n', cleaned)
            return cleaned.strip()
        except Exception:
            # Fallback regex tag stripping
            cleaned = re.sub(r'<[^>]+>', ' ', text)
            cleaned = re.sub(r'[ \t]+', ' ', cleaned)
            cleaned = re.sub(r'\n\s*\n+', '\n\n', cleaned)
            return cleaned.strip()
    return text.strip()

RDS_CLIENT_KEYWORDS = ["cropin", "runloyal", "intentwise", "shemaroo", "cnergee", "flowglobal", "retailscan", "credopay", "artfine"]

def parse_mssql_subject_details(subject):
    import re
    # Clean Fwd/Re
    subject = re.sub(r'^(?:fw|re|fwd|vs|fwd|aw|wg|rv):\s*', '', subject, flags=re.IGNORECASE).strip()
    
    # Normalize "MAX Healthcare" space variations to Maxhealthcare
    subject = re.sub(r'MAX\s+Healthcare', 'Maxhealthcare', subject, flags=re.IGNORECASE)
    subject = re.sub(r'Max\s+Healthcare', 'Maxhealthcare', subject, flags=re.IGNORECASE)
    subject = re.sub(r'MAXHealthcare', 'Maxhealthcare', subject, flags=re.IGNORECASE)

    # Try to match job alert style: Maxhealthcare BLR-MAX-SUNDB DBA_GeoPITS_LongRunningQueries_Closed Failed Alert -> Open
    job_match = re.search(r'^([a-zA-Z0-9_\-]+)\s+([a-zA-Z0-9_\-]+)\s+([a-zA-Z0-9_\-]+)\s+(Failed Alert|Job Failure Alert|Failed Job Success Alert|Alert)\s*->\s*([a-zA-Z0-9_\-]+)', subject, re.IGNORECASE)
    if job_match:
        return job_match.group(1).strip(), job_match.group(2).strip(), job_match.group(3).strip(), job_match.group(5).strip()

    # Try to match: GEOJIT DRP-BOSRV04 - Long Running Queries: Closed
    match = re.search(r'^([a-zA-Z0-9_\-]+)\s+([a-zA-Z0-9_\-]+)\s*-\s*([^:]+?)\s*:\s*([a-zA-Z0-9_\-]+)', subject, re.IGNORECASE)
    if match:
        return match.group(1).strip(), match.group(2).strip(), match.group(3).strip(), match.group(4).strip()

    # Match format without colon: GEOJIT DRP-BOSRV04 - Long Running Queries
    match2 = re.search(r'^([a-zA-Z0-9_\-]+)\s+([a-zA-Z0-9_\-]+)\s*-\s*(Long Running Queries|Open Transaction Alert|Open Transaction|MSSQL Alert)', subject, re.IGNORECASE)
    if match2:
        return match2.group(1).strip(), match2.group(2).strip(), match2.group(3).strip(), None

    return None, None, None, None


def parse_mssql_alert(body, subject=""):
    # Extract SPID / Session ID: matches SPID: 2583 or Session ID: 2583 etc.
    spid_match = re.search(r'(?:SPID|Session\s*ID|Session-ID|SessionID)\s*[:\-]?\s*(\d+)', body, re.IGNORECASE)
    spid = spid_match.group(1).strip() if spid_match else None
    
    # Also check subject for SPID if not in body
    if not spid:
        spid_subj = re.search(r'(?:SPID|Session\s*ID|Session-ID|SessionID)\s*[:\-]?\s*(\d+)', subject, re.IGNORECASE)
        if spid_subj:
            spid = spid_subj.group(1).strip()
    
    # Try to find Executing SQL or SQL Statement or SQL Query
    sql_match = re.search(r'(?:Executing SQL|SQL Statement|SQL Query)\s*:?\s*(.*)', body, re.IGNORECASE | re.DOTALL)
    sql_text = ""
    if sql_match:
        sql_text = sql_match.group(1).strip()
        sql_text = re.split(r'(?:First Occurred|Last Occurred|Logs:|Database:|This query has been running|Click here)', sql_text, flags=re.IGNORECASE)[0].strip()
    
    # If sql_text is still empty or looks like a table header/not query text, search for common SQL commands in the body
    if not sql_text or len(sql_text) < 5 or "sql text" in sql_text.lower():
        sql_command_match = re.search(r'\b(exec|select|update|delete|insert|with)\b.*', body, re.IGNORECASE | re.DOTALL)
        if sql_command_match:
            sql_text = sql_command_match.group(0).strip()
            sql_text = re.split(r'(?:This query has been running|Click here|Thanks for your attention|Best Regards)', sql_text, flags=re.IGNORECASE)[0].strip()

    # Determine alert status from subject or body
    status = "Open"
    subj_l = subject.lower()
    body_l = body.lower()
    
    client_raw, server_raw, alert_type_raw, status_raw = parse_mssql_subject_details(subject)
    if status_raw:
        if status_raw.lower() in ["closed", "resolved", "close", "resolve", "deactivated", "deactivate"]:
            status = "Closed"
        else:
            status = "Open"
    else:
        if any(w in subj_l for w in ["closed", "resolved", "close", "resolve", "deactivated", "deactivate"]):
            status = "Closed"
        elif any(w in body_l for w in ["closed", "resolved", "close", "resolve", "deactivated", "deactivate"]):
            status = "Closed"
        
    return spid, sql_text, status


def compute_mssql_priority(alert_details, subject="", body=""):
    """Return Critical / High / Medium / Low based on elapsed time + keywords."""
    # 1. Keyword override from subject/body
    combined = (subject + " " + body).lower()
    if any(k in combined for k in ["severity: 1", "severity:1", "critical", "p1", "sev1"]):
        return "Critical"
    if any(k in combined for k in ["severity: 2", "severity:2", "high", "p2", "sev2"]):
        return "High"

    # 2. Elapsed time from parsed table (format hh:mm:ss or mm:ss or plain minutes)
    elapsed = (alert_details.get("elapsed_time") or "").strip()
    if elapsed:
        try:
            parts = [int(p) for p in elapsed.replace("-", ":").split(":") if p.strip().isdigit()]
            if len(parts) == 3:      # hh:mm:ss
                total_min = parts[0] * 60 + parts[1] + parts[2] / 60
            elif len(parts) == 2:    # mm:ss
                total_min = parts[0] + parts[1] / 60
            elif len(parts) == 1:    # plain minutes
                total_min = parts[0]
            else:
                total_min = 0
            if total_min >= 30:
                return "Critical"
            if total_min >= 15:
                return "High"
            if total_min >= 5:
                return "Medium"
            return "Low"
        except Exception:
            pass

    # 3. Default
    return "High"   # unknown elapsed → treat as High so it is never silently ignored

def parse_mssql_alert_details(body, html_body=None, server_default=""):
    from bs4 import BeautifulSoup
    
    details = {
        "spid": "",
        "start_time": "",
        "elapsed_time": "",
        "user": "",
        "hostname": "",
        "database": "",
        "sql_text": "",
        "wait_type": "",
        "stored_procedure": "",
        # Compatibility keys
        "instance_name": server_default,
        "login_time": "",
        "login_name": "",
        "duration_min": "",
        "executing_sql": ""
    }
    
    parsed_via_html = False
    
    # 1. Try to parse from HTML body if provided
    if html_body:
        try:
            soup = BeautifulSoup(html_body, 'html.parser')
            tables = soup.find_all('table')
            
            # First, check for Key-Value style rows: e.g. <tr><td>SPID</td><td>2583</td></tr>
            for table in tables:
                trs = table.find_all('tr')
                for tr in trs:
                    cells = tr.find_all(['td', 'th'])
                    if len(cells) >= 2:
                        label = cells[0].get_text(strip=True).lower()
                        val = cells[1].get_text(strip=True)
                        if not val:
                            continue
                        if label == 'spid' or label.startswith('spid') or 'session' in label:
                            if not details['spid']: details['spid'] = val
                        elif 'start time' in label or 'login time' in label or 'start_time' in label:
                            if not details['start_time']: details['start_time'] = val
                        elif 'elapsed time' in label or 'duration' in label or 'elapsed_time' in label:
                            if not details['elapsed_time']: details['elapsed_time'] = val
                        elif 'user' in label or 'login name' in label or 'login_name' in label:
                            if not details['user']: details['user'] = val
                        elif 'hostname' in label or 'host name' in label or 'host_name' in label:
                            if not details['hostname']: details['hostname'] = val
                        elif 'database' in label:
                            if not details['database']: details['database'] = val
                        elif 'sql text' in label or 'executing' in label or 'sql_text' in label:
                            if not details['sql_text']: details['sql_text'] = val
                        elif 'wait type' in label or 'wait_type' in label:
                            if not details['wait_type']: details['wait_type'] = val
                        elif 'stored' in label or 'procedure' in label or 'stored_procedure' in label:
                            if not details['stored_procedure']: details['stored_procedure'] = val
            
            # Next, fall back/complement with column-header style parser
            for table in tables:
                trs = table.find_all('tr')
                if not trs:
                    continue
                
                # Try to find header row containing SPID and SQL Text
                header_row = None
                header_cols = []
                for tr in trs:
                    cols = [c.get_text(strip=True).lower() for c in tr.find_all(['th', 'td'])]
                    if any('spid' in c or 'session' in c for c in cols) and any('sql text' in c or 'executing' in c or 'sql_text' in c for c in cols):
                        header_row = tr
                        header_cols = cols
                        break
                
                if header_row and header_cols:
                    header_idx = trs.index(header_row)
                    data_row = None
                    for tr in trs[header_idx+1:]:
                        tds = tr.find_all('td')
                        if tds and len(tds) >= len(header_cols) - 2:
                            data_row = tr
                            break
                    
                    if data_row:
                        tds = [td.get_text(strip=True) for td in data_row.find_all('td')]
                        for idx, h_name in enumerate(header_cols):
                            if idx >= len(tds):
                                break
                            val = tds[idx]
                            if 'spid' == h_name or h_name.startswith('spid') or 'session' in h_name:
                                if not details['spid']: details['spid'] = val
                            elif 'start time' in h_name or 'login time' in h_name or 'start_time' in h_name:
                                if not details['start_time']: details['start_time'] = val
                            elif 'elapsed time' in h_name or 'duration' in h_name or 'elapsed_time' in h_name:
                                if not details['elapsed_time']: details['elapsed_time'] = val
                            elif 'user' in h_name or 'login name' in h_name or 'login_name' in h_name:
                                if not details['user']: details['user'] = val
                            elif 'hostname' in h_name or 'host name' in h_name or 'host_name' in h_name:
                                if not details['hostname']: details['hostname'] = val
                            elif 'database' in h_name:
                                if not details['database']: details['database'] = val
                            elif 'sql text' in h_name or 'executing' in h_name or 'sql_text' in h_name:
                                if not details['sql_text']: details['sql_text'] = val
                            elif 'wait type' in h_name or 'wait_type' in h_name:
                                if not details['wait_type']: details['wait_type'] = val
                            elif 'stored' in h_name or 'procedure' in h_name or 'stored_procedure' in h_name:
                                if not details['stored_procedure']: details['stored_procedure'] = val
            
            if details['spid'] and details['sql_text']:
                parsed_via_html = True
        except Exception as e:
            print(f"[HTML PARSING ERROR] {e}")

    # 2. Fallback to parsing from text body
    if not parsed_via_html:
        # Parse SPID / Session ID
        spid_match = re.search(r'(?:SPID|Session\s*ID|Session-ID|SessionID)\s*[:\-]?\s*(\d+)', body, re.IGNORECASE)
        if spid_match:
            details["spid"] = spid_match.group(1).strip()
            
        # Parse Database
        db_match = re.search(r'Database\s*[:\-]?\s*([a-zA-Z0-9_]+)', body, re.IGNORECASE)
        if db_match:
            details["database"] = db_match.group(1).strip()
            
        # Parse Table Row if present
        lines = body.split("\n")
        has_hostname_header = any('hostname' in line.lower() or 'host name' in line.lower() for line in lines)
        for line in lines:
            line = line.strip()
            if not line:
                continue
            if details["spid"] and line.startswith(details["spid"]):
                parts = re.split(r'\s+', line)
                if len(parts) >= 6 and re.match(r'^\d{4}-\d{2}-\d{2}$', parts[1]):
                    details["start_time"] = f"{parts[1]} {parts[2]}"
                    details["elapsed_time"] = parts[3]
                    details["user"] = parts[4]
                    
                    sql_keywords = ["exec", "select", "with", "update", "delete", "insert", "declare", "create", "alter", "drop"]
                    sql_start_idx = 6
                    for i in range(5, len(parts)):
                        if parts[i].lower() in sql_keywords:
                            sql_start_idx = i
                            break
                            
                    if has_hostname_header:
                        if sql_start_idx == 7:
                            details["hostname"] = parts[5]
                            details["database"] = parts[6]
                            remaining_parts = parts[7:]
                        elif sql_start_idx == 6:
                            details["hostname"] = ""
                            details["database"] = parts[5]
                            remaining_parts = parts[6:]
                        else:
                            details["hostname"] = parts[5]
                            details["database"] = parts[6] if sql_start_idx > 6 else ""
                            remaining_parts = parts[sql_start_idx:]
                    else:
                        details["hostname"] = ""
                        details["database"] = parts[5] if sql_start_idx > 5 else ""
                        remaining_parts = parts[sql_start_idx:]
                        
                    remaining = " ".join(remaining_parts)
                    wait_match = re.search(r'\b(PAGE[A-Z0-9_]*|LCK_[A-Z0-9_]*|ASYNC_[A-Z0-9_]*|CXPACKET|None)\b', remaining, re.IGNORECASE)
                    if wait_match:
                        details["wait_type"] = wait_match.group(1).strip()
                        split_idx = remaining.find(details["wait_type"])
                        details["sql_text"] = remaining[:split_idx].strip()
                        details["stored_procedure"] = remaining[split_idx + len(details["wait_type"]):].strip()
                    else:
                        details["sql_text"] = remaining
                        details["wait_type"] = "None"
                        details["stored_procedure"] = "None"
                    break
                        
        if not details["start_time"]:
            details["start_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        if not details["elapsed_time"]:
            dur_match = re.search(r'running for (?:more than|over)?\s*(\d+)\s*(?:minutes|mins)', body, re.IGNORECASE)
            if dur_match:
                details["elapsed_time"] = f"00:{dur_match.group(1).strip()}:00"
            else:
                details["elapsed_time"] = "00:05:00"
                
        if not details["sql_text"] or len(details["sql_text"]) < 5:
            sql_command_match = re.search(r'\b(exec|select|update|delete|insert|with)\b.*', body, re.IGNORECASE | re.DOTALL)
            if sql_command_match:
                sql_text = sql_command_match.group(0).strip()
                sql_text = re.split(r'(?:This query has been running|Click here|Thanks for your attention|Best Regards)', sql_text, flags=re.IGNORECASE)[0].strip()
                details["sql_text"] = sql_text

    # 3. Synchronize old and new keys for complete compatibility
    if details["start_time"]:
        details["login_time"] = details["start_time"]
    if details["user"]:
        details["login_name"] = details["user"]
    if details["sql_text"]:
        details["executing_sql"] = details["sql_text"]
    if details["elapsed_time"]:
        try:
            parts = details["elapsed_time"].split(":")
            if len(parts) == 3:
                h, m, s = map(int, parts)
                total_min = h * 60 + m
                details["duration_min"] = str(total_min)
            else:
                details["duration_min"] = "5"
        except:
            details["duration_min"] = "5"
            
    if details["login_time"] and not details["start_time"]:
        details["start_time"] = details["login_time"]
    if details["login_name"] and not details["user"]:
        details["user"] = details["login_name"]
    if details["executing_sql"] and not details["sql_text"]:
        details["sql_text"] = details["executing_sql"]
    if details["duration_min"] and not details["elapsed_time"]:
        try:
            total_min = int(details["duration_min"])
            h = total_min // 60
            m = total_min % 60
            details["elapsed_time"] = f"{h:02d}:{m:02d}:00"
        except:
            details["elapsed_time"] = "00:05:00"
            
    return details




def _is_rds_mail(subject: str) -> bool:
    s = subject.lower()
    return any(kw in s for kw in RDS_CLIENT_KEYWORDS)


def extract_reply_message(body):
    if not body:
        return ""

    # ── Step 1: Split off quoted email history ─────────────────────────────────
    history_markers = [
        r'(?i)^[>\s]*From\s*:\s*',
        r'(?i)^[>\s]*To\s*:\s*',
        r'(?i)^[>\s]*Subject\s*:\s*',
        r'(?i)^[>\s]*Sent\s*:\s*',
        r'(?i)^[>\s]*Date\s*:\s*',
        r'(?i)^from\s*:\s*',
        r'(?i)^to\s*:\s*',
        r'(?i)^subject\s*:\s*',
        r'(?i)^sent\s*:\s*',
        r'(?i)^date\s*:\s*',
        r'(?i)-----Original Message-----',
        r'(?i)________________________________',
        r'(?i)^[>\s]*On\s+.*\s+wrote\s*:',
        r'(?i)^[>\s]*Am\s+.*\s+schrieb\s*:',
        r'(?i)^[>\s]*Le\s+.*\s+a\s+écrit\s*:',
        r'(?i)^[>\s]*El\s+.*\s+escribió\s*:',
        # GeoMon system email body markers (from forwarded ticket HTML)
        r'(?i)GeoMon Incident Center',
        r'(?i)Ticket Communication update',
        r'(?i)Ticket Reference Details',
        r'(?i)This email was dynamically generated',
        r'(?i)Microsoft Graph APIs in response to an operator',
    ]
    lines = body.split('\n')
    clean_lines = []
    for line in lines:
        cleaned_line = line.replace('&nbsp;', ' ').replace('\xa0', ' ').replace('\u00a0', ' ').strip()
        should_cut = False
        for marker in history_markers:
            if re.search(marker, line) or re.search(marker, cleaned_line):
                should_cut = True
                break
        if should_cut:
            break
        clean_lines.append(line)

    # ── Step 2: Strip email signature block ────────────────────────────────────
    # Signatures come AFTER the reply content, separated by a blank line.
    # They look like: blank lines, then Name, then Title, then optional image/link lines.
    # Also handle RFC 3676 "-- " delimiter and Outlook's &nbsp; spacer lines.

    sig_hard_delimiters = [
        r'^\s*--\s*$',            # RFC 3676: "-- " on its own line
        r'^\s*[-_]{3,}\s*$',     # --- or ___ separators
    ]

    def is_empty_or_nbsp(line_text):
        """True for blank lines or lines containing only whitespace/&nbsp;/NBSP chars."""
        cleaned = line_text.strip().replace('&nbsp;', '').replace('\xa0', '').replace('\u00a0', '')
        return cleaned == ''

    def is_signature_line(line_text):
        """Heuristic: a short plain-text line that looks like a name, title, or company."""
        stripped = line_text.strip().replace('&nbsp;', '').replace('\xa0', '').replace('\u00a0', '')
        if not stripped or len(stripped) > 80:
            return False
        # Only letters, spaces, commas, dots, hyphens — classic name/title pattern
        return bool(re.match(r'^[A-Za-z][\w\s,\.\-&]*$', stripped))

    # First pass: find a hard delimiter
    sig_start = len(clean_lines)
    for idx, line in enumerate(clean_lines):
        for pat in sig_hard_delimiters:
            if re.match(pat, line.strip()):
                sig_start = idx
                break
        if sig_start < len(clean_lines):
            break

    # Second pass: if no hard delimiter found, detect blank-then-name/title block
    if sig_start == len(clean_lines) and clean_lines:
        # Find the first blank/nbsp line — this is a candidate split point
        for idx, line in enumerate(clean_lines):
            if is_empty_or_nbsp(line):
                # Check if everything from here onward is blank/nbsp or signature-like text
                remainder = clean_lines[idx:]
                all_sig = all(is_empty_or_nbsp(l) or is_signature_line(l) for l in remainder)
                if all_sig and idx > 0:
                    sig_start = idx
                    break

    clean_lines = clean_lines[:sig_start]

    # ── Step 3: Final cleanup ──────────────────────────────────────────────────
    reply_content = '\n'.join(clean_lines).strip()
    # Remove trailing &nbsp; / NBSP artifacts
    reply_content = re.sub(r'(\s*&nbsp;\s*)+$', '', reply_content).strip()
    reply_content = re.sub(r'(\s*[\xa0\u00a0]\s*)+$', '', reply_content).strip()

    if not reply_content:
        reply_content = body.strip()   # Fallback: return raw body if parsing yields nothing
    return reply_content




def clean_html(html_str):
    """Convert HTML email body to plain text, preserving line structure."""
    if not html_str:
        return ""
    try:
        from html.parser import HTMLParser
        import html as _html

        class _TextExtractor(HTMLParser):
            BLOCK_TAGS = {
                'p', 'div', 'br', 'tr', 'td', 'th', 'li', 'h1', 'h2', 'h3',
                'h4', 'h5', 'h6', 'blockquote', 'pre', 'hr', 'table'
            }
            SKIP_TAGS = {'script', 'style', 'head'}

            def __init__(self):
                super().__init__()
                self.parts = []
                self._skip = 0

            def handle_starttag(self, tag, attrs):
                tag_lower = tag.lower()
                if tag_lower in self.SKIP_TAGS:
                    self._skip += 1
                elif tag_lower in self.BLOCK_TAGS:
                    self.parts.append('\n')

            def handle_endtag(self, tag):
                tag_lower = tag.lower()
                if tag_lower in self.SKIP_TAGS:
                    self._skip = max(0, self._skip - 1)
                elif tag_lower in self.BLOCK_TAGS:
                    self.parts.append('\n')

            def handle_data(self, data):
                if self._skip == 0:
                    self.parts.append(data)

            def handle_entityref(self, name):
                if self._skip == 0:
                    self.parts.append(_html.unescape(f'&{name};'))

            def handle_charref(self, name):
                if self._skip == 0:
                    self.parts.append(_html.unescape(f'&#{name};'))

            def get_text(self):
                return ''.join(self.parts)

        extractor = _TextExtractor()
        extractor.feed(html_str)
        text = extractor.get_text()
        # Collapse 3+ consecutive newlines to 2 (preserve paragraph breaks)
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text
    except Exception:
        # Fallback to simple regex stripping
        text = re.sub(r'(?i)<br\s*/?>', '\n', html_str)
        text = re.sub(r'(?i)<tr[^>]*>', '\n', text)
        text = re.sub(r'(?i)</p>', '\n', text)
        text = re.sub(r'<[^>]+>', ' ', text)
        return text


# =====================================================================
# SECTION 3: INCOMING REPLY & BOUNCE MAIL FILTERS
# =====================================================================
def is_ndr_or_bounce(item) -> bool:
    subject = getattr(item, 'subject', '') or ''
    body = getattr(item, 'text_body', None) or getattr(item, 'body', None) or ""
    
    sender_email = "SYSTEM"
    if hasattr(item, 'sender') and item.sender and hasattr(item.sender, 'email_address') and item.sender.email_address:
        sender_email = item.sender.email_address
    elif hasattr(item, 'author') and item.author and hasattr(item.author, 'email_address') and item.author.email_address:
        sender_email = item.author.email_address
        
    sender_name = ""
    if hasattr(item, 'sender') and item.sender and hasattr(item.sender, 'name'):
        sender_name = item.sender.name or ""
    elif hasattr(item, 'author') and item.author and hasattr(item.author, 'name'):
        sender_name = item.author.name or ""
        
    subject_lower = subject.lower().strip()
    sender_email_lower = sender_email.lower().strip()
    sender_name_lower = sender_name.lower().strip()
    body_lower = body.lower()
    
    # 1. Check sender email
    if (
        "postmaster@" in sender_email_lower or
        "mailer-daemon@" in sender_email_lower or
        "mailer_daemon@" in sender_email_lower or
        "postmaster" in sender_email_lower or
        "microsoftexchange" in sender_email_lower
    ):
        return True
        
    # 2. Check sender display name
    if (
        "microsoft outlook" in sender_name_lower or
        "postmaster" in sender_name_lower or
        "mailer-daemon" in sender_name_lower or
        "mailer daemon" in sender_name_lower
    ):
        return True
        
    # 3. Check subject prefixes
    if (
        subject_lower.startswith("undeliverable:") or
        subject_lower.startswith("undelivered:") or
        subject_lower.startswith("delivery failure") or
        subject_lower.startswith("delivery status notification") or
        subject_lower.startswith("returned mail:") or
        "mail delivery failed" in subject_lower
    ):
        return True
        
    # 4. Check body content indicators of delivery failures
    if (
        "couldn't be delivered" in body_lower or
        "wasn't found at" in body_lower or
        "non-delivery report" in body_lower or
        "delivery failure" in body_lower or
        "delivery status notification" in body_lower or
        "diagnostic code:" in body_lower or
        "diagnostic-code:" in body_lower or
        "550 5.1.10" in body_lower or
        "5.1.10" in body_lower or
        "address rejected" in body_lower
    ):
        return True
        
    return False


def process_incoming_reply(item) -> bool:
    subject = (item.subject or "").strip()
    if not subject:
        return False

    ticket_match = re.search(r'Ticket\s*#?\s*(\d+)', subject, re.IGNORECASE)
    if not ticket_match:
        return False
        
    ticket_id = int(ticket_match.group(1))
        
    body = getattr(item, 'text_body', None) or getattr(item, 'body', None) or ""
    
    # Get sender details
    sender_email = "SYSTEM"
    if hasattr(item, 'sender') and item.sender and hasattr(item.sender, 'email_address') and item.sender.email_address:
        sender_email = item.sender.email_address
    elif hasattr(item, 'author') and item.author and hasattr(item.author, 'email_address') and item.author.email_address:
        sender_email = item.author.email_address
        
    sender_lower = sender_email.lower().strip()
    subject_lower = subject.lower()
    
    # Filter out automated system alert email copies and NDR bounce emails
    if is_ndr_or_bounce(item):
        print(f"[REPLY FILTER] Skipping NDR bounce: {subject} from {sender_email}")
        return False
        
    is_reply_or_fwd = bool(re.match(r'^\s*(re|fw|fwd|reply|forward|aw|wg|rv)\s*:\s*', subject, re.IGNORECASE))
    system_email = (USER or "dccagent@geopits.com").lower().strip()
    
    # Extract reply message text for validation of internal content
    body_text_to_use = body
    if body_text_to_use and ("<html" in body_text_to_use.lower() or "<div" in body_text_to_use.lower() or "<p" in body_text_to_use.lower() or "<br" in body_text_to_use.lower()):
        body_text_to_use = clean_html(body_text_to_use)
    extracted_content = extract_reply_message(body_text_to_use)
    extracted_lower = extracted_content.lower()
    
    is_automated = (
        "[auto]" in subject_lower or
        "[geomon log alert]" in subject_lower or
        "new log incident alert" in subject_lower or
        "database system alert:" in extracted_lower or 
        "database service restart event" in extracted_lower or
        "geomon incident center" in extracted_lower or
        "ticket reference details" in extracted_lower or
        "assigned agent:" in extracted_lower or
        "resource spike alert summary" in extracted_lower or 
        "critical: server down alert" in extracted_lower or
        "executing sql" in extracted_lower or
        "spid" in extracted_lower or
        "automated daily storage audit" in extracted_lower or
        "always from mailbox: dccagent@geopits.com" in extracted_lower or
        "this is an automated notification" in extracted_lower or
        "this alert was triggered automatically" in extracted_lower or
        "uptime alert triggered:" in extracted_lower or
        "log file shrinking" in extracted_lower or
        "open alert (id:" in extracted_lower or
        "resolved alert (id:" in extracted_lower or
        (sender_lower == system_email and not is_reply_or_fwd and not ticket_match)
    )
    
    if is_automated:
        print(f"[REPLY FILTER] Skipping automated system email: {subject}")
        return False
        
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM tickets WHERE id = %s;", (ticket_id,))
        if not cur.fetchone():
            cur.close()
            conn.close()
            return False # Ticket does not exist
            
        # Get sender details
        sender_email = "SYSTEM"
        if hasattr(item, 'sender') and item.sender and hasattr(item.sender, 'email_address') and item.sender.email_address:
            sender_email = item.sender.email_address
        elif hasattr(item, 'author') and item.author and hasattr(item.author, 'email_address') and item.author.email_address:
            sender_email = item.author.email_address
        # Check if body is HTML
        if body and ("<html" in body.lower() or "<div" in body.lower() or "<p" in body.lower() or "<br" in body.lower()):
            body = clean_html(body)
            
        clean_reply = extract_reply_message(body)
        
        email_lower = sender_email.lower().strip()
        if email_lower.endswith("@geopits.com"):
            comment_type = "dba_reply"
        else:
            comment_type = "client_reply"
            
        # Check for duplicates: avoid duplicate comments if the reply content already exists in the ticket comments
        # (e.g. for dashboard-sent emails or duplicated emails)
        cur.execute("""
            SELECT content FROM ticket_comments 
            WHERE ticket_id = %s;
        """, (ticket_id,))
        existing_comments = cur.fetchall()
        is_dup = False
        clean_reply_stripped = clean_reply.strip().lower() if clean_reply else ""
        if clean_reply_stripped:
            for (econtent,) in existing_comments:
                if econtent and econtent.strip().lower() == clean_reply_stripped:
                    is_dup = True
                    break
        
        if not is_dup:
            cur.execute("""
                SELECT id FROM ticket_comments 
                WHERE ticket_id = %s AND author = %s AND comment_type = %s AND content = %s 
                LIMIT 1;
            """, (ticket_id, sender_email, comment_type, clean_reply))
            if cur.fetchone():
                is_dup = True
                
        if is_dup:
            cur.close()
            conn.close()
            print(f"[REPLY FILTER] Duplicate comment detected for Ticket #{ticket_id}. Skipping insertion/email.")
            return True # Already processed
            
        # Insert reply comment
        cur.execute("""
            INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
            VALUES (%s, %s, %s, %s, %s);
        """, (ticket_id, sender_email, comment_type, clean_reply, ''))
        
        # Insert log comment
        action_desc = "DBA Team member replied via email" if comment_type == "dba_reply" else "Client replied via email"
        cur.execute("""
            INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
            VALUES (%s, %s, 'log', %s, '');
        """, (ticket_id, sender_email, f"Email received: {sender_email} ({action_desc})."))
        
        # Insert notification
        notify_msg = f"New {action_desc} on Ticket #{ticket_id}"
        cur.execute("INSERT INTO notifications (username, message, is_read) VALUES ('global', %s, FALSE);", (notify_msg,))
        
        conn.commit()

        # Get ticket details for email routing and notification
        try:
            cur.execute("SELECT company, ticket_name, contact, agent, status, business_unit FROM tickets WHERE id = %s;", (ticket_id,))
            ticket_row = cur.fetchone()
            if ticket_row:
                company, ticket_name, ticket_contact, ticket_agent, ticket_status, business_unit = ticket_row
                
                # Send alert mail based on that mail reply
                to_list = []
                if comment_type == "client_reply":
                    # Alert the DBA / Support team
                    agent_email = None
                    if ticket_agent:
                        cur.execute("SELECT email FROM users WHERE username = %s;", (ticket_agent,))
                        agent_row = cur.fetchone()
                        if agent_row and agent_row[0]:
                            agent_email = agent_row[0].strip()
                    
                    if agent_email:
                        to_list.append(agent_email)
                    
                    tech_email = get_technology_alert_email(cur, business_unit)
                    if tech_email:
                        for email in re.split(r'[;,]', tech_email):
                            email = email.strip()
                            if email and email not in to_list:
                                to_list.append(email)
                                
                    recipient_role = "DBA Support Team"
                else:
                    # Alert the Client
                    if ticket_contact:
                        for email in re.split(r'[;,]', ticket_contact):
                            email = email.strip()
                            if email and email not in to_list:
                                to_list.append(email)
                    
                    if not to_list:
                        client_email, _ = lookup_client_contact_details(cur, company, business_unit)
                        if client_email:
                            for email in re.split(r'[;,]', client_email):
                                email = email.strip()
                                if email and email not in to_list:
                                    to_list.append(email)
                                    
                    recipient_role = "Client Operations"
                
                # Exclude system mailbox (dccagent@geopits.com) from the reply alerts to avoid loops
                system_email = (USER or "dccagent@geopits.com").lower().strip()
                to_list = [email for email in to_list if email.lower().strip() != system_email]
                to_emails = ", ".join(to_list) if to_list else "admin@geomon.com"
                
                subject = f"RE: [Ticket #{ticket_id}] {ticket_name}"
                
                header_title = "Client Update Alert" if comment_type == "client_reply" else "DBA Support Update"
                accent_color = "#2563eb" if comment_type == "client_reply" else "#ea580c"
                
                html_body = f"""
                <html>
                <head>
                    <style>
                        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333333; line-height: 1.6; background-color: #f7fafc; margin: 0; padding: 0; }}
                        .container {{ max-width: 650px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }}
                        .header {{ background-color: #0c0f1d; padding: 25px 30px; color: #ffffff; border-bottom: 3px solid {accent_color}; }}
                        .header h2 {{ margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }}
                        .header p {{ margin: 5px 0 0 0; font-size: 13px; opacity: 0.85; text-transform: uppercase; letter-spacing: 1px; }}
                        .content {{ padding: 30px; }}
                        .comment-block {{ background-color: #f8fafc; padding: 20px; border-left: 4px solid {accent_color}; border-radius: 6px; margin-bottom: 30px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.02); }}
                        .comment-title {{ font-size: 13px; color: #64748b; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; }}
                        .comment-text {{ font-size: 15px; color: #1e293b; white-space: pre-wrap; }}
                        .section-title {{ font-size: 15px; font-weight: 800; color: #0c0f1d; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-top: 30px; }}
                        .info-table {{ width: 100%; border-collapse: collapse; margin-top: 12px; }}
                        .info-table td {{ padding: 8px 0; font-size: 14px; vertical-align: top; }}
                        .info-label {{ color: #64748b; font-weight: 600; width: 160px; }}
                        .info-value {{ color: #1e293b; }}
                        .badge-priority {{ display: inline-block; background-color: #fee2e2; color: #ef4444; padding: 2px 10px; border-radius: 9999px; font-weight: 750; font-size: 11px; }}
                        .badge-status {{ display: inline-block; background-color: #dbeafe; color: #2563eb; padding: 2px 10px; border-radius: 9999px; font-weight: 750; font-size: 11px; }}
                        .footer {{ background-color: #f1f5f9; padding: 15px 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }}
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2>GeoMon Incident Center</h2>
                            <p>{header_title} on Ticket #{ticket_id}</p>
                        </div>
                        <div class="content">
                            <div class="comment-block">
                                <div class="comment-title">New Reply from {sender_email} ({recipient_role} Alert)</div>
                                <div class="comment-text">{clean_reply}</div>
                            </div>
                            
                            <div class="section-title">Ticket Reference Details</div>
                            <table class="info-table">
                                <tr>
                                    <td class="info-label">Ticket ID:</td>
                                    <td class="info-value"><strong>#{ticket_id}</strong></td>
                                </tr>
                                <tr>
                                    <td class="info-label">Ticket Name:</td>
                                    <td class="info-value">{ticket_name}</td>
                                </tr>
                                <tr>
                                    <td class="info-label">Assigned Agent:</td>
                                    <td class="info-value">{ticket_agent or 'Unassigned'}</td>
                                </tr>
                                <tr>
                                    <td class="info-label">Status:</td>
                                    <td class="info-value"><span class="badge-status">{ticket_status}</span></td>
                                </tr>
                                <tr>
                                    <td class="info-label">Business Unit / Tech:</td>
                                    <td class="info-value">{business_unit}</td>
                                </tr>
                            </table>
                        </div>
                        <div class="footer">
                            This is an automated alert notification. Please reply to this email to add further comments to the ticket.
                        </div>
                    </div>
                </body>
                </html>
                """
                
                # send_email_outlook is commented out per request to not send emails on replies
                # from routes import send_email_outlook
                # send_email_outlook(to_emails, None, subject, html_body, sender_email="dccagent@geopits.com")
                print(f"Reply alert email dispatch bypassed per user configuration for Ticket #{ticket_id}")
        except Exception as mail_err:
            print(f"Error during reply mail processing details fetch: {mail_err}")
        print(f"Successfully processed email reply for Ticket #{ticket_id} from {sender_email} as {comment_type}")
        cur.close()
        conn.close()
        return True
    except Exception as e:
        conn.rollback()
        print(f"Error processing incoming reply for Ticket #{ticket_id}: {e}")
        try:
            cur.close()
        except:
            pass
        conn.close()
        return False


# =====================================================================
# SECTION 4: OUTLOOK & GRAPH API CLIENTS
# =====================================================================
class GraphMailSender:
    def __init__(self, email_address, name=""):
        self.email_address = email_address
        self.name = name

class GraphMailItem:
    def __init__(self, message_dict, access_token, user_email):
        self._dict = message_dict
        self._access_token = access_token
        self._user_email = user_email
        self.id = message_dict.get("id")
        self.subject = message_dict.get("subject") or ""
        body_obj = message_dict.get("body") or {}
        raw_body = body_obj.get("content") or ""
        self.body = raw_body
        # Strip HTML tags so regex-based parsers (SPID, SQL text etc.) work on plain text
        try:
            from bs4 import BeautifulSoup
            _soup = BeautifulSoup(raw_body, "html.parser")
            for br in _soup.find_all("br"):
                br.replace_with("\n")
            for p in _soup.find_all(["p", "td", "tr"]):
                p.insert_after("\n")
            self.text_body = _soup.get_text(separator="\n", strip=True)
        except Exception:
            self.text_body = raw_body
        
        received_str = message_dict.get("receivedDateTime")
        if received_str:
            import datetime
            try:
                self.datetime_received = datetime.datetime.fromisoformat(received_str.replace("Z", "+00:00"))
            except Exception:
                self.datetime_received = datetime.datetime.now(datetime.timezone.utc)
        else:
            import datetime
            self.datetime_received = datetime.datetime.now(datetime.timezone.utc)
            
        sender_obj = message_dict.get("sender") or message_dict.get("from") or {}
        email_address_obj = sender_obj.get("emailAddress") or {}
        sender_email = email_address_obj.get("address") or "SYSTEM"
        sender_name = email_address_obj.get("name") or ""
        self.sender = GraphMailSender(sender_email, sender_name)
        self.author = GraphMailSender(sender_email, sender_name)
        self.is_read = message_dict.get("isRead", True)
        
    def save(self):
        url = f"https://graph.microsoft.com/v1.0/users/{self._user_email}/messages/{self.id}"
        headers = {
            "Authorization": f"Bearer {self._access_token}",
            "Content-Type": "application/json"
        }
        try:
            import requests
            r = requests.patch(url, json={"isRead": self.is_read}, headers=headers, timeout=10)
            if r.status_code == 200:
                print(f"Successfully marked message {self.id} as {'read' if self.is_read else 'unread'} via Graph API.")
            else:
                print(f"Failed to update message isRead via Graph API: {r.status_code} {r.text}")
        except Exception as e:
            print(f"Error updating message isRead via Graph API: {e}")

    @property
    def attachments(self):
        if not hasattr(self, "_attachments"):
            self._attachments = []
            if self._dict.get("hasAttachments", False) or self._dict.get("has_attachments", False):
                import base64
                import requests
                url = f"https://graph.microsoft.com/v1.0/users/{self._user_email}/messages/{self.id}/attachments"
                headers = {
                    "Authorization": f"Bearer {self._access_token}",
                    "Content-Type": "application/json"
                }
                try:
                    r = requests.get(url, headers=headers, timeout=15)
                    if r.status_code == 200:
                        attachments_data = r.json().get("value", [])
                        for att in attachments_data:
                            if att.get("@odata.type") == "#microsoft.graph.fileAttachment" or "contentBytes" in att:
                                name = att.get("name") or ""
                                content_b64 = att.get("contentBytes")
                                if content_b64:
                                    try:
                                        content = base64.b64decode(content_b64)
                                        class GraphAttachment:
                                            def __init__(self, name, content):
                                                self.name = name
                                                self.content = content
                                        self._attachments.append(GraphAttachment(name, content))
                                    except Exception as decode_err:
                                        print(f"Error decoding attachment {name}: {decode_err}")
                except Exception as e:
                    print(f"Error fetching attachments via Graph API: {e}")
        return self._attachments

class GraphQuery:
    def __init__(self, folder_name, access_token, user_email, since_dt=None):
        """since_dt: ISO-8601 UTC string like '2026-06-28T10:00:00Z' (receivedDateTime watermark).
        If None, fetches the last 200 messages with no time filter."""
        self.folder_name = folder_name
        self.since_dt = since_dt
        self.access_token = access_token
        self.user_email = user_email

    def order_by(self, order_str):
        # No-op: ordering is handled internally via receivedDateTime asc
        return self

    def __getitem__(self, val):
        limit = 50
        if isinstance(val, slice):
            limit = val.stop or 50

        import requests
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }

        # ── Resolve folder ID ────────────────────────────────────────────────
        folder_id = "inbox"
        if self.folder_name == "sentitems":
            folder_id = "sentitems"
        elif self.folder_name != "inbox":
            try:
                folders_url = f"https://graph.microsoft.com/v1.0/users/{self.user_email}/mailFolders?$top=100"
                r = requests.get(folders_url, headers=headers, timeout=15)
                if r.status_code == 200:
                    folders = r.json().get("value", [])
                    print(f"[GRAPH API] Available mail folders: {[f.get('displayName') for f in folders]}")
                    for f in folders:
                        dn = f.get("displayName", "").lower()
                        if dn == self.folder_name.lower():
                            folder_id = f.get("id")
                            break
                        # Substring fallback for MySQL-Mongo-Postgres size report folder
                        if "mysql" in self.folder_name.lower() and ("postgres" in self.folder_name.lower() or "mongo" in self.folder_name.lower()):
                            if "mysql" in dn and ("postgres" in dn or "mongo" in dn):
                                folder_id = f.get("id")
                                print(f"[GRAPH API] Match found: '{f.get('displayName')}' matched requested folder '{self.folder_name}'")
                                break
                    if folder_id == "inbox" and self.folder_name.lower() in ["ai-report-automation", "mssql alert",
                                                                               "mysql-mongo-postgres-db",
                                                                               "mysql mongo postgres- db & table size",
                                                                               "mysql mongo postgres-db",
                                                                               "mysql-mongo-postgres"]:
                        for f in folders:
                            dn = f.get("displayName", "").lower()
                            if dn in ["mssql alert", "mssql_reportdata",
                                      "mysql-mongo-postgres-db",
                                      "mysql mongo postgres- db & table size",
                                      "mysql mongo postgres-db",
                                      "mysql-mongo-postgres"] or ("mysql" in dn and "postgres" in dn):
                                folder_id = f.get("id")
                                break
            except Exception as e:
                print(f"Error fetching mail folders: {e}")

        # ── Build URL using receivedDateTime watermark (NOT isRead) ──────────
        # Graph API supports $filter=receivedDateTime ge {dt} combined with
        # $orderBy=receivedDateTime asc because the filter and order fields match.
        messages = []
        try:
            if self.since_dt:
                filter_str = f"receivedDateTime ge {self.since_dt}"
                order_str  = "receivedDateTime asc"
            else:
                filter_str = ""
                order_str  = "receivedDateTime desc"

            url = (f"https://graph.microsoft.com/v1.0/users/{self.user_email}"
                   f"/mailFolders/{folder_id}/messages?$top={limit}")
            if filter_str:
                url += f"&$filter={filter_str}"
            url += f"&$orderBy={order_str}"

            r = requests.get(url, headers=headers, timeout=15)
            if r.status_code == 200:
                for v in r.json().get("value", []):
                    messages.append(GraphMailItem(v, self.access_token, self.user_email))
            else:
                print(f"Error fetching messages from Graph API: {r.status_code} {r.text}")
        except Exception as e:
            print(f"Error fetching messages via Graph API: {e}")

        return messages


class GraphFolder:
    def __init__(self, folder_name, access_token, user_email):
        self.folder_name = folder_name
        self.access_token = access_token
        self.user_email = user_email

    def since(self, dt_str):
        """Return a GraphQuery that fetches messages with receivedDateTime >= dt_str (ISO-8601 UTC)."""
        return GraphQuery(self.folder_name, self.access_token, self.user_email, since_dt=dt_str)

    def filter(self, is_read=False):
        # Legacy compatibility — delegates to since() with no time filter.
        # isRead filtering is intentionally dropped; dedup uses processed_emails instead.
        return GraphQuery(self.folder_name, self.access_token, self.user_email, since_dt=None)

    def all(self):
        return GraphQuery(self.folder_name, self.access_token, self.user_email, since_dt=None)

class GraphAccountRoot:
    def __init__(self, access_token, user_email):
        self.access_token = access_token
        self.user_email = user_email
        
    def __truediv__(self, other):
        if other == "Top of Information Store":
            return self
        return GraphFolder(other, self.access_token, self.user_email)

class GraphAccount:
    def __init__(self, access_token, user_email):
        self.access_token = access_token
        self.user_email = user_email
        self.root = GraphAccountRoot(access_token, user_email)
        self.inbox = GraphFolder("inbox", access_token, user_email)
        self.sent = GraphFolder("sentitems", access_token, user_email)

def get_account():
    if USER and PASSWORD:
        try:
            credentials=OAuth2LegacyCredentials(
                client_id=CLIENT_ID,
                client_secret=CLIENT_SECRET,
                tenant_id=TENANT_ID,
                username=USER,
                password=PASSWORD
            )

            config=Configuration(
                server="outlook.office365.com",
                credentials=credentials,
                auth_type=OAUTH2
            )

            return Account(
                primary_smtp_address=USER,
                config=config,
                autodiscover=False,
                access_type=DELEGATE
            )
        except Exception as e:
            print("EWS connection failed:", e)
            
    if CLIENT_ID and CLIENT_SECRET and TENANT_ID and USER:
        print("[GRAPH API] Attempting to initialize live Exchange connection using Microsoft Graph API...")
        try:
            import requests
            token_url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
            token_data = {
                "grant_type": "client_credentials",
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "scope": "https://graph.microsoft.com/.default"
            }
            token_r = requests.post(token_url, data=token_data, timeout=10)
            if token_r.status_code == 200:
                access_token = token_r.json().get("access_token")
                if access_token:
                    print("[GRAPH API] Successfully connected to live Exchange server via MS Graph!")
                    return GraphAccount(access_token, USER)
        except Exception as graph_err:
            print("[GRAPH API] Failed to connect to live Exchange server:", graph_err)
            
    print("Warning: USER_EMAIL or MAIL_PASSWORD is not configured or Graph credentials missing. Skipping mailbox authentication (running in simulated local mode).")
    return None

account = get_account()
if account:
    print("Connected to mailbox successfully!")
else:
    print("Outlook Mailbox integration bypassed (local mode).")

# =====================================================================
# SECTION 5: EVENT, ERROR & REPORT PARSERS
# =====================================================================
def parse_event(body):
    logs=[]
    blocks=body.split("-------------------------------------------------")

    for b in blocks:
        t_m=re.search(r"Time:\s*(.*?)\s*(?:Provider:|Message:|$)", b, re.IGNORECASE | re.DOTALL)
        p_m=re.search(r"Provider:\s*(.*?)\s*(?:Message:|$)", b, re.IGNORECASE | re.DOTALL)
        m_m=re.search(r"Message:\s*(.*)", b, re.IGNORECASE | re.DOTALL)

        if not t_m or not m_m:
            continue

        time_val=t_m.group(1).strip()
        provider=p_m.group(1).strip() if p_m else "Windows"
        msg=m_m.group(1).strip()
        
        time_val=time_val.replace('\r', '').replace('\n', ' ')

        if not time_val or time_val.lower().startswith("provider") or msg.lower()=="message":
            continue

        logs.append((time_val,provider,msg))

    return logs

def parse_error(body):
    logs=[]
    pattern=r"<log>(.*?)</log>"
    entries=re.findall(pattern,body,re.DOTALL)

    for e in entries:
        time_match=re.search(r"<LogDate>(.*?)</LogDate>",e)
        src_match=re.search(r"<ProcessInfo>(.*?)</ProcessInfo>",e)
        msg_match=re.search(r"<Text>(.*?)</Text>",e)

        if not time_match or not msg_match:
            continue

        logs.append(
        (
        time_match.group(1),
        src_match.group(1) if src_match else "MSSQL",
        msg_match.group(1)
        ))

    return logs

def parse_agent(body):
    logs=[]
    if "<alert>" in body or "<alerts>" in body:
        try:
            alert_chunks = re.findall(r'<alert>(.*?)</alert>', body, re.DOTALL)
            for chunk in alert_chunks:
                ts_match = re.search(r'<timestamp>(.*?)</timestamp>', chunk, re.DOTALL)
                msg_match = re.search(r'<message>(.*?)</message>', chunk, re.DOTALL)
                type_match = re.search(r'<type>(.*?)</type>', chunk, re.DOTALL)
                
                if ts_match and msg_match:
                    ts = ts_match.group(1).strip()
                    msg = msg_match.group(1).strip()
                    l_type = type_match.group(1).strip() if type_match else "SCHEDULER"
                    logs.append((ts, l_type, msg))
            return logs
        except Exception as e:
            print("Oracle XML parsing error:", e)
    try:
        start=body.find("{")
        end=body.rfind("}")+1
        json_text=body[start:end]
        json_text=json_text.replace("\n","").replace("\r","").replace("=","")
        data=json.loads(json_text)

        for row in data.get("AgentJobLogs",[]):
            logs.append(
            (
            row["RunDateTime"],
            row["JobName"],
            row["Message"]
            ))
    except Exception as e:
        print("Agent parser error:",e)

    return logs

def get_default_server(client, subject=""):
    client_lower = client.lower() if client else ""
    if "shemaroo" in client_lower:
        return "EC2AMAZ-A1O1M2J"
    elif "credopay" in client_lower:
        if "dr" in (subject or "").lower():
            return "vm-cp-dr-marsdb"
        return "MARSPRODDB-01"
    elif "cropin" in client_lower:
        if "node2" in (subject or "").lower():
            return "WSFCNODE2"
        return "WSFCNODE1"
    elif "retailscan" in client_lower:
        return "EC2AMAZ-IC6PG05"
    return "Unknown-Server"

def parse_db_uptime_report(body, client, server, subject=""):
    # Clean/normalize body text first
    text = body
    text = re.sub(r'(?i)<tr[^>]*>', '\n', text)
    text = re.sub(r'(?i)<br\s*/?>', '\n', text)
    text = re.sub(r'(?i)</p>', '\n', text)
    text = re.sub(r'<[^>]+>', ' ', text)
    
    # Extract server name from cleaned text if present
    server_match = re.search(r'(?:Server\s*Name|Server)\s*[:|\-]?\s*([a-zA-Z0-9_\-\\]+)', text, re.IGNORECASE)
    if server_match:
        server = server_match.group(1).strip()
    
    if not server or server.lower() == "unknown":
        server = get_default_server(client, subject)
        
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    
    service_keywords = [
        "SQL Server (MSSQLSERVER)",
        "SQL Server Agent (MSSQLSERVER)",
        "SQL Server Launchpad (MSSQLSERVER)",
        "SQL Server Browser",
        "SQL Writer",
        "SQL Server",
        "SQL Server Agent",
        "SQL Server Launchpad"
    ]
    
    services_found = []
    
    for line in lines:
        matched_kw = None
        for kw in service_keywords:
            if kw.lower() in line.lower():
                matched_kw = kw
                break
        if matched_kw:
            status_match = re.search(r'\b(RUNNING|STOPPED|PAUSED|STARTING|STOPPING|ONLINE|OFFLINE)\b', line, re.IGNORECASE)
            status = status_match.group(1).upper() if status_match else "RUNNING"
            
            datetime_match = re.search(r'\b\d{1,2}\s+[a-zA-Z]{3,9}\s+\d{4}\s+\d{2}:\d{2}:\d{2}(?:[.:]\d+)?\b', line)
            if not datetime_match:
                datetime_match = re.search(r'\b\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\b', line)
            
            restart_time_str = datetime_match.group(0) if datetime_match else None
            
            services_found.append({
                "service_name": matched_kw,
                "status": status,
                "last_restart_time": restart_time_str
            })
            
    if not services_found:
        services_found.append({
            "service_name": "SQL Server (MSSQLSERVER)",
            "status": "RUNNING",
            "last_restart_time": None
        })
        
    return services_found, server

def lookup_client_contact_details(cursor, client_name, db_type):
    try:
        cursor.execute("""
            SELECT client_email, phone_number 
            FROM admin_clients 
            WHERE LOWER(TRIM(client_name)) = LOWER(TRIM(%s)) 
              AND LOWER(TRIM(db_type)) = LOWER(TRIM(%s))
            LIMIT 1;
        """, (client_name, db_type))
        row = cursor.fetchone()
        if row and row[0]:
            return row[0], row[1]
    except Exception as e:
        print(f"Error checking admin_clients contacts: {e}")
        
    try:
        cursor.execute("""
            SELECT client_email, phone_number 
            FROM client_access 
            WHERE LOWER(TRIM(client_name)) = LOWER(TRIM(%s)) 
              AND LOWER(TRIM(technology)) = LOWER(TRIM(%s))
            LIMIT 1;
        """, (client_name, db_type))
        row = cursor.fetchone()
        if row and row[0]:
            return row[0], row[1]
    except Exception as e:
        print(f"Error checking client_access contacts: {e}")
        
    return None, None

def get_technology_alert_email(cursor, db_type):
    try:
        cursor.execute("SELECT alert_email FROM technology_alerts_config WHERE LOWER(technology) = LOWER(%s);", (db_type,))
        row = cursor.fetchone()
        if row and row[0]:
            return row[0]
    except Exception as e:
        print(f"Error reading technology_alerts_config: {e}")
    return None


def check_and_trigger_uptime_alerts(cur, client, server, db_type, svc, restart_dt, received):
    # 1. Fetch previous state of this service
    prev_status = None
    prev_restart_time = None
    try:
        cur.execute("""
            SELECT status, last_restart_time 
            FROM db_uptime_history
            WHERE LOWER(TRIM(client_name)) = LOWER(TRIM(%s)) 
              AND LOWER(TRIM(server_name)) = LOWER(TRIM(%s)) 
              AND LOWER(TRIM(service_name)) = LOWER(TRIM(%s))
            ORDER BY captured_at DESC LIMIT 1;
        """, (client, server, svc["service_name"]))
        row = cur.fetchone()
        if row:
            prev_status = row[0]
            prev_restart_time = row[1]
    except Exception as e:
        print(f"Error fetching previous uptime history: {e}")

    # Determine changes
    is_stopped = (svc["status"].upper() == "STOPPED")
    
    has_restarted = False
    if restart_dt and prev_restart_time:
        # compare as offset-naive datetimes
        curr_naive = restart_dt.replace(tzinfo=None)
        prev_naive = prev_restart_time.replace(tzinfo=None) if hasattr(prev_restart_time, 'replace') else prev_restart_time
        if curr_naive != prev_naive:
            has_restarted = True

    # Get contact emails
    client_email, _ = lookup_client_contact_details(cur, client, db_type)
    tech_email = get_technology_alert_email(cur, db_type)

    if not client_email:
        print(f"[ALERT ROUTING] there is no client mail")
    if not tech_email:
        print(f"[ALERT ROUTING] there is no technology alert mail")

    to_list = ["dccagent@geopits.com"]
    if client_email:
        for e in re.split(r'[;,]', client_email):
            e = e.strip()
            if e and e not in to_list:
                to_list.append(e)
    if tech_email:
        for e in re.split(r'[;,]', tech_email):
            e = e.strip()
            if e and e not in to_list:
                to_list.append(e)
    to_emails = ", ".join(to_list)
    cc_emails = None

    try:
        from routes import send_email_outlook
    except Exception as e:
        print(f"Error importing send_email_outlook: {e}")
        return

    # 2. Trigger Stopped Service Alert
    if is_stopped:
        # Check if an open ticket for this service stopped already exists
        cur.execute("""
            SELECT id FROM tickets 
            WHERE company = %s 
              AND ticket_name = %s 
              AND status NOT IN ('RESOLVED', 'CLOSED');
        """, (client, f"{client} {server} - {svc['service_name']} STOPPED"))
        exists_stopped_ticket = cur.fetchone()
        
        if not exists_stopped_ticket:
            ticket_name = f"{client} {server} - {svc['service_name']} STOPPED"
            description = (
                f"Service Stopped Alert:\n"
                f"Client: {client}\n"
                f"Server: {server}\n"
                f"Technology: {db_type}\n"
                f"Service: {svc['service_name']}\n"
                f"Status: STOPPED\n"
                f"Captured At: {received.strftime('%Y-%m-%d %H:%M:%S')}"
            )
            
            cur.execute("""
                INSERT INTO tickets (business_unit, company, contact, ticket_name, category, status, priority, agent, description, created_by, created_at)
                VALUES (%s, %s, %s, %s, 'Logs', 'OPEN', 'High', 'SYSTEM', %s, 'System', %s)
                RETURNING id;
            """, (db_type, client, to_emails, ticket_name, description, received))
            new_ticket_id = cur.fetchone()[0]
            # Commit ticket insertion immediately to prevent sequence skipping on any subsequent errors
            cur.connection.commit()
            
            # Insert log comment
            cur.execute("""
                INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
                VALUES (%s, 'System', 'log', %s, '');
            """, (new_ticket_id, f"Uptime alert triggered: service {svc['service_name']} status is STOPPED."))

            # Log email routing outcome
            if to_emails:
                email_log_msg = f"Alert email sent to: {to_emails}"
                if cc_emails:
                    email_log_msg += f" (CC: {cc_emails})"
            else:
                email_log_msg = f"Email alert skipped: No recipient email configured for client {client} or database technology {db_type}."
            cur.execute("""
                INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
                VALUES (%s, 'System', 'log', %s, '');
            """, (new_ticket_id, email_log_msg))
            
            # Send email
            email_body = f"""
            <html>
            <body style="font-family: Calibri, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
                <div style="background-color: #dc2626; color: white; padding: 20px; border-radius: 8px;">
                    <h2 style="margin: 0; font-size: 20px;">🚨 Database Service Stopped Alert</h2>
                    <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Ticket #{new_ticket_id} - High Priority Uptime Alert</p>
                </div>
                <div style="margin-top: 20px; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; background-color: #f8fafc;">
                    <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">Hi Team,</p>
                    <p>The following database service status has been reported as <strong>STOPPED</strong>:</p>
                    <table style="border-collapse: collapse; width: 100%; max-width: 600px; margin-top: 15px; background: white;">
                        <tr>
                            <th style="border: 1px solid #cbd5e1; padding: 10px 12px; background-color: #f1f5f9; text-align: left; font-weight: bold; width: 150px;">Client</th>
                            <td style="border: 1px solid #cbd5e1; padding: 10px 12px;">{client}</td>
                        </tr>
                        <tr>
                            <th style="border: 1px solid #cbd5e1; padding: 10px 12px; background-color: #f1f5f9; text-align: left; font-weight: bold;">Server</th>
                            <td style="border: 1px solid #cbd5e1; padding: 10px 12px;">{server}</td>
                        </tr>
                        <tr>
                            <th style="border: 1px solid #cbd5e1; padding: 10px 12px; background-color: #f1f5f9; text-align: left; font-weight: bold;">Service</th>
                            <td style="border: 1px solid #cbd5e1; padding: 10px 12px;">{svc['service_name']}</td>
                        </tr>
                        <tr>
                            <th style="border: 1px solid #cbd5e1; padding: 10px 12px; background-color: #f1f5f9; text-align: left; font-weight: bold;">Status</th>
                            <td style="border: 1px solid #cbd5e1; padding: 10px 12px; font-weight: bold; color: #dc2626;">STOPPED</td>
                        </tr>
                        <tr>
                            <th style="border: 1px solid #cbd5e1; padding: 10px 12px; background-color: #f1f5f9; text-align: left; font-weight: bold;">Captured At</th>
                            <td style="border: 1px solid #cbd5e1; padding: 10px 12px;">{received.strftime('%Y-%m-%d %H:%M:%S')}</td>
                        </tr>
                    </table>
                </div>
            </body>
            </html>
            """
            try:
                if to_emails:
                    send_email_outlook(to_emails, cc_emails, f"[Ticket #{new_ticket_id}] {ticket_name}", email_body, sender_email="dccagent@geopits.com")
                else:
                    print(f"[UPTIME ALERT] No recipient configured for {client} ({db_type}) — stopped-service email skipped.")
                print(f"[UPTIME ALERT] Created service stopped ticket #{new_ticket_id} and sent mail for {client} - {svc['service_name']}")
            except Exception as e:
                print(f"[UPTIME ALERT] Error sending service stopped email: {e}")

    # 3. Trigger Restart Event Alert
    if has_restarted:
        ticket_name = f"{client} {server} - {svc['service_name']} Restarted"
        
        # Check if we already created a restart ticket for this exact new timestamp to prevent duplicates
        cur.execute("""
            SELECT id FROM tickets 
            WHERE company = %s 
              AND ticket_name = %s 
              AND description LIKE %s;
        """, (client, ticket_name, f"%New Restart Time: {restart_dt.strftime('%Y-%m-%d %H:%M:%S')}%"))
        exists_restart_ticket = cur.fetchone()
        
        if not exists_restart_ticket:
            description = (
                f"Service Restart Alert:\n"
                f"Client: {client}\n"
                f"Server: {server}\n"
                f"Technology: {db_type}\n"
                f"Service: {svc['service_name']}\n"
                f"Previous Restart Time: {prev_restart_time.strftime('%Y-%m-%d %H:%M:%S') if hasattr(prev_restart_time, 'strftime') else prev_restart_time}\n"
                f"New Restart Time: {restart_dt.strftime('%Y-%m-%d %H:%M:%S')}\n"
                f"Captured At: {received.strftime('%Y-%m-%d %H:%M:%S')}"
            )
            
            cur.execute("""
                INSERT INTO tickets (business_unit, company, contact, ticket_name, category, status, priority, agent, description, created_by, created_at)
                VALUES (%s, %s, %s, %s, 'Logs', 'OPEN', 'Medium', 'SYSTEM', %s, 'System', %s)
                RETURNING id;
            """, (db_type, client, to_emails, ticket_name, description, received))
            new_ticket_id = cur.fetchone()[0]
            # Commit ticket insertion immediately to prevent sequence skipping on any subsequent errors
            cur.connection.commit()
            
            # Insert log comment
            cur.execute("""
                INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
                VALUES (%s, 'System', 'log', %s, '');
            """, (new_ticket_id, f"Uptime alert triggered: last restart time has changed from {prev_restart_time} to {restart_dt}."))

            # Log email routing outcome
            if to_emails:
                email_log_msg = f"Alert email sent to: {to_emails}"
                if cc_emails:
                    email_log_msg += f" (CC: {cc_emails})"
            else:
                email_log_msg = f"Email alert skipped: No recipient email configured for client {client} or database technology {db_type}."
            cur.execute("""
                INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
                VALUES (%s, 'System', 'log', %s, '');
            """, (new_ticket_id, email_log_msg))
            
            # Send email
            email_body = f"""
            <html>
            <body style="font-family: Calibri, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
                <div style="background-color: #0284c7; color: white; padding: 20px; border-radius: 8px;">
                    <h2 style="margin: 0; font-size: 20px;">🔄 Database Service Restart Event</h2>
                    <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Ticket #{new_ticket_id} - Medium Priority Uptime Alert</p>
                </div>
                <div style="margin-top: 20px; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; background-color: #f8fafc;">
                    <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">Hi Team,</p>
                    <p>A change in the last restart time has been detected, indicating the service restarted:</p>
                    <table style="border-collapse: collapse; width: 100%; max-width: 600px; margin-top: 15px; background: white;">
                        <tr>
                            <th style="border: 1px solid #cbd5e1; padding: 10px 12px; background-color: #f1f5f9; text-align: left; font-weight: bold; width: 180px;">Client</th>
                            <td style="border: 1px solid #cbd5e1; padding: 10px 12px;">{client}</td>
                        </tr>
                        <tr>
                            <th style="border: 1px solid #cbd5e1; padding: 10px 12px; background-color: #f1f5f9; text-align: left; font-weight: bold;">Server</th>
                            <td style="border: 1px solid #cbd5e1; padding: 10px 12px;">{server}</td>
                        </tr>
                        <tr>
                            <th style="border: 1px solid #cbd5e1; padding: 10px 12px; background-color: #f1f5f9; text-align: left; font-weight: bold;">Service</th>
                            <td style="border: 1px solid #cbd5e1; padding: 10px 12px;">{svc['service_name']}</td>
                        </tr>
                        <tr>
                            <th style="border: 1px solid #cbd5e1; padding: 10px 12px; background-color: #f1f5f9; text-align: left; font-weight: bold;">Previous Restart Time</th>
                            <td style="border: 1px solid #cbd5e1; padding: 10px 12px;">{prev_restart_time.strftime('%Y-%m-%d %H:%M:%S') if hasattr(prev_restart_time, 'strftime') else prev_restart_time}</td>
                        </tr>
                        <tr>
                            <th style="border: 1px solid #cbd5e1; padding: 10px 12px; background-color: #f1f5f9; text-align: left; font-weight: bold;">New Restart Time</th>
                            <td style="border: 1px solid #cbd5e1; padding: 10px 12px; font-weight: bold; color: #0284c7;">{restart_dt.strftime('%Y-%m-%d %H:%M:%S')}</td>
                        </tr>
                        <tr>
                            <th style="border: 1px solid #cbd5e1; padding: 10px 12px; background-color: #f1f5f9; text-align: left; font-weight: bold;">Captured At</th>
                            <td style="border: 1px solid #cbd5e1; padding: 10px 12px;">{received.strftime('%Y-%m-%d %H:%M:%S')}</td>
                        </tr>
                    </table>
                </div>
            </body>
            </html>
            """
            try:
                if to_emails:
                    send_email_outlook(to_emails, cc_emails, f"[Ticket #{new_ticket_id}] {ticket_name}", email_body, sender_email="dccagent@geopits.com")
                else:
                    print(f"[UPTIME ALERT] No recipient configured for {client} ({db_type}) — restart-detected email skipped.")
                print(f"[UPTIME ALERT] Created service restart ticket #{new_ticket_id} and sent mail for {client} - {svc['service_name']}")
            except Exception as e:
                print(f"[UPTIME ALERT] Error sending service restart email: {e}")

# =====================================================================
# SECTION 6: CORE DB LOG INGESTION ENGINE (process_mail)
# =====================================================================
def process_mail(item, override_client=None, override_server=None, override_db=None, override_log_type=None):
    try:
        from routes import send_email_outlook
    except Exception as e:
        print(f"Error importing send_email_outlook in process_mail: {e}")
    subject=item.subject
    client,server,db,log_type=parse_subject(subject)
    
    if override_client is not None:
        client = override_client
    if override_server is not None:
        server = override_server
    if override_db is not None:
        db = override_db
    if override_log_type is not None:
        log_type = override_log_type
    
    if log_type not in ["error_log", "event_log", "agent_log", "db_uptime", "mssql_alert", "long_running_queries"]:
        return

    client = client or "Unknown"
    server = server or "Unknown"
    db = db or "Unknown"
    
    if client == "N/A":
        client = "Unknown"
    
    body = item.text_body
    if not body:
        body = str(item.body)
    # Always strip any residual HTML so descriptions / activity logs are plain text
    if body and ('<html' in body.lower() or '<body' in body.lower() or '<table' in body.lower() or '<td' in body.lower() or '<br' in body.lower()):
        try:
            from bs4 import BeautifulSoup as _BSMain
            _sm = _BSMain(body, 'html.parser')
            for _br in _sm.find_all('br'): _br.replace_with('\n')
            for _tag in _sm.find_all(['p', 'tr', 'td', 'div', 'li']): _tag.insert_after('\n')
            body = _sm.get_text(separator='\n', strip=True)
        except Exception:
            body = re.sub(r'<[^>]+>', ' ', body)
            body = re.sub(r'[ \t]+', ' ', body).strip()

    received=item.datetime_received

    if log_type=="event_log":
        logs=parse_event(body)
    elif log_type=="error_log":
        logs=parse_error(body)
    elif log_type=="agent_log":
        logs=parse_agent(body)
    elif log_type=="db_uptime":
        if db in ["MySQL", "PostgreSQL", "MongoDB"]:
            # Clean/normalize body text first
            text = body
            text = re.sub(r'(?i)<tr[^>]*>', '\n', text)
            text = re.sub(r'(?i)<br\s*/?>', '\n', text)
            text = re.sub(r'(?i)</p>', '\n', text)
            text = re.sub(r'<[^>]+>', ' ', text)
            lines = [l.strip() for l in text.split('\n') if l.strip()]
            cleaned_body = "\n".join(lines)

            # Map client and server to match database admin_clients registry
            c_lower = client.lower()
            if "cropin" in c_lower:
                client = "Cropin"
                server = "Cropin"
            elif "runloyal" in c_lower:
                client = "Runloyal"
                server = "Runloyal"
            elif "intentwise" in c_lower or "amazon" in c_lower:
                client = "Intentwise"
                server = "Intentwise"
            elif "shemaroo" in c_lower:
                client = "Shemaroo"
                server = "Shemaroo"
            elif "retailscan" in c_lower:
                client = "Retailscan"
                server = "Retailscan"
            elif "360tf" in c_lower:
                client = "360tf"
                server = "360tf"
            elif "artfine" in c_lower:
                client = "Artfine"
                server = "Artfine"
            elif "cnergee" in c_lower:
                client = "Cnergee"
                server = "Cnergee"
            elif "flowglobal" in c_lower:
                client = "Flowglobal"
                server = "Flowglobal"
            elif "credopay" in c_lower:
                client = "CredoPay"
                server = "CredoPay"

            # Search for service blocks (e.g. PRIMARY/REPLICA nodes)
            blocks = []
            headers = list(re.finditer(r'(?:[●🟢🔴*]*\s*)?([a-zA-Z0-9_\- ]+?\((?:PRIMARY|REPLICA)\))', cleaned_body, re.IGNORECASE))
            if headers:
                for idx, match in enumerate(headers):
                    start = match.end()
                    end = headers[idx+1].start() if idx + 1 < len(headers) else len(cleaned_body)
                    svc_name = match.group(1).strip()
                    block_text = cleaned_body[start:end]
                    blocks.append((svc_name, block_text))
            else:
                # Single node fallback
                blocks.append((db, cleaned_body))

            services = []
            for svc_name, block_text in blocks:
                # Parse status
                status_m = re.search(r'\bStatus\b\s*[:|-]?\s*([a-zA-Z0-9_-]+)', block_text, re.IGNORECASE)
                if status_m:
                    status = status_m.group(1).strip().upper()
                else:
                    status_m2 = re.search(r'\b(ONLINE|OFFLINE|RUNNING|STOPPED)\b', block_text, re.IGNORECASE)
                    status = status_m2.group(1).strip().upper() if status_m2 else "ONLINE"
                
                # Parse uptime
                uptime_desc = None
                uptime_m = re.search(r'(?:Database Uptime|Uptime)\s*[:|-]?\s*(.*)', block_text, re.IGNORECASE)
                if uptime_m:
                    uptime_desc = uptime_m.group(1).strip()
                    # Clean trailing response time or other labels if present
                    if "response time" in uptime_desc.lower():
                        uptime_desc = re.split(r'(?i)response time', uptime_desc)[0].strip()
                
                # Parse last restart time
                restart_time_str = None
                restart_m = re.search(r'Last Restart Time\s*[:|-]?\s*(.*)', block_text, re.IGNORECASE)
                if restart_m:
                    restart_time_str = restart_m.group(1).strip()
                    # Clean trailing database uptime or other labels if present
                    if "database uptime" in restart_time_str.lower():
                        restart_time_str = re.split(r'(?i)database uptime', restart_time_str)[0].strip()
                    if "uptime" in restart_time_str.lower():
                        restart_time_str = re.split(r'(?i)uptime', restart_time_str)[0].strip()
                
                # Clean up any potential markdown characters or html debris from value strings
                if uptime_desc:
                    uptime_desc = re.sub(r'[*_`#|]', '', uptime_desc).strip()
                if restart_time_str:
                    restart_time_str = re.sub(r'[*_`#|]', '', restart_time_str).strip()

                services.append({
                    "service_name": svc_name,
                    "status": status,
                    "last_restart_time": restart_time_str,
                    "uptime_desc": uptime_desc
                })
        else:
            services, resolved_server = parse_db_uptime_report(body, client, server, subject)
            server = resolved_server
        
        conn = get_connection()
        cur = conn.cursor()
        for svc in services:
            restart_dt = None
            if svc["last_restart_time"]:
                clean_ts = svc["last_restart_time"].strip()
                if clean_ts.count(":") == 3:
                    clean_ts = clean_ts.rsplit(":", 1)[0]
                else:
                    clean_ts = clean_ts.split(".")[0]
                try:
                    restart_dt = datetime.strptime(clean_ts, "%d %b %Y %H:%M:%S")
                except:
                    try:
                        restart_dt = datetime.strptime(clean_ts, "%d %B %Y %H:%M:%S")
                    except:
                        try:
                            restart_dt = datetime.strptime(clean_ts, "%Y-%m-%d %H:%M:%S")
                        except:
                            pass
            
            # Calculate dynamic uptime description for MSSQL
            uptime_desc = svc.get("uptime_desc")
            if not uptime_desc and restart_dt and received:
                delta = received - restart_dt
                days = delta.days
                hours, remainder = divmod(delta.seconds, 3600)
                minutes, _ = divmod(remainder, 60)
                parts = []
                if days > 0:
                    parts.append(f"{days} Days")
                if hours > 0 or days > 0:
                    parts.append(f"{hours} Hours")
                if minutes > 0 or (days == 0 and hours == 0):
                    parts.append(f"{minutes} Mins")
                uptime_desc = " ".join(parts) if parts else "0 Mins"
            
            if not uptime_desc:
                uptime_desc = svc.get("last_restart_time") or "ONLINE"
            
            # Save the calculated uptime_desc back to svc so logs list can also use it
            svc["uptime_desc"] = uptime_desc
            
            # Check and trigger alerts for restart or stopped status
            try:
                check_and_trigger_uptime_alerts(cur, client, server, db, svc, restart_dt, received)
            except Exception as e:
                print(f"Error checking uptime alerts in process_mail: {e}")

            cur.execute("""
                INSERT INTO db_uptime_history (client_name, server_name, db_type, service_name, status, uptime_desc, last_restart_time, captured_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (client_name, server_name, service_name, captured_at) DO UPDATE
                SET status = EXCLUDED.status,
                    uptime_desc = EXCLUDED.uptime_desc,
                    last_restart_time = EXCLUDED.last_restart_time
            """, (client, server, db, svc["service_name"], svc["status"], uptime_desc, restart_dt, received))
        conn.commit()
        
        logs = []
        for svc in services:
            log_time_str = svc["last_restart_time"] or received.strftime("%Y-%m-%d %H:%M:%S")
            msg = f"Service {svc['service_name']} is {svc['status']}. Last Uptime: {svc.get('uptime_desc') or 'N/A'}"
            logs.append((log_time_str, svc["service_name"], msg))
    elif log_type in ["mssql_alert", "long_running_queries"]:
        # Ensure body is plain text for SPID/SQL parsing
        _html_body_for_ticket = body
        if "<html" in body.lower() or "<body" in body.lower() or "<table" in body.lower():
            try:
                from bs4 import BeautifulSoup as _BS
                _s = _BS(body, "html.parser")
                for _br in _s.find_all("br"): _br.replace_with("\n")
                for _p in _s.find_all(["p", "td", "tr"]): _p.insert_after("\n")
                body = _s.get_text(separator="\n", strip=True)
            except Exception:
                pass
        spid, sql_text, alert_status = parse_mssql_alert(body, subject)

        # For job-failure / closed alerts with no SPID, still create a ticket from the subject
        if not spid:
            # Try to extract SPID from subject too
            _spid_subj = re.search(r'(?:SPID|Session\s*ID|Session-ID|SessionID)[\s:\-]+([\d]+)', subject, re.IGNORECASE)
            if _spid_subj:
                spid = _spid_subj.group(1).strip()

        if spid or True:  # Always process — if no SPID use subject as identifier
            # Extract sender email (or original sender if forwarded)
            sender_email = "SYSTEM"
            if hasattr(item, 'sender') and item.sender and hasattr(item.sender, 'email_address') and item.sender.email_address:
                sender_email = item.sender.email_address
            elif hasattr(item, 'author') and item.author and hasattr(item.author, 'email_address') and item.author.email_address:
                sender_email = item.author.email_address

            # Check if this email is a forward
            subject_str = getattr(item, 'subject', subject) or subject
            is_forwarded = any(prefix in subject_str.lower() for prefix in ["fwd:", "fw:", "re:"])
            if is_forwarded or "forwarded message" in body.lower():
                from_match = re.search(r'(?:From|Sender)\s*:\s*.*?([a-zA-Z0-9_\-\.\+]+@[a-zA-Z0-9_\-\.\+]+)', body, re.IGNORECASE)
                if from_match:
                    sender_email = from_match.group(1).strip()

            # Original body html for forwarding
            original_html = getattr(item, "html_body", None) or getattr(item, "body", None) or body

            # Parse structural details for log occurrences
            alert_details = parse_mssql_alert_details(body, html_body=original_html, server_default=server)
            if not alert_details.get("spid") and spid:
                alert_details["spid"] = spid
            if not alert_details.get("sql_text") and sql_text:
                alert_details["sql_text"] = sql_text
            # Synchronize compatibility keys
            if alert_details.get("sql_text") and not alert_details.get("executing_sql"):
                alert_details["executing_sql"] = alert_details["sql_text"]
            if not alert_details.get("spid") and spid:
                alert_details["spid"] = spid

            log_payload = "MSSQL_LOG_DATA:" + json.dumps(alert_details)

            conn = get_connection()
            try:
                cur = conn.cursor()

                # Determine ticket name components first — needed for lookup
                client_raw, server_raw, alert_type_raw, status_raw = parse_mssql_subject_details(subject)
                if not client_raw:
                    client_raw = client
                    server_raw = server
                    if "failed alert" in subject.lower() or "job failure" in subject.lower() or "failed job" in subject.lower():
                        alert_type_raw = "Job Alert"
                    else:
                        alert_type_raw = "Open Transaction" if "transaction" in subject.lower() else "Long Running Queries"

                if "transaction" in (alert_type_raw or "").lower():
                    alert_type_name = "Open Transaction"
                elif "job" in (alert_type_raw or "").lower():
                    alert_type_name = "Job Alert"
                else:
                    alert_type_name = "Long Running Queries"

                alert_status = alert_status or "Open"
                status_val = "Closed" if (alert_status or "").lower() == "closed" else "Open"
                if alert_type_name == "Job Alert":
                    ticket_name = subject[:255]
                else:
                    ticket_name = f"{client_raw} {server_raw} - {alert_type_name}: {status_val}"

                # The "open" version of the ticket_name pattern used to find existing open tickets.
                # e.g. for subject "Credopay MARSPRODDB-01 - Long Running Queries: Closed"
                # the open ticket was stored as  "Credopay MARSPRODDB-01 - Long Running Queries: Open"
                open_ticket_name_pattern = f"{client_raw} {server_raw} - {alert_type_name}%"

                # Check for existing open ticket:
                #   Priority 1: match by SPID in description (most reliable)
                #   Priority 2: match by constructed ticket_name pattern (client+server+alert_type)
                #   Priority 3: match by raw subject prefix (job alerts)
                existing_ticket = None
                if spid:
                    cur.execute("""
                        SELECT id, status, description, ticket_name FROM tickets
                        WHERE LOWER(TRIM(company)) = LOWER(TRIM(%s))
                          AND (description ILIKE %s OR description ILIKE %s OR description ILIKE %s)
                          AND status NOT IN ('RESOLVED', 'CLOSED')
                        LIMIT 1;
                    """, (client, f"%SPID {spid}%", f"%SPID:{spid}%", f"%SPID: {spid}%"))
                    existing_ticket = cur.fetchone()

                if not existing_ticket and alert_type_name != "Job Alert":
                    # For OPEN alerts: only match by SPID so we never merge two different SPIDs into one ticket.
                    # For CLOSED/resolved alerts: use the name pattern so closure works even when body has no SPID.
                    if alert_status.lower() == "open" and spid:
                        # Already attempted SPID match above — no further pattern fallback for open alerts
                        pass
                    else:
                        # Closure or no-SPID open: match by client+server+alert_type pattern
                        cur.execute("""
                            SELECT id, status, description, ticket_name FROM tickets
                            WHERE LOWER(TRIM(company)) = LOWER(TRIM(%s))
                              AND ticket_name ILIKE %s
                              AND status NOT IN ('RESOLVED', 'CLOSED')
                            ORDER BY id DESC
                            LIMIT 1;
                        """, (client, open_ticket_name_pattern))
                        existing_ticket = cur.fetchone()

                if not existing_ticket:
                    # Fallback: match by subject prefix (for job alerts or unrecognised formats)
                    cur.execute("""
                        SELECT id, status, description, ticket_name FROM tickets
                        WHERE LOWER(TRIM(company)) = LOWER(TRIM(%s))
                          AND ticket_name ILIKE %s
                          AND status NOT IN ('RESOLVED', 'CLOSED')
                        ORDER BY id DESC
                        LIMIT 1;
                    """, (client, f"%{subject[:120]}%"))
                    existing_ticket = cur.fetchone()

                # If we matched an existing ticket but the incoming alert (e.g. closure alert) did not contain SPID,
                # extract SPID from the existing ticket's description/name.
                if existing_ticket and not spid:
                    ex_desc = existing_ticket[2] or ""
                    ex_tname = existing_ticket[3] or ""
                    spid_match = re.search(r'\b(?:SPID|Session\s*ID|Session-ID|SessionID)\s*[:\-]?\s*(\d+)', ex_desc, re.IGNORECASE)
                    if spid_match:
                        spid = spid_match.group(1).strip()
                    else:
                        spid_match = re.search(r'\b(?:SPID|Session\s*ID|Session-ID|SessionID)\s*[:\-]?\s*(\d+)', ex_tname, re.IGNORECASE)
                        if spid_match:
                            spid = spid_match.group(1).strip()
                    
                    # Update local alert_details and payload if we extracted SPID
                    if spid:
                        alert_details["spid"] = spid
                        if not alert_details.get("executing_sql") and alert_details.get("sql_text"):
                            alert_details["executing_sql"] = alert_details["sql_text"]
                        log_payload = "MSSQL_LOG_DATA:" + json.dumps(alert_details)
                
                if alert_status.lower() == "open":
                    if existing_ticket:
                        ticket_id = existing_ticket[0]
                        ex_ticket_name = existing_ticket[3]
                        # Silently append the SPID log to the existing ticket — NO email sent for in-progress updates.
                        # Alert email is only sent once when the ticket is first created.
                        cur.execute("""
                            INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
                            VALUES (%s, 'System', 'log', %s, '');
                        """, (ticket_id, log_payload))
                        print(f"[MSSQL] Appended log to existing ticket #{ticket_id} (SPID {spid}) — no duplicate email sent.")
                    else:
                        if spid:
                            alert_type_desc = "an open transaction" if "transaction" in subject.lower() else "a long running query"
                            description = f"SPID {spid} - There is {alert_type_desc} in Company - {client}, Server - {server}.\n\nExecuting SQL:\n{sql_text}\n\nEmail Body:\n{body[:2000]}"
                        else:
                            description = f"Job Alert from {client}, Server - {server}.\n\nAlert Subject: {subject}\n\nEmail Body:\n{body[:2000]}"
                        
                        description = strip_all_html(description)
                        
                        # Compute real priority from elapsed time / keywords
                        ticket_priority = compute_mssql_priority(alert_details, subject, body)
                        priority_colour = {
                            "Critical": "#dc2626",
                            "High":     "#ea580c",
                            "Medium":   "#0284c7",
                            "Low":      "#16a34a",
                        }.get(ticket_priority, "#ea580c")
                        priority_icon = {
                            "Critical": "🔴",
                            "High":     "🟠",
                            "Medium":   "🔵",
                            "Low":      "🟢",
                        }.get(ticket_priority, "🟠")

                        cur.execute("""
                            INSERT INTO tickets (business_unit, company, contact, ticket_name, category, status, priority, agent, description, created_by, created_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            RETURNING id;
                        """, (
                            'MSSQL', client, sender_email, ticket_name,
                            'Logs', 'OPEN', ticket_priority, 'SYSTEM',
                            description, 'System', received
                        ))
                        new_ticket_id = cur.fetchone()[0]
                        # Commit ticket insertion immediately to prevent sequence skipping on any subsequent errors
                        cur.connection.commit()
                        
                        # Add initial log comment with structural json
                        cur.execute("""
                            INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
                            VALUES (%s, 'System', 'log', %s, '');
                        """, (new_ticket_id, log_payload))
 
                        # Save clean original email text for forwarding (stripped of HTML)
                        cur.execute("""
                            INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
                            VALUES (%s, 'System', 'original_email', %s, '');
                        """, (new_ticket_id, strip_all_html(original_html)))
                        
                        # Scope notifications to global list
                        cur.execute("""
                            INSERT INTO notifications (username, message, is_read)
                            VALUES (%s, %s, FALSE);
                        """, ('global', f"New ticket '{ticket_name}' has been created automatically by System",))
                        
                        # Resolve contact emails for this client/tech
                        client_email, _ = lookup_client_contact_details(cur, client, 'MSSQL')
                        tech_email = get_technology_alert_email(cur, 'MSSQL')
                        
                        if not client_email:
                            print(f"[ALERT ROUTING] there is no client mail")
                        if not tech_email:
                            print(f"[ALERT ROUTING] there is no technology alert mail")
                            
                        to_list = ["dccagent@geopits.com"]
                        if client_email:
                            for e in re.split(r'[;,]', client_email):
                                e = e.strip()
                                if e and e not in to_list:
                                    to_list.append(e)
                        if tech_email:
                            for e in re.split(r'[;,]', tech_email):
                                e = e.strip()
                                if e and e not in to_list:
                                    to_list.append(e)
                        to_emails = ", ".join(to_list)
                        cc_emails = None

                        # Construct a premium HTML email layout for the alert
                        email_body = f"""
<html>
<body style="font-family: Calibri, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 0;">
  <div style="max-width: 680px; margin: 30px auto; background: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, {priority_colour} 0%, {priority_colour}cc 100%); padding: 28px 32px;">
      <h2 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">{priority_icon} New Incident Alert — Ticket #{new_ticket_id}</h2>
      <p style="margin: 6px 0 0 0; color: rgba(255,255,255,0.85); font-size: 13px;">{alert_type_name} | {ticket_priority} Priority</p>
    </div>
    <div style="padding: 28px 32px;">
      <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">Hi Team,</p>
      <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.7;">
        A <strong>{ticket_priority}</strong> priority database alert has been detected on the <strong>{client}</strong> environment.
        A ticket (<strong>#{new_ticket_id}</strong>) has been automatically raised in our incident management system.
        Please review the details below and take the appropriate action at the earliest.
      </p>
      <table style="border-collapse: collapse; width: 100%; margin-bottom: 24px; font-size: 14px;">
        <tr>
          <th style="background:#f1f5f9; padding: 10px 14px; border: 1px solid #e2e8f0; text-align: left; width: 160px; color: #64748b; font-weight: 600;">Ticket ID</th>
          <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: 700; color: #0f172a;">#{new_ticket_id}</td>
        </tr>
        <tr>
          <th style="background:#f1f5f9; padding: 10px 14px; border: 1px solid #e2e8f0; text-align: left; color: #64748b; font-weight: 600;">Client</th>
          <td style="padding: 10px 14px; border: 1px solid #e2e8f0;">{client}</td>
        </tr>
        <tr>
          <th style="background:#f1f5f9; padding: 10px 14px; border: 1px solid #e2e8f0; text-align: left; color: #64748b; font-weight: 600;">Server</th>
          <td style="padding: 10px 14px; border: 1px solid #e2e8f0;">{server}</td>
        </tr>
        <tr>
          <th style="background:#f1f5f9; padding: 10px 14px; border: 1px solid #e2e8f0; text-align: left; color: #64748b; font-weight: 600;">SPID</th>
          <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: 700;">{spid or "N/A"}</td>
        </tr>
        <tr>
          <th style="background:#f1f5f9; padding: 10px 14px; border: 1px solid #e2e8f0; text-align: left; color: #64748b; font-weight: 600;">Alert Type</th>
          <td style="padding: 10px 14px; border: 1px solid #e2e8f0;">{alert_type_name}</td>
        </tr>
        <tr>
          <th style="background:#f1f5f9; padding: 10px 14px; border: 1px solid #e2e8f0; text-align: left; color: #64748b; font-weight: 600;">Priority</th>
          <td style="padding: 10px 14px; border: 1px solid #e2e8f0;"><span style="background:{priority_colour}22; color:{priority_colour}; padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: 700; text-transform: uppercase;">{priority_icon} {ticket_priority}</span></td>
        </tr>
        <tr>
          <th style="background:#f1f5f9; padding: 10px 14px; border: 1px solid #e2e8f0; text-align: left; color: #64748b; font-weight: 600;">Elapsed Time</th>
          <td style="padding: 10px 14px; border: 1px solid #e2e8f0;">{alert_details.get("elapsed_time") or "N/A"}</td>
        </tr>
        <tr>
          <th style="background:#f1f5f9; padding: 10px 14px; border: 1px solid #e2e8f0; text-align: left; color: #64748b; font-weight: 600;">Detected At</th>
          <td style="padding: 10px 14px; border: 1px solid #e2e8f0;">{received.strftime("%Y-%m-%d %H:%M:%S") if received else ""} IST</td>
        </tr>
      </table>
      {"<p style='margin:0 0 8px 0; font-size:13px; color:#334155; font-weight:600;'>Executing SQL:</p><pre style='background:#f1f5f9; border:1px solid #e2e8f0; border-radius:6px; padding:12px; font-size:12px; white-space:pre-wrap; word-break:break-all; color:#0f172a;'>" + (sql_text[:1200] if sql_text else "N/A") + "</pre>" if sql_text else ""}
      <p style="margin: 16px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.7;">
        Our monitoring system has automatically opened this ticket. Our DBA team will investigate and respond promptly.
        You will receive a closure notification once the incident has been resolved.
      </p>
      <p style="margin: 20px 0 0 0; font-size: 14px; color: #334155;">Regards,<br><strong>GeoMon DBA Support Team</strong><br><span style="color:#64748b; font-size: 12px;">Automated Incident Management | Geopits Technologies</span></p>
    </div>
    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 32px; text-align: center;">
      <p style="margin: 0; font-size: 11px; color: #94a3b8;">This alert was triggered automatically by the GeoMon Obsv Dashboard. Ticket #{new_ticket_id} has been logged in the system.</p>
    </div>
  </div>
</body>
</html>"""

                        if to_emails:
                            try:
                                send_email_outlook(to_emails, cc_emails, f"[Ticket #{new_ticket_id}] {ticket_name}", email_body, sender_email="dccagent@geopits.com")
                                cur.execute("""
                                    INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
                                    VALUES (%s, 'System', 'log', %s, '');
                                """, (new_ticket_id, f"Alert email sent to: {to_emails}"))
                            except Exception as em_err:
                                print(f"Error sending automatic alert email: {em_err}")
                        
                        print(f"Created new ticket #{new_ticket_id} for SPID {spid} from sender {sender_email}")
                else: # closed / resolved status
                    if existing_ticket:
                        ticket_id = existing_ticket[0]
                        ex_ticket_name = existing_ticket[3]
                        # Build the closed ticket name explicitly:
                        # e.g. "GEOJIT DRP-DIST03 - Long Running Queries: Open" → "GEOJIT DRP-DIST03 - Long Running Queries: Closed"
                        if alert_type_name == "Job Alert":
                            closed_ticket_name = subject[:255]
                        else:
                            closed_ticket_name = f"{client_raw} {server_raw} - {alert_type_name}: Closed"
                        # Mark ticket as RESOLVED and rename to Closed
                        cur.execute("""
                            UPDATE tickets SET status = 'RESOLVED', ticket_name = %s WHERE id = %s;
                        """, (closed_ticket_name, ticket_id))
                        # Log the closure payload as a comment
                        cur.execute("""
                            INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
                            VALUES (%s, 'System', 'log', %s, '');
                        """, (ticket_id, log_payload))
                        # Add a human-readable closure comment
                        cur.execute("""
                            INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
                            VALUES (%s, 'System', 'comment', %s, '');
                        """, (ticket_id, f"Ticket automatically resolved: Closure alert received for SPID {spid} on server {server}. The database session has been terminated and the incident is now closed."))
                        print(f"Resolved existing ticket #{ticket_id} for SPID {spid}")

                        # Send closure notification email to client + tech contacts
                        try:
                            cl_email, _ = lookup_client_contact_details(cur, client, 'MSSQL')
                            t_email = get_technology_alert_email(cur, 'MSSQL')
                            to_list = ["dccagent@geopits.com"]
                            for _e in re.split(r'[;,]', cl_email or ""):
                                _e = _e.strip()
                                if _e and _e not in to_list:
                                    to_list.append(_e)
                            for _e in re.split(r'[;,]', t_email or ""):
                                _e = _e.strip()
                                if _e and _e not in to_list:
                                    to_list.append(_e)
                            closure_to = ", ".join(to_list)
                            closure_time = received.strftime('%Y-%m-%d %H:%M:%S') if received else ''
                            closure_subject = f"[Ticket #{ticket_id}] RESOLVED: {closed_ticket_name}"
                            closure_body = f"""
<html>
<body style="font-family: Calibri, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 0;">
  <div style="max-width: 680px; margin: 30px auto; background: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 28px 32px;">
      <h2 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">✅ Incident Resolved — Ticket #{ticket_id}</h2>
      <p style="margin: 6px 0 0 0; color: #dcfce7; font-size: 13px;">Database System Alert Closure Notification</p>
    </div>
    <!-- Body -->
    <div style="padding: 28px 32px;">
      <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">Hi Team,</p>
      <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.7;">
        We are pleased to inform you that the database incident reported for <strong>{client}</strong> on server <strong>{server}</strong>
        has been <strong style="color: #16a34a;">successfully resolved</strong>.
        The SQL session (SPID <strong>{spid}</strong>) that was flagged for monitoring has been terminated and the system has returned to normal operation.
        No further action is required from your end at this time.
      </p>
      <!-- Details Table -->
      <table style="border-collapse: collapse; width: 100%; margin-bottom: 24px; font-size: 14px;">
        <tr>
          <th style="background:#f1f5f9; padding: 10px 14px; border: 1px solid #e2e8f0; text-align: left; width: 160px; color: #64748b; font-weight: 600;">Ticket ID</th>
          <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #0f172a; font-weight: 700;">#{ticket_id}</td>
        </tr>
        <tr>
          <th style="background:#f1f5f9; padding: 10px 14px; border: 1px solid #e2e8f0; text-align: left; color: #64748b; font-weight: 600;">Client</th>
          <td style="padding: 10px 14px; border: 1px solid #e2e8f0;">{client}</td>
        </tr>
        <tr>
          <th style="background:#f1f5f9; padding: 10px 14px; border: 1px solid #e2e8f0; text-align: left; color: #64748b; font-weight: 600;">Server</th>
          <td style="padding: 10px 14px; border: 1px solid #e2e8f0;">{server}</td>
        </tr>
        <tr>
          <th style="background:#f1f5f9; padding: 10px 14px; border: 1px solid #e2e8f0; text-align: left; color: #64748b; font-weight: 600;">SPID</th>
          <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: 700;">{spid}</td>
        </tr>
        <tr>
          <th style="background:#f1f5f9; padding: 10px 14px; border: 1px solid #e2e8f0; text-align: left; color: #64748b; font-weight: 600;">Alert Type</th>
          <td style="padding: 10px 14px; border: 1px solid #e2e8f0;">{alert_type_name}</td>
        </tr>
        <tr>
          <th style="background:#f1f5f9; padding: 10px 14px; border: 1px solid #e2e8f0; text-align: left; color: #64748b; font-weight: 600;">Resolved At</th>
          <td style="padding: 10px 14px; border: 1px solid #e2e8f0;">{closure_time} IST</td>
        </tr>
        <tr>
          <th style="background:#f1f5f9; padding: 10px 14px; border: 1px solid #e2e8f0; text-align: left; color: #64748b; font-weight: 600;">Final Status</th>
          <td style="padding: 10px 14px; border: 1px solid #e2e8f0;"><span style="background:#dcfce7; color:#166534; padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: 700; text-transform: uppercase;">RESOLVED</span></td>
        </tr>
      </table>
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b; line-height: 1.7;">
        Our DBA team has reviewed and closed this incident. If you continue to experience any database performance issues or have further questions,
        please do not hesitate to reach out to us by replying to this email.
      </p>
      <p style="margin: 20px 0 0 0; font-size: 14px; color: #334155;">Regards,<br><strong>GeoMon DBA Support Team</strong><br><span style="color:#64748b; font-size: 12px;">Automated Incident Management | Geopits Technologies</span></p>
    </div>
    <!-- Footer -->
    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 32px; text-align: center;">
      <p style="margin: 0; font-size: 11px; color: #94a3b8;">This is an automated closure notification sent by the GeoMon Obsv Dashboard. Please do not reply directly to this system address.</p>
    </div>
  </div>
</body>
</html>"""
                            send_email_outlook(closure_to, None, closure_subject, closure_body, sender_email="dccagent@geopits.com")
                            cur.execute("""
                                INSERT INTO ticket_comments (ticket_id, author, comment_type, content, attachments)
                                VALUES (%s, 'System', 'log', %s, '');
                            """, (ticket_id, f"Closure notification email sent to: {closure_to}"))
                            print(f"[CLOSURE MAIL] Sent closure email for Ticket #{ticket_id} to {closure_to}")
                        except Exception as cl_err:
                            print(f"[CLOSURE MAIL] Error sending closure email for ticket #{ticket_id}: {cl_err}")
                    else:
                        print(f"Received closed alert for SPID {spid} but no open ticket was found.")
                
                conn.commit()
            except Exception as e:
                conn.rollback()
                print(f"Error in ticket automation: {e}")
            finally:
                conn.close()
        return
    elif log_type in ["disk_io_latency", "deadlock_report", 
                      "missing_index", "transaction_log_usage", "blocking_sessions", 
                      "wait_statistics", "tempdb_usage", "generic"]:
        pass
    else:
        return

    if not logs:
        print("No logs parsed")
        return

    msgs=[x[2] for x in logs]
    counts=Counter(msgs)
    seen = set()

    for t,src,msg in logs:
        if db == "MSSQL":
            msg_lower = msg.lower()
            ignore_keywords = [
                "the step succeeded",
                "this is an informational message only",
                "no user action is required",
                "Login Succeeded"
            ]
            if any(kw in msg_lower for kw in ignore_keywords):
                continue
        if msg in seen:
            continue
        seen.add(msg)

        log_time,utc,ist=parse_time(t)
        occ=counts[msg]

        time_bucket = log_time.strftime("%Y-%m-%d_%H")
        n_msg = normalize_for_hash(msg)

        h_str=f"{client}_{server}_{db}_{log_type}_{src}_{n_msg}_{time_bucket}"
        h=make_hash(h_str)

        severity = classify_severity(db, msg)

        insert_log((
        client,
        server,
        db,
        log_type,
        src,
        log_time,
        utc,
        ist,
        msg,
        json.dumps({"source":src,"msg":msg}),
        subject,
        received,
        h,
        occ,
        severity
        ))

class MockMailSender:
    def __init__(self, email_address):
        self.email_address = email_address

class MockMailItem:
    def __init__(self, subject, body, datetime_received, sender_email=None):
        self.subject = subject
        self.text_body = body
        self.body = body
        self.datetime_received = datetime_received
        self.attachments = []
        self.is_read = False
        if sender_email:
            self.sender = MockMailSender(sender_email)
            self.author = MockMailSender(sender_email)
        else:
            self.sender = None
            self.author = None
    def save(self):
        pass

# =====================================================================
# SECTION 7: MAIN SYNC ENGINE & MONITOR EXECUTION
# =====================================================================
def get_sent_ticket_info(account):
    """
    Reads sent messages from the Sent Items folder of the account.
    Extracts ticket IDs and base subjects.
    Returns:
      (sent_ticket_ids, sent_base_subjects)
    """
    sent_ticket_ids = set()
    sent_base_subjects = set()
    if not account:
        # Mock mode fallback: populate with existing active tickets to allow mock replies to pass
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT id, ticket_name FROM tickets WHERE status NOT IN ('RESOLVED', 'CLOSED');")
            for tid, tname in cur.fetchall():
                sent_ticket_ids.add(tid)
                base = re.sub(r'^(?:re|fw|fwd|reply|forward|aw|wg|rv):\s*', '', tname, flags=re.IGNORECASE).strip().lower()
                if base:
                    sent_base_subjects.add(base)
            cur.close()
        finally:
            conn.close()
        return sent_ticket_ids, sent_base_subjects

    try:
        if hasattr(account, "access_token") and hasattr(account, "user_email"):
            # Graph Account
            import requests
            headers = {
                "Authorization": f"Bearer {account.access_token}",
                "Content-Type": "application/json"
            }
            # Fetch up to 100 sent items from the sentitems endpoint
            url = f"https://graph.microsoft.com/v1.0/users/{account.user_email}/mailFolders/sentitems/messages?$top=100&$orderBy=receivedDateTime desc"
            r = requests.get(url, headers=headers, timeout=15)
            if r.status_code == 200:
                messages = r.json().get("value", [])
                for msg in messages:
                    subject = (msg.get("subject") or "").strip()
                    if not subject:
                        continue
                    # Clean the subject
                    base_sub = re.sub(r'^(?:re|fw|fwd|reply|forward|aw|wg|rv):\s*', '', subject, flags=re.IGNORECASE).strip()
                    ticket_match = re.search(r'Ticket\s*#?\s*(\d+)', subject, re.IGNORECASE)
                    if ticket_match:
                        sent_ticket_ids.add(int(ticket_match.group(1)))
                    if base_sub:
                        sent_base_subjects.add(base_sub.lower())
            else:
                print(f"[SENT ITEMS] Error fetching sent items via Graph API: {r.status_code} {r.text}")
        else:
            # EWS Account
            sent_folder = account.sent
            # Fetch last 100 sent items
            sent_items = sent_folder.all().order_by('-datetime_sent')[:100]
            for item in sent_items:
                subject = (item.subject or "").strip()
                if not subject:
                    continue
                base_sub = re.sub(r'^(?:re|fw|fwd|reply|forward|aw|wg|rv):\s*', '', subject, flags=re.IGNORECASE).strip()
                ticket_match = re.search(r'Ticket\s*#?\s*(\d+)', subject, re.IGNORECASE)
                if ticket_match:
                    sent_ticket_ids.add(int(ticket_match.group(1)))
                if base_sub:
                    sent_base_subjects.add(base_sub.lower())
    except Exception as e:
        print(f"[SENT ITEMS] Error retrieving sent items: {e}")

    return sent_ticket_ids, sent_base_subjects

def get_last_sync_time(folder_hint=None, default_lookback_hours=24, buffer_minutes=30):
    """
    Returns an ISO-8601 UTC string representing the watermark for mail fetching.
    Reads MAX(processed_at) from processed_emails, subtracts a buffer to avoid
    missing emails that arrived near the boundary, and formats for Graph API.
    Falls back to `default_lookback_hours` ago if the table is empty.
    
    folder_hint: optional subject keyword to narrow MAX(processed_at) to a specific
                 mail type (e.g. 'Long Running' for MSSQL folder). If None, uses global MAX.
    """
    import datetime as _dt
    try:
        _conn = get_connection()
        _cur = _conn.cursor()
        if folder_hint:
            _cur.execute(
                "SELECT MAX(processed_at AT TIME ZONE 'Asia/Kolkata' AT TIME ZONE 'UTC') FROM processed_emails WHERE subject ILIKE %s;",
                (f"%{folder_hint}%",)
            )
        else:
            _cur.execute("SELECT MAX(processed_at AT TIME ZONE 'Asia/Kolkata' AT TIME ZONE 'UTC') FROM processed_emails;")
        row = _cur.fetchone()
        _cur.close()
        _conn.close()
        if row and row[0]:
            watermark = row[0] - _dt.timedelta(minutes=buffer_minutes)
        else:
            watermark = _dt.datetime.utcnow() - _dt.timedelta(hours=default_lookback_hours)
    except Exception as _e:
        print(f"[SYNC] Could not read processed_emails watermark: {_e}")
        import datetime as _dt2
        watermark = _dt2.datetime.utcnow() - _dt2.timedelta(hours=default_lookback_hours)
    # Graph API requires ISO-8601 UTC with Z suffix, e.g. '2026-06-28T10:00:00Z'
    return watermark.strftime("%Y-%m-%dT%H:%M:%SZ")


def get_folder_watermark(folder_name, default_lookback_hours=24):
    import json
    import os
    import datetime as _dt
    w_file = "/Users/sanjay/Documents/GeoVexSight-App-main 2/logs/folder_watermarks.json"
    try:
        if os.path.exists(w_file):
            with open(w_file, "r") as f:
                data = json.load(f)
            if folder_name in data:
                val = _dt.datetime.fromisoformat(data[folder_name].replace("Z", "+00:00"))
                # Subtract 30 minutes buffer
                buffer_time = val - _dt.timedelta(minutes=30)
                return buffer_time.strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception as e:
        print(f"[WATERMARK] Error reading watermark for {folder_name}: {e}")
        
    return (_dt.datetime.utcnow() - _dt.timedelta(hours=default_lookback_hours)).strftime("%Y-%m-%dT%H:%M:%SZ")


def save_folder_watermark(folder_name, timestamp=None):
    import json
    import os
    import datetime as _dt
    w_file = "/Users/sanjay/Documents/GeoVexSight-App-main 2/logs/folder_watermarks.json"
    try:
        data = {}
        if os.path.exists(w_file):
            with open(w_file, "r") as f:
                try:
                    data = json.load(f)
                except Exception:
                    pass
        ts_str = None
        if timestamp:
            try:
                if isinstance(timestamp, _dt.datetime):
                    if timestamp.tzinfo is not None:
                        timestamp = timestamp.astimezone(_dt.timezone.utc)
                    ts_str = timestamp.strftime("%Y-%m-%dT%H:%M:%SZ")
                else:
                    ts_str = str(timestamp)
            except Exception as ts_err:
                print(f"[WATERMARK] Error parsing timestamp: {ts_err}")
        if not ts_str:
            ts_str = _dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        data[folder_name] = ts_str
        os.makedirs(os.path.dirname(w_file), exist_ok=True)
        with open(w_file, "w") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"[WATERMARK] Error saving watermark for {folder_name}: {e}")



def read_mail():
    if not account:
        print("[MOCK MAIL] Bypassed mode. Simulating inbox read for Cnergee and Credopay MySQL status...")
        cnergee_subject = "[MySQL Status] Cnergee - ONLINE | 2026-06-16 05:00 IST"
        cnergee_body = """Cnergee Alerts
MySQL Availability & Replication Monitor

prod-mysql-primary (PRIMARY)
Client: Cnergee
Host: 172.17.1.1
Port: 3306
Status: ONLINE
Version: 8.0.40
Last Restart Time: 2026-03-17 22:52:24
Database Uptime: 90 Days 6 Hours 7 Mins
Response Time: 0.059 sec

replica1 (REPLICA)
Client: Cnergee
Host: 172.17.1.2
Port: 3306
Status: ONLINE
Version: 8.0.40
Last Restart Time: 2025-08-22 19:01:52
Database Uptime: 297 Days 10 Hours 44 Mins
Response Time: 0.002 sec

replica2 (REPLICA)
Client: Cnergee
Host: 172.17.1.11
Port: 3306
Status: ONLINE
Version: 8.0.40
Last Restart Time: 2025-08-22 19:16:36
Database Uptime: 297 Days 9 Hours 43 Mins
Response Time: 0.021 sec"""

        credopay_subject = "[MySQL Status] Credopay — ONLINE | 2026-06-16 08:00 UTC"
        credopay_body = """Credopay Alerts
MySQL Availability Monitor

ONLINE
2026-06-16 08:00 UTC • cpprodmysqldbsrv.mysql.database.azure.com

Client: Credopay
DB Host: cpprodmysqldbsrv.mysql.database.azure.com
Port: 3306
Status: ONLINE
Last Restart Time: 2026-05-29 22:32:48
Database Uptime: 17 Days 9 Hours 27 Mins
Response Time: 0.345 sec
Check Time: 2026-06-16 08:00 UTC"""

        now = get_accurate_ist().replace(tzinfo=None)
        
        mock_items = [
            MockMailItem(cnergee_subject, cnergee_body, now),
            MockMailItem(credopay_subject, credopay_body, now)
        ]
        
        for item in mock_items:
            subject = item.subject
            client, server, db, log_type = parse_subject(subject)
            if client and log_type == "db_uptime":
                db_conn = get_connection()
                try:
                    cur = db_conn.cursor()
                    cur.execute("SELECT 1 FROM db_monitoring_logs WHERE email_subject = %s AND email_received_time >= %s - interval '1 minute' LIMIT 1", (subject, now))
                    exists = cur.fetchone()
                    cur.close()
                    if exists:
                        continue
                finally:
                    db_conn.close()

                print(f"[MOCK MAIL] Processing Simulated MySQL Status: {subject}")
                process_mail(item)
                audit_logger.info(f"[PROCESSED] {subject}")
        # Fetch active/open tickets to simulate reply processing
        db_conn = get_connection()
        try:
            cur = db_conn.cursor()
            cur.execute("SELECT id, ticket_name FROM tickets WHERE status NOT IN ('RESOLVED', 'CLOSED') ORDER BY id DESC LIMIT 2;")
            active_tickets = cur.fetchall()
            cur.close()
        finally:
            db_conn.close()

        mock_replies = []
        for t_id, t_name in active_tickets:
            mock_replies.extend([
                # 1. DBA team reply with subject matching
                MockMailItem(
                    subject=t_name,
                    body="Once grow through db correctly",
                    datetime_received=now,
                    sender_email="dba.team@geopits.com"
                ),
                # 2. Client reply with subject matching
                MockMailItem(
                    subject=f"RE: {t_name}",
                    body="Please look into this ASAP.",
                    datetime_received=now,
                    sender_email="client.ops@thyrocare.com"
                ),
                # 3. DBA team reply using explicit ticket ID in subject
                MockMailItem(
                    subject=f"[Ticket #{t_id}] RE: {t_name}",
                    body="We have checked it and optimized the query.",
                    datetime_received=now,
                    sender_email="dba.team@geopits.com"
                )
            ])

        for reply_item in mock_replies:
            try:
                processed = process_incoming_reply(reply_item)
                if processed:
                    print(f"[MOCK MAIL] Successfully processed reply for Ticket ID/Subject: {reply_item.subject}")
            except Exception as e:
                print(f"[MOCK MAIL] Error processing mock reply: {e}")

        try:
            simulate_local_uptime_update()
        except Exception as sim_err:
            print("[MOCK MAIL] Failed to run simulation:", sim_err)
        return
    # ════════════════════════════════════════════════════════════════════════
    # FOLDER 1 — MSSQL Alert  →  MSSQL alert emails only (creates tickets)
    # ════════════════════════════════════════════════════════════════════════
    print("\n[FOLDER 1] Reading MSSQL Alert folder — alert/ticket emails...")
    try:
        mssql_folder = account.root / "Top of Information Store" / "MSSQL Alert"
        mssql_sync_dt = get_folder_watermark("MSSQL Alert", default_lookback_hours=24)
        print(f"[MSSQL Alert] Fetching messages after {mssql_sync_dt}")
        mssql_items = list(mssql_folder.since(mssql_sync_dt).order_by('datetime_received')[:200])
        print(f"[MSSQL Alert] Found {len(mssql_items)} emails to evaluate.")
    except Exception as e:
        print(f"[MSSQL Alert] Folder check failed: {e}")
        mssql_items = []
        try:
            simulate_local_uptime_update()
        except Exception: pass
        err_msg = str(e).lower()
        if any(kw in err_msg for kw in ["cannot service this request right now", "try again later", "refresh_token", "aadsts", "expired"]):
            raise

    import datetime as _dt
    for item in mssql_items:
        subject = (item.subject or "").strip()
        msg_id = getattr(item, 'id', None) or getattr(item, 'message_id', None)
        
        # Skip Maxhealthcare emails
        _subj_clean = re.sub(r'MAX\s*Healthcare|MAXHealthcare', 'maxhealthcare', subject, flags=re.IGNORECASE).lower()
        if "maxhealthcare" in _subj_clean:
            print(f"[SKIP] Excluding Maxhealthcare email: {subject}")
            if not item.is_read:
                try:
                    item.is_read = True; item.save()
                except Exception: pass
            if msg_id:
                try:
                    _pc = get_connection(); _pcc = _pc.cursor()
                    _pcc.execute("INSERT INTO processed_emails (message_id, subject, sender) VALUES (%s, %s, %s) ON CONFLICT (message_id) DO NOTHING",
                                 (str(msg_id), subject[:490], "SYSTEM"))
                    _pc.commit(); _pcc.close(); _pc.close()
                except Exception: pass
            continue

        try:
            if msg_id:
                _dc = get_connection(); _dcc = _dc.cursor()
                _dcc.execute("SELECT 1 FROM processed_emails WHERE message_id = %s LIMIT 1", (str(msg_id),))
                if _dcc.fetchone():
                    _dcc.close(); _dc.close()
                    if not item.is_read:
                        item.is_read = True; item.save()
                    continue
                _dcc.close(); _dc.close()
        except Exception: pass

        # Skip system/NDR emails
        sender_email = "SYSTEM"
        if hasattr(item, 'sender') and item.sender and hasattr(item.sender, 'email_address') and item.sender.email_address:
            sender_email = item.sender.email_address
        sender_lower = sender_email.lower().strip()
        system_email = (USER or "dccagent@geopits.com").lower().strip()
        is_reply_or_fwd = bool(re.match(r'^\s*(re|fw|fwd|reply|forward|aw|wg|rv)\s*:\s*', subject, re.IGNORECASE))
        if is_ndr_or_bounce(item) or (sender_lower == system_email and not is_reply_or_fwd):
            if not item.is_read:
                item.is_read = True; item.save()
            continue

        time.sleep(0.3)
        client, server, db, log_type = parse_subject(subject)
        # Force mssql_alert for any unrecognised subject in this folder
        if not client or not log_type or log_type == "generic":
            log_type = "mssql_alert"
            _subj_n = re.sub(r'MAX\s*Healthcare', 'Maxhealthcare', subject, flags=re.IGNORECASE)
            _m = re.match(r'^([A-Za-z][A-Za-z0-9]+)\s+([A-Za-z0-9_\-\.]+)', _subj_n)
            if _m:
                client = client or _m.group(1).strip()
                server = server or _m.group(2).strip()
            client = client or "Unknown"; server = server or "Unknown"; db = db or "MSSQL"

        # Deduplicate open ticket by subject
        try:
            _dc = get_connection(); _dcc = _dc.cursor()
            _dcc.execute("SELECT 1 FROM tickets WHERE ticket_name = %s AND created_at::date = CURRENT_DATE LIMIT 1", (subject[:255],))
            _dup = _dcc.fetchone()
            if not _dup:
                _parsed = parse_mssql_subject_details(subject)
                _c2, _s2, _at, _st = _parsed if _parsed else (None, None, None, None)
                if _c2 and _s2 and _at and _st:
                    _dcc.execute("SELECT 1 FROM tickets WHERE ticket_name ILIKE %s AND created_at::date = CURRENT_DATE LIMIT 1",
                                 (f"{_c2} {_s2} - {_at}: {_st}"[:255],))
                    _dup = _dcc.fetchone()
            _dcc.close(); _dc.close()
            if _dup:
                print(f"[MSSQL Alert] Skipping duplicate: {subject}")
                if not item.is_read:
                    item.is_read = True; item.save()
                if msg_id:
                    try:
                        _pc = get_connection(); _pcc = _pc.cursor()
                        _pcc.execute("INSERT INTO processed_emails (message_id, subject, sender) VALUES (%s, %s, %s) ON CONFLICT (message_id) DO NOTHING",
                                     (str(msg_id), subject[:490], str(sender_email)[:240]))
                        _pc.commit(); _pcc.close(); _pc.close()
                    except Exception: pass
                continue
        except Exception: pass

        print(f"[MSSQL Alert] Processing: {subject}")
        try:
            process_mail(item, override_client=client, override_server=server, override_db=db, override_log_type=log_type)
            audit_logger.info(f"[PROCESSED] {subject}")
        except Exception as _e:
            print(f"[MSSQL Alert] process_mail error: {_e}")
            import traceback; traceback.print_exc()
        if not item.is_read:
            item.is_read = True; item.save()
        if msg_id:
            try:
                _pc = get_connection(); _pcc = _pc.cursor()
                _pcc.execute("INSERT INTO processed_emails (message_id, subject, sender) VALUES (%s, %s, %s) ON CONFLICT (message_id) DO NOTHING",
                             (str(msg_id), subject[:490], str(sender_email)[:240]))
                _pc.commit(); _pcc.close(); _pc.close()
            except Exception: pass

    if mssql_items:
        try:
            if len(mssql_items) < 200:
                save_folder_watermark("MSSQL Alert", _dt.datetime.utcnow())
            else:
                save_folder_watermark("MSSQL Alert", mssql_items[-1].datetime_received)
        except Exception:
            try: save_folder_watermark("MSSQL Alert")
            except Exception: pass
    else:
        try:
            save_folder_watermark("MSSQL Alert", _dt.datetime.utcnow())
        except Exception: pass

    # ════════════════════════════════════════════════════════════════════════
    # FOLDER 2 — Ai-report-automation  →  Real-time log analytics / reports
    # ════════════════════════════════════════════════════════════════════════
    print("\n[FOLDER 2] Reading Ai-report-automation folder — real-time log analytics...")
    try:
        ai_folder = account.root / "Top of Information Store" / "Ai-report-automation"
        ai_sync_dt = get_folder_watermark("Ai-report-automation", default_lookback_hours=24)
        print(f"[Ai-report-automation] Fetching messages after {ai_sync_dt}")
        ai_items = list(ai_folder.since(ai_sync_dt).order_by('datetime_received')[:200])
        print(f"[Ai-report-automation] Found {len(ai_items)} emails to evaluate.")
    except Exception as e:
        print(f"[Ai-report-automation] Folder check failed: {e}")
        ai_items = []
        err_msg = str(e).lower()
        if any(kw in err_msg for kw in ["cannot service this request right now", "try again later", "refresh_token", "aadsts", "expired"]):
            raise

    for item in ai_items:
        subject = (item.subject or "").strip()
        msg_id = getattr(item, 'id', None) or getattr(item, 'message_id', None)

        # Skip Maxhealthcare emails
        _subj_clean = re.sub(r'MAX\s*Healthcare|MAXHealthcare', 'maxhealthcare', subject, flags=re.IGNORECASE).lower()
        if "maxhealthcare" in _subj_clean:
            print(f"[SKIP] Excluding Maxhealthcare email: {subject}")
            if not item.is_read:
                try:
                    item.is_read = True; item.save()
                except Exception: pass
            if msg_id:
                try:
                    _pc = get_connection(); _pcc = _pc.cursor()
                    _pcc.execute("INSERT INTO processed_emails (message_id, subject, sender) VALUES (%s, %s, %s) ON CONFLICT (message_id) DO NOTHING",
                                 (str(msg_id), subject[:490], "SYSTEM"))
                    _pc.commit(); _pcc.close(); _pc.close()
                except Exception: pass
            continue

        try:
            if msg_id:
                _dc = get_connection(); _dcc = _dc.cursor()
                _dcc.execute("SELECT 1 FROM processed_emails WHERE message_id = %s LIMIT 1", (str(msg_id),))
                if _dcc.fetchone():
                    _dcc.close(); _dc.close()
                    if not item.is_read:
                        item.is_read = True; item.save()
                    continue
                _dcc.close(); _dc.close()
        except Exception: pass

        sender_email = "SYSTEM"
        if hasattr(item, 'sender') and item.sender and hasattr(item.sender, 'email_address') and item.sender.email_address:
            sender_email = item.sender.email_address
        sender_lower = sender_email.lower().strip()
        system_email = (USER or "dccagent@geopits.com").lower().strip()
        is_reply_or_fwd = bool(re.match(r'^\s*(re|fw|fwd|reply|forward|aw|wg|rv)\s*:\s*', subject, re.IGNORECASE))
        if is_ndr_or_bounce(item) or (sender_lower == system_email and not is_reply_or_fwd):
            if not item.is_read:
                item.is_read = True; item.save()
            if msg_id:
                try:
                    _pc = get_connection(); _pcc = _pc.cursor()
                    _pcc.execute("INSERT INTO processed_emails (message_id, subject, sender) VALUES (%s, %s, %s) ON CONFLICT (message_id) DO NOTHING",
                                 (str(msg_id), subject[:490], str(sender_email)[:240]))
                    _pc.commit(); _pcc.close(); _pc.close()
                except Exception: pass
            continue

        time.sleep(0.3)
        client, server, db, log_type = parse_subject(subject)
        if not client or not log_type or log_type == "generic":
            # Force mssql_alert for unrecognised subjects in this folder
            log_type = "mssql_alert"
            _subj_n = re.sub(r'MAX\s*Healthcare', 'Maxhealthcare', subject, flags=re.IGNORECASE)
            _m = re.match(r'^([A-Za-z][A-Za-z0-9]+)\s+([A-Za-z0-9_\-\.]+)', _subj_n)
            if _m:
                client = client or _m.group(1).strip()
                server = server or _m.group(2).strip()
            client = client or "Unknown"; server = server or "Unknown"; db = db or "MSSQL"

        print(f"[Ai-report-automation] Processing: {subject}")
        try:
            process_mail(item, override_client=client, override_server=server, override_db=db, override_log_type=log_type)
            audit_logger.info(f"[PROCESSED] {subject}")
        except Exception as _e:
            print(f"[Ai-report-automation] process_mail error: {_e}")
        if not item.is_read:
            item.is_read = True; item.save()
        if msg_id:
            try:
                _pc = get_connection(); _pcc = _pc.cursor()
                _pcc.execute("INSERT INTO processed_emails (message_id, subject, sender) VALUES (%s, %s, %s) ON CONFLICT (message_id) DO NOTHING",
                             (str(msg_id), subject[:490], str(sender_email)[:240]))
                _pc.commit(); _pcc.close(); _pc.close()
            except Exception: pass

    if ai_items:
        try:
            if len(ai_items) < 200:
                save_folder_watermark("Ai-report-automation", _dt.datetime.utcnow())
            else:
                save_folder_watermark("Ai-report-automation", ai_items[-1].datetime_received)
        except Exception:
            try: save_folder_watermark("Ai-report-automation")
            except Exception: pass
    else:
        try:
            save_folder_watermark("Ai-report-automation", _dt.datetime.utcnow())
        except Exception: pass

    # ════════════════════════════════════════════════════════════════════════
    # FOLDER 3 — MySQL-Mongo-Postgres-DB  →  DB & Table size telemetry only
    # ════════════════════════════════════════════════════════════════════════
    print("\n[FOLDER 3] Reading MySQL-Mongo-Postgres-DB folder — DB & Table size reports...")
    _db_size_folder_names = [
        "MySQL-Mongo-Postgres-DB",
        "MySQL Mongo Postgres- DB & Table Size",
        "MySQL Mongo Postgres-DB",
        "MySQL-Mongo-Postgres",
    ]
    db_size_items = []
    _db_folder_found = None
    for _fn in _db_size_folder_names:
        try:
            _f = account.root / "Top of Information Store" / _fn
            _sync_dt = get_folder_watermark("MySQL-Mongo-Postgres-DB", default_lookback_hours=48)
            _items = list(_f.since(_sync_dt).order_by('datetime_received')[:200])
            db_size_items = _items
            _db_folder_found = _fn
            print(f"[{_fn}] Found {len(_items)} emails to evaluate.")
            break
        except Exception as _fe:
            _em = str(_fe).lower()
            if any(kw in _em for kw in ["cannot service this request right now", "try again later", "refresh_token", "aadsts", "expired"]):
                raise
            print(f"[DB Size Folder] '{_fn}' not found or failed: {_fe}")
            continue

    if not _db_folder_found:
        print("[FOLDER 3] MySQL-Mongo-Postgres-DB folder not found — skipping DB size ingestion.")

    for item in db_size_items:
        subject = (item.subject or "").strip()
        msg_id = getattr(item, 'id', None) or getattr(item, 'message_id', None)

        # Skip Maxhealthcare emails
        _subj_clean = re.sub(r'MAX\s*Healthcare|MAXHealthcare', 'maxhealthcare', subject, flags=re.IGNORECASE).lower()
        if "maxhealthcare" in _subj_clean:
            print(f"[SKIP] Excluding Maxhealthcare email: {subject}")
            if not item.is_read:
                try:
                    item.is_read = True; item.save()
                except Exception: pass
            if msg_id:
                try:
                    _pc = get_connection(); _pcc = _pc.cursor()
                    _pcc.execute("INSERT INTO processed_emails (message_id, subject, sender) VALUES (%s, %s, %s) ON CONFLICT (message_id) DO NOTHING",
                                 (str(msg_id), subject[:490], "SYSTEM"))
                    _pc.commit(); _pcc.close(); _pc.close()
                except Exception: pass
            continue

        try:
            if msg_id:
                _dc = get_connection(); _dcc = _dc.cursor()
                _dcc.execute("SELECT 1 FROM processed_emails WHERE message_id = %s LIMIT 1", (str(msg_id),))
                if _dcc.fetchone():
                    _dcc.close(); _dc.close()
                    if not item.is_read:
                        item.is_read = True; item.save()
                    continue
                _dcc.close(); _dc.close()
        except Exception: pass

        sender_email = "SYSTEM"
        if hasattr(item, 'sender') and item.sender and hasattr(item.sender, 'email_address') and item.sender.email_address:
            sender_email = item.sender.email_address
        if is_ndr_or_bounce(item):
            if not item.is_read:
                item.is_read = True; item.save()
            if msg_id:
                try:
                    _pc = get_connection(); _pcc = _pc.cursor()
                    _pcc.execute("INSERT INTO processed_emails (message_id, subject, sender) VALUES (%s, %s, %s) ON CONFLICT (message_id) DO NOTHING",
                                 (str(msg_id), subject[:490], str(sender_email)[:240]))
                    _pc.commit(); _pcc.close(); _pc.close()
                except Exception: pass
            continue

        time.sleep(0.3)
        print(f"[DB Size Folder] Processing size report: {subject}")
        try:
            from telemetry_parser import process_telemetry_email
            _conn = get_connection(); _cur = _conn.cursor()
            html_body = getattr(item, 'body', None) or getattr(item, 'html_body', None) or ""
            rcv = getattr(item, 'datetime_received', None)
            rcv_date = rcv.date() if rcv else None
            _inserted = process_telemetry_email(_cur, subject, html_body, received_date=rcv_date)
            _conn.commit(); _cur.close(); _conn.close()
            print(f"[DB Size Folder] Ingested {_inserted} records for '{subject}'")
            audit_logger.info(f"[DB SIZE PROCESSED] {subject}")
        except Exception as _e:
            print(f"[DB Size Folder] process_telemetry_email error: {_e}")
        if not item.is_read:
            item.is_read = True; item.save()
        if msg_id:
            try:
                _pc = get_connection(); _pcc = _pc.cursor()
                _pcc.execute("INSERT INTO processed_emails (message_id, subject, sender) VALUES (%s, %s, %s) ON CONFLICT (message_id) DO NOTHING",
                             (str(msg_id), subject[:490], str(sender_email)[:240]))
                _pc.commit(); _pcc.close(); _pc.close()
            except Exception: pass

    if db_size_items:
        try:
            if len(db_size_items) < 200:
                save_folder_watermark("MySQL-Mongo-Postgres-DB", _dt.datetime.utcnow())
            else:
                save_folder_watermark("MySQL-Mongo-Postgres-DB", db_size_items[-1].datetime_received)
        except Exception:
            try: save_folder_watermark("MySQL-Mongo-Postgres-DB")
            except Exception: pass
    else:
        try:
            save_folder_watermark("MySQL-Mongo-Postgres-DB", _dt.datetime.utcnow())
        except Exception: pass

    # ════════════════════════════════════════════════════════════════════════
    # FOLDER 4 — Inbox  →  Replies + real-time log analytics + DB size mails
    # (handled in the block below)
    # ════════════════════════════════════════════════════════════════════════
    print("\n[FOLDER 4] Reading Inbox — replies, log analytics, and size report emails...")

    try:
        sent_ticket_ids, sent_base_subjects = get_sent_ticket_info(account)
        print(f"[REPLY FILTER] Loaded {len(sent_ticket_ids)} ticket IDs and {len(sent_base_subjects)} base subjects from Sent Items.")

        inbox = account.inbox

        # ── Load processed IDs and compute inbox watermark ────────────────────
        processed_ids = set()
        try:
            conn = get_connection()
            cur = conn.cursor()
            cur.execute("SELECT message_id FROM processed_emails;")
            processed_ids = {row[0] for row in cur.fetchall()}
            cur.close()
            conn.close()
        except Exception as load_err:
            print("[REPLY FILTER] Error loading processed message IDs:", load_err)

        # Fetch all inbox messages received after the watermark (oldest-first, up to 200 items per cycle)
        inbox_sync_dt = get_folder_watermark("Inbox", default_lookback_hours=24)
        print(f"[INBOX] Fetching messages received after {inbox_sync_dt} (processed_emails watermark)")
        inbox_items = list(inbox.since(inbox_sync_dt).order_by('datetime_received')[:200])
        print(f"[INBOX] Found {len(inbox_items)} inbox emails to evaluate in this cycle.")

        def mark_as_processed(m_id, sub, snd):
            try:
                conn = get_connection()
                cur = conn.cursor()
                cur.execute(
                    "INSERT INTO processed_emails (message_id, subject, sender) VALUES (%s, %s, %s) ON CONFLICT (message_id) DO NOTHING;",
                    (m_id, (sub or "")[:490], (snd or "")[:240])
                )
                conn.commit()
                cur.close()
                conn.close()
            except Exception as e_proc:
                print(f"[REPLY FILTER] Error marking message {m_id} as processed: {e_proc}")
        
        for item in inbox_items:
            # Determine unique message ID
            msg_id = getattr(item, "id", None) or getattr(item, "message_id", None)
            if not msg_id:
                msg_hash = ((item.subject or "") + str(getattr(item, "datetime_received", "")) + str(getattr(item, "datetime_sent", "")))
                msg_id = hashlib.sha256(msg_hash.encode()).hexdigest()

            # Skip already-processed mails (in-memory set loaded above)
            if str(msg_id) in processed_ids:
                # Mark as read on exchange too so it stops appearing as unread
                if not item.is_read:
                    try:
                        item.is_read = True
                        item.save()
                    except Exception:
                        pass
                continue

            time.sleep(0.5)
            subject = (item.subject or "").strip()

            # Skip Maxhealthcare emails
            _subj_clean = re.sub(r'MAX\s*Healthcare|MAXHealthcare', 'maxhealthcare', subject, flags=re.IGNORECASE).lower()
            if "maxhealthcare" in _subj_clean:
                print(f"[SKIP] Excluding Maxhealthcare email: {subject}")
                if not item.is_read:
                    try:
                        item.is_read = True; item.save()
                    except Exception: pass
                # Get sender details for mark_as_processed
                _sender_email = "SYSTEM"
                if hasattr(item, 'sender') and item.sender and hasattr(item.sender, 'email_address') and item.sender.email_address:
                    _sender_email = item.sender.email_address
                elif hasattr(item, 'author') and item.author and hasattr(item.author, 'email_address') and item.author.email_address:
                    _sender_email = item.author.email_address
                mark_as_processed(msg_id, subject, _sender_email)
                continue

            # Get sender details
            sender_email = "SYSTEM"
            if hasattr(item, 'sender') and item.sender and hasattr(item.sender, 'email_address') and item.sender.email_address:
                sender_email = item.sender.email_address
            elif hasattr(item, 'author') and item.author and hasattr(item.author, 'email_address') and item.author.email_address:
                sender_email = item.author.email_address
            sender_lower = sender_email.lower().strip()
            
            # Clean body/check for system alert
            body_val = str(getattr(item, 'text_body', None) or getattr(item, 'body', None) or "")
            body_lower = body_val.lower()
            is_system_alert = (
                "database system alert:" in body_lower or
                "resource spike alert summary" in body_lower or
                "critical: server down alert" in body_lower or
                "an automated daily storage audit" in body_lower or
                "automated daily storage audit" in body_lower
            )

            is_reply_or_fwd = re.match(r'^\s*(re|fw|fwd|reply|forward|aw|wg|rv)\s*:\s*', subject, re.IGNORECASE)
            # Skip NDR bounce reports immediately
            if is_ndr_or_bounce(item):
                print(f"[REPLY FILTER] Skipping bounce email: {subject}")
                if not item.is_read:
                    item.is_read = True
                    item.save()
                mark_as_processed(msg_id, subject, sender_email)
                continue

            # Determine if this email matches telemetry or log analytics based on subject filter only
            is_reply_or_fwd = bool(re.match(r'^\s*(re|fw|fwd|reply|forward|aw|wg|rv)\s*:\s*', subject, re.IGNORECASE))
            system_email = (USER or "dccagent@geopits.com").lower().strip()

            is_rds = bool(subject and _is_rds_mail(subject))

            client_t, server_t, db_t, log_type_t = parse_subject(subject)
            is_telemetry = False
            if client_t and log_type_t in ["error_log", "event_log", "agent_log", "db_uptime", "mssql_alert", "long_running_queries"]:
                is_telemetry = True
            else:
                subj_norm_t = re.sub(r'MAX\s+Healthcare', 'Maxhealthcare', subject, flags=re.IGNORECASE)
                subj_norm_t = re.sub(r'MAXHealthcare', 'Maxhealthcare', subj_norm_t, flags=re.IGNORECASE)
                _looks_like_alert = any(kw in subject.lower() for kw in [
                    "long running", "open transaction", "failed alert", "job failure",
                    "failed job", "mssql alert", "query alert", "lock alert"
                ])
                if _looks_like_alert:
                    is_telemetry = True
                    log_type_t = "mssql_alert"
                    _m_t = re.match(r'^([A-Za-z][A-Za-z0-9]+)\s+([A-Za-z0-9_\-\.]+)', subj_norm_t)
                    if _m_t:
                        client_t = client_t or _m_t.group(1).strip()
                        server_t = server_t or _m_t.group(2).strip()
                    client_t = client_t or "Unknown"
                    server_t = server_t or "Unknown"
                    db_t = db_t or "MSSQL"

            subj_lower_storage = subject.lower()
            is_storage = (
                "[ticket #" not in subj_lower_storage
                and any(kw in subj_lower_storage for kw in [
                    "db & table size report", "db and table size report",
                    "size report", "collection size report",
                    "table size growth report",
                    "storage report",
                ])
            )

            is_log_analytics = any(kw in subj_lower_storage for kw in [
                "[hourly]", "[daily digest]", "infrastructure health report",
                "log analytics", "real-time log", "database health report",
                "performance report", "health report",
            ])

            # Try processing client replies first if the subject contains a ticket ID
            processed_as_reply = False
            ticket_match = re.search(r'Ticket\s*#?\s*(\d+)', subject, re.IGNORECASE)
            if ticket_match:
                try:
                    processed_as_reply = process_incoming_reply(item)
                except Exception as re_err:
                    print("Error checking reply mail:", re_err)

                if processed_as_reply:
                    if not item.is_read:
                        item.is_read = True
                        item.save()
                    mark_as_processed(msg_id, subject, sender_email)
                    continue
                else:
                    # It was an automated system alert email copy (not a human reply).
                    # We want to skip it entirely and not parse it as a new alert.
                    print(f"[INBOX] Skipping system alert email copy: {subject}")
                    if not item.is_read:
                        item.is_read = True
                        item.save()
                    mark_as_processed(msg_id, subject, sender_email)
                    continue

            # If NOT processed as a reply, check and process log analytics/telemetry directly (subject filter only)
            if is_rds and not is_reply_or_fwd:
                print(f"Detected Inbox RDS Email: {subject}")
                try:
                    process_rds_mail(item)
                except Exception as rds_err:
                    print(f"[RDS MAIL] Error: {rds_err}")
                audit_logger.info(f"[PROCESSED] {subject}")
                if not item.is_read:
                    item.is_read = True
                    item.save()
                mark_as_processed(msg_id, subject, sender_email)
                continue

            if is_telemetry and not is_reply_or_fwd:
                print(f"[INBOX] Processing telemetry email: {subject}")
                try:
                    process_mail(item, override_client=client_t, override_server=server_t, override_db=db_t, override_log_type=log_type_t)
                except Exception as pm_err:
                    print(f"[INBOX] process_mail error: {pm_err}")
                if not item.is_read:
                    item.is_read = True
                    item.save()
                mark_as_processed(msg_id, subject, sender_email)
                continue

            if is_storage and not is_reply_or_fwd:
                print(f"[INBOX] Detected DB/Table Size mail: {subject}")
                try:
                    from telemetry_parser import process_telemetry_email
                    import psycopg2
                    _conn = get_connection()
                    _cur = _conn.cursor()
                    html_body = getattr(item, 'body', None) or getattr(item, 'html_body', None) or body_val or ""
                    rcv = getattr(item, 'datetime_received', None)
                    rcv_date = rcv.date() if rcv else None
                    _inserted = process_telemetry_email(_cur, subject, html_body, received_date=rcv_date)
                    _conn.commit()
                    _cur.close()
                    _conn.close()
                    print(f"[INBOX] Storage mail ingested: {_inserted} records for '{subject}'")
                except Exception as _stor_err:
                    print(f"[INBOX] Storage mail error: {_stor_err}")
                if not item.is_read:
                    item.is_read = True
                    item.save()
                mark_as_processed(msg_id, subject, sender_email)
                continue

            if is_log_analytics and not is_reply_or_fwd:
                print(f"[INBOX] Detected Log Analytics / Health Report mail: {subject}")
                try:
                    process_rds_mail(item)
                    print(f"[INBOX] Log analytics mail processed: {subject}")
                except Exception as _la_err:
                    print(f"[INBOX] Log analytics mail error: {_la_err}")
                if not item.is_read:
                    item.is_read = True
                    item.save()
                mark_as_processed(msg_id, subject, sender_email)
                continue

            # Otherwise, skip automated system-sent/alert emails that are not telemetry/log reports
            body_text_to_use = body_val
            if body_text_to_use and ("<html" in body_text_to_use.lower() or "<div" in body_text_to_use.lower() or "<p" in body_text_to_use.lower() or "<br" in body_text_to_use.lower()):
                body_text_to_use = clean_html(body_text_to_use)
            extracted_content = extract_reply_message(body_text_to_use)
            extracted_lower = extracted_content.lower()
            subject_lower = subject.lower()

            is_automated = (
                "[auto]" in subject_lower or
                "[geomon log alert]" in subject_lower or
                "new log incident alert" in subject_lower or
                "automated alert notification" in body_lower or
                "this is an automated notification" in body_lower or
                "this alert was triggered automatically" in body_lower or
                "always from mailbox: dccagent@geopits.com" in body_lower or
                "database system alert:" in body_lower or
                "database service restart event" in body_lower or
                "geomon incident center" in body_lower or
                "ticket reference details" in body_lower or
                "assigned agent:" in body_lower or
                "resource spike alert summary" in body_lower or
                "critical: server down alert" in body_lower or
                "automated daily storage audit" in body_lower or
                "uptime alert triggered:" in body_lower or
                "log file shrinking" in body_lower or
                "open alert (id:" in body_lower or
                "resolved alert (id:" in body_lower or
                "database system alert:" in extracted_lower or
                "database service restart event" in extracted_lower or
                "geomon incident center" in extracted_lower or
                "ticket reference details" in extracted_lower or
                "assigned agent:" in extracted_lower or
                "resource spike alert summary" in extracted_lower or
                "critical: server down alert" in extracted_lower or
                "automated daily storage audit" in extracted_lower or
                "always from mailbox: dccagent@geopits.com" in extracted_lower or
                "this is an automated notification" in extracted_lower or
                "this alert was triggered automatically" in extracted_lower or
                "uptime alert triggered:" in extracted_lower or
                "log file shrinking" in extracted_lower or
                "open alert (id:" in extracted_lower or
                "resolved alert (id:" in extracted_lower or
                (sender_lower == system_email and not is_reply_or_fwd)
            )
            
            if is_automated:
                print(f"[REPLY FILTER] Skipping automated or system-sent alert: {subject}")
                if not item.is_read:
                    try:
                        item.is_read = True
                        item.save()
                    except Exception: pass
                mark_as_processed(msg_id, subject, sender_email)
                continue

            # If it is a self-copied system alert, mark it as read so it doesn't clog the unread inbox queue
            if sender_lower == system_email and is_system_alert:
                print(f"Marking self-copied system alert as read: {subject}")
                if not item.is_read:
                    item.is_read = True
                    item.save()

            # Always mark the item as processed at the end of the iteration
            mark_as_processed(msg_id, subject, sender_email)
                    
        if inbox_items:
            try:
                if len(inbox_items) < 200:
                    save_folder_watermark("Inbox", _dt.datetime.utcnow())
                else:
                    save_folder_watermark("Inbox", inbox_items[-1].datetime_received)
            except Exception:
                try: save_folder_watermark("Inbox")
                except Exception: pass
        else:
            try:
                save_folder_watermark("Inbox", _dt.datetime.utcnow())
            except Exception: pass
    except Exception as e:
        print("Inbox check error:", e)
        try:
            print("[MOCK MAIL] Inbox check failed. Running simulation update...")
            simulate_local_uptime_update()
        except Exception as sim_err:
            print("[MOCK MAIL] Failed to run simulation:", sim_err)
        err_msg = str(e).lower()
        if any(kw in err_msg for kw in ["cannot service this request right now", "try again later", "refresh_token", "aadsts", "expired"]):
            raise

def simulate_local_uptime_update():
    """
    Simulation mode helper to update db_uptime_history and db_monitoring_logs
    in local development mode when Outlook Mailbox integration is bypassed.
    This keeps the UI looking real-time and active.
    """
    conn = get_connection()
    try:
        cur = conn.cursor()
        
        # Get the latest record for each unique service
        cur.execute("""
            SELECT DISTINCT ON (client_name, server_name, db_type, service_name)
                client_name, server_name, db_type, service_name, status, last_restart_time
            FROM db_uptime_history
            ORDER BY client_name, server_name, db_type, service_name, captured_at DESC;
        """)
        rows = cur.fetchall()
        
        if not rows:
            print("[SIMULATION] No existing db_uptime_history records to simulate.")
            return

        now = get_accurate_ist().replace(tzinfo=None)
        
        for client, server, db_type, service_name, status, last_restart_time in rows:
            # Calculate new uptime duration
            uptime_desc = "ONLINE"
            if last_restart_time:
                # Ensure last_restart_time is parsed if it's a string, though in DB it's a TIMESTAMP
                if isinstance(last_restart_time, str):
                    try:
                        # Clean first
                        clean_ts = last_restart_time.strip()
                        if clean_ts.count(":") == 3:
                            clean_ts = clean_ts.rsplit(":", 1)[0]
                        else:
                            clean_ts = clean_ts.split(".")[0]
                        last_restart_time = datetime.strptime(clean_ts, "%Y-%m-%d %H:%M:%S")
                    except:
                        pass
                
                if isinstance(last_restart_time, datetime):
                    delta = now - last_restart_time
                    days = delta.days
                    hours, remainder = divmod(delta.seconds, 3600)
                    minutes, _ = divmod(remainder, 60)
                    parts = []
                    if days > 0:
                        parts.append(f"{days} Days")
                    if hours > 0 or days > 0:
                        parts.append(f"{hours} Hours")
                    if minutes > 0 or (days == 0 and hours == 0):
                        parts.append(f"{minutes} Mins")
                    uptime_desc = " ".join(parts) if parts else "0 Mins"

            # Check if a record for this service and captured_at (within 1 minute) already exists
            cur.execute("""
                SELECT 1 FROM db_uptime_history 
                WHERE client_name = %s AND server_name = %s AND service_name = %s AND captured_at >= %s - interval '1 minute'
                LIMIT 1;
            """, (client, server, service_name, now))
            if cur.fetchone():
                continue # Already updated recently

            # Check and trigger alerts for restart or stopped status
            try:
                # convert last_restart_time to datetime if it's a string
                sim_restart_dt = last_restart_time
                if isinstance(sim_restart_dt, str):
                    try:
                        clean_ts = sim_restart_dt.strip()
                        if clean_ts.count(":") == 3:
                            clean_ts = clean_ts.rsplit(":", 1)[0]
                        else:
                            clean_ts = clean_ts.split(".")[0]
                        sim_restart_dt = datetime.strptime(clean_ts, "%Y-%m-%d %H:%M:%S")
                    except:
                        pass
                check_and_trigger_uptime_alerts(cur, client, server, db_type, {"service_name": service_name, "status": status}, sim_restart_dt, now)
            except Exception as e:
                print(f"Error checking uptime alerts in simulation: {e}")

            # Insert into db_uptime_history
            cur.execute("""
                INSERT INTO db_uptime_history (client_name, server_name, db_type, service_name, status, uptime_desc, last_restart_time, captured_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (client_name, server_name, service_name, captured_at) DO UPDATE
                SET status = EXCLUDED.status,
                    uptime_desc = EXCLUDED.uptime_desc,
                    last_restart_time = EXCLUDED.last_restart_time;
            """, (client, server, db_type, service_name, status, uptime_desc, last_restart_time, now))

            # Also insert log into db_monitoring_logs so search & charts work
            log_msg = f"Service {service_name} is {status}. Last Uptime: {uptime_desc}"
            log_hash = f"{client}_{server}_{db_type}_db_uptime_{service_name}_{now.strftime('%Y%m%d%H%M')}"
            h = make_hash(log_hash)
            
            cur.execute("""
                INSERT INTO db_monitoring_logs (
                    client_name, server_name, db_type, log_type, log_source,
                    log_time, log_time_utc, log_time_ist, log_message, email_subject, email_received_time, log_hash
                )
                VALUES (%s, %s, %s, 'db_uptime', %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (log_hash) DO NOTHING;
            """, (client, server, db_type, service_name, now, now, now, log_msg, f"[Simulated Status] {client} — {status}", now, h))

        conn.commit()
        print(f"[SIMULATION] Successfully simulated uptime status updates at {now}.")
    except Exception as e:
        conn.rollback()
        print(f"[SIMULATION] Error during simulation update: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    import datetime as _main_dt
    print("Mail monitor started")
    _telemetry_poll_counter = 0
    _TELEMETRY_POLL_EVERY = 60  # run telemetry folder sweep every 60 cycles (~30 min at 30s/cycle)
    _TOKEN_REFRESH_INTERVAL = 45 * 60  # refresh access token every 45 min (token valid 60 min)
    _last_token_refresh = _main_dt.datetime.utcnow()

    while True:
        # ── Proactive token refresh (every 45 min, before calls, not after 401) ──
        _now = _main_dt.datetime.utcnow()
        if (_now - _last_token_refresh).total_seconds() >= _TOKEN_REFRESH_INTERVAL:
            print("[TOKEN] 45-min refresh interval reached. Refreshing Graph API token...")
            try:
                _new_account = get_account()
                if _new_account:
                    account = _new_account
                    _last_token_refresh = _now
                    print("[TOKEN] Token refreshed successfully.")
                else:
                    print("[TOKEN] Refresh returned None — keeping existing account.")
            except Exception as _tok_err:
                print(f"[TOKEN] Refresh failed: {_tok_err}")

        try:
            read_mail()
        except Exception as e:
            print("Mail error:", e)
            err_msg = str(e).lower()
            if any(kw in err_msg for kw in ["refresh_token", "aadsts", "expired", "401", "unauthorized", "invalidauthenticationtoken"]):
                print("[TOKEN] 401/expired error detected. Force-refreshing token now...")
                try:
                    _new_account = get_account()
                    if _new_account:
                        account = _new_account
                        _last_token_refresh = _main_dt.datetime.utcnow()
                        print("[TOKEN] Token force-refreshed successfully.")
                except Exception as ex:
                    print("[TOKEN] Force-refresh failed:", ex)
            elif "the server cannot service this request right now" in err_msg or "try again later" in err_msg:
                print("ExchangeServerBusy: The server is busy or throttling requests. Backing off for 2 minutes...")
                time.sleep(120)
                continue

        # ── Periodic telemetry folder sweep for DB & Table size mails ─────────
        _telemetry_poll_counter += 1
        if _telemetry_poll_counter >= _TELEMETRY_POLL_EVERY:
            _telemetry_poll_counter = 0
            print("[TELEMETRY SWEEP] Running periodic DB/Table size telemetry folder scan...")
            try:
                from telemetry_parser import run_telemetry_sync
                run_telemetry_sync()
            except Exception as _tel_err:
                print(f"[TELEMETRY SWEEP] Error: {_tel_err}")

        if not account:
            time.sleep(10)
        else:
            time.sleep(30)
