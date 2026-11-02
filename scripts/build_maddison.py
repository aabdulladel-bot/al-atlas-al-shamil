"""يبني سلاسل الناتج للفرد من Maddison Project Database 2023 (CC BY 4.0) للواجهة.

المصدر: نسخة Our World in Data (معالجة طفيفة معلنة في استشهادها) في data/raw/maddison/owid_gdppc_maddison.csv،
مسجّلة في sources/manifest.json. الوحدة: دولار دولي بأسعار 2011. لا رقم مكتوب يدوياً: كل قيمة من الملف.
المخرجات:
  web/data/econ/gdppc_regions.json  أقاليم Maddison والعالم، وربطها بمناطق الأطلس (scripts/config/maddison_regions.json)
  web/data/econ/gdppc_countries.json  سلسلة كل دولة، مفتاحها اسم الدولة في Natural Earth (خريطة الدول اليوم)
الاستعمال: python3 -I scripts/build_maddison.py
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data/raw/maddison/owid_gdppc_maddison.csv"
NE = ROOT / "data/raw/naturalearth/ne_50m_admin_0_countries.geojson"
CFG = ROOT / "scripts/config/maddison_regions.json"
OUT = ROOT / "web/data/econ"
META = {
    "source": "Bolt and van Zanden, Maddison Project Database 2023 (CC BY 4.0)، عبر Our World in Data بمعالجة طفيفة",
    "unit": "دولار دولي بأسعار 2011",
    "note": "تقديرات تاريخية: الأقاليم تبدأ من 1820، وبعض الدول أقدم بنقاط متفرقة. الخط بين نقطتين متباعدتين وصل لا قياس.",
}


def main():
    rows = list(csv.DictReader(SRC.open(encoding="utf-8")))
    series, by_code = {}, {}
    for r in rows:
        v = r["gdp_per_capita"]
        if not v:
            continue
        pt = [int(r["year"]), round(float(v))]
        series.setdefault(r["entity"], []).append(pt)
        if r["code"] and not r["code"].startswith("OWID"):
            by_code.setdefault(r["code"], []).append(pt)
    for s in (*series.values(), *by_code.values()):
        s.sort()
    cfg = json.loads(CFG.read_text(encoding="utf-8"))
    wanted = {cfg["world"], *(n for r in cfg["regions"].values() for n in r["series"])}
    missing = (wanted - series.keys()) | (wanted - cfg["names"].keys())
    if missing:
        raise SystemExit(f"أقاليم غير موجودة في المصدر: {sorted(missing)}")
    OUT.mkdir(parents=True, exist_ok=True)
    regions = {"_meta": META, "world": cfg["world"], "map": cfg["regions"], "names": cfg["names"], "series": {n: series[n] for n in sorted(wanted)}}
    (OUT / "gdppc_regions.json").write_text(json.dumps(regions, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    # اسم الدولة في Natural Earth ← رمزها (ISO_A3، وإلا ADM0_A3) ← سلسلتها
    ne = json.loads(NE.read_text(encoding="utf-8"))["features"]
    countries, unmatched = {}, []
    for f in ne:
        p = f["properties"]
        code = p.get("ISO_A3") if p.get("ISO_A3") not in (None, "-99") else p.get("ADM0_A3")
        if code in by_code:
            countries[p["NAME"]] = by_code[code]
        else:
            unmatched.append(p["NAME"])
    (OUT / "gdppc_countries.json").write_text(json.dumps({"_meta": META, "countries": countries}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"أقاليم: {len(regions['series'])}، دول مطابقة: {len(countries)}، دول بلا سلسلة: {len(unmatched)}")


if __name__ == "__main__":
    main()
