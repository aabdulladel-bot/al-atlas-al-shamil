"""يبني web/data/observatory.json: مؤشرات حالية لكل دولة اليوم، تُحسب من الملفات الخام المرخّصة.

- كل ملف خام يُتحقق من تجزئته (sha256) مع sources/manifest.json قبل القراءة، فلا يتغيّر الرقم بصمت.
- كل مؤشر يحدد قارئه ("reader") وطريقة عرض الدول الغائبة ("absent"):
  * "zero": الدولة الغائبة من القاعدة قيمتها صفر مسجّل (القاعدة تسجّل الحدث فقط).
  * "unavailable": الدولة الغائبة لا قيمة لها، ولا تُعرض بصفر.
- مطابقة الأسماء: UCDP بجدول بدائل صريح، وUN WPP برمز ISO3 من ملف Natural Earth الخام نفسه.
- الاستعمال: python3 -I scripts/build_observatory.py [--check]
"""
import csv
import gzip
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
NE_RAW = ROOT / "data/raw/naturalearth/ne_50m_admin_0_countries.geojson"
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


def name_to_iso3():
    """اسم الخريطة الحديثة -> رمز ISO3 من ملف Natural Earth الخام نفسه."""
    d = json.loads(NE_RAW.read_text(encoding="utf-8"))
    out = {}
    for f in d["features"]:
        p = f["properties"]
        if p.get("NAME") and p.get("ADM0_A3"):
            out[p["NAME"]] = p["ADM0_A3"]
    return out


def read_ucdp_years(data, ind, names, aliases):
    """سنوات النزاع المسجّلة على أرض الدولة داخل المدى، لكل دولة حديثة."""
    z = zipfile.ZipFile(io.BytesIO(data))
    rows = list(csv.DictReader(io.StringIO(z.read(z.infolist()[0]).decode("utf-8"))))
    lo, hi = ind["years"]
    years, unmatched = {}, set()
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
    values = {n: len(years.get(n, ())) for n in names}  # الغائب صفر لأن القاعدة تسجّل الحدث فقط
    return values, sorted(unmatched), hi - lo + 1


def read_wpp_lex(data, ind, names):
    """متوقع الحياة عند الولادة (LEx) لكل دولة في السنة المطلوبة، بمطابقة ISO3."""
    text = gzip.decompress(data).decode("utf-8-sig")
    rows = list(csv.DictReader(io.StringIO(text)))
    year = str(ind["years"][0])
    by_iso = {}
    for r in rows:
        if r["Time"] == year and r["LocTypeName"] == "Country/Area" and r["ISO3_code"]:
            by_iso[r["ISO3_code"]] = float(r[ind["column"]])
    iso = name_to_iso3()
    values, unmatched = {}, set()
    for n in names:
        code = iso.get(n)
        if code in by_iso:
            values[n] = round(by_iso[code], 1)
    return values, sorted(unmatched), None


def build():
    cfg = json.loads(CFG.read_text(encoding="utf-8"))
    names = modern_names()
    aliases = cfg["aliases"]
    out = {"_meta": {"note": cfg["_note"], "sources": {}}, "indicators": [], "unmatched": {}}
    for ind in cfg["indicators"]:
        entry = manifest_entry(ind["source"])
        out["_meta"]["sources"][ind["source"]] = {
            "license": entry["license"],
            "attribution": entry["attribution"],
            "landing": entry["landing"],
            "tier": entry["tier"],
        }
        data = verified_bytes(entry)
        if ind["reader"] == "ucdp_years":
            values, unmatched, of = read_ucdp_years(data, ind, names, aliases)
            shown = {n: {"value": v, "of": of} for n, v in sorted(values.items())}
        elif ind["reader"] == "wpp_lex":
            values, unmatched, _ = read_wpp_lex(data, ind, names)
            shown = {n: {"value": v} for n, v in sorted(values.items())}
        else:
            raise SystemExit(f"قارئ غير معروف: {ind['reader']}")
        out["indicators"].append({
            "id": ind["id"],
            "name_ar": ind["name_ar"],
            "unit_ar": ind["unit_ar"],
            "definition_ar": ind["definition_ar"],
            "source": ind["source"],
            "years": ind["years"],
            "sunan": ind["sunan"],
            "sunna_link_ar": ind["sunna_link_ar"],
            "absent": ind["absent"],
            "values": shown,
        })
        out["unmatched"][ind["id"]] = unmatched
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
            print(f"المرصد: {ind['id']}: {len(ind['values'])} دولة بقيمة، غير مطابق: {len(d['unmatched'][ind['id']])}")
