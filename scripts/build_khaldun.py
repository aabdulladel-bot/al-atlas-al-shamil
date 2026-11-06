"""يبني web/data/khaldun.json: مؤشر الشروط الخلدونية لكل دولة اليوم، من مؤشرات المرصد.

- المدخل: web/data/observatory.json (يُبنى من ملفات خام مُتحقَّق من تجزئتها)، وscripts/config/khaldun.json.
- كل مؤشر يُرتَّب بين الدول بنسبة الدول التي هي أسوأ منها أو مثلها، فلا تسيطر القيم الشاذة، والأقران المتعادلون ينالون الدرجة نفسها.
- المؤشر المعدّل بالسكان يُحوَّل إلى معدل لكل ١٠٠٠٠٠ نسمة قبل الترتيب.
- درجة الشرط متوسط درجات مؤشراته المتاحة. المركّب يُحسب لدولة إن توفّرت لها min_conditions شروط على الأقل، وإلا يبقى null.
- الاستعمال: python3 -I scripts/build_khaldun.py [--check]
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CFG = ROOT / "scripts/config/khaldun.json"
OBS = ROOT / "web/data/observatory.json"
SUNAN = ROOT / "sunan/sunan.json"
OUT = ROOT / "web/data/khaldun.json"


def rank_scores(values, lower_is_better):
    """درجة 0..1 لكل دولة: نسبة الدول التي هي أسوأ منها أو مثلها، فالأفضل = 1.

    الأقران المتعادلون ينالون الدرجة نفسها، والأفضل مجموعةً (مثلاً كل من لم يُسجَّل فيه قتيل)
    ينال 1 لا متوسط رتبته. الدولة الوحيدة في مؤشر ينالها 1.
    """
    n = len(values)
    if n < 2:
        return {k: 1.0 for k in values}
    if lower_is_better:
        return {k: sum(1 for x in values.values() if x >= v) / n for k, v in values.items()}
    return {k: sum(1 for x in values.values() if x <= v) / n for k, v in values.items()}


def build():
    cfg = json.loads(CFG.read_text(encoding="utf-8"))
    obs = json.loads(OBS.read_text(encoding="utf-8"))
    sunan = json.loads(SUNAN.read_text(encoding="utf-8"))
    sun_items = sunan if isinstance(sunan, list) else sunan["sunan"]
    hyp = {x["id"]: x.get("hypothesis", "") for x in sun_items}
    ind_by_id = {i["id"]: i for i in obs["indicators"]}
    pop = {k: v["value"] for k, v in ind_by_id["population_2024"]["values"].items()} if "population_2024" in ind_by_id else {}

    cond_scores = {}  # الشرط -> {الدولة: درجة}
    cond_meta = []
    for cond in cfg["conditions"]:
        per_country = {}
        used = []
        for spec in cond["indicators"]:
            ind = ind_by_id.get(spec["id"])
            if ind is None:
                raise SystemExit(f"مؤشر غير موجود في المرصد: {spec['id']}")
            vals = {k: v["value"] for k, v in ind["values"].items()}
            if "per" in spec:
                # العدد / (السكان بالآلاف × ١٠٠٠) × ١٠٠٬٠٠٠ = العدد × ١٠٠ / السكان بالآلاف: معدل لكل ١٠٠٠٠٠ نسمة
                vals = {k: v * 100 / pop[k] for k, v in vals.items() if pop.get(k)}
            s = rank_scores(vals, spec["direction"] == "lower_is_better")
            used.append({"indicator": spec["id"], "per": spec.get("per"), "direction": spec["direction"], "countries": len(s)})
            for k, score in s.items():
                per_country.setdefault(k, []).append(score)
        cond_scores[cond["id"]] = {k: sum(v) / len(v) for k, v in per_country.items()}
        cond_meta.append({
            "id": cond["id"],
            "name_ar": cond["name_ar"],
            "sunna": cond["sunna"],
            "hypothesis": hyp.get(cond["sunna"], ""),
            "proxy_note_ar": cond.get("proxy_note_ar", ""),
            "gap_ar": cond.get("gap_ar", ""),
            "indicators": used,
        })

    countries = sorted({k for m in cond_scores.values() for k in m})
    out_countries = {}
    for k in countries:
        scores = {cid: round(m[k], 3) for cid, m in cond_scores.items() if k in m}
        n = len(scores)
        comp = round(sum(scores.values()) / n, 3) if n >= cfg["min_conditions"] else None
        out_countries[k] = {"conditions": scores, "available": n, "composite": comp}
    return json.dumps({
        "_meta": {
            "note": cfg["_note"],
            "min_conditions": cfg["min_conditions"],
            "total_conditions": len(cfg["conditions"]),
        },
        "conditions": cond_meta,
        "countries": out_countries,
    }, ensure_ascii=False, indent=2) + "\n"


if __name__ == "__main__":
    text = build()
    if "--check" in sys.argv:
        cur = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if cur != text:
            raise SystemExit("web/data/khaldun.json لا يطابق مولّده: شغّل npm run build:khaldun")
        print("الشروط الخلدونية: مطابقة")
    else:
        OUT.write_text(text, encoding="utf-8")
        d = json.loads(text)
        complete = sum(1 for v in d["countries"].values() if v["composite"] is not None)
        print(f"الشروط الخلدونية: {len(d['countries'])} دولة بدرجة جزئية، منها {complete} بمركّب كامل")
