# يجلب من ويكي بيانات (CC0) وصف كيانات Historical Basemaps للبطاقة التعريفية والبحث: التسمية والوصف والأسماء البديلة بالعربية والإنجليزية،
# والنوع (P31) وتاريخا النشأة والزوال (P571/P576)، وعنوانا مقالتي ويكيبيديا العربية والإنجليزية (للرابط وحده).
# ثم تسميات الأنواع نفسها، ليُعرض نوع الكيان كما تسمّيه ويكي بيانات.
# المعرّفات: من data/raw/wikidata/hb_titles.json، مع تصحيحات scripts/config/hb_qid_overrides.json.
# يكتب data/raw/wikidata/hb_entities.json. الاستعمال: python3 -I scripts/fetch_wikidata_entities.py
# كل كيان في طلب من Special:EntityData، بتمهّل، ويحترم Retry-After.
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
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


# الكيانات تُجلب واحداً واحداً من Special:EntityData (صفحة مخزّنة مؤقتاً لا تمرّ بواجهة الاستعلام)، بتمهّل،
# مع ذاكرة مؤقتة خارج المستودع يُستأنف منها إن انقطع الجلب. واجهة wbgetentities ترفض الطلبات (429) لساعات أحياناً.
ENTITY_URL = "https://www.wikidata.org/wiki/Special:EntityData/{}.json"
CACHE = Path(tempfile.gettempdir()) / "al-atlas-wikidata-cache"


def get_entity(q):
    CACHE.mkdir(exist_ok=True)
    f = CACHE / f"{q}.json"
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8")), True
    part = CACHE / f"{q}.part"
    for attempt in range(8):
        r = subprocess.run(["curl", "-sS", "-L", "-m", "180", "-A", fwn.UA, "-o", str(part), "-D", str(CACHE / f"{q}.head"),
                            "-w", "%{http_code}", ENTITY_URL.format(q)], capture_output=True, text=True)
        status = r.stdout.strip() or "000"
        if status == "200":
            os.replace(part, f)
            return json.loads(f.read_text(encoding="utf-8")), False
        wait = 30 * (attempt + 1)
        head = (CACHE / f"{q}.head").read_text(errors="replace") if (CACHE / f"{q}.head").exists() else ""
        for line in head.splitlines():
            if line.lower().startswith("retry-after:"):
                try:
                    wait = max(wait, int(line.split(":", 1)[1].strip()))
                except ValueError:
                    pass
        print(f"{q}: HTTP {status}، انتظار {wait} ث (محاولة {attempt + 1})", file=sys.stderr, flush=True)
        time.sleep(wait)
    raise SystemExit(f"تعذّر جلب {q} بعد ثماني محاولات")


def fetch(ids, props=None, sitefilter=None):
    # props وsitefilter باقيان للتوافق: الصفحة تعيد الكيان كاملاً، ويُستخلص منه ما يلزم وحده
    out = {}
    ids = sorted(set(ids))
    for n, q in enumerate(ids, 1):
        d, cached = get_entity(q)
        ents = d.get("entities", {})
        out[q] = ents.get(q) or next(iter(ents.values()))  # المعرّف المحوَّل يعود باسمه الجديد
        if n % 25 == 0 or n == len(ids):
            print(f"{n}/{len(ids)}", file=sys.stderr, flush=True)
        if not cached:
            time.sleep(1.5)
    return out


def main():
    titles = json.loads((ROOT / "data/raw/wikidata/hb_titles.json").read_text(encoding="utf-8"))["titles"]
    overrides = json.loads((ROOT / "scripts/config/hb_qid_overrides.json").read_text(encoding="utf-8"))["overrides"]
    qids = {v["qid"] for v in titles.values() if v and v.get("qid")} | {o["qid"] for o in overrides.values()}
    raw = fetch(qids, "labels|descriptions|aliases|claims|sitelinks", "arwiki|enwiki")
    entities = {}
    for q, e in raw.items():
        if "missing" in e:
            continue
        claims = e.get("claims", {})
        entities[q] = {
            "ar": val(e.get("labels", {}), "ar"), "en": val(e.get("labels", {}), "en"),
            "desc_ar": val(e.get("descriptions", {}), "ar"), "desc_en": val(e.get("descriptions", {}), "en"),
            # الأسماء البديلة للبحث (الأمويون، الخلافة العباسية...): كما في ويكي بيانات
            "aliases_ar": [a["value"] for a in e.get("aliases", {}).get("ar", [])][:12],
            "aliases_en": [a["value"] for a in e.get("aliases", {}).get("en", [])][:8],
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
