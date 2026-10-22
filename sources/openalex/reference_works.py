# يبحث في OpenAlex عن أعمال مرجعية تاريخية بعناوين محددة، ويحفظ البيانات الوصفية فقط.
# المفتاح يُقرأ من متغير البيئة OPENALEX_API_KEY ولا يُطبع ولا يُحفظ.
import json, os, re, time, urllib.parse, urllib.request
from pathlib import Path

OUT = Path(__file__).parent / "reference_works.json"
KEY = os.environ.get("OPENALEX_API_KEY", "")
BASE = "https://api.openalex.org/works"

# (اللغة، العنوان المرشح، المجال)
SEEDS = [
    ("en", "Encyclopaedia of Islam", "islam"),
    ("en", "Encyclopaedia Iranica", "iran"),
    ("en", "Cambridge History of Iran", "iran"),
    ("en", "Cambridge World History", "world"),
    ("en", "Oxford Encyclopedia of World History", "world"),
    ("en", "Encyclopedia of Ancient History", "ancient"),
    ("en", "Dictionary of the Middle Ages", "medieval"),
    ("en", "History of Humanity", "world"),
    ("en", "General History of Africa", "africa"),
    ("en", "History of Civilizations of Central Asia", "central_asia"),
    ("en", "History of Mankind", "world"),
    ("en", "Cambridge Ancient History", "ancient"),
    ("en", "Encyclopedia of Chinese History", "china"),
    ("en", "Encyclopedia of Latin American History", "latin_america"),
    ("en", "Encyclopedia of Indian History", "india"),
    ("fr", "Encyclopédie de l'Islam", "islam"),
    ("fr", "Histoire générale", "world"),
    ("de", "Enzyklopädie des Islam", "islam"),
    ("de", "Propyläen Weltgeschichte", "world"),
    ("tr", "İslam Ansiklopedisi", "islam"),
    ("fa", "دایرةالمعارف بزرگ اسلامی", "islam"),
    ("ar", "موسوعة التاريخ الإسلامي", "islam"),
    ("ar", "موسوعة الحضارة الإسلامية", "islam"),
    ("es", "Historia de España", "iberia"),
    ("ru", "История мира", "world"),
    ("zh", "中国历史", "china"),
    ("ja", "世界史", "world"),
]

def norm(s):
    s = re.sub(r"[ً-ٟـ]", "", s or "")
    return re.sub(r"\s+", " ", s).strip().lower()

def query(phrase):
    params = {"filter": f'title.search:"{phrase}"', "per-page": "15", "sort": "cited_by_count:desc"}
    if KEY:
        params["api_key"] = KEY
    url = BASE + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "atlas-sunan/0.1"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf8"))

def record(w, lang, domain, phrase):
    pl = w.get("primary_location") or {}
    src = pl.get("source") or {}
    oa = w.get("open_access") or {}
    return {
        "openalex_id": w.get("id"),
        "doi": w.get("doi"),
        "title": w.get("title"),
        "year": w.get("publication_year"),
        "type": w.get("type"),
        "language": w.get("language") or lang,
        "domain": domain,
        "seed_phrase": phrase,
        "cited_by_count": w.get("cited_by_count"),
        "venue": src.get("display_name"),
        "publisher": src.get("host_organization_name"),
        "oa_status": oa.get("oa_status"),
        "oa_url": oa.get("oa_url"),
        "license": pl.get("license"),
        "verified": False,
    }

results, seen = [], set()
for lang, phrase, domain in SEEDS:
    try:
        data = query(phrase)
    except Exception as e:
        print(f"[{lang}] {phrase}: خطأ ({type(e).__name__})")
        time.sleep(1)
        continue
    if "error" in data:
        print(f"[{lang}] {phrase}: {str(data.get('message'))[:100]}")
        continue
    hits = [w for w in data.get("results", []) if phrase.lower() in norm(w.get("title")) or norm(phrase) in norm(w.get("title"))]
    print(f"[{lang}] {phrase}: {len(hits)} تطابق من {data['meta']['count']}")
    for w in hits:
        if w["id"] in seen:
            continue
        seen.add(w["id"])
        results.append(record(w, lang, domain, phrase))
    time.sleep(0.3)

OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf8")
print("saved", len(results), "records to", OUT.name)
