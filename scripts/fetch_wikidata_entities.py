# يجلب من ويكي بيانات (CC0) وصف كيانات Historical Basemaps للبطاقة التعريفية: التسمية والوصف بالعربية والإنجليزية،
# والنوع (P31) وتاريخا النشأة والزوال (P571/P576)، وعنوانا مقالتي ويكيبيديا العربية والإنجليزية (للرابط وحده).
# ثم تسميات الأنواع نفسها، ليُعرض نوع الكيان كما تسمّيه ويكي بيانات.
# المعرّفات: من data/raw/wikidata/hb_titles.json، مع تصحيحات scripts/config/hb_qid_overrides.json.
# يكتب data/raw/wikidata/hb_entities.json. الاستعمال: python3 -I scripts/fetch_wikidata_entities.py
# الطلبات 50 معرّفاً في الطلب، متمهّلة، وتحترم Retry-After (دالة get من fetch_wikidata_names.py).
import importlib.util
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data/raw/wikidata/hb_entities.json"
spec = importlib.util.spec_from_file_location("fwn", ROOT / "scripts/fetch_wikidata_names.py")
fwn = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fwn)
BATCH = 50


def val(d, lang):
    return (d.get(lang) or {}).get("value")


def ids_of(claims, prop):
    out = []
    for c in claims.get(prop, []):
        v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
        if isinstance(v, dict) and v.get("id"):
            out.append(v["id"])
    return out


def fetch(ids, props, sitefilter=None):
    out = {}
    ids = sorted(set(ids))
    for i in range(0, len(ids), BATCH):
        params = {"action": "wbgetentities", "ids": "|".join(ids[i:i + BATCH]), "props": props,
                  "languages": "ar|en", "format": "json"}
        if sitefilter:
            params["sitefilter"] = sitefilter
        out.update(fwn.get(params).get("entities", {}))
        print(f"{min(i + BATCH, len(ids))}/{len(ids)}", file=sys.stderr, flush=True)
        time.sleep(8)
    return out


def main():
    titles = json.loads((ROOT / "data/raw/wikidata/hb_titles.json").read_text(encoding="utf-8"))["titles"]
    overrides = json.loads((ROOT / "scripts/config/hb_qid_overrides.json").read_text(encoding="utf-8"))["overrides"]
    qids = {v["qid"] for v in titles.values() if v and v.get("qid")} | {o["qid"] for o in overrides.values()}
    raw = fetch(qids, "labels|descriptions|claims|sitelinks", "arwiki|enwiki")
    entities = {}
    for q, e in raw.items():
        if "missing" in e:
            continue
        claims = e.get("claims", {})
        entities[q] = {
            "ar": val(e.get("labels", {}), "ar"), "en": val(e.get("labels", {}), "en"),
            "desc_ar": val(e.get("descriptions", {}), "ar"), "desc_en": val(e.get("descriptions", {}), "en"),
            "p31": ids_of(claims, "P31"),
            "inception": fwn.times(claims, "P571"), "dissolved": fwn.times(claims, "P576"),
            "arwiki": (e.get("sitelinks", {}).get("arwiki") or {}).get("title"),
            "enwiki": (e.get("sitelinks", {}).get("enwiki") or {}).get("title"),
        }
    types = {t for e in entities.values() for t in e["p31"]}
    traw = fetch(types, "labels")
    type_labels = {q: {"ar": val(e.get("labels", {}), "ar"), "en": val(e.get("labels", {}), "en")} for q, e in traw.items() if "missing" not in e}
    OUT.write_text(json.dumps({
        "_meta": {"source": "Wikidata (CC0) عبر wbgetentities", "retrieved_at": datetime.now(timezone.utc).isoformat(),
                  "note": "مستخلص للبطاقة التعريفية: لا يُحفظ من ويكي بيانات إلا الحقول المذكورة في fetch_wikidata_entities.py"},
        "entities": dict(sorted(entities.items())), "type_labels": dict(sorted(type_labels.items())),
    }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(json.dumps({"entities": len(entities), "types": len(type_labels)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
