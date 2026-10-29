# يتحقق أن تصنيف الربط المكاني يطابق الحالات المرجعية في scripts/config/spatial_expected.json، وأن قواعد المستوى تعمل على حالات مفردة.
# الاستعمال: python3 -I scripts/check_spatial_links.py   (يحتاج shapely والبيانات المولَّدة)
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("bsl", ROOT / "scripts/build_spatial_links.py")
bsl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bsl)

expected = json.loads((ROOT / "scripts/config/spatial_expected.json").read_text(encoding="utf-8"))
feats = json.loads((ROOT / "web/data/claim_points.geojson").read_text(encoding="utf-8"))["features"]
raw, names = bsl.wikidata_facts()
rows, _, _ = bsl.compute(feats, bsl.sunna_index(), raw, names)

problems = []
for case in expected["links"]:
    found = [c for c in rows.get(case["year"], {}).get(case["entity"], []) if c["id"] == case["claim"] and c["place_ar"] == case["place"]]
    got = found[0]["tier"] if found else "غير موجود"
    if got != case["tier"]:
        problems.append(f"{case['claim']} @ {case['entity']} ({case['place']}, {case['year']}): المتوقع {case['tier']} والناتج {got}")

for r in expected["rules"]:
    got, _ = bsl.classify(r["name"], r["year"], r["place_approx"], raw, names)
    if got != r["tier"]:
        problems.append(f"قاعدة {r['name']} سنة {r['year']}: المتوقع {r['tier']} والناتج {got}")

if problems:
    print("\n".join(problems))
    print(f"فشل الربط المكاني: {len(problems)} خطأ")
    sys.exit(1)
print(f"الربط المكاني: {len(expected['links'])} حالة مرجعية و{len(expected['rules'])} قاعدة، كلها مطابقة")
