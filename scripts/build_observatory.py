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


def verified_bytes(entry, file_path=None):
    """الملف الخام بعد التحقق من تجزئته مع المانيفست. يُختار الملف بمساره إن لم يكن الأول."""
    f = entry["files"][0] if file_path is None else next(x for x in entry["files"] if x["file"] == file_path)
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


def read_ucdp_sum(data, ind, names, aliases):
    """مجموع قيمة عمود (مثل الوفيات) داخل المدى، لكل دولة حديثة.

    إن كان "single_location_only" فلا تُحسب الصفوف التي يقع فيها النزاع في أكثر من دولة،
    لأن قيمتها لا تُوزّع على الدول بغير تقدير، وحسابها كاملاً لكل دولة يضاعف الرقم.
    """
    z = zipfile.ZipFile(io.BytesIO(data))
    rows = list(csv.DictReader(io.StringIO(z.read(z.infolist()[0]).decode("utf-8"))))
    lo, hi = ind["years"]
    totals, unmatched, excluded = {}, set(), 0
    for r in rows:
        y = int(r["year"])
        if not lo <= y <= hi:
            continue
        loc = r[ind["location_column"]].strip()
        if ind.get("single_location_only") and ", " in loc:
            excluded += 1
            continue
        for raw in loc.split(", "):
            raw = raw.strip()
            name = aliases.get(raw, raw)
            if name not in names:
                unmatched.add(raw)
                continue
            totals[name] = totals.get(name, 0) + float(r[ind["column"]] or 0)
    values = {n: round(totals.get(n, 0)) for n in names}  # الغائب صفر: القاعدة تسجّل الحدث فقط
    return values, sorted(unmatched), excluded


def read_gapminder_latest(data, ind, names):
    """آخر قيمة متاحة داخل المدى لكل دولة، مع سنتها. الرموز ISO3 بحروف صغيرة في الملف."""
    rows = list(csv.DictReader(io.StringIO(data.decode("utf-8"))))
    lo, hi = ind["years"]
    value_col = [c for c in rows[0].keys() if c not in ("geo", "time")][0]
    latest = {}
    for r in rows:
        y = int(r["time"])
        if not lo <= y <= hi or r[value_col] == "":
            continue
        code = r["geo"].upper()
        if code not in latest or y > latest[code][0]:
            latest[code] = (y, float(r[value_col]))
    iso = name_to_iso3()
    values = {}
    for n in names:
        code = iso.get(n)
        if code in latest:
            y, v = latest[code]
            values[n] = {"value": round(v, 1), "year": y}
    return values, [], None


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
        data = verified_bytes(entry, ind.get("file"))
        if ind["reader"] == "ucdp_years":
            values, unmatched, of = read_ucdp_years(data, ind, names, aliases)
            shown = {n: {"value": v, "of": of} for n, v in sorted(values.items())}
        elif ind["reader"] == "ucdp_sum":
            values, unmatched, excluded = read_ucdp_sum(data, ind, names, aliases)
            shown = {n: {"value": v} for n, v in sorted(values.items())}
            out["_meta"].setdefault("excluded", {})[ind["id"]] = excluded
        elif ind["reader"] == "gapminder_latest":
            values, unmatched, _ = read_gapminder_latest(data, ind, names)
            shown = {n: v for n, v in sorted(values.items())}
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
