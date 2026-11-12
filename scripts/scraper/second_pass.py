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
FACTS_CACHE = ROOT / ".cache" / "scraper" / "second_pass_facts.json"  # ذاكرة مؤقتة، لا تُلتزم

POLITY = re.compile(r"\b(state|kingdom|empire|dynast\w*|sultanate|khanate|khaganate|emirate|principalit\w*|duchy|"
                    r"republic|country|colony|protectorate|caliphate|confederation|realm|monarchy|horde|sovereign|"
                    r"countship|federally recognized|tribe)\b", re.I)
NOT_POLITY = re.compile(r"\b(ethnic|culture|civilization|people|language|human|settlement|city|town|village|"
                        r"archaeolog\w*|hunter\w*|nomad\w*|population|linguistic|agricultur\w*|site|county)\b", re.I)
STOP = {"empire", "kingdom", "state", "states", "the", "of", "dynasty", "republic", "people", "peoples",
        "chiefdom", "region", "tribe", "tribes", "emirate", "sultanate", "khanate", "culture", "and", "in",
        "rulers", "house", "nation", "states"}


def keywords(text):
    """كلمات مفتاحية للمقارنة: ثلاثة أحرف فأكثر، دون الكلمات العامة."""
    return {w for w in re.findall(r"[a-zāēīōūʻ'’\-]+", (text or "").lower()) if len(w) >= 3 and w not in STOP}


def years_of(row):
    """سنوات ظهور الاسم على الخرائط، من الصف."""
    return [int(x) for x in (row.get("map_years") or "").split() if re.fullmatch(r"-?\d+", x)]


def classify(name, map_years, en, types, arwiki, frm, to):
    """يعيد (القرار، الأسباب): accept، أو reject، أو manual (تحتاج مراجعة يدوية).
    القاعدة الزمنية تُطبَّق على كل سنة ظهر فيها الاسم: إن خرجت كلها فالرفض، وإن خرج بعضها فالمراجعة."""
    reasons = []
    if not types:
        return "reject", ["لا نوع في البيانات المجلوبة"]
    if NOT_POLITY.search(types) or not POLITY.search(types):
        return "reject", ["النوع ليس سياسياً"]
    if re.match(r"house of", en or "", re.I):
        return "reject", ["أسرة لا دولة"]
    if not arwiki:
        return "reject", ["لا مقالة عربية"]
    if map_years and (frm is not None or to is not None):
        inside = [y for y in map_years if (frm is None or y >= frm) and (to is None or y <= to)]
        if not inside:
            return "reject", ["الكيان لم يكن موجوداً بهذا الاسم في أي سنة من سنوات الخريطة"]
        if len(inside) < len(map_years):
            return "manual", ["بعض سنوات الخريطة خارج فترة الكيان، وقد يكون الاسم لكيان آخر في تلك السنوات"]
    shared = keywords(name) & keywords(en)
    if not shared:
        return "manual", ["التسمية في ويكي بيانات تختلف عن الاسم في المصدر (قد يكون تعريباً مختلفاً)"]
    return "accept", ["مستوفٍ للشروط"]


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
        decision, reasons = classify(r["name"], years_of(r), en, types, f.get("arwiki"), f.get("from"), f.get("to"))
        shared = keywords(r["name"]) & keywords(en)
        out.append({
            "name": r["name"], "tier": "منخفضة-ثانية", "map_years": r.get("map_years", ""),
            "qid": r["qid"], "en": en, "arwiki": f.get("arwiki") or "", "proposed_ar": f.get("arwiki") or "",
            "current_ar": r.get("current_ar", ""), "from": f.get("from"), "to": f.get("to"),
            "types": types, "shared_keywords": " ".join(sorted(shared)),
            "proposal": {"accept": "yes", "reject": "no", "manual": "manual"}[decision],
            "reasons": "؛ ".join(reasons),
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
    man = sum(1 for o in out if o["proposal"] == "manual")
    print(f"قبول مقترح: {yes}، مراجعة يدوية: {man}، من {len(out)}", flush=True)


if __name__ == "__main__":
    main()
