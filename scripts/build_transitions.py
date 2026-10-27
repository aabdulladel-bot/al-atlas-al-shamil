# يبني لوحة التحولات بالمطابقة الجغرافية: لكل سنتين يحسب تداخل مساحات الكيانات المسمّاة،
# ويصنّف مصير كل كيان (بقي اسمه، خلفه كيان آخر، دخل في كيان أوسع، انقسم، زال) ومنشأ كل كيان جديد.
# المصادر الخام: data/raw/historical-basemaps (GPL-3) وdata/raw/naturalearth (ملك عام)، لا الملفات المبسّطة.
# الاستعمال: python3 -I scripts/build_transitions.py   (يحتاج shapely، انظر requirements.txt)
#
# المنهج:
# - الكيان = كل المضلعات التي تحمل الاسم نفسه في السنة نفسها، بعد إصلاح الهندسة غير الصالحة (make_valid).
#   المضلعات بلا اسم لا تُعدّ كيانات، لكنها تُحتسب في سؤال: هل غطّى أرضَ الكيان كيانٌ مسمّى؟
# - المساحات جيوديسية على كرة نصف قطرها نصف القطر الأصيل لـ WGS84 (مساحة متكافئة)، بالكيلومتر المربع.
# - لكل كيانين a في السنة الأولى وb في الثانية: sa = مساحة التقاطع / مساحة a (نصيب b من أرض a)،
#   وsb = مساحة التقاطع / مساحة b (نصيب a من أرض b).
# - الخلافة: sa ≥ 0.5 وsb ≥ 0.5 معاً، وهي علاقة واحد لواحد بالضرورة.
# - مصير كيان a لم يبق اسمه، بالترتيب:
#   خلافة ← انقسام (كيانان أو أكثر أخذ كل منهما ≥ PIECE من أرضه) ← دخول في كيان أوسع (أخذ ≥ TAU من أرضه وأرضه أقل من نصف ذلك الكيان)
#   ← تقلّص (بقي ≥ TAU من أرضه في كيان قائم عليها، والباقي بلا كيان مسمّى) ← توزّع بين صغار أو زوال (بحسب تغطية الكيانات المسمّاة).
# - منشأ كيان b لم يكن اسمه، بالمرآة: خلافة ← اندماج ← اقتطاع من كيان أوسع ← نشأة من كيان وتوسّع ← تجميع من صغار أو أرض بلا اسم.
# هذه علاقات مكانية بين خريطتين، لا أحكام تاريخية بالسببية أو الوراثة القانونية.
import json
import math
import sys
from pathlib import Path

import shapely
from shapely import STRtree
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data/raw/historical-basemaps"
NE = ROOT / "data/raw/naturalearth/ne_50m_admin_0_countries.geojson"
OUT = ROOT / "web/data/transitions"
YEARS = [-4000, -1000, -1, 700, 1200, 1600, 1800, 1914, 1945, 2010]
KEYS = [str(y) for y in YEARS] + ["modern"]
TAU = 0.25        # أدنى نصيب تُعتبر به الصلة
MAJORITY = 0.5    # عتبة الخلافة من الجهتين
PIECE = 0.10      # أدنى نصيب تُعدّ به القطعة جزءاً في الانقسام أو الاندماج
KEEP_LINK = 0.05  # أدنى نصيب تُحفظ به الصلة في الملف (للعرض)
R = 6371007.181   # نصف القطر الأصيل لـ WGS84 بالمتر

if shapely.__version__.split(".")[0] != "2":
    sys.exit(f"يلزم shapely 2.x، والموجود {shapely.__version__}")


def ring_area(coords):
    # مساحة حلقة على الكرة (Chamberlain & Duquette 2007)، بالمتر المربع
    total = 0.0
    n = len(coords)
    for i in range(n - 1):
        lon1, lat1 = coords[i][0], coords[i][1]
        lon2, lat2 = coords[i + 1][0], coords[i + 1][1]
        total += math.radians(lon2 - lon1) * (2 + math.sin(math.radians(lat1)) + math.sin(math.radians(lat2)))
    return abs(total * R * R / 2)


def polygons(g):
    if g is None or g.is_empty:
        return []
    if g.geom_type == "Polygon":
        return [g]
    if g.geom_type in ("MultiPolygon", "GeometryCollection"):
        return [p for part in g.geoms for p in polygons(part)]
    return []


def area_km2(g):
    a = 0.0
    for p in polygons(g):
        a += ring_area(p.exterior.coords) - sum(ring_area(h.coords) for h in p.interiors)
    return a / 1e6


def clean(geom):
    g = shape(geom)
    if not g.is_valid:
        g = shapely.make_valid(g)
    parts = polygons(g)
    return shapely.MultiPolygon(parts) if parts else None


def load(key):
    if key == "modern":
        src = json.loads(NE.read_text(encoding="utf-8"))
        rows = [(f["properties"]["NAME"], None, 3, f["geometry"]) for f in src["features"]]
        # التعديلات التحريرية المعلنة على الأسماء العربية (scripts/config/label_overrides.json)
        over = json.loads((ROOT / "scripts/config/label_overrides.json").read_text(encoding="utf-8"))["overrides"]
        ar = {f["properties"]["NAME"]: over.get(f["properties"]["NAME"], {}).get("ar") or f["properties"].get("NAME_AR") or f["properties"]["NAME"] for f in src["features"]}
    else:
        y = int(key)
        name = f"world_bc{-y}.geojson" if y < 0 else f"world_{y}.geojson"
        src = json.loads((RAW / name).read_text(encoding="utf-8"))
        rows = [(f["properties"].get("NAME"), f["properties"].get("PARTOF"), f["properties"].get("BORDERPRECISION"), f["geometry"]) for f in src["features"]]
        ar = {}
    groups, partof, prec, unnamed, repaired = {}, {}, {}, [], 0
    for nm, po, bp, geom in rows:
        if not geom:
            continue
        if not shape(geom).is_valid:
            repaired += 1
        g = clean(geom)
        if g is None:
            continue
        if not nm:
            unnamed.append(g)
            continue
        groups.setdefault(nm, []).append(g)
        if po and po != nm:
            partof.setdefault(nm, set()).add(po)
        if bp is not None:
            prec[nm] = min(prec.get(nm, 9), bp)
    names = sorted(groups)
    geoms = [shapely.union_all(groups[n]) for n in names]
    ents = []
    for n, g in zip(names, geoms):
        ents.append({
            "name": n,
            "name_ar": ar.get(n),
            "partof": sorted(partof.get(n, [])) or None,
            "precision": prec.get(n),
            "area_km2": area_km2(g),
            "geom": g,
        })
    named_union = shapely.union_all(geoms)
    print(f"{key}: {len(ents)} كياناً مسمّى، {len(unnamed)} مضلعاً بلا اسم، أُصلح {repaired}", file=sys.stderr)
    return {"ents": ents, "index": {e["name"]: i for i, e in enumerate(ents)}, "tree": STRtree(geoms), "named_union": named_union}


def overlaps(A, B):
    # كل تقاطع ذي مساحة بين كيانات A وB: {(i, j): كم²}
    out = {}
    for i, e in enumerate(A["ents"]):
        for j in B["tree"].query(e["geom"], predicate="intersects"):
            inter = shapely.intersection(e["geom"], B["ents"][j]["geom"])
            km2 = area_km2(inter)
            if km2 > 0:
                out[(i, int(j))] = km2
    return out


def coverage(e, other):
    if e["area_km2"] == 0:
        return 0.0
    return area_km2(shapely.intersection(e["geom"], other["named_union"])) / e["area_km2"]


r3 = lambda x: round(x, 3)


def compare(ka, kb, A, B):
    ov = overlaps(A, B)
    ea, eb = A["ents"], B["ents"]
    sa = {k: v / ea[k[0]]["area_km2"] for k, v in ov.items() if ea[k[0]]["area_km2"] > 0}
    sb = {k: v / eb[k[1]]["area_km2"] for k, v in ov.items() if eb[k[1]]["area_km2"] > 0}
    out_links = {i: [] for i in range(len(ea))}
    in_links = {j: [] for j in range(len(eb))}
    for (i, j) in ov:
        x, y = sa.get((i, j), 0), sb.get((i, j), 0)
        if max(x, y) >= KEEP_LINK:
            out_links[i].append((j, x, y))
            in_links[j].append((i, x, y))
    # الخلافة بين اسمين مختلفين فقط: من بقي اسمه لا يُعدّ خالفاً ولا مخلوفاً
    succ = {(i, j) for (i, j) in ov if sa.get((i, j), 0) >= MAJORITY and sb.get((i, j), 0) >= MAJORITY
            and ea[i]["name"] not in B["index"] and eb[j]["name"] not in A["index"]}
    succ_a = {i: j for i, j in succ}
    succ_b = {j: i for i, j in succ}

    def fate(i):
        e = ea[i]
        links = sorted(out_links[i], key=lambda t: -t[1])
        j_same = B["index"].get(e["name"])
        if j_same is not None:
            keep = sa.get((i, j_same), 0)
            moved = max(keep, sb.get((i, j_same), 0)) < TAU
            return {"type": "name_moved" if moved else "kept", "retained": r3(keep),
                    "area_ratio": r3(eb[j_same]["area_km2"] / e["area_km2"]) if e["area_km2"] else None}
        if i in succ_a:
            j = succ_a[i]
            return {"type": "succeeded", "by": eb[j]["name"]}
        pieces = [t for t in links if t[1] >= PIECE]
        if len(pieces) >= 2:
            return {"type": "split", "into": [eb[j]["name"] for j, _, _ in pieces]}
        big = [t for t in links if t[1] >= TAU]
        if big:
            j, x, y = big[0]
            return {"type": "absorbed" if y < MAJORITY else "reduced", "into": eb[j]["name"]}
        cov = coverage(e, B)
        return {"type": "dispersed" if cov >= TAU else "vanished", "named_cover": r3(cov)}

    def origin(j):
        e = eb[j]
        links = sorted(in_links[j], key=lambda t: -t[2])
        i_same = A["index"].get(e["name"])
        if i_same is not None:
            moved = max(sa.get((i_same, j), 0), sb.get((i_same, j), 0)) < TAU
            return {"type": "name_moved" if moved else "kept"}
        if j in succ_b:
            return {"type": "successor", "of": ea[succ_b[j]]["name"]}
        sources = [t for t in links if t[2] >= PIECE]
        if len(sources) >= 2:
            return {"type": "merged", "from": [ea[i]["name"] for i, _, _ in sources]}
        big = [t for t in links if t[2] >= TAU]
        if big:
            i, x, y = big[0]
            return {"type": "carved" if x < MAJORITY else "expanded", "from": ea[i]["name"]}
        cov = coverage(e, A)
        return {"type": "assembled" if cov >= TAU else "new_land", "named_cover": r3(cov)}

    def row(e, extra, links, side):
        r = {"name": e["name"]}
        if e["name_ar"] and e["name_ar"] != e["name"]:
            r["name_ar"] = e["name_ar"]
        if e["partof"]:
            r["partof"] = e["partof"]
        r["precision"] = e["precision"]
        r["area_km2"] = round(e["area_km2"])
        r.update(extra)
        other = eb if side == "from" else ea
        r["links"] = [[other[k]["name"], r3(x), r3(y)] for k, x, y in sorted(links, key=lambda t: -(t[1] if side == "from" else t[2]))]
        return r

    frm = [row(ea[i], {"fate": fate(i)}, out_links[i], "from") for i in range(len(ea))]
    to = [row(eb[j], {"origin": origin(j)}, in_links[j], "to") for j in range(len(eb))]
    counts = {"from": {}, "to": {}}
    for r in frm:
        counts["from"][r["fate"]["type"]] = counts["from"].get(r["fate"]["type"], 0) + 1
    for r in to:
        counts["to"][r["origin"]["type"]] = counts["to"].get(r["origin"]["type"], 0) + 1
    return {
        "_meta": {
            "from": ka, "to": kb,
            "method": "مطابقة جغرافية بتداخل المساحات الجيوديسية بين كيانات مسمّاة (المضلعات المتحدة الاسم موحّدة)",
            "thresholds": {"tau": TAU, "majority": MAJORITY, "piece": PIECE, "keep_link": KEEP_LINK},
            "links": "[الاسم في السنة الأخرى، نصيبه من أرض الكيان الأول sa، نصيب الكيان الأول من أرضه sb]",
            "sources": "Historical Basemaps (GPL-3، حدود تقريبية) وNatural Earth (ملك عام) للدول اليوم",
        },
        "counts": counts,
        "from": frm,
        "to": to,
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    data = {k: load(k) for k in KEYS}
    pairs = 0
    for a in range(len(KEYS)):
        for b in range(a + 1, len(KEYS)):
            ka, kb = KEYS[a], KEYS[b]
            res = compare(ka, kb, data[ka], data[kb])
            (OUT / f"{ka}__{kb}.json").write_text(json.dumps(res, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
            pairs += 1
            c = res["counts"]
            print(f"{ka}→{kb}: {c['from']} | {c['to']}")
    print(f"كُتب {pairs} ملف مقارنة في {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
