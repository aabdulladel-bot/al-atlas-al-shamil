# يبني web/data/places_info.json للبطاقة التعريفية للمواضع (نقاط الخريطة في كل حقبة).
# لكل موضع: يُربط بمعرّف ويكي بيانات عبر عنوان مقالته الإنجليزية (name_en)، ثم يُتحقق من الربط بثلاثة شروط:
#   1) المقالة ليست صفحة توضيح، وهي تحمل معرّف ويكي بيانات.
#   2) للكيان إحداثيات (P625) وتبعد عن موضع الأطلس ضمن هامش يناسب دقة الموضع.
#   3) للكيان نوع (P31).
# ما لا يتحقق منه يُكتب بحالة «unverified» مع السبب، ولا تُملأ البطاقة بتخمين.
# الوصف والنوع والتواريخ من ويكي بيانات (CC0)، والمقالات للإحالة فقط. الاستعمال: python3 -I scripts/build_place_info.py [--check]
import json
import math
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web/data/places_info.json"
CACHE = ROOT / ".cache/scraper/places_info_raw.json"  # ذاكرة مؤقتة، لا تُلتزم
UA = "al-atlas-cards/1.0 (project maintainer; https://github.com/aabdulladel-bot/al-atlas-al-shamil)"
CHECK = "--check" in sys.argv
# هامش المسافة بين الموضع وإحداثيات الكيان (كم)، بحسب دقة الموضع في الأطلس
TOL_KM = {"pleiades-verified": 80, "pleiades-representative": 250, "natural-earth-modern-city": 60}
DEFAULT_TOL = 120


_cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}


def save_cache():
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(_cache, ensure_ascii=False), encoding="utf-8")


def get_json(url):
    # الاستجابة الناجحة تُحفظ مؤقتاً، فيستأنف البناء بعد الحجب دون إعادة الطلبات.
    # عند 429 أو 403 ينتظر ويتراجع بزمن متزايد، كما تطلب شروط الاستعمال.
    if url in _cache:
        return _cache[url]
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    last = None
    for attempt in range(8):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.loads(r.read().decode("utf-8"))
            _cache[url] = data
            save_cache()
            return data
        except Exception as e:
            last = e
            time.sleep(15 + attempt * 15)
    raise RuntimeError(f"{url[:120]}: {last}")


def haversine_km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, [a[1], a[0], b[1], b[0]])
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def load_places():
    out = []
    for era in range(1, 9):
        d = json.loads((ROOT / f"web/data/places_era{era}.geojson").read_text(encoding="utf-8"))
        for f in d["features"]:
            p = f["properties"]
            out.append({"id": f["id"], "era": era, "coords": f["geometry"]["coordinates"], "name_ar": p.get("name_ar", ""),
                        "name_en": p.get("name_en", ""), "coord_status": p.get("coord_status", "")})
    return out


def chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def wiki_qids(titles):
    """عنوان مقالة إنجليزية ← معرّف ويكي بيانات، مع اتباع إعادة التوجيه ورفض صفحات التوضيح."""
    result = {}
    for batch in chunks(sorted(set(titles)), 40):
        q = urllib.parse.urlencode({"action": "query", "titles": "|".join(batch), "redirects": 1, "prop": "pageprops",
                                    "ppprop": "wikibase_item|disambiguation", "format": "json"})
        data = get_json(f"https://en.wikipedia.org/w/api.php?{q}")
        redirects = {r["from"]: r["to"] for r in data.get("query", {}).get("redirects", [])}
        pages = {p["title"]: p for p in data.get("query", {}).get("pages", {}).values()}
        for t in batch:
            final = redirects.get(t, t)
            pg = pages.get(final, {})
            pp = pg.get("pageprops", {})
            result[t] = {"qid": pp.get("wikibase_item"), "disambig": "disambiguation" in pp, "title": final, "missing": "missing" in pg}
        time.sleep(4)
    return result


def wd_entities(qids):
    out = {}
    for batch in chunks(sorted(set(qids)), 50):
        q = urllib.parse.urlencode({"action": "wbgetentities", "ids": "|".join(batch), "props": "labels|descriptions|claims|sitelinks",
                                    "languages": "ar|en", "sitefilter": "arwiki", "format": "json"})
        out.update(get_json(f"https://www.wikidata.org/w/api.php?{q}").get("entities", {}))
        time.sleep(4)
    return out


def claim_value(ent, prop):
    vals = []
    for c in ent.get("claims", {}).get(prop, []):
        snak = c.get("mainsnak", {})
        if snak.get("snaktype") == "value":
            vals.append(snak["datavalue"]["value"])
    return vals


def year_of(tv):
    t = tv.get("time", "")
    try:
        y = int(t.split("-")[0] if not t.startswith("-") else "-" + t[1:].split("-")[0])
    except ValueError:
        return None
    prec = tv.get("precision", 0)
    return y if prec >= 9 else None  # دقة السنة فأعلى فقط، فلا يُعرض قرن أو ألفية كسنة


def label(ent, lang):
    return (ent.get("labels", {}).get(lang) or {}).get("value")


def desc(ent, lang):
    return (ent.get("descriptions", {}).get(lang) or {}).get("value")


def search_candidates(name):
    q = urllib.parse.urlencode({"action": "wbsearchentities", "search": name, "language": "en", "type": "item", "limit": 7, "format": "json"})
    return [h["id"] for h in get_json(f"https://www.wikidata.org/w/api.php?{q}").get("search", [])]


def build():
    places = load_places()
    titles = [p["name_en"] for p in places if p["name_en"]]
    wiki = wiki_qids(titles)
    # الموضع الذي عنوانه صفحة توضيح أو غائب: يُبحث عنه في ويكي بيانات، ويُقبل أول مرشح تطابق إحداثياته الهامش
    per_place = {}
    for p in places:
        w = wiki.get(p["name_en"], {}) if p["name_en"] else {}
        per_place[p["id"]] = w.get("qid")
    need = [p for p in places if p["name_en"] and (wiki.get(p["name_en"], {}).get("disambig") or wiki.get(p["name_en"], {}).get("missing"))]
    cands = {p["name_en"]: search_candidates(p["name_en"]) for p in need}
    cand_ents = wd_entities({q for qs in cands.values() for q in qs})
    for p in need:
        tol = TOL_KM.get(p["coord_status"], DEFAULT_TOL)
        for q in cands.get(p["name_en"], []):
            e = cand_ents.get(q)
            c = claim_value(e, "P625") if e else []
            if c and haversine_km(p["coords"], (c[0]["longitude"], c[0]["latitude"])) <= tol and claim_value(e, "P31"):
                per_place[p["id"]] = q
                wiki[p["name_en"]] = {**wiki.get(p["name_en"], {}), "title": wiki.get(p["name_en"], {}).get("title"), "via": "search", "disambig": False}
                break
    qids = sorted({q for q in per_place.values() if q})
    ents = wd_entities(qids)
    type_ids = sorted({v["id"] for e in ents.values() for v in claim_value(e, "P31") if isinstance(v, dict)})
    type_labels = {}
    for tid, e in wd_entities(type_ids).items():
        type_labels[tid] = {"ar": label(e, "ar"), "en": label(e, "en")}

    records = {}
    counts = {"verified": 0, "unverified": 0}
    for p in places:
        w = wiki.get(p["name_en"], {}) if p["name_en"] else {}
        rec = {"era": p["era"]}
        reason = None
        qid = per_place.get(p["id"])
        ent = ents.get(qid) if qid else None
        if not qid:
            reason = "لا مقالة إنجليزية بمعرّف ويكي بيانات"
        elif w.get("disambig"):
            reason = "عنوان المقالة صفحة توضيح، ولم يتطابق أي مرشح من ويكي بيانات مع الإحداثيات"
        elif ent is None or "missing" in ent:
            reason = "الكيان غير موجود في ويكي بيانات"
        else:
            coords = claim_value(ent, "P625")
            types = [v["id"] for v in claim_value(ent, "P31") if isinstance(v, dict)]
            if not coords:
                reason = "لا إحداثيات للكيان"
            elif not types:
                reason = "لا نوع للكيان"
            else:
                c = coords[0]
                d = haversine_km(p["coords"], (c["longitude"], c["latitude"]))
                tol = TOL_KM.get(p["coord_status"], DEFAULT_TOL)
                if d > tol:
                    reason = f"الإحداثيات تبعد {round(d)} كم عن موضع الأطلس (الهامش {tol} كم)"
                else:
                    rec.update({
                        "qid": qid, "status": "verified", "distance_km": round(d),
                        "ar": label(ent, "ar"), "en": label(ent, "en"),
                        "desc_ar": desc(ent, "ar"), "desc_en": desc(ent, "en"),
                        "types": [{"id": t, "ar": type_labels.get(t, {}).get("ar"), "en": type_labels.get(t, {}).get("en")} for t in types[:3]],
                        "start": next((y for y in (year_of(v) for v in claim_value(ent, "P571") if isinstance(v, dict) and "time" in v) if y is not None), None),
                        "end": next((y for y in (year_of(v) for v in claim_value(ent, "P576") if isinstance(v, dict) and "time" in v) if y is not None), None),
                        "arwiki": (ent.get("sitelinks", {}).get("arwiki") or {}).get("title"),
                        "enwiki": w.get("title"),
                        "linked_by": "search" if w.get("via") == "search" else "article",
                    })
        if reason:
            rec.update({"status": "unverified", "reason": reason})
            counts["unverified"] += 1
        else:
            counts["verified"] += 1
        records[p["id"]] = rec
    return {
        "_meta": {
            "source": "Wikidata (CC0)، المقالات الإنجليزية للإحالة فقط، ويُتحقق من كل ربط بالإحداثيات",
            "note": "الوصف والنوع والتواريخ كما في ويكي بيانات، لا من الأطلس. الموضع الذي لم يُربط يُعرض بلا وصف مع سببه.",
            "counts": counts,
        },
        "places": records,
    }


if __name__ == "__main__":
    data = build()
    text = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
    if CHECK:
        print(json.dumps(data["_meta"]["counts"], ensure_ascii=False))
        sys.exit(0)
    OUT.write_text(text, encoding="utf-8")
    print(f"كُتب {OUT}: {data['_meta']['counts']}")
