# يبني web/data/analysis/links.json من الشواهد المرتبطة بالسُّنن ومن أماكنها:
#  - matrix: مختبر الفرضية: لكل سُنّة وحقبة، عدد الشواهد المؤيدة والمقيِّدة (من الادعاءات الموثّقة نفسها).
#  - conflicts: تعارض داخل المكان: مكان واحد فيه شاهد مؤيد وشاهد مقيِّد لسُّنّة واحدة.
#  - threads: خيط الشاهد: الشواهد التي تشترك في مكان واحد، بحسب مكانه.
# لا يُضاف شيء من خارج المستودع. الاستعمال: python3 -I scripts/build_analysis_links.py [--check]
import glob
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web/data/analysis/links.json"
CHECK = "--check" in sys.argv
sun = json.loads((ROOT / "web/data/sunan.json").read_text(encoding="utf-8"))
L = sun.get("sunan", sun)
roles = defaultdict(list)  # claim -> [(sunna, sup|lim)]
for s in L:
    for x in s["supporting"]:
        roles[x["id"]].append((s["id"], "sup"))
    for x in s["limiting"]:
        if x.get("id"):
            roles[x["id"]].append((s["id"], "lim"))
era_of = {}
for f in glob.glob(str(ROOT / "verification/era*/claims.json")):
    e = int(Path(f).parent.name.replace("era", ""))
    for c in json.loads(Path(f).read_text(encoding="utf-8")):
        era_of[c["id"]] = e
pts = json.loads((ROOT / "web/data/claim_points.geojson").read_text(encoding="utf-8"))["features"]
place_claims = {}
for f in pts:
    p = f["properties"]
    place_claims[p["name_ar"]] = [c["id"] for c in json.loads(p["claims"])]

matrix = []
for s in L:
    cells = {}
    for cid, rs in roles.items():
        for sid, r in rs:
            if sid != s["id"] or cid not in era_of:
                continue
            e = str(era_of[cid])
            cells.setdefault(e, {"sup": 0, "lim": 0})["sup" if r == "sup" else "lim"] += 1
    matrix.append({"sunna": s["id"], "name": s.get("name", s["id"]), "eras": cells})

conflicts = []
for pname, ids in place_claims.items():
    by = defaultdict(lambda: {"sup": [], "lim": []})
    for cid in ids:
        for sid, r in roles.get(cid, []):
            by[sid][r].append(cid)
    for sid, d in by.items():
        if d["sup"] and d["lim"]:
            conflicts.append({"place": pname, "sunna": sid, "sup": sorted(d["sup"]), "lim": sorted(d["lim"])})

threads = defaultdict(list)
for pname, ids in place_claims.items():
    if len(ids) < 2:
        continue
    for cid in ids:
        others = [o for o in ids if o != cid]
        if others:
            threads[cid].append({"place": pname, "claims": sorted(others)})

# بصمة المكان: توزيع أنواع العدسات الأربع على شواهد المكان الواحد (من ملفات sunan/lenses)
lens_of = {}
for f in sorted(glob.glob(str(ROOT / "sunan/lenses/*.json"))):
    lens = json.loads(Path(f).read_text(encoding="utf-8"))
    name = Path(f).stem
    for e in lens["entries"]:
        lens_of.setdefault(e["claim"], {})[name] = e["type"]
profiles = {}
for pname, ids in place_claims.items():
    counts = defaultdict(lambda: defaultdict(int))
    for cid in ids:
        for lens, t in lens_of.get(cid, {}).items():
            counts[lens][t] += 1
    if counts:
        profiles[pname] = {l: dict(sorted(v.items())) for l, v in sorted(counts.items())}

data = {
    "_meta": {
        "note": "مشتق من sunan/sunan.json وclaim_points.geojson والادعاءات الموثّقة. لا يُعدَّل يدوياً، ويُعاد بناؤه بالسكربت.",
        "conflict_rule": "مكان واحد فيه شاهد مؤيد وشاهد مقيِّد لسُّنّة واحدة",
    },
    "matrix": matrix,
    "conflicts": conflicts,
    "threads": {k: v for k, v in sorted(threads.items())},
    "profiles": dict(sorted(profiles.items())),
}
text = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
if CHECK:
    if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
        print("links.json لا يطابق المصدر", file=sys.stderr); sys.exit(1)
    print(f"روابط التحليل: مطابقة ({len(conflicts)} تعارض، {len(threads)} شاهداً بخيوط)")
    sys.exit(0)
OUT.write_text(text, encoding="utf-8")
print(f"كُتب {OUT}: {len(conflicts)} تعارض، {len(threads)} شاهداً بخيوط")
