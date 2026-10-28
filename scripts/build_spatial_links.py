# يربط الادعاءات الموثّقة المرتبطة بمكان بالكيان الذي يقع المكان داخل أرضه على خريطة حقبة الادعاء.
# الناتج web/data/links/claims_by_entity_{key}.json: لكل كيان على تلك الخريطة الادعاءات التي تقع على أرضه،
# مع السنن التي تستعمل الادعاء. هذا ربط مكاني محسوب، لا حكم تاريخي.
# القاعدة: المكان داخل المضلع، وإن لم يكن داخل أي كيان فأقرب كيان على مسافة لا تتجاوز NEAR_DEG درجة، ويُعلَّم near.
# الاستعمال: python3 -I scripts/build_spatial_links.py   (بعد build_claim_points وbuild_transitions وbuild_sunan؛ يحتاج shapely)
import importlib.util
import json
import sys
from pathlib import Path

from shapely.geometry import Point

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("bt", ROOT / "scripts/build_transitions.py")
bt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bt)

OUT = ROOT / "web/data/links"
NEAR_DEG = 0.2
# الحقبة ← خريطتها، كما في ERAS في web/app.js
ERA_KEY = {1: "-4000", 2: "-1000", 3: "-1", 4: "700", 5: "1200", 6: "1600", 7: "1800", 8: "modern"}


def sunna_index():
    # أسماء السنن التي تستعمل كل ادعاء، من البيانات المولَّدة للواجهة لا من المصدر
    sunan = json.loads((ROOT / "web/data/sunan.json").read_text(encoding="utf-8"))
    out = {}
    for s in sunan.get("sunan", sunan):
        for x in list(s.get("supporting", [])) + list(s.get("limiting", [])):
            if x.get("id"):
                out.setdefault(x["id"], []).append(s["name"])
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    feats = json.loads((ROOT / "web/data/claim_points.geojson").read_text(encoding="utf-8"))["features"]
    sunan_of = sunna_index()
    totals = {"linked": 0, "near": 0, "unlinked": []}
    for key in bt.KEYS:
        if key not in ERA_KEY.values():
            continue
        ents = bt.load(key)["ents"]
        out = {}
        for f in feats:
            pt = Point(f["geometry"]["coordinates"])
            for c in json.loads(f["properties"]["claims"]):
                if ERA_KEY.get(c["era"]) != key:
                    continue
                inside = [e for e in ents if e["geom"].contains(pt)]
                near = False
                if inside:
                    hit = inside[0]
                else:
                    hit = min(ents, key=lambda e: e["geom"].distance(pt), default=None)
                    if hit is None or hit["geom"].distance(pt) > NEAR_DEG:
                        totals["unlinked"].append(c["id"])
                        continue
                    near = True
                out.setdefault(hit["name"], []).append({
                    "id": c["id"], "era": c["era"], "statement": c["statement"], "attributed_to": c["attributed_to"],
                    "place_ar": f["properties"]["name_ar"], "near": near, "sunan": sorted(set(sunan_of.get(c["id"], []))),
                })
                totals["linked"] += 1
                totals["near"] += near
        meta = {"year": key, "rule": f"المكان داخل المضلع، وإلا أقرب كيان على {NEAR_DEG} درجة (near)، وإلا غير مربوط", "source": "web/data/claim_points.geojson وخرائط الحدود المحسوبة من Historical Basemaps وNatural Earth"}
        (OUT / f"claims_by_entity_{key}.json").write_text(json.dumps({"_meta": meta, **out}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"{key}: {sum(len(v) for v in out.values())} ادعاء على {len(out)} كياناً", file=sys.stderr)
    unlinked = totals["unlinked"]
    print(f"مربوط: {totals['linked']} (قريب: {totals['near']})، غير مربوط: {len(unlinked)} {unlinked}")


if __name__ == "__main__":
    main()
