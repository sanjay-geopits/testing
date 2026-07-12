import json
import re
import xml.etree.ElementTree as ET

def extract_json_from_sql_output(text):
    """
    Extracts a JSON object or array from the email body text.
    Handles HTML tags cleaning, finds the outer brackets, and parses.
    """
    if not text:
        return []
    
    # Strip HTML tags
    text_clean = re.sub(r'<[^>]+>', ' ', text)
    
    # Try to find JSON array or object
    match = re.search(r'(\[.*\]|\{.*\})', text_clean, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass
            
    # Try line-by-line or list of objects
    found_objs = []
    for m in re.finditer(r'(\{.*?\})', text_clean, re.DOTALL):
        try:
            found_objs.append(json.loads(m.group(1)))
        except Exception:
            pass
            
    if found_objs:
        return found_objs
        
    return []

def extract_xml_from_sql_output(text):
    """
    Extracts XML root block (such as deadlock XML) from the raw text.
    """
    if not text:
        return None
    # Find XML blocks like <deadlock>...</deadlock> or generic tags
    match = re.search(r'(<deadlock>.*</deadlock>|<.*?>.*</.*?>)', text, re.DOTALL | re.IGNORECASE)
    if match:
        try:
            return ET.fromstring(match.group(1))
        except Exception:
            pass
    return None

def extract_memory_components(text):
    """
    Parses key memory metrics (PLE, Buffer Cache Hit Ratio, memory sizes) from the body text.
    """
    if not text:
        return {}
    
    text_clean = re.sub(r'<[^>]+>', '\n', text)
    metrics = {}
    
    patterns = {
        "page_life_expectancy": r'(?:Page Life Expectancy|PLE)\s*[:=-]?\s*(\d+)',
        "buffer_cache_hit_ratio": r'(?:Buffer [Cc]ache [Hh]it [Rr]atio)\s*[:=-]?\s*([\d\.]+)',
        "total_server_memory_kb": r'(?:Total Server Memory|Total Memory)\s*[:=-]?\s*(\d+)',
        "target_server_memory_kb": r'(?:Target Server Memory|Target Memory)\s*[:=-]?\s*(\d+)',
        "connection_memory_kb": r'(?:Connection Memory)\s*[:=-]?\s*(\d+)',
        "lock_memory_kb": r'(?:Lock Memory)\s*[:=-]?\s*(\d+)',
        "optimizer_memory_kb": r'(?:Optimizer Memory)\s*[:=-]?\s*(\d+)',
        "sql_cache_memory_kb": r'(?:SQL Cache Memory)\s*[:=-]?\s*(\d+)'
    }
    
    for key, pat in patterns.items():
        m = re.search(pat, text_clean, re.IGNORECASE)
        if m:
            try:
                metrics[key] = float(m.group(1)) if "." in m.group(1) else int(m.group(1))
            except ValueError:
                pass
    return metrics
