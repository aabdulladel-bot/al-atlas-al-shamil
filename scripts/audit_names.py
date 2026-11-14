#!/usr/bin/env python3
# تدقيق كامل للأسماء المطبَّقة يدوياً (status = override) على خريطة الحقب.
# لكل اسم: المعرّف، والتسمية في ويكي بيانات، وتاريخ الكيان، وسنوات ظهوره على الخريطة.
# ثم يضع علامات: خارج الفترة، جزئي، هوية مشكوك فيها، بلا معرّف، بلا بيانات، بلا تواريخ.
# ويقترح قراراً لكل اسم: إبقاء، أو إعادة الاسم الحالي، أو مراجعة يدوية.
# يكتب review/names_audit.csv ولا يغيّر أي إعداد. الاستعمال: python3 -I scripts/audit_names.py
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NAMES = ROOT / "web" / "data" / "names" / "hb_names.json"
QOVR = ROOT / "scripts" / "config" / "hb_qid_overrides.json"
VER = ROOT / "review" / "names_verification.json"
SEC = ROOT / "review" / "names_second_pass.json"
ENT = ROOT / "data" / "raw" / "wikidata" / "hb_entities.json"
OUT = ROOT / "review" / "names_audit.csv"

STOP = {"empire", "kingdom", "state", "states", "the", "of", "dynasty", "republic", "people", "peoples",
        "chiefdom", "region", "tribe", "tribes", "emirate", "sultanate", "khanate", "culture", "and", "in",
        "rulers", "house", "nation", "principality", "duchy", "colony", "protectorate", "island", "islands"}


def kw(text):
    return {w for w in re.findall(r"[a-zāēīōūʻ'’\-]+", (text or "").lower()) if len(w) >= 3 and w not in STOP}


def year(s):
    m = re.match(r"([+-]?)(\d{1,4})", s or "")
    if not m:
        return None
    y = int(m.group(2))
    return -y if m.group(1) == "-" else y


def main():
    names = json.loads(NAMES.read_text(encoding="utf-8"))["names"]
    qovr = json.loads(QOVR.read_text(encoding="utf-8"))["overrides"]
    ver = {r["name"]: r for r in json.loads(VER.read_text(encoding="utf-8"))}
    sec = {r["name"]: r for r in json.loads(SEC.read_text(encoding="utf-8"))} if SEC.exists() else {}
    ents = json.loads(ENT.read_text(encoding="utf-8"))["entities"]

    rows = []
    for name, v in names.items():
        if v.get("status") != "override":
            continue
        qid = (qovr.get(name) or {}).get("qid") or (ver.get(name) or {}).get("qid") or (sec.get(name) or {}).get("qid")
        ent = ents.get(qid) if qid else None
        src = "wikidata_cache"
        row = ver.get(name) or sec.get(name) or {}
        if qid and ent is None and row.get("qid") == qid:
            # الكيان غير مخزَّن في ذاكرة الأطلس، فنستعمل ما سُجّل وقت التحقق (من/إلى/الاسم الإنجليزي)
            ent = {"en": row.get("en") or "", "inception": [f"+{row['from']:04d}-01-01T00:00:00Z"] if row.get("from") is not None else [],
                   "dissolved": [f"+{row['to']:04d}-01-01T00:00:00Z"] if row.get("to") is not None else []}
            if row.get("from") is not None and row["from"] < 0:
                ent["inception"] = [f"-{abs(row['from']):04d}-01-01T00:00:00Z"]
            if row.get("to") is not None and row["to"] < 0:
                ent["dissolved"] = [f"-{abs(row['to']):04d}-01-01T00:00:00Z"]
            src = "verification_record"
        years = [int(y) for y in (v.get("years") or [])]
        en = (ent or {}).get("en") or ""
        inc = min((year(s) for s in (ent or {}).get("inception", []) if year(s) is not None), default=None)
        dis = max((year(s) for s in (ent or {}).get("dissolved", []) if year(s) is not None), default=None)
        flags = []
        if not qid:
            flags.append("بلا معرّف")
        elif ent is None:
            flags.append("بلا بيانات")
        if qid and ent is not None and src == "verification_record" and (row.get("from") is None and row.get("to") is None):
            pass
        if qid and ent is not None:
            if inc is None and dis is None:
                flags.append("بلا تواريخ")
            elif years:
                inside = [y for y in years if (inc is None or y >= inc) and (dis is None or y <= dis)]
                if not inside:
                    flags.append("خارج الفترة")
                elif len(inside) < len(years):
                    flags.append("جزئي")
            pre = lambda ws: {w[:4] for w in ws if len(w) >= 4}
            shared = pre(kw(name)) & pre(kw(en) | kw((ent or {}).get("enwiki", "")))
            if not shared:
                flags.append("هوية مشكوك فيها")
        if "خارج الفترة" in flags or "بلا بيانات" in flags:
            decision = "إعادة الاسم الحالي"
        elif flags and any(f in flags for f in ("جزئي", "هوية مشكوك فيها", "بلا معرّف")):
            decision = "مراجعة يدوية"
        else:
            decision = "إبقاء"
        rows.append({
            "name": name, "ar": v.get("ar", ""), "current_ar": (ver.get(name) or {}).get("current_ar", ""),
            "qid": qid or "", "en_wikidata": en, "inception": inc if inc is not None else "",
            "dissolved": dis if dis is not None else "", "map_years": " ".join(map(str, years)),
            "source": src, "flags": "؛ ".join(flags), "decision": decision,
        })

    rows.sort(key=lambda r: (r["decision"], r["name"]))
    with OUT.open("w", encoding="utf-8-sig", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    from collections import Counter
    print("أسماء مطبَّقة يدوياً:", len(rows))
    print("القرارات:", dict(Counter(r["decision"] for r in rows)))
    print("العلامات:", dict(Counter(f for r in rows for f in r["flags"].split("؛ ") if f)))


if __name__ == "__main__":
    main()
