# يبني بيانات العرض الثلاثي الأبعاد (المكعّب الزمكاني) في web/data/stack/:
# - slice_{key}.json لكل خريطة: الكيانات المسمّاة بهندسة مبسّطة، ونقطة تمثيلية داخل كل كيان، ومساحته.
# - links.json: الخيوط بين كل خريطتين متتاليتين، مأخوذة من web/data/transitions (لا يُعاد حسابها).
# الاستعمال: python3 -I scripts/build_stack.py   (بعد build_transitions.py؛ يحتاج shapely)
#
# التبسيط والاقتصاص للعرض فقط؛ النقطة التمثيلية والمساحة من الهندسة الكاملة.
# الخيط يُرسم إذا أخذ الكيان الثاني ربع أرض الأول فأكثر، أو جاء ربع أرض الثاني فأكثر من الأول (TAU في build_transitions).
import importlib.util
import json
import sys
from pathlib import Path

import shapely

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("bt", ROOT / "scripts/build_transitions.py")
bt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bt)

OUT = ROOT / "web/data/stack"
TR = ROOT / "web/data/transitions"
SIMPLIFY = 0.02  # درجة (نحو 2 كم)
r3 = lambda x: round(x, 3)


# العرض يقتص ما جنوب خط 60 جنوباً (القارة القطبية الجنوبية تملأ أسفل المشهد بلا دلالة تاريخية)
# وما شمال 85 (ميركاتور لا يعرّف ±90)
CLIP = shapely.box(-180, -60, 180, 85)


def ring(coords):
    return [[r3(x), r3(y)] for x, y in coords]


def slim(g):
    s = shapely.simplify(shapely.intersection(g, CLIP), SIMPLIFY, preserve_topology=True)
    polys = []
    for p in bt.polygons(s):
        if p.is_empty or len(p.exterior.coords) < 4:
            continue
        polys.append([ring(p.exterior.coords)] + [ring(h.coords) for h in p.interiors if len(h.coords) >= 4])
    return polys


LABELS = ROOT / "web/data/borders"


def label_min_zoom(area_km2):
    # أدنى تقريب تظهر عنده تسمية الكيان على خريطة سنته: من مساحته، فالأكبر يظهر أبكر (قاعدة معلنة لا اختيار)
    for limit, z in ((2_000_000, 1.5), (500_000, 2.5), (100_000, 3.5), (20_000, 4.5)):
        if area_km2 >= limit:
            return z
    return 5.5


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    slices = []
    hb_file = ROOT / "web/data/names/hb_names.json"
    hb = json.loads(hb_file.read_text(encoding="utf-8"))["names"] if hb_file.exists() else {}
    for idx, key in enumerate(bt.KEYS):
        data = bt.load(key)
        ents = []
        for e in data["ents"]:
            polys = slim(e["geom"])
            if not polys:
                continue
            rp = e["geom"].representative_point()
            row = {"n": e["name"], "p": e["precision"], "a": round(e["area_km2"]), "r": [r3(rp.x), r3(rp.y)], "g": polys}
            if e["name_ar"] and e["name_ar"] != e["name"]:
                row["ar"] = e["name_ar"]
            ents.append(row)
        (OUT / f"slice_{key}.json").write_text(json.dumps({"key": key, "entities": ents}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        if key != "modern":
            # تسميات خريطة السنة للأطلس والبطاقة: الاسم العربي إن وُجد، والإنجليزي، والموضع، والمساحة، ومصدر الاسم
            labels = []
            for row in sorted(ents, key=lambda r: -r["a"]):
                info = hb.get(row["n"], {})
                lab = {"en": row["n"], "x": row["r"][0], "y": row["r"][1], "a": row["a"], "min": label_min_zoom(row["a"])}
                if row.get("ar"):
                    lab["ar"] = row["ar"]
                elif info.get("ar"):
                    # للاسم تسمية عربية، لكنها لكيان آخر بالاسم نفسه لم يكن قائماً في هذه السنة: تبقى للبطاقة لا للخريطة
                    lab["ar_other"] = info["ar"]
                for src, dst in (("qid", "qid"), ("status", "st"), ("inception", "from"), ("dissolved", "to"), ("years", "years"), ("en_shown", "en_shown")):
                    if info.get(src) is not None:
                        lab[dst] = info[src]
                if lab.get("ar_other"):
                    lab["st"] = "other_era"
                labels.append(lab)
            (LABELS / f"labels_{key}.json").write_text(json.dumps({"_meta": {"year": int(key), "name_source": "web/data/names/hb_names.json (Wikidata CC0)", "min_rule": "من المساحة: 2 مليون كم² ← 1.5، نصف مليون ← 2.5، مئة ألف ← 3.5، عشرون ألفاً ← 4.5، وما دون ← 5.5"}, "labels": labels}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        slices.append({"key": key, "index": idx, "entities": len(ents)})
        print(f"{key}: {len(ents)} كياناً", file=sys.stderr)

    links = []
    for a, b in zip(bt.KEYS, bt.KEYS[1:]):
        d = json.loads((TR / f"{a}__{b}.json").read_text(encoding="utf-8"))
        to_names = {r["name"] for r in d["to"]}
        for r in d["from"]:
            f = r["fate"]
            for name, sa, sb in r["links"]:
                if max(sa, sb) < bt.TAU or name not in to_names:
                    continue
                kind = "same" if name == r["name"] else "succ" if f["type"] == "succeeded" and f.get("by") == name else "change"
                links.append([a, r["name"], b, name, sa, sb, kind])
    meta = {
        "slices": slices,
        "simplify_deg": SIMPLIFY,
        "tau": bt.TAU,
        "link_fields": ["من سنة", "من كيان", "إلى سنة", "إلى كيان", "نصيبه من أرض الأول", "نصيب الأول من أرضه", "same|succ|change"],
        "sources": "Historical Basemaps (GPL-3) وNatural Earth (ملك عام)",
    }
    (OUT / "links.json").write_text(json.dumps({"_meta": meta, "links": links}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    kinds = {}
    for l in links:
        kinds[l[6]] = kinds.get(l[6], 0) + 1
    print(f"خيوط: {len(links)} {kinds}")


if __name__ == "__main__":
    main()
