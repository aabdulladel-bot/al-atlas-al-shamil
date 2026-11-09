# يبني web/data/names/entity_info.json للبطاقة التعريفية: لكل كيان في خرائط Historical Basemaps له معرّف في ويكي بيانات،
# وصفه بالعربية والإنجليزية ونوعه (P31) وعنوانا مقالتي ويكيبيديا، كما في ويكي بيانات (CC0)، بعد تصحيحات الهوية.
# المدخلات: data/raw/wikidata/hb_entities.json (fetch_wikidata_entities.py) وscripts/wikidata_titles.py وweb/data/names/hb_names.json.
# الاستعمال: python3 -I scripts/build_entity_info.py [--check]
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web/data/names/entity_info.json"
spec = importlib.util.spec_from_file_location("wt", ROOT / "scripts/wikidata_titles.py")
wt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wt)
# أنواع تعني أن المجموعة تُعرَّف باللغة أو بالتصنيف، لا كياناً ذا حدود: تُعرض معها ملاحظة في البطاقة
GROUPING_NOTE = ROOT / "scripts/config/entity_groupings.json"
ACCEPTED = {"verified", "undated", "override"}


def build():
    titles = wt.load_titles()
    data = wt.load_entities()
    ents, type_labels = data["entities"], data["type_labels"]
    names = json.loads((ROOT / "web/data/names/hb_names.json").read_text(encoding="utf-8"))["names"]
    # الوصف لما قُبلت مطابقته في ويكي بيانات وحده (متحقق، أو بلا تواريخ، أو تصحيح هوية معلن). ما عُرِّب لأن مطابقته رُفضت
    # (صفحة توضيح، أو مدينة، أو كيان في زمن آخر) لا يُعرض وصفه، لأنه وصف كيان آخر.
    on_maps = {n for n, v in names.items() if v.get("status") in ACCEPTED}
    groupings = json.loads(GROUPING_NOTE.read_text(encoding="utf-8"))
    out, used = {}, set()
    for name in sorted(on_maps):
        t = titles.get(name)
        q = (t or {}).get("qid")
        e = ents.get(q) if q else None
        if not e:
            continue
        types = [x for x in e["p31"] if x in type_labels]
        used.update(types)
        rec = {"q": q, "t": types}
        for k_out, k_in in (("d_ar", "desc_ar"), ("d_en", "desc_en"), ("arwiki", "arwiki"), ("enwiki", "enwiki")):
            if e.get(k_in):
                rec[k_out] = e[k_in]
        if set(types) & set(groupings["types"]):
            rec["g"] = 1
        if t.get("identity_override"):
            rec["fix"] = t["identity_override"]
        out[name] = rec
    return {
        "_meta": {
            "source": "Wikidata (CC0)، بمستخلص data/raw/wikidata/hb_entities.json وتصحيحات scripts/config/hb_qid_overrides.json",
            "note": "الوصف والنوع كما في ويكي بيانات، لا من الأطلس. روابط ويكيبيديا للإحالة فقط، ولا يُنقل من نصها شيء.",
            "grouping_note": groupings["note"],
        },
        "types": {q: type_labels[q] for q in sorted(used)},
        "entities": out,
    }


def main():
    text = json.dumps(build(), ensure_ascii=False, separators=(",", ":")) + "\n"
    if "--check" in sys.argv:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
            raise SystemExit("web/data/names/entity_info.json لا يطابق مولّده: شغّل npm run build:entities")
        print("البطاقة التعريفية: مطابقة")
        return
    OUT.write_text(text, encoding="utf-8")
    d = json.loads(text)
    print(json.dumps({"كيانات بوصف": len(d["entities"]), "أنواع": len(d["types"]),
                      "بوصف عربي": sum(1 for v in d["entities"].values() if "d_ar" in v),
                      "مجموعات تصنيفية": sum(1 for v in d["entities"].values() if v.get("g"))}, ensure_ascii=False))


if __name__ == "__main__":
    main()
