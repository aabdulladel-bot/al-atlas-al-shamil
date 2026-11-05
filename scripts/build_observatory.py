"""يبني web/data/observatory.json: مؤشرات حالية لكل دولة اليوم، تُحسب من الملفات الخام المرخّصة.

- كل ملف خام يُتحقق من تجزئته (sha256) مع sources/manifest.json قبل القراءة، فلا يتغيّر الرقم بصمت.
- الأسماء تُطابَق مع أسماء الخريطة الحديثة بجدول بدائل صريح (scripts/config/observatory.json)،
  وكل اسم لم يُطابَق يُذكر في الناتج، لا يُسقط بصمت.
- الاستعمال: python3 -I scripts/build_observatory.py [--check]
"""
import csv
import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CFG = ROOT / "scripts/config/observatory.json"
MANIFEST = ROOT / "sources/manifest.json"
MODERN = ROOT / "web/data/borders/modern_countries.geojson"
OUT = ROOT / "web/data/observatory.json"


def manifest_entry(source_id):
    m = json.loads(MANIFEST.read_text(encoding="utf-8"))
    items = m if isinstance(m, list) else m["sources"]
    for e in items:
        if e.get("id") == source_id:
            return e
    raise SystemExit(f"مصدر غير مسجّل في المانيفست: {source_id}")


def verified_bytes(entry):
    """الملف الخام بعد التحقق من تجزئته مع المانيفست."""
    f = entry["files"][0]
    data = (ROOT / f["file"]).read_bytes()
    got = hashlib.sha256(data).hexdigest()
    if got != f["sha256"]:
        raise SystemExit(f"تجزئة {f['file']} لا تطابق المانيفست: {got}")
    return data


def modern_names():
    d = json.loads(MODERN.read_text(encoding="utf-8"))
    return {f["properties"]["NAME"] for f in d["features"] if f["properties"].get("NAME")}


def build():
    cfg = json.loads(CFG.read_text(encoding="utf-8"))
    names = modern_names()
    aliases = cfg["aliases"]
    out = {
        "_meta": {
            "note": cfg["_note"],
            "sources": {},
        },
        "indicators": [],
        "unmatched": {},
    }
    for ind in cfg["indicators"]:
        entry = manifest_entry(ind["source"])
        out["_meta"]["sources"][ind["source"]] = {
            "license": entry["license"],
            "attribution": entry["attribution"],
            "landing": entry["landing"],
            "tier": entry["tier"],
        }
        data = verified_bytes(entry)
        z = zipfile.ZipFile(io.BytesIO(data))
        rows = list(csv.DictReader(io.StringIO(z.read(z.infolist()[0]).decode("utf-8"))))
        lo, hi = ind["years"]
        years = {}  # الدولة -> مجموعة السنوات
        unmatched = set()
        for r in rows:
            y = int(r["year"])
            if not lo <= y <= hi:
                continue
            for raw in r["location"].split(", "):
                raw = raw.strip()
                name = aliases.get(raw, raw)
                if name not in names:
                    unmatched.add(raw)
                    continue
                years.setdefault(name, set()).add(y)
        # كل دولة حديثة تظهر: من لا ترد في القاعدة قيمتها صفر مسجّل، لا غائب
        values = {n: {"value": len(years.get(n, ())), "of": hi - lo + 1} for n in sorted(names)}
        out["indicators"].append({
            "id": ind["id"],
            "name_ar": ind["name_ar"],
            "unit_ar": ind["unit_ar"],
            "definition_ar": ind["definition_ar"],
            "source": ind["source"],
            "years": [lo, hi],
            "sunan": ind["sunan"],
            "sunna_link_ar": ind["sunna_link_ar"],
            "values": values,
        })
        out["unmatched"][ind["id"]] = sorted(unmatched)
    return json.dumps(out, ensure_ascii=False, indent=2) + "\n"


if __name__ == "__main__":
    text = build()
    if "--check" in sys.argv:
        cur = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if cur != text:
            raise SystemExit("web/data/observatory.json لا يطابق مولّده: شغّل npm run build:observatory")
        print("المرصد: مطابقة")
    else:
        OUT.write_text(text, encoding="utf-8")
        d = json.loads(text)
        for ind in d["indicators"]:
            withrec = sum(1 for v in ind["values"].values() if v["value"] > 0)
            print(f"المرصد: {ind['id']}: {len(ind['values'])} دولة، منها {withrec} بسنوات نزاع مسجّلة، غير مطابق: {len(d['unmatched'][ind['id']])}")
