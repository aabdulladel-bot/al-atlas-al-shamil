# يتحقق من طبعات المصادر عبر فهرس أرشيف الإنترنت (البيانات الوصفية فقط)
import json, sys, urllib.parse, urllib.request
def search(q, rows=4):
    params = {"q": q, "fl[]": ["identifier", "title", "creator", "date", "year", "publisher", "licenseurl", "mediatype"], "rows": rows, "output": "json"}
    url = "https://archive.org/advancedsearch.php?" + urllib.parse.urlencode(params, doseq=True)
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "atlas-sunan/0.1"}), timeout=60) as r:
        return json.load(r)["response"]
queries = json.loads(sys.argv[1])
for label, q in queries:
    d = search(q)
    print(f"## {label}: {d['numFound']} نتيجة")
    for x in d["docs"]:
        print("   ", x.get("identifier"), "|", x.get("date") or x.get("year"), "|", (x.get("creator") or "")[:40] if isinstance(x.get("creator"), str) else x.get("creator"), "|", (x.get("title") or "")[:70] if isinstance(x.get("title"), str) else "", "|", x.get("licenseurl"), "|", x.get("mediatype"))
