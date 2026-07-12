"""
services/email_service.py — Email dispatching service (Graph API, SMTP, Simulated fallback)
"""
import os
import re
import requests
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import base64 as _base64
from typing import Optional, Tuple

from core.database import get_connection

def lookup_email_routing_service(client_name: str, db_type: str, conn=None) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Looks up TO, CC, and FROM email configurations dynamically from the database.
    Does NOT use any hardcoded default emails.
    """
    close_conn = False
    if conn is None:
        conn = get_connection()
        close_conn = True
    
    to_emails = None
    cc_emails = None
    from_email = None
    
    try:
        cur = conn.cursor()
        # 1. Resolve FROM / Sender email from system_settings
        cur.execute("SELECT value FROM system_settings WHERE key = 'sender_email';")
        row = cur.fetchone()
        if row and row[0]:
            from_email = row[0].strip()
        
        # 2. Resolve TO and CC emails from client_alert_settings
        cur.execute("""
            SELECT client_emails, cc_emails 
            FROM client_alert_settings 
            WHERE LOWER(TRIM(client_name)) = LOWER(TRIM(%s)) 
              AND LOWER(TRIM(db_type)) = LOWER(TRIM(%s))
            LIMIT 1;
        """, (client_name, db_type))
        row = cur.fetchone()
        if row:
            if row[0]:
                to_emails = row[0].strip()
            if row[1]:
                cc_emails = row[1].strip()
        
        # 3. If TO not found in client_alert_settings, resolve from admin_clients
        if not to_emails:
            cur.execute("""
                SELECT client_email 
                FROM admin_clients 
                WHERE LOWER(TRIM(client_name)) = LOWER(TRIM(%s)) 
                  AND LOWER(TRIM(db_type)) = LOWER(TRIM(%s))
                LIMIT 1;
            """, (client_name, db_type))
            row = cur.fetchone()
            if row and row[0]:
                to_emails = row[0].strip()
                
        # 4. Resolve CC from technology_alerts_config if not set in client_alert_settings
        if not cc_emails:
            cur.execute("""
                SELECT alert_email 
                FROM technology_alerts_config 
                WHERE LOWER(technology) = LOWER(%s)
                LIMIT 1;
            """, (db_type,))
            row = cur.fetchone()
            if row and row[0]:
                cc_emails = row[0].strip()
                
        cur.close()
    except Exception as e:
        print(f"[EMAIL ROUTING SERVICE ERROR] {e}")
    finally:
        if close_conn:
            conn.close()
            
    # Fallback for FROM email: check environment variables
    if not from_email:
        from_email = os.getenv("SENDER_EMAIL") or os.getenv("USER_EMAIL") or os.getenv("SMTP_USERNAME")
        
    return to_emails, cc_emails, from_email


def build_gorgeous_html_email(title: str, greeting: str, lead_text: str, details: dict, action_url: Optional[str] = None, action_text: Optional[str] = None) -> str:
    details_html = ""
    for label, val in details.items():
        details_html += f"""
        <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 500; font-size: 14px; width: 180px; text-align: left;">{label}</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600; font-size: 14px; text-align: left;">{val}</td>
        </tr>
        """
        
    action_button_html = ""
    if action_url and action_text:
        action_button_html = f"""
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 30px auto; width: 100%; max-width: 280px;">
            <tr>
                <td align="center" bgcolor="#2563eb" style="border-radius: 8px; background-color: #2563eb;">
                    <a href="{action_url}" target="_blank" style="background-color: #2563eb; border: 12px solid #2563eb; border-radius: 8px; color: #ffffff; display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 700; text-align: center; text-decoration: none; width: 100%; box-sizing: border-box; -webkit-text-size-adjust: none;">{action_text}</a>
                </td>
            </tr>
        </table>
        """

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; padding: 40px 0;">
            <tr>
                <td align="center">
                    <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05);" cellspacing="0" cellpadding="0" border="0">
                        <!-- Header Banner -->
                        <tr>
                            <td style="background-color: #0f172a; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 35px 40px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">{title}</h1>
                                <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">GeoMon Enterprise Observability</p>
                            </td>
                        </tr>
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px 40px 30px 40px;">
                                <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #0f172a; font-weight: 600; text-align: left;">{greeting}</p>
                                <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #334155; text-align: left;">{lead_text}</p>
                                
                                <!-- Details Table -->
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 8px; border-collapse: separate; overflow: hidden; margin-bottom: 24px;">
                                    {details_html}
                                </table>
                                
                                {action_button_html}
                                
                                <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 20px; color: #64748b; font-style: italic; text-align: left;">
                                    For security reasons, please do not share these details. If you need to reset or change your password, you can do so directly from your account settings inside the portal.
                                </p>
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f1f5f9; padding: 25px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
                                <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 18px;">
                                    &copy; 2026 GeoMon Inc. All rights reserved.<br/>
                                    This is an automated system notification. Please do not reply directly to this email.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    return html


def send_email_outlook(to_emails: str, cc_emails: Optional[str], subject: str, body: str, sender_email: Optional[str] = None, attachments: list = None, reply_to: Optional[str] = None, exclude_dccagent: bool = False) -> bool:
    # Resolve sender email dynamically
    final_sender = sender_email
    if not final_sender:
        final_sender = os.getenv("SENDER_EMAIL") or os.getenv("USER_EMAIL") or os.getenv("SMTP_USERNAME")
    if not final_sender:
        try:
            conn_temp = get_connection()
            cur_temp = conn_temp.cursor()
            cur_temp.execute("SELECT value FROM system_settings WHERE key = 'sender_email';")
            row_temp = cur_temp.fetchone()
            if row_temp and row_temp[0]:
                final_sender = row_temp[0].strip()
            cur_temp.close()
            conn_temp.close()
        except Exception as e:
            print(f"[OUTLOOK SENDER RESOLVE ERROR] {e}")
            
    if not final_sender:
        print("[OUTLOOK EMAIL SENDER ERROR] No sender email configured. Skipping dispatch.")
        return False

    tenant_id = os.getenv("APP_TENANT")
    client_id = os.getenv("APP_CLIENT")
    client_secret = os.getenv("APP_SECRET")

    # Auto-add dccagent@geopits.com to CC if final_sender is not it
    if not exclude_dccagent and final_sender.strip().lower() != "dccagent@geopits.com":
        if cc_emails:
            cc_list = [c.strip().lower() for c in re.split(r'[;,]', cc_emails) if c.strip()]
            if "dccagent@geopits.com" not in cc_list:
                cc_emails = cc_emails + ", dccagent@geopits.com"
        else:
            cc_emails = "dccagent@geopits.com"

    def clean_to_list(email_str):
        if not email_str:
            return None
        emails = re.split(r'[;,]', str(email_str))
        cleaned = [e.strip() for e in emails if e.strip() and e.strip().lower() != "none"]
        return ", ".join(cleaned) if cleaned else None

    def clean_cc_list(email_str):
        if not email_str:
            return None
        emails = re.split(r'[;,]', str(email_str))
        cleaned = []
        sender_lower = final_sender.strip().lower() if final_sender else ""
        for e in emails:
            e_clean = e.strip().lower()
            if e_clean and e_clean != "none":
                if e_clean == "dccagent@geopits.com" and sender_lower == "dccagent@geopits.com":
                    continue
                cleaned.append(e.strip())
        return ", ".join(cleaned) if cleaned else None

    to_emails = clean_to_list(to_emails)
    cc_emails = clean_cc_list(cc_emails)
    
    to_list = []
    if to_emails:
        to_list = [e.strip() for e in re.split(r'[;,]', to_emails) if e.strip()]
    if not exclude_dccagent and "dccagent@geopits.com" not in [e.lower() for e in to_list]:
        to_list.insert(0, "dccagent@geopits.com")
    to_emails = ", ".join(to_list)
        
    print(f"[OUTLOOK EMAIL SENDER] Initiating send from {final_sender} to {to_emails}...")
    
    graph_attachments = []
    if attachments:
        for att in attachments:
            try:
                att_name = att.get("name", "attachment")
                att_data = att.get("data", "")
                if "," in att_data:
                    att_data = att_data.split(",", 1)[1]
                graph_attachments.append({
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    "name": att_name,
                    "contentBytes": att_data
                })
            except Exception as ae:
                print(f"[ATTACHMENT PARSE ERROR] {ae}")
    
    # 1. Primary Method: MS Graph API
    if tenant_id and client_id and client_secret:
        try:
            print("[GRAPH API] Authenticating client credentials flow with Entra ID...")
            token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
            token_data = {
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
                "scope": "https://graph.microsoft.com/.default"
            }
            
            token_r = requests.post(token_url, data=token_data, timeout=10)
            if token_r.status_code == 200:
                access_token = token_r.json().get("access_token")
                if access_token:
                    print(f"[GRAPH API] Access token successfully acquired! Sending mail via Graph on behalf of {final_sender}...")
                    send_url = f"https://graph.microsoft.com/v1.0/users/{final_sender}/sendMail"
                    
                    to_recipients = []
                    for email in re.split(r'[;,]', to_emails):
                        email = email.strip()
                        if email and "@" in email:
                            to_recipients.append({"emailAddress": {"address": email}})
                            
                    cc_recipients = []
                    if cc_emails:
                        for email in re.split(r'[;,]', cc_emails):
                            email = email.strip()
                            if email and "@" in email:
                                cc_recipients.append({"emailAddress": {"address": email}})
                                
                    payload = {
                        "message": {
                            "subject": subject,
                            "body": {
                                "contentType": "HTML",
                                "content": body if "<html>" in body else body.replace("\n", "<br/>")
                            },
                            "toRecipients": to_recipients,
                            "replyTo": [
                                {
                                    "emailAddress": {
                                        "address": reply_to if reply_to else "dccagent@geopits.com"
                                    }
                                }
                            ]
                        },
                        "saveToSentItems": "true"
                    }
                    if cc_recipients:
                        payload["message"]["ccRecipients"] = cc_recipients
                    if graph_attachments:
                        payload["message"]["attachments"] = graph_attachments
                        
                    headers = {
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json"
                    }
                    
                    send_r = requests.post(send_url, json=payload, headers=headers, timeout=30)
                    if send_r.status_code in [200, 202]:
                        print("SUCCESS: Email successfully sent via MS Graph API!")
                        return True
                    else:
                        print(f"[GRAPH API Error] SendMail failed (Status {send_r.status_code}): {send_r.text}")
            else:
                print(f"[GRAPH API Error] Token request failed (Status {token_r.status_code}): {token_r.text}")
        except Exception as graph_err:
            print(f"[GRAPH API Error] Exception during Graph API execution: {graph_err}")
            
    # 2. SMTP Fallback
    smtp_server = os.getenv("SMTP_SERVER") or os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME") or os.getenv("SMTP_USER") or os.getenv("USER_EMAIL")
    smtp_password = os.getenv("SMTP_PASSWORD") or os.getenv("MAIL_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM_EMAIL") or smtp_username or "noreply@geomon.com"
    
    if smtp_server and smtp_username and smtp_password:
        print(f"[SMTP EMAIL SENDER] Connecting to SMTP server {smtp_server}:{smtp_port}...")
        try:
            msg = MIMEMultipart()
            msg["From"] = smtp_from
            msg["To"] = to_emails
            if cc_emails:
                msg["Cc"] = cc_emails
            msg["Subject"] = subject
            msg["Reply-To"] = reply_to if reply_to else "dccagent@geopits.com"
            msg.attach(MIMEText(body, "html"))
            
            if attachments:
                for att in attachments:
                    try:
                        att_name = att.get("name", "attachment")
                        att_data_str = att.get("data", "")
                        if "," in att_data_str:
                            att_data_str = att_data_str.split(",", 1)[1]
                        att_bytes = _base64.b64decode(att_data_str)
                        part = MIMEBase("application", "octet-stream")
                        part.set_payload(att_bytes)
                        encoders.encode_base64(part)
                        part.add_header("Content-Disposition", f'attachment; filename="{att_name}"')
                        msg.attach(part)
                    except Exception as smtp_att_err:
                        print(f"[SMTP ATTACHMENT ERROR] {smtp_att_err}")
            
            recipients = [email.strip() for email in re.split(r'[;,]', to_emails) if email.strip()]
            if cc_emails:
                recipients += [email.strip() for email in re.split(r'[;,]', cc_emails) if email.strip()]
                
            if smtp_port == 465:
                server = smtplib.SMTP_SSL(smtp_server, smtp_port, timeout=10)
            else:
                server = smtplib.SMTP(smtp_server, smtp_port, timeout=10)
                server.starttls()
                
            server.login(smtp_username, smtp_password)
            server.sendmail(smtp_from, recipients, msg.as_string())
            server.quit()
            print("SUCCESS: Email successfully sent via SMTP!")
            return True
        except Exception as e:
            print(f"SMTP error occurred: {e}. Trying other methods...")
            
    # 3. Simulated Fallback
    print("[SIMULATED EMAIL SYSTEM] No working email credentials configured. Logging email details:")
    print(f"-> TO: {to_emails}")
    print(f"-> CC: {cc_emails}")
    print(f"-> SUBJECT: {subject}")
    print(f"-> BODY:\n{body}")
    if graph_attachments:
        print(f"-> ATTACHMENTS: {[a['name'] for a in graph_attachments]}")
    return True
