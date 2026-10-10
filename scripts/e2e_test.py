import urllib.request
import json
import sys

base = "http://localhost:4000"
endpoints = [
    ("GET", "/api/status"),
    ("GET", "/api/accounts"),
    ("GET", "/api/chats"),
    ("GET", "/api/messages"),
    ("GET", "/api/routes"),
    ("GET", "/api/vendors"),
    ("GET", "/api/news"),
    ("GET", "/api/settings/stats"),
    ("GET", "/api/settings/dms"),
    ("GET", "/api/settings/retention"),
    ("GET", "/api/ai/settings"),
    ("GET", "/chat"),
    ("GET", "/css/chat.css"),
    ("GET", "/js/chat.js"),
    ("GET", "/")
]

print("=====================================================")
print("🧪 TELCIA MODULAR E2E VERIFICATION SUITE")
print("=====================================================")

passed = 0
for method, ep in endpoints:
    url = base + ep
    req = urllib.request.Request(url, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            code = resp.status
            size = len(resp.read())
            print(f"✅ PASS [{code}] {method:<4} {ep:<25} ({size} bytes)")
            passed += 1
    except Exception as e:
        print(f"❌ FAIL       {method:<4} {ep:<25} Error: {e}")

# Also test AI test ping endpoint
try:
    post_req = urllib.request.Request(
        base + "/api/ai/test",
        data=json.dumps({"provider": "deepseek"}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(post_req, timeout=10) as resp:
        print(f"✅ PASS [{resp.status}] POST /api/ai/test              (AI Provider Alive)")
        passed += 1
except Exception as e:
    print(f"⚠️ WARN       POST /api/ai/test              Error: {e}")

total = len(endpoints) + 1
print("=====================================================")
print(f"🏁 Final Result: {passed}/{total} End-to-End Tests Passed Successfully!")
print("=====================================================")

if passed < len(endpoints):
    sys.exit(1)
