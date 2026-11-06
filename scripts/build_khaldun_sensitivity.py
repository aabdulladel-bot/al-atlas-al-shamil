"""يبني web/data/khaldun_sensitivity.json: تحليل حساسية ترتيب مؤشر الشروط الخلدونية للأوزان.

- المدخل: web/data/khaldun.json (درجات الشروط المبنية من المرصد). لا يقرأ مصادر خاماً.
- السيناريو الأساس: أوزان متساوية (كما في المؤشر المعلن).
- السيناريوهات: كل شرط مُدرَج على حدة، بوزن مضروب في ٠٫٥ ثم في ٢، والبقية تبقى ١.
- يُقارن كل سيناريو بالأساس على الدول التي لها مركّب في الحالتين: معامل سبيرمان للرتب،
  وأكبر تغيّر في رتبة دولة، وأكثر الدول حركةً.
- الاستعمال: python3 -I scripts/build_khaldun_sensitivity.py [--check]
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IN = ROOT / "web/data/khaldun.json"
OUT = ROOT / "web/data/khaldun_sensitivity.json"
TOP_MOVERS = 8


def composite(scores, weights):
    """المتوسط الموزون للشروط المتاحة للدولة، أو None إن لم تكتمل الشروط الدنيا."""
    avail = {c: s for c, s in scores.items() if c in weights}
    total = sum(weights[c] for c in avail)
    if total == 0:
        return None
    return sum(weights[c] * s for c, s in avail.items()) / total


def ranks(values):
    """رتب مع متوسط التعادل (١ للأدنى)، بترتيب الدول بالاسم."""
    items = sorted(values.items(), key=lambda kv: kv[1])
    out, i = {}, 0
    while i < len(items):
        j = i
        while j + 1 < len(items) and items[j + 1][1] == items[i][1]:
            j += 1
        avg = (i + j) / 2 + 1
        for k in range(i, j + 1):
            out[items[k][0]] = avg
        i = j + 1
    return out


def spearman(a, b):
    """سبيرمان على الدول المشتركة: ارتباط بيرسون لرتبها."""
    keys = sorted(set(a) & set(b))
    ra = ranks({k: a[k] for k in keys})
    rb = ranks({k: b[k] for k in keys})
    xs = [ra[k] for k in keys]
    ys = [rb[k] for k in keys]
    n = len(keys)
    mx, my = sum(xs) / n, sum(ys) / n
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    vx = sum((x - mx) ** 2 for x in xs) ** 0.5
    vy = sum((y - my) ** 2 for y in ys) ** 0.5
    return cov / (vx * vy) if vx and vy else 1.0


def build():
    k = json.loads(IN.read_text(encoding="utf-8"))
    scored = [c["id"] for c in k["conditions"] if c.get("scored")]
    names = {c["id"]: c["name_ar"] for c in k["conditions"]}
    base_w = {c: 1.0 for c in scored}
    countries = k["countries"]

    def scores_of(cid_scores):
        return cid_scores

    base = {n: composite(v["conditions"], base_w) for n, v in countries.items()}
    base = {n: x for n, x in base.items() if x is not None and countries[n]["available"] >= k["_meta"]["min_conditions"]}
    base_rank = ranks(base)

    scenarios = []
    for cid in scored:
        for mult in (0.5, 2.0):
            w = dict(base_w)
            w[cid] = mult
            alt = {n: composite(countries[n]["conditions"], w) for n in base}
            alt = {n: x for n, x in alt.items() if x is not None}
            rho = spearman(base, alt)
            alt_rank = ranks(alt)
            moves = sorted(((abs(base_rank[n] - alt_rank[n]), n, base_rank[n], alt_rank[n]) for n in alt), reverse=True)
            scenarios.append({
                "id": f"{cid}_x{mult:g}",
                "label_ar": f"وزن «{names[cid]}» × {mult:g}",
                "condition": cid,
                "multiplier": mult,
                "spearman_vs_base": round(rho, 4),
                "max_rank_shift": round(moves[0][0], 1) if moves else 0,
                "top_movers": [
                    {"country": n, "base_rank": b, "scenario_rank": a, "shift": round(abs(b - a), 1)}
                    for _, n, b, a in moves[:TOP_MOVERS]
                ],
            })
    return json.dumps({
        "_meta": {
            "note_ar": "تحليل حساسية لترتيب مؤشر الشروط الخلدونية للأوزان. ρ قريب من ١ يعني أن الترتيب ثابت تقريباً، وانخفاضه يعني أن الترتيب يعتمد على الوزن. الرتب بين الدول المتجانسة، والرتبة ١ هي الأدنى مركّباً.",
            "baseline": "أوزان متساوية",
            "countries_compared": len(base),
            "scored_conditions": scored,
        },
        "scenarios": scenarios,
    }, ensure_ascii=False, indent=2) + "\n"


if __name__ == "__main__":
    text = build()
    if "--check" in sys.argv:
        cur = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if cur != text:
            raise SystemExit("web/data/khaldun_sensitivity.json لا يطابق مولّده: شغّل npm run build:khaldun-sensitivity")
        print("تحليل الحساسية: مطابقة")
    else:
        OUT.write_text(text, encoding="utf-8")
        d = json.loads(text)
        for s in d["scenarios"]:
            print(f"{s['id']}: ρ={s['spearman_vs_base']}، أكبر تغيّر رتبة={s['max_rank_shift']}")
