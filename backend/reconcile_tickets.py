import re
from db_manager import get_connection
from subject_parser import parse_subject

def reconcile():
    conn = get_connection()
    cur = conn.cursor()

    # 1. First, let's fix known casing and format discrepancies for company names
    standardizations = {
        "GEOJIT": "Geojit",
        "Credopay": "CredoPay",
        "RetailScan": "Retailscan",
        "Retail": "Retailscan",
        "Pepper-Advantage": "Pepper Advantage",
        "Pepper": "Pepper Advantage",
        "RunLoyal": "Runloyal",
        "FlowGlobal": "Flowglobal",
        "MAX": "Maxhealthcare",
        "Mitsubishielevator": "Mitsubishi"
    }

    for bad_name, clean_name in standardizations.items():
        cur.execute("UPDATE tickets SET company = %s WHERE company = %s", (clean_name, bad_name))
        conn.commit()

    # 2. Query all tickets that are still marked as 'Unknown'
    cur.execute("SELECT id, ticket_name, description, company FROM tickets WHERE company = 'Unknown'")
    unknown_tickets = cur.fetchall()

    print(f"Found {len(unknown_tickets)} tickets with company='Unknown'")

    updated_count = 0
    for tid, tname, desc, comp in unknown_tickets:
        if not desc:
            continue

        # Try to find 'Alert Subject: <subject>' in the description
        subj_match = re.search(r'Alert Subject:\s*(.*)', desc, re.IGNORECASE)
        extracted_subject = ""
        if subj_match:
            extracted_subject = subj_match.group(1).strip()
        else:
            # Fallback: maybe there is a 'Subject: <subject>'
            subj_match_2 = re.search(r'Subject:\s*(.*)', desc, re.IGNORECASE)
            if subj_match_2:
                extracted_subject = subj_match_2.group(1).strip()

        client, server, db, log_type = None, None, None, None
        if extracted_subject:
            # Run parse_subject to extract details
            client, server, db, log_type = parse_subject(extracted_subject)

        # If parse_subject did not succeed or returned Unknown, apply custom heuristics on description text
        if not client or client == "Unknown":
            desc_lower = desc.lower()
            if "credopay" in desc_lower or "marsdb" in desc_lower or "marsproddb" in desc_lower:
                client = "CredoPay"
            elif "geojit" in desc_lower or "bosrv" in desc_lower or "flipdb" in desc_lower or "agni" in desc_lower:
                client = "Geojit"
            elif "pepper" in desc_lower or "prod-lg-" in desc_lower or "lg-ci" in desc_lower:
                client = "Pepper Advantage"
            elif "retailscan" in desc_lower or "retail scan" in desc_lower or "ec2amaz-ic6pg05" in desc_lower:
                client = "Retailscan"
            elif "cropin" in desc_lower or "wsfcnode" in desc_lower:
                client = "Cropin"
            elif "shemaroo" in desc_lower or "ec2amaz-a1o1m2j" in desc_lower:
                client = "Shemaroo"
            elif "hpcl" in desc_lower or "cdcmsproddb1" in desc_lower:
                client = "HPCL"
            elif "cnergee" in desc_lower:
                client = "Cnergee"
            elif "intentwise" in desc_lower or "amazon rds" in desc_lower:
                client = "Intentwise"
            elif "360tf" in desc_lower:
                client = "360tf"
            elif "artfine" in desc_lower:
                client = "Artfine"
            elif "maxhealthcare" in desc_lower or "max healthcare" in desc_lower or "blr-max-sundb" in desc_lower:
                client = "Maxhealthcare"
            elif "mitsubishielevator" in desc_lower or "mitsubishi" in desc_lower or "imec-db2" in desc_lower:
                client = "Mitsubishi"

        if not server or server == "Unknown":
            # Heuristically extract server name from description/subject
            server_match = re.search(r'Server\s*-\s*([a-zA-Z0-9_\-\.\\]+)', desc, re.IGNORECASE)
            if server_match:
                server = server_match.group(1).strip()
            else:
                server_match_2 = re.search(r'Server:\s*([a-zA-Z0-9_\-\.\\]+)', desc, re.IGNORECASE)
                if server_match_2:
                    server = server_match_2.group(1).strip()

        # Update company if found
        if client and client != "Unknown":
            new_tname = tname
            if tname.startswith("Unknown"):
                # Reconstruct ticket name dynamically
                status_part = "Open"
                if "closed" in tname.lower() or "resolved" in tname.lower():
                    status_part = "Closed"

                # Standardize alert type name
                alert_type_name = "Long Running Queries"
                if "transaction" in tname.lower():
                    alert_type_name = "Open Transaction"
                elif "job" in tname.lower():
                    alert_type_name = "Job Alert"

                srv_part = server if server and server != "Unknown" else "Unknown"
                new_tname = f"{client} {srv_part} - {alert_type_name}: {status_part}"

            cur.execute("""
                UPDATE tickets 
                SET company = %s, ticket_name = %s 
                WHERE id = %s
            """, (client, new_tname, tid))
            print(f"Reconciled ticket #{tid}: '{tname}' -> company={client}, ticket_name='{new_tname}'")
            updated_count += 1

    conn.commit()
    cur.close()
    conn.close()
    print(f"Finished. Reconciled {updated_count} tickets.")

if __name__ == "__main__":
    reconcile()
