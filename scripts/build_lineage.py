"""يبني web/data/lineage.json: سلاسل الكيانات عبر الخرائط المتجاورة زمنياً، من ملفات الانتقال (web/data/transitions).

كل ملف انتقال a→b يربط كل كيان بالكيانات التي تتقاطع معه في الخريطة الأخرى، بنسبتين من السكربت نفسه
(scripts/build_transitions.py): sa = مساحة التقاطع ÷ مساحة الكيان في الخريطة الأولى، وsb = مساحة التقاطع ÷ مساحة الكيان
في الثانية. فلكل رابط بين X وY:
  ownShare   = نصيب أرض X الواقع داخل Y
  otherShare = نصيب أرض Y الواقع داخل X
وهذا التطابق جغرافي بالأرض، لا بالاسم أو بالتسمية التاريخية. ويُعرض معه ذلك في الواجهة.

المخرج: lineage[خريطة][اسم الكيان] = {"prev": {خريطة سابقة: [روابط]}, "next": {خريطة لاحقة: [روابط]}}
والرابط: {name, name_ar?, ownShare, otherShare}، مرتّبة بأقوى صلة (أصغر النسبتين أولاً).
الخرائط المتجاورة فقط (الانتقال من حقبة إلى التي تليها)، لأن ملفات الانتقال موجودة لكل الأزواج.

الاستعمال: python3 -I scripts/build_lineage.py [--check]
"""
import json
import sys
from pathlib import Path

from shapely import make_valid
from shapely.geometry import Point, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
TR = ROOT / "web/data/transitions"
BORDERS = ROOT / "web/data/borders"
CLAIM_POINTS = ROOT / "web/data/claim_points.geojson"
OUT = ROOT / "web/data/lineage.json"
# ترتيب الخرائط الزمني، كما في BORDER_YEARS ثم الحاضر
ORDER = ["-4000", "-1000", "-1", "700", "1200", "1600", "1800", "1914", "1945", "2010", "modern"]
TOP = 12  # حدّ معقول لكل خطوة، والباقي يُحسب في الواجهة بعدده

_polys_cache = {}


def map_polys(k):
    """مضلعات كيانات خريطة معينة بالاسم (حدود الواجهة المبسّطة، للاحتواء فقط لا للمساحة)."""
    if k not in _polys_cache:
        fn = BORDERS / ("modern_countries.geojson" if k == "modern" else f"borders_{k}.geojson")
        out = {}
        for f in json.loads(fn.read_text(encoding="utf-8"))["features"]:
            n = f["properties"].get("NAME")
            if n:
                out.setdefault(n, []).append(make_valid(shape(f["geometry"])))
        _polys_cache[k] = {n: unary_union(v) for n, v in out.items()}
    return _polys_cache[k]


_points = None


def claim_points():
    global _points
    if _points is None:
        _points = []
        for f in json.loads(CLAIM_POINTS.read_text(encoding="utf-8"))["features"]:
            p = f["properties"]
            _points.append((p.get("name_ar") or p.get("name_en") or p["slug"], Point(f["geometry"]["coordinates"])))
    return _points


def shared_claim_places(a, x, b, y):
    """أسماء مواقع الشواهد الواقعة داخل الأرض التي يشترك فيها الكيانان (x في الخريطة a، وy في b).
    هذا ربط مكاني: الموقع داخل الأرض المشتركة، ولا يعني أن الشاهد يذكر الصلة نفسها."""
    pa, pb = map_polys(a), map_polys(b)
    if x not in pa or y not in pb:
        return []
    inter = pa[x].intersection(pb[y])
    if inter.is_empty:
        return []
    return sorted({name for name, pt in claim_points() if inter.contains(pt)})


def build():
    lin = {k: {} for k in ORDER}
    for a, b in zip(ORDER, ORDER[1:]):
        f = TR / f"{a}__{b}.json"
        if not f.exists():
            raise SystemExit(f"ملف انتقال مفقود: {f.name}")
        d = json.loads(f.read_text(encoding="utf-8"))
        # صفوف السنة الأولى: كل كيان X فيها روابطه إلى الثانية (من جهة X: sa = نصيب X داخل الآخر، sb = نصيب الآخر داخل X)
        for row in d["from"]:
            x = row["name"]
            entry = lin[a].setdefault(x, {"prev": {}, "next": {}})
            links = [{"name": n, "name_ar": None, "ownShare": sa, "otherShare": sb} for n, sa, sb in row["links"]]
            for l in links:
                places = shared_claim_places(a, x, b, l["name"])
                if places:
                    l["places"] = places
            entry["next"][b] = links
        # صفوف السنة الثانية: كل كيان Y فيها روابطه إلى الأولى (من جهة Y: sa = نصيب الآخر داخل Y، sb = نصيب Y داخل الآخر)
        for row in d["to"]:
            y = row["name"]
            entry = lin[b].setdefault(y, {"prev": {}, "next": {}})
            links = [{"name": n, "name_ar": None, "ownShare": sb, "otherShare": sa} for n, sa, sb in row["links"]]
            for l in links:
                places = shared_claim_places(a, l["name"], b, y)
                if places:
                    l["places"] = places
            entry["prev"][a] = links
        # الأسماء العربية من الملف نفسه
        ar = {r["name"]: r["name_ar"] for r in d["from"] + d["to"] if r.get("name_ar")}
        for side in (d["from"], d["to"]):
            pass
        for k in (a, b):
            for ent in lin[k].values():
                for dirn in ("prev", "next"):
                    for m, links in ent[dirn].items():
                        for l in links:
                            l["name_ar"] = ar.get(l["name"])
    # ترتيب كل قائمة بأقوى صلة، وحدّها
    for k in ORDER:
        for ent in lin[k].values():
            for dirn in ("prev", "next"):
                for m in list(ent[dirn]):
                    links = sorted(ent[dirn][m], key=lambda l: (-min(l["ownShare"], l["otherShare"]), -l["ownShare"]))
                    ent[dirn][m] = {"items": links[:TOP], "total": len(links)}
    # كيانات بلا أي رابط تُحذف، لتبقى الملفات خفيفة
    lin = {k: {n: e for n, e in v.items() if e["prev"] or e["next"]} for k, v in lin.items()}
    doc = {
        "_meta": {
            "order": ORDER,
            "shares": "ownShare: نصيب أرض هذا الكيان داخل الآخر. otherShare: نصيب أرض الآخر داخل هذا الكيان. التطابق بالأرض لا بالاسم.",
            "source": "web/data/transitions (scripts/build_transitions.py): Historical Basemaps (GPL-3، حدود تقريبية) وNatural Earth (ملك عام)",
            "places": "places: مواقع الشواهد (web/data/claim_points.geojson) الواقعة داخل الأرض المشتركة بين الكيانين. ربط مكاني، لا حكم بأن الشاهد يذكر الصلة.",
            "top": TOP,
        },
        "lineage": lin,
    }
    return json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n"


if __name__ == "__main__":
    out = build()
    if "--check" in sys.argv:
        cur = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if cur != out:
            raise SystemExit("web/data/lineage.json لا يطابق مولّده: شغّل npm run build:lineage")
        print("السلاسل: مطابقة")
    else:
        OUT.write_text(out, encoding="utf-8")
        n = sum(len(v) for v in json.loads(out)["lineage"].values())
        print(f"السلاسل: {n} كياناً موصولاً عبر الحقب")
