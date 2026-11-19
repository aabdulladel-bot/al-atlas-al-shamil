# يبني web/data/place_lineage.json: لكل موضع، الكيان الذي وقع فيه في كل سنة من سنوات الحدود (هندسياً، بالإحداثيات).
# المدخلات: مضلعات web/data/borders/borders_{سنة}.geojson والحدود الحديثة modern_countries.geojson، ومواضع الحقب places_era*.geojson.
# لا تخمين: إن لم يقع الموضع داخل أي مضلع في تلك السنة فالقيمة null. وإن وقع في أكثر من مضلع تُسجَّل الأسماء كلها وتُعلَّم.
# الاستعمال: python3 -I scripts/build_place_lineage.py [--check]
import json
import sys
from pathlib import Path
from shapely.geometry import Point, shape
from shapely.prepared import prep

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web/data/place_lineage.json"
CHECK = "--check" in sys.argv
YEARS = [-4000, -1000, -1, 700, 800, 900, 1000, 1200, 1600, 1800, 1914, 1945, 2010]
KEYS = [str(y) for y in YEARS] + ["modern"]


def load_polys(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    out = []
    for f in data["features"]:
        name = (f.get("properties") or {}).get("NAME")
        if not name or not f.get("geometry"):
            continue
        g = shape(f["geometry"])
        out.append((name, prep(g), g))
    return out


def places():
    seen = {}
    for era in range(1, 9):
        d = json.loads((ROOT / f"web/data/places_era{era}.geojson").read_text(encoding="utf-8"))
        for f in d["features"]:
            seen.setdefault(f["id"], f["geometry"]["coordinates"])
    return seen


def build():
    layers = {str(y): load_polys(ROOT / f"web/data/borders/borders_{y}.geojson") for y in YEARS}
    layers["modern"] = load_polys(ROOT / "web/data/borders/modern_countries.geojson")
    out = {}
    multi = 0
    for pid, (lon, lat) in places().items():
        pt = Point(lon, lat)
        rec = {}
        for k in KEYS:
            hits = [name for name, pg, g in layers[k] if pg.contains(pt)]
            if hits:
                if len(hits) > 1:
                    multi += 1
                rec[k] = hits[0] if len(hits) == 1 else {"names": sorted(set(hits)), "overlap": True}
                continue
            # لا مطابقة قريبة: الموضع الواقع على حدود متجاورة أو فجوة في المصدر يبقى null، ولا يُخمَّن كيان آخر
            rec[k] = None
        out[pid] = rec
    # الأسماء العربية لكل حقبة من ملفات التسميات نفسها (labels_{سنة}.json، و modern_labels.json)، وإلا يبقى الاسم الإنجليزي
    names_ar = {}
    for k in KEYS:
        f = ROOT / ("web/data/borders/modern_labels.json" if k == "modern" else f"web/data/borders/labels_{k}.json")
        if not f.exists():
            continue
        lab = json.loads(f.read_text(encoding="utf-8"))
        rows = lab.get("labels", lab) if isinstance(lab, dict) else lab
        names_ar[k] = {}
        for r in rows:
            if r.get("en") and r.get("ar"):
                names_ar[k].setdefault(r["en"], r["ar"])
    return {
        "names_ar": names_ar,
        "_meta": {
            "source": "حدود Historical Basemaps (GPL-3، المشتقة في web/data/borders) وحدود Natural Earth الحديثة (ملك عام)، مع مواضع الأطلس",
            "rule": "الكيان الذي يحتوي نقطة الموضع في كل سنة حدود، بالإحداثيات وحدها. null: لا يحتويه أي مضلع في تلك السنة (قد يعني فجوة في المصدر أو موضعاً على حدّ متجاور، ولا يُخمَّن كيان آخر). overlap: تداخل مضلعات، تُعرض الأسماء كلها.",
            "caution": "المصدر التاريخي يرسم جماعات وأقواماً في الحقب القديمة (مثل Semites)، لا دولاً وحدها. الاسم يُعرض كما هو في المصدر، ولا يُعدّ كياناً سياسياً.",
            "years": KEYS,
            "overlaps": multi,
        },
        "places": out,
    }


if __name__ == "__main__":
    data = build()
    text = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
    if CHECK:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
            print("place_lineage.json لا يطابق المصدر", file=sys.stderr); sys.exit(1)
        print(f"سيرة المواضع: مطابقة ({len(data['places'])} موضعاً، تداخلات {data['_meta']['overlaps']})")
        sys.exit(0)
    OUT.write_text(text, encoding="utf-8")
    print(f"كُتب {OUT}: {len(data['places'])} موضعاً، تداخلات {data['_meta']['overlaps']}")
