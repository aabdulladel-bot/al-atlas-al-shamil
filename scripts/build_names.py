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
import importlib.util

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("wt", ROOT / "scripts/wikidata_titles.py")
wt = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(wt)
RAW = ROOT / "data/raw/historical-basemaps"
EXTRACT = ROOT / "data/raw/wikidata/hb_titles.json"
OVERRIDES = ROOT / "scripts/config/hb_name_overrides.json"
OUT = ROOT / "web/data/names/hb_names.json"
ARABIZED = ROOT / "scripts/config/hb_arabized.json"
# أسباب الرفض التي يُعرَّب فيها الاسم، لأن المضلع كيان سياسي والعنوان في ويكي بيانات صفحة موقع أو مدينة
ARABIZED_REASONS = {"صفحة توضيح", "موقع أثري", "مدينة", "مدينة كبرى", "مستوطنة بشرية"}
YEARS = [-4000, -1000, -1, 700, 800, 900, 1000, 1200, 1600, 1800, 1914, 1945, 2010]
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
    "Q41710", "Q133311", "Q2472587", "Q4533081", "Q103817", "Q4204501", "Q851990",  # جماعات وشعوب وقبائل ومجموعات سكانية
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


REVIEW = ROOT / "review/arabized_review.csv"
NE_FILE = ROOT / "data/raw/naturalearth/ne_50m_admin_0_countries.geojson"
LABEL_OVERRIDES = ROOT / "scripts/config/label_overrides.json"
KIND_AR = {"k": "اسم متداول", "t": "تعريب صوتي", "d": "ترجمة وصفية"}


def write_review(cfg, names):
    """ورقة المراجعة اللغوية لكل تعريب تقديري: الاسم في المصدر، والتعريب، ونوعه، وسنواته، وخانتان للمراجع."""
    import csv
    REVIEW.parent.mkdir(parents=True, exist_ok=True)
    kinds = {n: x["kind"] for n, x in cfg.get("unmatched", {}).items()}
    with REVIEW.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["الاسم في المصدر", "التعريب", "النوع", "السنوات", "القرار (يُقبل/يُعدَّل)", "التعريب المقترح من المراجع"])
        for n, v in sorted(names.items(), key=lambda kv: kv[0].lower()):
            if v.get("status") == "arabized":
                kind = KIND_AR.get(kinds.get(n), "تعريب صفحة مرفوضة")
                w.writerow([n, v["ar"], kind, " ".join(str(y) for y in v.get("years_ar", v.get("years", []))), "", ""])
            elif v.get("fill"):
                f = v["fill"]
                kind = KIND_AR.get(f["kind"], "") + f" (والاسم الموثّق «{v['ar']}» لسنوات أخرى)"
                w.writerow([n, f["ar"], kind, " ".join(str(y) for y in f["years"]), "", ""])


def main():
    present = years_by_name()
    extract = {"titles": wt.load_titles()} if EXTRACT.exists() else {"titles": {}}
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
    # أسماء رُفضت لأنها صفحات توضيح في ويكي بيانات، ولا اسم عربي موثّق لها: تُعرَّب تقديرياً من الاسم الإنجليزي.
    # التعريب لا يحمل تحققاً زمنياً، فيُعرض في كل سنة يظهر فيها الاسم الإنجليزي نفسه، كما في الأسماء بلا تواريخ.
    cfg = json.loads(ARABIZED.read_text(encoding="utf-8")) if ARABIZED.exists() else {}
    for n, ar in cfg.get("names", {}).items():
        v = names.get(n)
        if v and v["status"] == "rejected" and v.get("reason") in ARABIZED_REASONS:
            names[n] = {k: x for k, x in v.items() if k != "reason"} | {"status": "arabized", "ar": ar, "years_ar": present[n]}
    # أسماء لم يطابقها ويكي بيانات أو طابقها بلا عربي: تعريب تقديري معلن بنوعه (متداول، صوتي، وصفي)، ويحتاج مراجعة لغوية
    # وتشمل أيضاً: أسماء لم تمرّ بويكي بيانات أصلاً، وأسماء رُفض عربيّها (لكيان آخر بالاسم نفسه أو لنوع غير المرسوم) فيبقى
    # المرفوض في ar_rejected للشفافية، وسنوات خارج مدة الكيان المتحقق تُملأ بـ fill ويبقى الاسم الموثّق لسنواته.
    for n, x in cfg.get("unmatched", {}).items():
        if n not in present:
            continue
        v = names.get(n)
        base = {"status": "arabized", "ar": x["ar"], "arabized_kind": x["kind"], "years_ar": present[n]}
        if v is None:
            names[n] = {**base, "years": present[n]}
        elif v["status"] in ("no_match", "no_arabic", "rejected", "date_mismatch"):
            names[n] = {**v, **base}
        elif v.get("ar"):
            gap = [y for y in present[n] if y not in v.get("years_ar", [])]
            if gap:
                names[n] = {**v, "fill": {"ar": x["ar"], "kind": x["kind"], "years": gap}}
    # أسماء لم تمرّ بويكي بيانات أصلاً، وتطابق بالإنجليزية اسم دولة حديثة في Natural Earth (ملك عام): يؤخذ اسمها العربي
    # منه. مطابقة بالاسم لا بالهوية. والأسماء ذات التعديل التحريري المعلن (label_overrides.json) لا تُمسّ هنا،
    # لأن نطاق ذلك التعديل خريطة الدول اليوم، وتوسيعه إلى الخرائط التاريخية قرار لصاحب المشروع.
    ne = json.loads(NE_FILE.read_text(encoding="utf-8"))
    editorial = set(json.loads(LABEL_OVERRIDES.read_text(encoding="utf-8")).get("overrides", {}))
    ne_ar = {f["properties"]["NAME"]: f["properties"]["NAME_AR"] for f in ne["features"] if f["properties"].get("NAME_AR")}
    for n, years in present.items():
        if n not in names and n in ne_ar and n not in editorial:
            names[n] = {"status": "ne_name", "ar": ne_ar[n], "years": years, "years_ar": years}
    write_review(cfg, names)
    # أسماء بلا تواريخ لشعوب وأقاليم، والعربي فيها اسم ويكي بيانات نفسه لا ترجمة: تُقبل بالقائمة المعلنة
    for n in cfg.get("wikidata_accepted", []):
        v = names.get(n)
        if v and v["status"] == "rejected" and v.get("ar_rejected"):
            names[n] = {k: x for k, x in v.items() if k not in ("reason", "ar_rejected")} | {"status": "undated", "ar": v["ar_rejected"], "years_ar": present[n]}
    counts = {}
    for v in names.values():
        counts[v["status"]] = counts.get(v["status"], 0) + 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "_meta": {
            "source": "Wikidata (CC0)، بمستخلص data/raw/wikidata/hb_titles.json",
            "rules": f"رفض صفحات التوضيح والقوائم؛ تحقق زمني بسماحة {TOL} سنة؛ بلا تواريخ يُقبل موسوماً؛ التعديلات اليدوية معلنة",
            "statuses": {"verified": "اسم عربي متحقق زمنياً", "undated": "اسم عربي بلا تواريخ للتحقق", "override": "تعديل يدوي معلن", "arabized": "تعريب تقديري من الاسم الإنجليزي؛ لا اسم عربي موثّق، ويحتاج مراجعة لغوية", "fill": "حقل لا حالة: تعريب تقديري لسنوات خارج مدة الكيان المتحقق (fill.years)، والاسم الموثّق لسنواته (years_ar)", "ne_name": "الاسم العربي لدولة حديثة بالاسم الإنجليزي نفسه في Natural Earth (مطابقة بالاسم لا بالهوية)",
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
