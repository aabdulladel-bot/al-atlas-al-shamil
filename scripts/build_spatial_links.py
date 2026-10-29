# يربط الادعاءات الموثّقة المرتبطة بمكان بالكيان الذي يقع المكان داخل أرضه على خريطة حقبة الادعاء،
# ويصنّف كل ربط بمستوى محدد وسبب مكتوب (scripts/config/spatial_rules.json). لا يُحذف أي شاهد:
# - متحقق: الكيان دولة أو مملكة أو إمبراطورية، وتواريخه الكاملة تشمل سنة الخريطة، والمكان داخل مضلعه، وهو مكان محدد في النص.
# - تمثيلي: الشروط السابقة، لكن المكان نفسه تقريبي (عاصمة لمملكة، أو تسمية قديمة)، وتُعرض ملاحظته.
# - محل خلاف: الكيان موجود على الخريطة لكن تاريخه يتعارض مع السنة، أو المصدر يرسمه بما يخالف المعروف (قائمة في القواعد).
# - غير متحقق: نوع الكيان أو تواريخه غير معروفة في ويكي بيانات، فلا يُحسب.
# - شعب: الكيان شعب أو قبيلة أو مجموعة إثنية، فلا يُعامل كدولة.
# - قريب من الحد: المكان خارج المضلع على مسافة لا تتجاوز NEAR_DEG، ولا يُحسب.
# الاستعمال: python3 -I scripts/build_spatial_links.py   (يحتاج shapely)
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
RULES = json.loads((ROOT / "scripts/config/spatial_rules.json").read_text(encoding="utf-8"))
STATE = set(RULES["state_p31"])
PEOPLE = set(RULES["people_p31"])
CONFLICTS = RULES["conflicts"]


def sunna_index():
    # أسماء السنن التي تستعمل كل ادعاء، من البيانات المولَّدة للواجهة لا من المصدر
    sunan = json.loads((ROOT / "web/data/sunan.json").read_text(encoding="utf-8"))
    out = {}
    for s in sunan.get("sunan", sunan):
        for x in list(s.get("supporting", [])) + list(s.get("limiting", [])):
            if x.get("id"):
                out.setdefault(x["id"], []).append(s["name"])
    return out


def wikidata_facts():
    # النوع والتواريخ من مستخلص ويكي بيانات (P31، و hb_names للتواريخ المعتمدة)
    raw = json.loads((ROOT / "data/raw/wikidata/hb_titles.json").read_text(encoding="utf-8"))["titles"]
    names = json.loads((ROOT / "web/data/names/hb_names.json").read_text(encoding="utf-8"))["names"]
    return raw, names


def classify(name, year, place_approx, raw, names):
    # يعيد (المستوى، السبب) لربط مكان بكيان على خريطة السنة
    if name in CONFLICTS:
        return "محل خلاف", CONFLICTS[name]
    p31 = set((raw.get(name) or {}).get("p31", []))
    if p31 & PEOPLE:
        return "شعب", "الكيان شعب أو قبيلة أو مجموعة إثنية، لا دولة؛ يُعرض ضمن أرض الشعب لا ضمن الشواهد السياسية"
    if not (p31 & STATE):
        return "غير متحقق", "نوع الكيان غير معروف في ويكي بيانات، فلا يُحسب الربط"
    info = names.get(name) or {}
    inc, dis = info.get("inception"), info.get("dissolved")
    if inc is None or dis is None:
        return "غير متحقق", "التواريخ الكاملة للكيان غير معروفة في ويكي بيانات، فلا يُحسب الربط"
    if not (inc <= year <= dis):
        return "محل خلاف", f"ويكي بيانات تؤرّخ الكيان من سنة {inc} إلى سنة {dis}، والخريطة سنة {year}"
    if place_approx:
        return "تمثيلي", "المكان تقريبي لا محدد في النص، وتُعرض ملاحظته مع النقطة"
    return "متحقق", "الكيان دولة أو مملكة أو إمبراطورية قائمة في السنة، والمكان داخل حدوده"


def compute(feats, sunan_of, raw, names):
    rows = {}
    counts = {"متحقق": 0, "تمثيلي": 0, "محل خلاف": 0, "غير متحقق": 0, "شعب": 0, "قريب من الحد": 0, "غير مربوط": 0}
    unlinked = []
    for key in ERA_KEY.values():
        ents = bt.load(key)["ents"]
        year = RULES["modern_year"] if key == "modern" else int(key)
        out = {}
        for f in feats:
            pt = Point(f["geometry"]["coordinates"])
            approx = bool(f["properties"].get("place_note"))
            for c in json.loads(f["properties"]["claims"]):
                if ERA_KEY.get(c["era"]) != key:
                    continue
                inside = [e for e in ents if e["geom"].contains(pt)]
                if inside:
                    hit, near = inside[0], False
                else:
                    hit = min(ents, key=lambda e: e["geom"].distance(pt), default=None)
                    if hit is None or hit["geom"].distance(pt) > NEAR_DEG:
                        unlinked.append(c["id"])
                        counts["غير مربوط"] += 1
                        continue
                    near = True
                tier, reason = ("قريب من الحد", "المكان خارج حدود الكيان على مسافة قريبة منها") if near else classify(hit["name"], year, approx, raw, names)
                counts[tier] += 1
                out.setdefault(hit["name"], []).append({
                    "id": c["id"], "era": c["era"], "statement": c["statement"], "attributed_to": c["attributed_to"],
                    "place_ar": f["properties"]["name_ar"], "place_note": f["properties"].get("place_note"),
                    "tier": tier, "tier_reason": reason, "sunan": sorted(set(sunan_of.get(c["id"], []))),
                })
        rows[key] = out
    return rows, counts, unlinked


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    feats = json.loads((ROOT / "web/data/claim_points.geojson").read_text(encoding="utf-8"))["features"]
    raw, names = wikidata_facts()
    rows, counts, unlinked = compute(feats, sunna_index(), raw, names)
    meta_rule = {
        "متحقق": "دولة أو مملكة أو إمبراطورية، وتواريخها الكاملة تشمل السنة، والمكان داخل مضلعها، وهو مكان محدد في النص",
        "تمثيلي": "الشروط السابقة، والمكان تقريبي (عاصمة أو تسمية قديمة) وتُعرض ملاحظته",
        "محل خلاف": "الكيان على الخريطة لكن تاريخه يتعارض مع السنة، أو القواعد تستبعده صراحة",
        "غير متحقق": "نوع الكيان أو تواريخه غير معروفة في ويكي بيانات",
        "شعب": "شعب أو قبيلة أو مجموعة إثنية، لا تُعامل كدولة",
        "قريب من الحد": "المكان خارج المضلع على مسافة لا تتجاوز 0.2 درجة",
    }
    for key, out in rows.items():
        meta = {"year": key, "rules": meta_rule, "source": "web/data/claim_points.geojson وخرائط الحدود من Historical Basemaps وNatural Earth، ونوع الكيان وتواريخه من ويكي بيانات"}
        (OUT / f"claims_by_entity_{key}.json").write_text(json.dumps({"_meta": meta, **out}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print("التصنيف:", json.dumps(counts, ensure_ascii=False), file=sys.stdout)
    print(f"غير مربوط: {len(unlinked)} {unlinked}")


if __name__ == "__main__":
    main()
