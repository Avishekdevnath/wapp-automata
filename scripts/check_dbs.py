import sqlite3
import glob

dbs = glob.glob("/opt/wapp-automata/**/*.sqlite", recursive=True) + glob.glob("/opt/wapp-automata/**/*.db", recursive=True)
for path in sorted(set(dbs)):
    try:
        conn = sqlite3.connect(path)
        c = conn.cursor()
        tables = [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        print(f"\n--- {path} ---")
        for t in tables:
            try:
                cnt = c.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
                if cnt > 0:
                    print(f"  {t}: {cnt}")
            except:
                pass
        conn.close()
    except Exception as e:
        print(f"{path} Error: {e}")
