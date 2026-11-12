# مهمة التحقق الجماعي من أسماء الكيانات: لكل اسم في Historical Basemaps بلا اسم عربي موثّق،
# يجمع المرشحين من ويكي بيانات، ويقيّمهم بقواعد معلنة، ويكتب ملف مراجعة. لا يغيّر أي اسم في الأطلس بنفسه:
# القرار لصاحب المشروع، ثم تُطبَّق المقبولة بخطوة منفصلة.
import csv
import glob
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NAMES = ROOT / "web/data/names/hb_names.json"
LABELS = ROOT / "web/data/borders"
TOL = 50  # تسامح بالسنوات بين تاريخ الكيان وسنة الخريطة، لأن خرائط المصدر تقريبية
POLITICAL = ("country", "state", "empire", "kingdom", "dynasty", "khanate", "khaganate", "caliphate", "sultanate",
             "emirate", "principality", "polity", "confederation", "duchy", "republic", "colony", "protectorate",
             "viceroyalty", "realm", "chiefdom", "city-state", "territory", "monarchy", "imamate", "tsardom", "horde")
PEOPLE = ("ethnic group", "people", "tribe", "culture", "archaeological culture", "nation", "clan", "confederacy")
DISAMBIG = {"Q4167410", "Q22808320"}


def map_area():
    """أكبر مساحة لكل اسم على أي خريطة، لترتيب الأسماء بأهميتها البصرية."""
    best = {}
    for f in glob.glob(str(LABELS / "labels_*.json")):
        if "modern" in f:
            continue
        for lab in json.load(open(f, encoding="utf-8"))["labels"]:
            best[lab["en"]] = max(best.get(lab["en"], 0), lab.get("a", 0))
    return best


def score(cand, facts, years, how):
    reasons, s = [], 0
    if how == "title":
        s += 3
        reasons.append("مقالة بالعنوان نفسه في ويكيبيديا الإنجليزية")
    elif how == "redirect":
        s += 2
        reasons.append("العنوان يحوّل إلى هذه المقالة")
    elif how == "search":
        reasons.append("اقتراح من البحث النصي، يحتاج مراجعة")
    else:
        s += 1
        reasons.append("مطابقة الاسم الإنجليزي في ويكي بيانات")
    types = facts.get("types", {})
    tl = " | ".join(types.values()).lower()
    if DISAMBIG & set(types):
        s -= 10
        reasons.append("صفحة توضيح")
    elif any(k in tl for k in POLITICAL):
        s += 2
        reasons.append("نوعه كيان سياسي")
    elif any(k in tl for k in PEOPLE):
        s += 1
        reasons.append("نوعه شعب أو ثقافة")
    elif types:
        s -= 3
        reasons.append(f"نوع غير سياسي: {tl[:60]}")
    lo, hi = facts.get("from"), facts.get("to")
    if not types:
        reasons.append("النوع والتاريخ غير متحقق منهما بعد")
    if (lo is not None or hi is not None) and years:
        inside = [y for y in years if (lo is None or y >= lo - TOL) and (hi is None or y <= hi + TOL)]
        if len(inside) == len(years):
            s += 2
            reasons.append("تاريخه يغطي سنوات الخريطة")
        elif not inside:
            s -= 3
            reasons.append("تاريخه خارج كل سنوات الخريطة")
        else:
            reasons.append("تاريخه يغطي بعض سنوات الخريطة")
    ar = facts.get("arwiki") or facts.get("ar")
    if ar:
        s += 1
    else:
        reasons.append("لا اسم عربي في ويكي بيانات")
    return s, reasons


def tier(s, facts, reasons):
    contradict = any(r.startswith("تاريخه خارج") or r == "صفحة توضيح" for r in reasons)
    has_ar = bool(facts.get("arwiki") or facts.get("ar"))
    # العالية تشترط معرفة النوع والتاريخ؛ بلا ويكي بيانات (مؤجَّلة) لا تتجاوز المتوسطة
    if s >= 6 and has_ar and not contradict and facts.get("types"):
        return "عالية"
    if s >= 3 and has_ar and not contradict:
        return "متوسطة"
    return "منخفضة"


def run(wm, statuses, limit, out):
    names = json.load(open(NAMES, encoding="utf-8"))["names"]
    area = map_area()
    todo = [n for n, v in names.items() if v.get("status") in statuses and n.strip()]
    todo.sort(key=lambda n: -area.get(n, 0))
    if limit:
        todo = todo[:limit]
    print(f"أسماء للتحقق: {len(todo)}")
    titles = wm.wiki_qids(todo)
    cands = {n: [] for n in todo}
    for n, t in titles.items():
        if t["qid"] and not t["disambiguation"]:
            cands[n].append((t["qid"], "redirect" if t["redirected"] else "title"))
    rest = [n for n in todo if not cands[n]]
    print(f"بالعنوان: {len(todo) - len(rest)}، وللبحث بالاسم: {len(rest)}")
    pending = []
    try:
        for n, qs in wm.label_candidates(rest).items():
            cands[n] += [(q, "label") for q in qs]
    except wm.core.RateLimited as e:
        pending.append(f"البحث بالاسم: {e}")
    try:
        facts = wm.entity_facts([q for cs in cands.values() for q, _ in cs])
    except wm.core.RateLimited as e:
        pending.append(f"التواريخ والأنواع: {e}")
        facts = {}
    # بديل غير مقيّد: بحث ويكيبيديا لما بقي بلا مرشح، اقتراحات تمر بالمراجعة إلزاماً
    still = [n for n in todo if not cands[n]]
    hits = wm.wiki_search(still)
    hit_titles = wm.wiki_qids([t for ts in hits.values() for t in ts])
    for n, ts in hits.items():
        for t in ts:
            h = hit_titles.get(t, {})
            if h.get("qid") and not h.get("disambiguation"):
                cands[n].append((h["qid"], "search"))
                titles.setdefault(f"__search__{t}", h)
    print(f"بالبحث النصي: {sum(1 for n in still if cands[n])} من {len(still)}")
    # الاسم العربي من رابط اللغة في ويكيبيديا، حين يغيب في ويكي بيانات أو تُؤجَّل
    for n, t in titles.items():
        if t["qid"] and t.get("ar_title"):
            f = facts.setdefault(t["qid"], {"qid": t["qid"], "types": {}})
            f.setdefault("arwiki", None)
            f["arwiki"] = f["arwiki"] or t["ar_title"]
    for p_ in pending:
        print("مؤجَّل:", p_)
    rows = []
    for n in todo:
        years = names[n].get("years", [])
        best = None
        for q, how in cands[n]:
            f = facts.get(q, {"types": {}})
            s, reasons = score(q, f, years, how)
            if best is None or s > best[0]:
                best = (s, q, f, reasons)
        row = {"name": n, "map_years": " ".join(map(str, years)), "area_km2": round(area.get(n, 0)),
               "current_ar": names[n].get("ar", ""), "current_status": names[n].get("status", "")}
        if best:
            s, q, f, reasons = best
            row.update({"qid": q, "en": f.get("en") or "", "ar_label": f.get("ar") or "", "arwiki": f.get("arwiki") or "",
                        "proposed_ar": f.get("arwiki") or f.get("ar") or "", "from": f.get("from"), "to": f.get("to"),
                        "types": "; ".join(f.get("types", {}).values()), "score": s, "tier": tier(s, f, reasons),
                        "reasons": "؛ ".join(reasons), "candidates": len(cands[n])})
        else:
            row.update({"qid": "", "en": "", "ar_label": "", "arwiki": "", "proposed_ar": "", "from": None, "to": None,
                        "types": "", "score": 0, "tier": "لا مرشح", "reasons": "لا مقالة ولا مطابقة اسم", "candidates": 0})
        row["accept"] = ""  # يملؤه صاحب المشروع: yes لقبول المرشح
        rows.append(row)
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out.with_suffix(".csv"), "w", encoding="utf-8-sig", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    out.with_suffix(".json").write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    counts = {}
    for r in rows:
        counts[r["tier"]] = counts.get(r["tier"], 0) + 1
    print("المستويات:", counts)
    print(f"كُتب: {out.with_suffix('.csv').relative_to(ROOT)} و{out.with_suffix('.json').name}")
    return rows
