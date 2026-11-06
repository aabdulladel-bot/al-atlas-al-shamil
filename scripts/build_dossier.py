"""يبني web/data/dossier.json: «ملف الدولة» لكل دولة اليوم، يجمع طبقات الأطلس الموجودة، ومجموعات إقليمية منها.

المصادر (كلها مبنية من ملفات مُتحقَّق منها في المانيفست):
- web/data/observatory.json: المؤشرات الحالية لكل دولة (UCDP، وUN DESA، وGapminder).
- web/data/khaldun.json: درجات الشروط والمركّب.
- web/data/lineage.json: أقوى صلة سابقة ولاحقة لكل دولة اليوم (من ملفات الانتقال).
- web/data/econ/gdppc_countries.json: الناتج للفرد (Maddison 2023، CC BY 4.0).
- الاسم العربي من web/data/borders/modern_countries.geojson؛ القارة والإقليم الفرعي من Natural Earth الخام (ملك عام).

القاعدة: لا يُضاف شيء غير موجود في هذه الملفات، والغائب يُعلن غياباً، لا يُملأ.
الاستعمال: python3 -I scripts/build_dossier.py [--check]
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OBS = ROOT / "web/data/observatory.json"
KH = ROOT / "web/data/khaldun.json"
LIN = ROOT / "web/data/lineage.json"
ECON = ROOT / "web/data/econ/gdppc_countries.json"
MODERN = ROOT / "web/data/borders/modern_countries.geojson"
NE_RAW = ROOT / "data/raw/naturalearth/ne_50m_admin_0_countries.geojson"
OUT = ROOT / "web/data/dossier.json"


def load(p):
    return json.loads(p.read_text(encoding="utf-8"))


def build():
    obs = load(OBS)
    kh = load(KH)
    lin = load(LIN)
    econ = load(ECON)["countries"]
    modern = load(MODERN)
    ne = load(NE_RAW)

    names = {}
    for f in modern["features"]:
        p = f["properties"]
        if p.get("NAME"):
            names[p["NAME"]] = p.get("NAME_AR") or None
    geo = {}
    for f in ne["features"]:
        p = f["properties"]
        if p.get("NAME") in names:
            geo[p["NAME"]] = {"continent": p.get("CONTINENT"), "subregion": p.get("SUBREGION")}

    ind_meta = [{"id": i["id"], "name_ar": i["name_ar"], "unit_ar": i["unit_ar"], "sunna_link_ar": i["sunna_link_ar"]} for i in obs["indicators"]]
    cond_names = {c["id"]: c["name_ar"] for c in kh["conditions"]}
    cond_scored = {c["id"]: bool(c.get("scored")) for c in kh["conditions"]}
    total_scored = kh["_meta"]["total_conditions"]

    countries = {}
    for name in sorted(names):
        ind_vals = {}
        for i in obs["indicators"]:
            v = i["values"].get(name)
            if v is not None:
                ind_vals[i["id"]] = {k: x for k, x in v.items()}
        kc = kh["countries"].get(name)
        econ_series = econ.get(name)
        econ_latest = econ_series[-1] if econ_series else None
        ent = lin["lineage"].get("modern", {}).get(name, {})
        prev_first = None
        for yr, blk in sorted(ent.get("prev", {}).items(), key=lambda kv: kv[0], reverse=True):
            items = blk.get("items") or []
            if items and not items[0].get("more"):
                prev_first = {"map": yr, "name": items[0].get("name_ar") or items[0]["name"], "ownShare": items[0]["ownShare"], "otherShare": items[0]["otherShare"]}
                break
        next_first = None
        for yr, blk in sorted(ent.get("next", {}).items(), key=lambda kv: kv[0]):
            items = blk.get("items") or []
            if items and not items[0].get("more"):
                next_first = {"map": yr, "name": items[0].get("name_ar") or items[0]["name"], "ownShare": items[0]["ownShare"], "otherShare": items[0]["otherShare"]}
                break

        gaps = []
        for m in ind_meta:
            if m["id"] not in ind_vals:
                gaps.append(f"لا قيمة لـ«{m['id']}» لهذه الدولة في المصادر المرخّصة")
        if kc is None:
            gaps.append("لا درجة للشروط الخلدونية لهذه الدولة")
        else:
            for cid, scored in cond_scored.items():
                if scored and cid not in kc["conditions"]:
                    gaps.append(f"لا درجة لشرط «{cond_names[cid]}» لهذه الدولة")
        if econ_latest is None:
            gaps.append("لا سلسلة ناتج للفرد لهذه الدولة في Maddison")
        if prev_first is None and next_first is None:
            gaps.append("لا سلف ولا خلف لهذه الدولة في الخرائط المتجاورة")

        countries[name] = {
            "name_ar": names[name],
            "continent": geo.get(name, {}).get("continent"),
            "subregion": geo.get(name, {}).get("subregion"),
            "indicators": ind_vals,
            "index": {
                "composite": kc["composite"] if kc else None,
                "available": kc["available"] if kc else 0,
                "total": total_scored,
                "conditions": kc["conditions"] if kc else {},
            },
            "economy": {"gdppc_year": econ_latest[0], "gdppc_value": econ_latest[1]} if econ_latest else None,
            "lineage": {"prev": prev_first, "next": next_first},
            "gaps": gaps,
        }

    regions = {}
    for name, c in countries.items():
        key = c["continent"] or "غير مصنّف"
        regions.setdefault(key, []).append(name)
    region_rows = []
    for key in sorted(regions):
        members = regions[key]
        comps = [countries[m]["index"]["composite"] for m in members if countries[m]["index"]["composite"] is not None]
        region_rows.append({
            "continent": key,
            "countries": len(members),
            "with_composite": len(comps),
            "mean_composite": round(sum(comps) / len(comps), 3) if comps else None,
        })

    return json.dumps({
        "_meta": {
            "note_ar": "ملف الدولة يجمع طبقات الأطلس الموجودة لكل دولة اليوم. ما لا يوجد يُعلن في «ما لا نعرفه»، ولا يُملأ.",
            "indicator_meta": ind_meta,
            "conditions": [{"id": c["id"], "name_ar": c["name_ar"], "scored": bool(c.get("scored"))} for c in kh["conditions"]],
            "sources": {
                "observatory": obs["_meta"]["sources"],
                "index": "scripts/build_khaldun.py على مؤشرات المرصد",
                "lineage": "web/data/lineage.json من ملفات الانتقال (Historical Basemaps، GPL-3؛ Natural Earth، ملك عام)",
                "economy": "Maddison Project Database 2023، CC BY 4.0، عبر Our World in Data",
                "geography": "Natural Earth 50m (ملك عام): CONTINENT وSUBREGION",
            },
        },
        "regions": region_rows,
        "countries": countries,
    }, ensure_ascii=False, indent=2) + "\n"


if __name__ == "__main__":
    text = build()
    if "--check" in sys.argv:
        cur = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if cur != text:
            raise SystemExit("web/data/dossier.json لا يطابق مولّده: شغّل npm run build:dossier")
        print("ملف الدولة: مطابقة")
    else:
        OUT.write_text(text, encoding="utf-8")
        d = json.loads(text)
        print(f"ملف الدولة: {len(d['countries'])} دولة، {len(d['regions'])} قارة")
