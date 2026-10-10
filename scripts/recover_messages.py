import sys
import re
import json
import sqlite3

def recover(db_path, target_db):
    print(f"Reading {db_path}...")
    with open(db_path, "rb") as f:
        data = f.read()

    print(f"File size: {len(data)} bytes. Scanning for SQLite raw message records...")
    
    # We look for raw JSON chunks that Baileys produces: {"key":{"remoteJid":...
    regex = re.compile(rb'(\{"key":\{"remoteJid":".+?"messageTimestamp":\d+.*?\})')
    
    matches = regex.findall(data)
    print(f"Found {len(matches)} regex chunks")
    
    recovered = {}
    for raw in matches:
        text = raw.decode("utf-8", errors="ignore")
        s = text.find('{"key":')
        if s == -1:
            continue
        # Search backwards for matching JSON
        for e in range(len(text), s + 20, -1):
            if text[e-1] == '}':
                candidate = text[s:e]
                try:
                    obj = json.loads(candidate)
                    key = obj.get("key", {})
                    msg_id = key.get("id")
                    remote_jid = key.get("remoteJid")
                    if msg_id and remote_jid:
                        recovered[msg_id] = obj
                        break
                except Exception:
                    pass

    print(f"Parsed {len(recovered)} valid unique WhatsApp message JSON objects!")
    
    if not recovered:
        print("No valid messages found to restore.")
        return

    conn = sqlite3.connect(target_db)
    cursor = conn.cursor()
    
    restored_count = 0
    for msg_id, raw_msg in recovered.items():
        key = raw_msg.get("key", {})
        remote_jid = key.get("remoteJid", "")
        is_from_me = 1 if key.get("fromMe") else 0
        
        # Participant or sender
        sender_jid = key.get("participant") or (remote_jid if not is_from_me else "")
        if not sender_jid and is_from_me:
            sender_jid = "me"
            
        chat_type = "group" if "@g.us" in remote_jid else "direct"
        
        # Extract text
        msg_content = raw_msg.get("message", {})
        text = ""
        if "conversation" in msg_content:
            text = msg_content["conversation"]
        elif "extendedTextMessage" in msg_content:
            text = msg_content["extendedTextMessage"].get("text", "")
        elif "imageMessage" in msg_content:
            text = msg_content["imageMessage"].get("caption", "[Image]")
        elif "videoMessage" in msg_content:
            text = msg_content["videoMessage"].get("caption", "[Video]")
        elif "documentMessage" in msg_content:
            text = msg_content["documentMessage"].get("fileName", "[Document]")
            
        ts = raw_msg.get("messageTimestamp", 0)
        if isinstance(ts, str):
            try: ts = int(ts)
            except: ts = 0
        if ts < 10000000000:
            ts = ts * 1000 # convert seconds to ms

        sender_name = raw_msg.get("pushName") or ""
        sender_phone = ""
        if "@s.whatsapp.net" in sender_jid:
            sender_phone = "+" + sender_jid.split("@")[0].split(":")[0]

        has_media = 1 if any(k in msg_content for k in ["imageMessage", "videoMessage", "documentMessage", "audioMessage", "stickerMessage"]) else 0
        media_type = None
        for mt in ["imageMessage", "videoMessage", "documentMessage", "audioMessage", "stickerMessage"]:
            if mt in msg_content:
                media_type = mt.replace("Message", "")
                break

        try:
            cursor.execute("""
                INSERT OR IGNORE INTO caught_messages (
                    id, remote_jid, chat_name, chat_type, sender_jid, sender_phone,
                    sender_name, message_text, has_media, media_type, is_from_me,
                    timestamp, raw_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                msg_id, remote_jid, remote_jid, chat_type, sender_jid, sender_phone,
                sender_name, text, has_media, media_type, is_from_me,
                ts, json.dumps(raw_msg)
            ))
            if cursor.rowcount > 0:
                restored_count += 1
        except Exception as e:
            pass

    conn.commit()
    conn.close()
    print(f"Successfully restored {restored_count} messages into {target_db}!")

if __name__ == "__main__":
    db_file = sys.argv[1] if len(sys.argv) > 1 else "/opt/wapp-automata/backup_recovery/scraped.sqlite"
    target = sys.argv[2] if len(sys.argv) > 2 else "/opt/wapp-automata/current/accounts/telcia-prod/data/scraped.sqlite"
    recover(db_file, target)
