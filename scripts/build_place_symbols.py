# يبني web/data/place_symbols.json: رموز المواضع الموثّقة من ويكي بيانات (CC0).
# الرموز المأخوذة: التصنيف التراثي (P1435)، والقديس الشفيع (P417)، والدين (P140)، والنشيد (P85)،
# والشعار المكتوب (P1451)، وملفات العلم (P41) والشعار (P94) أسماءً فقط بلا صور، لأن تراخيص الصور تختلف من ملف لآخر.
# لا يُستنتج رمز ولا يُضاف من خارج ويكي بيانات؛ الموضع بلا رموز لا يظهر في الملف.
# الاستعمال: python3 -I scripts/build_place_symbols.py [--check]
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web/data/place_symbols.json"
CACHE = ROOT / ".cache/scraper/place_symbols_raw.json"  # ذاكرة مؤقتة، لا تُلتزم
UA = "al-atlas-cards/1.0 (project maintainer; https://github.com/aabdulladel-bot/al-atlas-al-shamil)"
CHECK = "--check" in sys.argv
ITEM_PROPS = {"P1435": "heritage", "P417": "patron_saint", "P140": "religion", "P85": "anthem"}
FILE_PROPS = {"P41": "flag", "P94": "coat_of_arms"}

_cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}


def save_cache():
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(_cache, ensure_ascii=False), encoding="utf-8")


def get_json(url):
    # الاستجابة الناجحة تُحفظ، وعند 429 أو 403 ينتظر بزمن متزايد كما تطلب شروط الاستعمال
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
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(15 + attempt * 15)
    raise RuntimeError(f"{url[:120]}: {last}")


def entities(qids, props):
    out = {}
    qids = sorted(set(qids))
    for i in range(0, len(qids), 40):
        q = urllib.parse.urlencode({"action": "wbgetentities", "ids": "|".join(qids[i:i + 40]), "props": props,
                                    "languages": "ar|en", "format": "json"})
        out.update(get_json(f"https://www.wikidata.org/w/api.php?{q}").get("entities", {}))
        time.sleep(4)
    return out


def values(ent, prop):
    vals = []
    for c in ent.get("claims", {}).get(prop, []):
        s = c.get("mainsnak", {})
        if s.get("snaktype") == "value":
            vals.append(s["datavalue"]["value"])
    return vals


def label(ent, lang):
    return (ent.get("labels", {}).get(lang) or {}).get("value")


def build():
    info = json.loads((ROOT / "web/data/places_info.json").read_text(encoding="utf-8"))["places"]
    place_q = {pid: r["qid"] for pid, r in info.items() if r.get("status") == "verified" and r.get("qid")}
    ents = entities(place_q.values(), "claims|labels")
    refs = set()
    for e in ents.values():
        for p in ITEM_PROPS:
            refs.update(v["id"] for v in values(e, p) if isinstance(v, dict) and "id" in v)
    labels = entities(refs, "labels") if refs else {}
    lab = {q: {"ar": label(e, "ar"), "en": label(e, "en")} for q, e in labels.items()}
    records, counts = {}, {k: 0 for k in [*ITEM_PROPS.values(), "motto", *FILE_PROPS.values()]}
    for pid, q in place_q.items():
        e = ents.get(q)
        if not e:
            continue
        rec = {"qid": q}
        for p, key in ITEM_PROPS.items():
            items = [{"qid": v["id"], **lab.get(v["id"], {"ar": None, "en": None})} for v in values(e, p) if isinstance(v, dict) and "id" in v]
            items = [x for x in items if x.get("ar") or x.get("en")]
            if items:
                rec[key] = items
        mottos = [{"text": v["text"], "lang": v["language"]} for v in values(e, "P1451") if isinstance(v, dict) and "text" in v]
        if mottos:
            rec["motto"] = mottos[:2]
        for p, key in FILE_PROPS.items():
            files = [v for v in values(e, p) if isinstance(v, str)]
            if files:
                rec[key] = files[:1]
        if len(rec) > 1:
            records[pid] = rec
            for k in counts:
                if k in rec:
                    counts[k] += 1
    return {
        "_meta": {
            "source": "Wikidata (CC0). أسماء ملفات العلم والشعار للإحالة إلى Wikimedia Commons، ولا تُعرض الصور.",
            "note": "الرموز كما في ويكي بيانات للكيان المربوط بالموضع، لا من الأطلس. غياب رمز لا يعني غيابه في الواقع.",
            "places_with_symbols": len(records),
            "counts": counts,
        },
        "places": records,
    }


if __name__ == "__main__":
    data = build()
    if CHECK:
        print(json.dumps(data["_meta"], ensure_ascii=False))
        sys.exit(0)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"كُتب {OUT}: {data['_meta']['places_with_symbols']} موضعاً، {data['_meta']['counts']}")
