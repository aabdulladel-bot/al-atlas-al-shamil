#!/usr/bin/env python3
# تطبيق قرارات مراجعة الأسماء «العالية» (review/names_verification.json، عمود accept=yes) على الإعدادات.
# يكتب إلى scripts/config/hb_name_overrides.json و scripts/config/hb_qid_overrides.json فقط، ولا يمس الأطلس مباشرة.
# يتخطى أي مفتاح موجود مسبقاً ويذكره، فلا يستبدل تعديلاً يدوياً سابقاً.
# الاستعمال: python3 -I scripts/apply_verified_names.py [--tier عالية|متوسطة] [--dry-run]
# البدائل الثلاثة للمدن تُطبَّق مع مستوى «عالية» فقط.
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / "review" / "names_verification.json"
NAME_OVR = ROOT / "scripts" / "config" / "hb_name_overrides.json"
QID_OVR = ROOT / "scripts" / "config" / "hb_qid_overrides.json"
DATE = "2026-11-12"

# بدائل المدن الثلاث، بقرار صاحب المشروع: الكيان السياسي بدل المدينة، مع معرّف ويكي بيانات وعنوان عربي موثّقين.
# سنوات الخريطة من مضلعات المصدر: Venice في 1000 و1200 و1600، وMilan في 1600، وHanover في 1800.
ALTERNATIVES = {
    "Venice": {"qid": "Q4948", "ar": "جمهورية البندقية", "en_label": "Republic of Venice",
               "why": "بدل المدينة Q641: الكيان السياسي Republic of Venice، ويكي بيانات Q4948، والاسم العربي عنوان مقالته. مضلعات المصدر تغطي 1000 و1200 و1600."},
    "Milan": {"qid": "Q153529", "ar": "دوقية ميلانو", "en_label": "Duchy of Milan",
              "why": "بدل المدينة Q490: الكيان السياسي Duchy of Milan، ويكي بيانات Q153529، والاسم العربي عنوان مقالته. مضلع المصدر في 1600."},
    "Hanover": {"qid": "Q706018", "ar": "إمارة هانوفر الناخبة", "en_label": "Electorate of Hanover",
                "why": "بدل المدينة Q1715: الكيان السياسي Electorate of Hanover، ويكي بيانات Q706018 (1692–1807)، والاسم العربي عنوان مقالته. مضلع المصدر في 1800."},
}

# ملاحظات تحريرية تُضاف إلى سبب بعض القبولات، بحسب ما ظهر في المراجعة.
NOTES = {
    "Korea": " ملاحظة: المعرّف يجمع الدولة والمنطقة، ويُراجع إن أُريد شبه الجزيرة في عصر محدد.",
    "Arakan": " ملاحظة: تاريخ البداية في ويكي بيانات (P571 = -3325، بدقة قرن) تاريخ تقريبي قديم، ولم يُعتمد في القرار.",
}


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def apply_second(dry):
    """يطبّق قرارات الجولة الثانية (review/names_second_pass.json، عمود accept=yes) على الإعدادات نفسها."""
    rows = load(ROOT / "review" / "names_second_pass.json")
    names = load(NAME_OVR)
    ov = names["overrides"]
    added, skipped = [], []
    for r in rows:
        if r.get("accept") != "yes":
            continue
        name = r["name"]
        if name in ov:
            skipped.append(name)
            continue
        ar = r.get("proposed_ar") or r.get("current_ar")
        why = (f"الجولة الثانية للأسماء بلا نوع في ويكي بيانات ({DATE}): الكيان {r.get('en')} ({r['qid']})، "
               f"والاسم العربي عنوان مقالته ({r.get('arwiki') or ar}). {r.get('review_note', '')}").strip()
        ov[name] = {"ar": ar, "why": why}
        added.append(name)
    print(f"سيُضاف {len(added)} مفتاح، ويُتخطى {len(skipped)}")
    if skipped:
        print("المتخطى:", ", ".join(skipped))
    if dry:
        print("وضع الاختبار: لم يُكتب شيء.")
        return
    NAME_OVR.write_text(json.dumps(names, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("كُتبت الإعدادات.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tier", default="عالية")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--source", default="verification", choices=["verification", "second"])
    a = ap.parse_args()
    dry, tier = a.dry_run, a.tier
    if a.source == "second":
        return apply_second(dry)
    rows = load(REVIEW)
    names = load(NAME_OVR)
    qids = load(QID_OVR)
    ov = names["overrides"]
    qov = qids["overrides"]
    added, skipped = [], []

    for r in rows:
        if r.get("tier") != tier or r.get("accept") != "yes":
            continue
        name = r["name"]
        if name in ALTERNATIVES:  # تُعالج عبر البدائل أدناه
            continue
        if name in ov:
            skipped.append(name)
            continue
        ar = r.get("proposed_ar") or r.get("current_ar")
        en = r.get("en") or name
        why = (f"التحقق الجماعي ومراجعة صاحب المشروع ({DATE}): الكيان {en} ({r['qid']})، "
               f"والاسم العربي عنوان مقالته في ويكيبيديا العربية ({r.get('arwiki') or ar}).")
        why += NOTES.get(name, "")
        if r.get("duplicate_of"):
            why += f" الكيان نفسه يظهر أيضاً في «{r['duplicate_of']}»، وهو اسم مستقل على الخريطة."
        ov[name] = {"ar": ar, "why": why}
        added.append(name)

    for name, alt in (ALTERNATIVES.items() if tier == "عالية" else []):
        if name in ov or name in qov:
            skipped.append(name)
            continue
        ov[name] = {"ar": alt["ar"], "why": alt["why"] + f" قرار صاحب المشروع ({DATE})."}
        qov[name] = {"qid": alt["qid"], "why": alt["why"]}
        added.append(name)

    print(f"سيُضاف {len(added)} مفتاح، ويُتخطى {len(skipped)}")
    if skipped:
        print("المتخطى:", ", ".join(skipped))
    if dry:
        print("وضع الاختبار: لم يُكتب شيء.")
        return
    NAME_OVR.write_text(json.dumps(names, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    QID_OVR.write_text(json.dumps(qids, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("كُتبت الإعدادات.")


if __name__ == "__main__":
    main()
