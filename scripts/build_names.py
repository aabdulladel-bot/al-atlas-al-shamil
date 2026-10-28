# يقرّر الأسماء العربية للكيانات التاريخية في Historical Basemaps من مستخلص ويكي بيانات (data/raw/wikidata/hb_titles.json)،
# ويكتب web/data/names/hb_names.json الذي تقرؤه بقية البناء (الحدود، ولوحة التحولات، والمكعّب، والتسميات، والبطاقة).
# الاستعمال: python3 -I scripts/build_names.py
#
# القواعد (لا ترجمة ولا تخمين):
# - صفحات التوضيح والقوائم ترفض (P31 = Q4167410 أو Q13406463).
# - بلا تسمية عربية في ويكي بيانات: يبقى الاسم الإنجليزي.
# - تحقق زمني لكل سنة: إن كان للكيان تاريخ نشأة (P571) أو زوال (P576) فلا يُعرض اسمه العربي إلا في سنوات الخرائط
#   التي كان قائماً فيها بسماحة TOL سنة (years_ar). في غيرها يبقى اسم المصدر، لأن المصدر قد يسمّي بالاسم نفسه كياناً آخر.
#   إن لم يكن قائماً في أي منها رُفض الربط كله.
# - الأنواع التي تعني غير الكيان المرسوم ترفض: المدن والمستوطنات والمواقع الأثرية والمواد (REJECT_P31).
# - بلا تواريخ: يُقبل موسوماً "بلا تواريخ" إن كان نوعه سياسياً أو بشرياً أو إقليمياً صريحاً (UNDATED_OK)، وإلا رُفض.
# - التعديلات اليدوية المعلنة في scripts/config/hb_name_overrides.json تعلو على ما سبق، وتُذكر في البطاقة.
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data/raw/historical-basemaps"
EXTRACT = ROOT / "data/raw/wikidata/hb_titles.json"
OVERRIDES = ROOT / "scripts/config/hb_name_overrides.json"
OUT = ROOT / "web/data/names/hb_names.json"
YEARS = [-4000, -1000, -1, 700, 1200, 1600, 1800, 1914, 1945, 2010]
TOL = 50
# أنواع (P31) تعني أن العنوان طابق شيئاً غير الكيان السياسي أو البشري المرسوم على الخريطة:
# مدينة بدل دولتها (Algiers، Axum)، أو موقعاً أثرياً بدل مملكته (Bagan)، أو مادة (Air: الهواء بدل سلطنة آير).
REJECT_P31 = {
    "Q4167410": "صفحة توضيح", "Q13406463": "قائمة",
    "Q515": "مدينة", "Q486972": "مستوطنة بشرية", "Q5119": "عاصمة", "Q1549591": "مدينة كبرى", "Q1637706": "مدينة مليونية",
    "Q200250": "حاضرة", "Q3957": "بلدة", "Q532": "قرية", "Q839954": "موقع أثري",
    "Q79529": "مادة كيميائية", "Q169336": "خليط", "Q11432": "غاز",
}
# الكيان بلا تواريخ لا يُتحقق منه زمنياً، فلا يُقبل إلا بنوع سياسي أو بشري أو إقليمي صريح
UNDATED_OK = {
    "Q3024240", "Q6256", "Q3624078", "Q48349", "Q417175", "Q7275", "Q1250464", "Q164950",  # كيانات سياسية
    "Q41710", "Q133311", "Q2472587", "Q4533081", "Q103817", "Q4204501",  # جماعات وشعوب وقبائل
    "Q82794", "Q1620908", "Q465299", "Q8432",  # أقاليم وثقافات وحضارات
}


def wd_year(t):
    # "+1299-00-00T00:00:00Z" أو "-0027-01-16T00:00:00Z"
    m = re.match(r"([+-])(\d+)-", t or "")
    if not m:
        return None
    y = int(m.group(2))
    return -y if m.group(1) == "-" else y


def years_by_name():
    out = {}
    for y in YEARS:
        name = f"world_bc{-y}.geojson" if y < 0 else f"world_{y}.geojson"
        for f in json.loads((RAW / name).read_text(encoding="utf-8"))["features"]:
            n = f["properties"].get("NAME")
            if n:
                out.setdefault(n, set()).add(y)
    return {n: sorted(ys) for n, ys in out.items()}


def decide(name, hit, present):
    if not hit:
        return {"status": "no_match"}
    base = {"qid": hit["qid"], "en_label": hit.get("en"), "arwiki": hit.get("arwiki")}
    bad = [REJECT_P31[c] for c in hit.get("p31", []) if c in REJECT_P31]
    if bad:
        return {**base, "status": "rejected", "reason": bad[0]}
    if not hit.get("ar"):
        return {**base, "status": "no_arabic"}
    inc = [y for y in map(wd_year, hit.get("inception", [])) if y is not None]
    dis = [y for y in map(wd_year, hit.get("dissolved", [])) if y is not None]
    base.update({"ar": hit["ar"], "inception": min(inc) if inc else None, "dissolved": max(dis) if dis else None})
    if not inc and not dis:
        if not UNDATED_OK.intersection(hit.get("p31", [])):
            return {**base, "status": "rejected", "reason": "بلا تواريخ ولا نوع سياسي أو بشري صريح", "ar_rejected": base.pop("ar")}
        return {**base, "status": "undated", "years_ar": present}
    # التحقق لكل سنة لا للاسم كله: المصدر يستعمل الاسم الواحد لكيانات مختلفة في سنوات مختلفة
    # («Ghana» إمبراطورية غانا في 1200 وغانا الحديثة في 2010)، فالاسم العربي لا يُعرض إلا في سنوات قيام الكيان المطابَق
    alive = [y for y in present if (not inc or min(inc) <= y + TOL) and (not dis or max(dis) >= y - TOL)]
    if not alive:
        return {**base, "status": "date_mismatch", "ar_rejected": base.pop("ar")}
    return {**base, "status": "verified", "years_ar": alive}


def main():
    present = years_by_name()
    extract = json.loads(EXTRACT.read_text(encoding="utf-8")) if EXTRACT.exists() else {"titles": {}}
    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8")).get("overrides", {}) if OVERRIDES.exists() else {}
    names = {}
    for n, hit in sorted(extract["titles"].items()):
        if n not in present:
            continue
        names[n] = {**decide(n, hit, present[n]), "years": present[n]}
    for n, o in overrides.items():
        if n not in present:
            sys.exit(f"تعديل لاسم غير موجود في المصدر: {n}")
        names[n] = {**names.get(n, {}), "years_ar": present[n], **o, "status": "override", "years": present[n]}
    counts = {}
    for v in names.values():
        counts[v["status"]] = counts.get(v["status"], 0) + 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "_meta": {
            "source": "Wikidata (CC0)، بمستخلص data/raw/wikidata/hb_titles.json",
            "rules": f"رفض صفحات التوضيح والقوائم؛ تحقق زمني بسماحة {TOL} سنة؛ بلا تواريخ يُقبل موسوماً؛ التعديلات اليدوية معلنة",
            "statuses": {"verified": "اسم عربي متحقق زمنياً", "undated": "اسم عربي بلا تواريخ للتحقق", "override": "تعديل يدوي معلن",
                         "date_mismatch": "رُفض: كيان آخر بالاسم نفسه", "rejected": "رُفض: نوع غير الكيان المرسوم (توضيح، قائمة، مدينة، موقع، مادة) أو بلا تواريخ ولا نوع صريح",
                         "no_arabic": "لا تسمية عربية في ويكي بيانات", "no_match": "لا مقالة بهذا العنوان"},
            "counts": counts,
        },
        "names": names,
    }, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n", encoding="utf-8")
    ar = sum(1 for v in names.values() if v.get("ar"))
    print(f"أسماء عربية: {ar} من {len(names)} مطلوبة · {counts}")


if __name__ == "__main__":
    main()
