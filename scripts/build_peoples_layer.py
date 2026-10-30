# يستخرج من حدود كل سنة المضلعات التي يصنّفها ويكي بيانات شعباً أو قبيلة أو مجموعة إثنية (scripts/config/spatial_rules.json)
# إلى web/data/borders/peoples_{key}.geojson، ليُعرض طبقةً مستقلة عن الدول. الحدود تقريبية كما في المصدر.
# الاستعمال: python3 -I scripts/build_peoples_layer.py   (بعد build_borders.mjs، ويحتاج build_spatial_links.py لقواعد الأنواع)
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec_bt = importlib.util.spec_from_file_location("bt", ROOT / "scripts/build_transitions.py")
bt = importlib.util.module_from_spec(spec_bt)
spec_bt.loader.exec_module(bt)
spec = importlib.util.spec_from_file_location("bsl", ROOT / "scripts/build_spatial_links.py")
bsl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bsl)

OUT = ROOT / "web/data/borders"


def main():
    raw, _ = bsl.wikidata_facts()
    people = {n for n, v in raw.items() if set((v or {}).get("p31", [])) & bsl.PEOPLE}
    counts = {}
    # كل سنة لها ملف حدود تُبنى لها طبقة الشعوب، لا الحقب الثماني وحدها (1914 و1945 و2010 خرائط حدود إضافية)
    for key in bt.KEYS:
        feats = []
        if key != "modern":
            src = json.loads((OUT / f"borders_{key}.geojson").read_text(encoding="utf-8"))["features"]
            feats = [f for f in src if f["properties"].get("NAME") in people]
        collection = {"type": "FeatureCollection", "features": feats}
        (OUT / f"peoples_{key}.geojson").write_text(json.dumps(collection, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        counts[key] = len(feats)
    print(json.dumps({"شعوب على كل خريطة": counts}, ensure_ascii=False), file=sys.stdout)


if __name__ == "__main__":
    main()
