# يجلب من ويكي بيانات (CC0) ما يحتاجه البحث خارج كيانات الخرائط:
# - الأقاليم التاريخية (الأندلس، بلاد الشام...): التسمية والوصف والأسماء البديلة والإحداثيات (P625).
# - الكيانات الغائبة عن خرائط الأطلس (العباسيون، المماليك...): التسمية والوصف والأسماء البديلة وتاريخا النشأة والزوال.
# المعرّفات في scripts/config/search_extras.json. يكتب data/raw/wikidata/search_extras.json.
# الاستعمال: python3 -I scripts/fetch_wikidata_extras.py
import importlib.util
import json
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data/raw/wikidata/search_extras.json"
spec = importlib.util.spec_from_file_location("fwe", ROOT / "scripts/fetch_wikidata_entities.py")
fwe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fwe)


def coords(claims):
    for c in claims.get("P625", []):
        v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
        if isinstance(v, dict) and "longitude" in v:
            return [round(v["longitude"], 3), round(v["latitude"], 3)]
    return None


def resolve(cfg):
    # عنصر بلا qid: تُطبع مرشّحات البحث الثلاثة الأولى ليُختار المعرّف يدوياً ويُكتب في الإعداد، ولا يُختار آلياً
    pending = [x for x in cfg["regions"] + cfg["absent"] if not x.get("qid")]
    for x in pending:
        r = fwe.fwn.get({"action": "wbsearchentities", "search": x["search"], "language": "en", "limit": 3, "format": "json"})
        print(x["search"], "→", " | ".join(f"{h['id']} {h.get('label')} ({h.get('description', '')})" for h in r.get("search", [])))
        time.sleep(6)
    return bool(pending)


def main():
    cfg = json.loads((ROOT / "scripts/config/search_extras.json").read_text(encoding="utf-8"))
    if resolve(cfg):
        raise SystemExit("اكتب qid لكل عنصر في scripts/config/search_extras.json ثم أعد التشغيل")
    qids = [r["qid"] for r in cfg["regions"]] + [a["qid"] for a in cfg["absent"]]
    raw = fwe.fetch(qids, "labels|descriptions|aliases|claims|sitelinks", "arwiki|enwiki")
    out = {}
    for q, e in raw.items():
        if "missing" in e:
            continue
        claims = e.get("claims", {})
        out[q] = {
            "ar": fwe.val(e.get("labels", {}), "ar"), "en": fwe.val(e.get("labels", {}), "en"),
            "desc_ar": fwe.val(e.get("descriptions", {}), "ar"), "desc_en": fwe.val(e.get("descriptions", {}), "en"),
            "aliases_ar": [a["value"] for a in e.get("aliases", {}).get("ar", [])][:12],
            "aliases_en": [a["value"] for a in e.get("aliases", {}).get("en", [])][:8],
            "coords": coords(claims),
            "inception": fwe.fwn.times(claims, "P571"), "dissolved": fwe.fwn.times(claims, "P576"),
            "arwiki": (e.get("sitelinks", {}).get("arwiki") or {}).get("title"),
            "enwiki": (e.get("sitelinks", {}).get("enwiki") or {}).get("title"),
        }
    OUT.write_text(json.dumps({"_meta": {"source": "Wikidata (CC0) عبر wbgetentities", "retrieved_at": datetime.now(timezone.utc).isoformat()},
                               "entities": dict(sorted(out.items()))}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(json.dumps({"entities": len(out)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
