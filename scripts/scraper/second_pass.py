#!/usr/bin/env python3
# الجولة الثانية: للأسماء المنخفضة التي لا نوع لها في ويكي بيانات (مرشحها من البحث النصي وحده).
# يجلب بيانات الكيان مباشرة (EntityData، لأن SPARQL محجوب)، ثم يقترح قراراً بقواعد صارمة:
#   1) نوع سياسي (دولة، مملكة، سلالة، إمارة، خانية، سلطنة، مستعمرة، محمية...) ولا نوع إثني أو ثقافي أو مدني.
#   2) مقالة عربية موجودة (arwiki).
#   3) تسمية الكيان في ويكي بيانات تشترك في كلمة مفتاحية مع الاسم في المصدر.
#   4) التواريخ، إن وُجدت، تغطي سنوات ظهور الاسم على الخريطة.
# لا يكتب في الأطلس ولا في ملف القبول؛ يكتب مقترحات للمراجعة فقط: review/names_second_pass.json و.csv.
# الاستعمال: python3 -I -u scripts/scraper/second_pass.py
import csv
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import importlib.util  # noqa: E402

spec = importlib.util.spec_from_file_location("wikimedia_mod", HERE / "wikimedia.py")
wm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wm)

REVIEW = ROOT / "review" / "names_verification.json"
OUT_JSON = ROOT / "review" / "names_second_pass.json"
OUT_CSV = ROOT / "review" / "names_second_pass.csv"
FACTS_CACHE = ROOT / "review" / "names_second_pass_facts.json"

POLITY = re.compile(r"state|kingdom|empire|dynast|sultanate|khanate|khaganate|emirate|principalit|duchy|republic|"
                    r"country|colony|protectorate|caliphate|confederation|realm|monarchy|horde|sovereign|"
                    r"federally recognized|native american tribe|tribe", re.I)
NOT_POLITY = re.compile(r"ethnic|culture|civilization|people|language|human|settlement|city|village|"
                        r"archaeolog|hunter|nomad|population|linguistic|ethnolinguistic|agricultur|site", re.I)
STOP = {"empire", "kingdom", "state", "states", "the", "of", "dynasty", "republic", "people", "peoples",
        "chiefdom", "region", "tribe", "tribes", "emirate", "sultanate", "khanate", "culture", "and", "in", "rulers"}


def keywords(text):
    return {w for w in re.findall(r"[a-zāēīōūʻ'’\-]+", (text or "").lower()) if len(w) >= 4 and w not in STOP}


def years_of(row):
    ys = [int(x) for x in (row.get("map_years") or "").split() if re.fullmatch(r"-?\d+", x)]
    return ys


def overlaps(row, frm, to):
    ys = years_of(row)
    if not ys or (frm is None and to is None):
        return None  # لا تواريخ للمقارنة
    lo = frm if frm is not None else -10**6
    hi = to if to is not None else 10**6
    return any(lo <= y <= hi for y in ys)


def main():
    rows = json.loads(REVIEW.read_text(encoding="utf-8"))
    untyped = [r for r in rows if r.get("tier") == "منخفضة" and not r.get("types") and r.get("qid")]
    qids = sorted({r["qid"] for r in untyped})
    print(f"صفوف بلا نوع: {len(untyped)}، معرّفات فريدة: {len(qids)}", flush=True)

    facts = json.loads(FACTS_CACHE.read_text(encoding="utf-8")) if FACTS_CACHE.exists() else {}
    missing = [q for q in qids if q not in facts]
    print(f"تُجلب بيانات {len(missing)} معرّفاً", flush=True)
    for i in range(0, len(missing), 25):
        got = wm.entity_facts_ed(missing[i:i + 25])
        facts.update(got)
        FACTS_CACHE.write_text(json.dumps(facts, ensure_ascii=False), encoding="utf-8")
        print(f"  {min(i + 25, len(missing))}/{len(missing)}", flush=True)

    out = []
    for r in untyped:
        f = facts.get(r["qid"], {})
        types = " ; ".join(f.get("types", {}).values())
        en = f.get("en") or ""
        reasons = []
        ok_type = bool(types) and bool(POLITY.search(types)) and not NOT_POLITY.search(types)
        if not types:
            reasons.append("لا نوع في البيانات المجلوبة")
        elif not ok_type:
            reasons.append("النوع ليس سياسياً")
        ok_arwiki = bool(f.get("arwiki"))
        if not ok_arwiki:
            reasons.append("لا مقالة عربية")
        shared = keywords(r["name"]) & keywords(en)
        ok_name = bool(shared)
        if not ok_name:
            reasons.append("التسمية في ويكي بيانات لا تشترك في كلمة مفتاحية مع الاسم")
        ov = overlaps(r, f.get("from"), f.get("to"))
        if ov is False:
            reasons.append("التواريخ لا تغطي سنوات الخريطة")
        accept = ok_type and ok_arwiki and ok_name and ov is not False
        out.append({
            "name": r["name"], "tier": "منخفضة-ثانية", "map_years": r.get("map_years", ""),
            "qid": r["qid"], "en": en, "arwiki": f.get("arwiki") or "", "proposed_ar": f.get("arwiki") or "",
            "current_ar": r.get("current_ar", ""), "from": f.get("from"), "to": f.get("to"),
            "types": types, "shared_keywords": " ".join(sorted(shared)), "dates_cover": ov,
            "proposal": "yes" if accept else "no", "reasons": "؛ ".join(reasons) if reasons else "مستوفٍ للشروط",
            "url_en": f"https://en.wikipedia.org/wiki/{(en or r['name']).replace(' ', '_')}",
            "url_ar": f"https://ar.wikipedia.org/wiki/{f.get('arwiki', '').replace(' ', '_')}" if f.get("arwiki") else "",
            "url_wikidata": f"https://www.wikidata.org/wiki/{r['qid']}",
        })
    OUT_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(out[0].keys()))
        w.writeheader()
        w.writerows(out)
    yes = sum(1 for o in out if o["proposal"] == "yes")
    print(f"اقتراحات بقبول: {yes} من {len(out)}", flush=True)


if __name__ == "__main__":
    main()
