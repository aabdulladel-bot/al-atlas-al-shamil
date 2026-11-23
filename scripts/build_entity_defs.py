# يبني web/data/names/entity_defs.json: تعريفات لأسماء الخرائط التي لا تعريف لها في entity_info.json.
# المصدر ويكي بيانات (CC0) عبر SPARQL، بمطابقة صارمة:
#   - الاسم الإنجليزي في المصدر يطابق اسم العنصر أو أحد أسمائه البديلة حرفياً، أو معرّفه المسجّل في hb_names.json.
#   - العنصر من صنف شعب أو قبيلة أو ثقافة أثرية (لا شرط زمني)، أو من صنف كيان سياسي (دولة تاريخية، إمبراطورية،
#     مملكة، سلطنة، خلافة، خانية، اتحاد، مشيخة، دولة مدينة، إمارة) بشرط أن تتداخل مدته مع سنة من سنوات ظهوره على الخرائط.
#   - إن بقي أكثر من مرشح، يُختار الأكثر روابط ويكيبيديا، ويُسجَّل عدد المرشحين.
# الأبعاد (سياسية، ولغوية وثقافية، ودينية، واقتصادية، وتاريخية، ومصادر) من خصائص العنصر نفسه، لا من الأطلس.
# التسميات الجامعة (قبائل، رحّل، صيادون جامعون…) تُعرَّف من scripts/config/collective_names.json: نمط العيش وأبعاده (نص تحريري معلن)،
# والإقليم والجماعة بمعرّفات ويكي بيانات مثبّتة، ونص ابن خلدون المطابَق (scripts/check_collective_names.mjs).
# الاستعمال: python3 -I scripts/build_entity_defs.py [--check]
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web/data/names/entity_defs.json"
CACHE = ROOT / ".cache/scraper/entity_defs_sparql.json"  # ذاكرة مؤقتة، لا تُلتزم
UA = "al-atlas-cards/1.0 (project maintainer; https://github.com/aabdulladel-bot/al-atlas-al-shamil)"
CHECK = "--check" in sys.argv
PEOPLE = {"Q41710": "جماعة عرقية", "Q4204501": "جماعة عرقية تاريخية", "Q2472587": "شعب", "Q133311": "قبيلة", "Q465299": "ثقافة أثرية"}
POLITY = {"Q3024240": "دولة تاريخية", "Q48349": "إمبراطورية", "Q417175": "مملكة", "Q12759805": "سلطنة", "Q131401": "خلافة",
          "Q331644": "خانية", "Q170156": "اتحاد", "Q1642488": "مشيخة", "Q133442": "دولة مدينة", "Q208500": "إمارة"}
CLASSES = {**PEOPLE, **POLITY}
COLL = json.loads((ROOT / "scripts/config/collective_names.json").read_text(encoding="utf-8"))
REJECT = json.loads((ROOT / "scripts/config/entity_defs_overrides.json").read_text(encoding="utf-8"))["reject"]
PACE = 61  # ثانية بين الطلبات غير المخزنة: حد الخادم الحالي طلب في الدقيقة
SLACK = 50  # سنوات تسامح في تداخل المدة، لأن سنوات الخرائط تقريبية
COLLECTIVE = re.compile(r"\b(tribes|nomads|nomadic|hunter-gatherers|gatherers|pastoral|pastoralists|peoples|farmers|herders|chiefdoms|clans|villages|cultures|bands|foragers|fishermen)\b", re.I)

_cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}


def sparql(q):
    if q in _cache:
        return _cache[q]
    url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": q})
    last = None
    for attempt in range(12):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
            with urllib.request.urlopen(req, timeout=180) as r:
                rows = json.load(r)["results"]["bindings"]
            _cache[q] = rows
            CACHE.parent.mkdir(parents=True, exist_ok=True)
            CACHE.write_text(json.dumps(_cache, ensure_ascii=False), encoding="utf-8")
            time.sleep(PACE)
            return rows
        except Exception as e:  # noqa: BLE001
            last = e
            # الخادم قد يحدّ الطلبات بطلب في الدقيقة؛ يُحترم Retry-After إن وُجد
            ra = getattr(e, "headers", None) and e.headers.get("Retry-After")
            time.sleep(int(ra) + 2 if ra and str(ra).isdigit() else 65)
    raise RuntimeError(f"SPARQL: {last}")


def v(b, k):
    return b.get(k, {}).get("value")


def qid(uri):
    return uri.rsplit("/", 1)[-1] if uri else None


def year(s):
    m = re.match(r"^(-?\d+)-", s or "")
    return int(m.group(1)) if m else None


CLS = " ".join(f"wd:{c}" for c in CLASSES)


def candidates_by_label(names):
    out = {}
    for i in range(0, len(names), 35):
        batch = names[i:i + 35]
        vals = " ".join(json.dumps(n) + "@en" for n in batch)
        q = (f"SELECT ?l ?item ?c ?inc ?dis (COUNT(DISTINCT ?sl) AS ?links) WHERE {{ VALUES ?l {{ {vals} }} "
             f"?item rdfs:label|skos:altLabel ?l . ?item wdt:P31/wdt:P279* ?c . VALUES ?c {{ {CLS} }} "
             f"OPTIONAL {{ ?item wdt:P571 ?inc }} OPTIONAL {{ ?item wdt:P576 ?dis }} OPTIONAL {{ ?sl schema:about ?item }} }} "
             f"GROUP BY ?l ?item ?c ?inc ?dis")
        for b in sparql(q):
            out.setdefault(v(b, "l"), []).append({"q": qid(v(b, "item")), "c": qid(v(b, "c")), "inc": year(v(b, "inc")), "dis": year(v(b, "dis")), "links": int(v(b, "links") or 0)})
        print(f"label batch {i}: {len(out)} names with candidates", flush=True)
    return out


def candidates_by_qid(pairs):
    out = {}
    qs = sorted({q for _, q in pairs})
    for i in range(0, len(qs), 60):
        vals = " ".join(f"wd:{q}" for q in qs[i:i + 60])
        q = (f"SELECT ?item ?c ?inc ?dis (COUNT(DISTINCT ?sl) AS ?links) WHERE {{ VALUES ?item {{ {vals} }} "
             f"?item wdt:P31/wdt:P279* ?c . VALUES ?c {{ {CLS} }} OPTIONAL {{ ?item wdt:P571 ?inc }} OPTIONAL {{ ?item wdt:P576 ?dis }} "
             f"OPTIONAL {{ ?sl schema:about ?item }} }} GROUP BY ?item ?c ?inc ?dis")
        for b in sparql(q):
            out.setdefault(qid(v(b, "item")), []).append({"q": qid(v(b, "item")), "c": qid(v(b, "c")), "inc": year(v(b, "inc")), "dis": year(v(b, "dis")), "links": int(v(b, "links") or 0)})
    return out


def acceptable(c, years):
    if c["c"] in PEOPLE:
        return True
    if not years:
        return False
    lo = c["inc"] if c["inc"] is not None else -10**6
    hi = c["dis"] if c["dis"] is not None else 10**6
    if c["inc"] is None and c["dis"] is None:
        return False  # كيان سياسي بلا تواريخ: لا يُقبل بالاسم وحده
    return any(lo - SLACK <= y <= hi + SLACK for y in years)


DIMS = {
    "type": ("P31", "النوع"), "gov": ("P122", "شكل الحكم"), "capital": ("P36", "العاصمة"),
    "lang": ("P37", "اللغة الرسمية"), "lang_used": ("P2936", "اللغات المستعملة"), "religion": ("P140", "الدين"),
    "currency": ("P38", "العملة"), "replaces": ("P1365", "حلّ محل"), "replaced_by": ("P1366", "حلّ محله"),
    "follows": ("P155", "سبقه"), "followed_by": ("P156", "تلاه"), "sources": ("P1343", "مذكور في"),
}


ED_CACHE = ROOT / ".cache/scraper/entity_defs_entitydata.json"  # ذاكرة مؤقتة، لا تُلتزم
_ed = json.loads(ED_CACHE.read_text(encoding="utf-8")) if ED_CACHE.exists() else {}
KEEP = {"P571", "P576", "P1549", *[p for p, _ in DIMS.values()]}


def _val(dv):
    t, x = dv.get("type"), dv.get("value")
    if t == "wikibase-entityid":
        return x.get("id")
    if t == "time":
        return x.get("time")
    if t == "monolingualtext":
        return {"text": x.get("text"), "lang": x.get("language")}
    return None


def entity(q):
    """عنصر ويكي بيانات من Special:EntityData (خدمة الاستعلام تحدّ الطلبات بطلب في الدقيقة). يُخزَّن منه ما يلزم فقط."""
    if q in _ed:
        return _ed[q]
    url = f"https://www.wikidata.org/wiki/Special:EntityData/{q}.json"
    last = None
    for attempt in range(8):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
                ent = next(iter(json.load(r)["entities"].values()))
            break
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(5 + attempt * 10)
    else:
        raise RuntimeError(f"EntityData {q}: {last}")
    claims = {}
    for prop, sts in ent.get("claims", {}).items():
        if prop not in KEEP:
            continue
        pref = [s for s in sts if s.get("rank") == "preferred"]
        for st in (pref or [s for s in sts if s.get("rank") != "deprecated"]):
            dv = st.get("mainsnak", {}).get("datavalue")
            v_ = _val(dv) if dv else None
            if v_ is not None:
                claims.setdefault(prop, []).append(v_)
    slim = {"labels": {k: x["value"] for k, x in ent.get("labels", {}).items() if k in ("ar", "en")},
            "desc": {k: x["value"] for k, x in ent.get("descriptions", {}).items() if k in ("ar", "en")},
            "sw": {k: x["title"] for k, x in ent.get("sitelinks", {}).items() if k in ("arwiki", "enwiki")},
            "claims": claims}
    _ed[q] = slim
    if len(_ed) % 25 == 0:
        ED_CACHE.write_text(json.dumps(_ed, ensure_ascii=False), encoding="utf-8")
    time.sleep(0.4)
    return slim


def wd_year(t):
    m = re.match(r"^([+-]?)(\d+)-", t or "")
    return (-int(m.group(2)) if m.group(1) == "-" else int(m.group(2))) if m else None


def details(qids):
    out = {}
    for n_, q in enumerate(sorted(qids)):
        e = entity(q)
        r = {"q": q, "ar": e["labels"].get("ar"), "en": e["labels"].get("en"), "d_ar": e["desc"].get("ar"), "d_en": e["desc"].get("en"),
             "arwiki": e["sw"].get("arwiki"), "enwiki": e["sw"].get("enwiki")}
        c = e["claims"]
        r["inc"] = next((y for y in map(wd_year, c.get("P571", [])) if y is not None), None)
        r["dis"] = next((y for y in map(wd_year, c.get("P576", [])) if y is not None), None)
        r["demonym"] = next((x["text"] for x in c.get("P1549", []) if isinstance(x, dict) and x.get("lang") == "ar"), None)
        for k, (prop, _) in DIMS.items():
            lst = []
            for vq in c.get(prop, []):
                if not isinstance(vq, str) or not vq.startswith("Q") or len(lst) >= 6:
                    continue
                lab = entity(vq)["labels"]
                item = {"ar": lab.get("ar"), "en": lab.get("en")}
                if (item["ar"] or item["en"]) and item not in lst:
                    lst.append(item)
            if lst:
                r.setdefault("dims", {})[k] = lst
        out[q] = {k: x for k, x in r.items() if x is not None}
        if n_ % 40 == 0:
            print(f"details {n_}/{len(qids)}", flush=True)
    ED_CACHE.parent.mkdir(parents=True, exist_ok=True)
    ED_CACHE.write_text(json.dumps(_ed, ensure_ascii=False), encoding="utf-8")
    return out


def build():
    hb = json.loads((ROOT / "web/data/names/hb_names.json").read_text(encoding="utf-8"))["names"]
    have = json.loads((ROOT / "web/data/names/entity_info.json").read_text(encoding="utf-8"))["entities"]
    todo = sorted(n for n in hb if n not in have)
    years = {n: [y for y in hb[n].get("years", []) if isinstance(y, int)] for n in todo}
    by_label = candidates_by_label(todo)
    by_q = candidates_by_qid([(n, hb[n]["qid"]) for n in todo if hb[n].get("qid")])
    chosen, notes = {}, {}
    for n in todo:
        cands = list(by_q.get(hb[n].get("qid"), [])) if hb[n].get("qid") else []
        cands += by_label.get(n, [])
        ok = {}
        for c in cands:
            if acceptable(c, years[n]):
                prev = ok.get(c["q"])
                # الصنف الأخص بالكيان: الشعب يُفضَّل للأسماء الجماعية، والكيان السياسي لغيرها
                if not prev or (c["c"] in POLITY and prev["c"] in PEOPLE and not COLLECTIVE.search(n)):
                    ok[c["q"]] = c
        if n in REJECT:
            continue
        if ok:
            # الأولى من يقع أكثر سنوات الخرائط داخل مدته بلا تسامح، ثم الأكثر روابط
            def inside(c):
                lo = c["inc"] if c["inc"] is not None else -10**6
                hi = c["dis"] if c["dis"] is not None else 10**6
                return sum(1 for y in years[n] if lo <= y <= hi) if (c["inc"] is not None or c["dis"] is not None) else 0
            best = sorted(ok.values(), key=lambda c: (-inside(c), -c["links"]))
            chosen[n] = best[0]
            notes[n] = len(best)
    det = details({c["q"] for c in chosen.values()})
    entities, collective = {}, {}
    for n, c in chosen.items():
        d = det.get(c["q"], {})
        if not (d.get("d_ar") or d.get("d_en") or d.get("dims")):
            continue
        entities[n] = {**{k: d[k] for k in ["q", "ar", "d_ar", "d_en", "arwiki", "enwiki", "inc", "dis", "demonym", "dims"] if d.get(k) is not None},
                       "kind": "people" if c["c"] in PEOPLE else "polity", "class": CLASSES[c["c"]],
                       "match": "hb_qid" if c["q"] == hb[n].get("qid") else "label", "candidates": notes[n]}
    # التسميات الجامعة المعرَّفة تحريرياً تتقدم على أي مطابقة بالاسم: «قبائل الطوارق» ليست عنصر «الطوارق» نفسه
    for n in COLL["names"]:
        entities.pop(n, None)
    wd = {k: w for k, w in COLL["wikidata"].items() if not k.startswith("_")}
    wdet = details({w["q"] for w in wd.values() if w.get("q")})
    def ref(label):
        w = wd.get(label)
        if not w:
            return None
        d = wdet.get(w.get("q"), {}) if w.get("q") else {}
        if w.get("expect_en") and d.get("en") != w["expect_en"]:
            print(f"تحذير: {w['q']} تسميته {d.get('en')!r} لا {w['expect_en']!r}، فيُسقط المعرّف", flush=True)
            d = {}
        r = {"ar": w.get("ar") or d.get("ar"), "en": label.split(" (")[0]}
        if d:
            r.update({k: d[k] for k in ["q", "d_ar", "d_en", "arwiki", "enwiki", "dims"] if d.get(k)})
        return {k: x for k, x in r.items() if x}
    for n, c in COLL["names"].items():
        e = {"ar": c.get("ar") or hb.get(n, {}).get("ar"), "modes": c["modes"], "years": years.get(n) or hb.get(n, {}).get("years", [])}
        for k in ["region", "group"]:
            if c.get(k):
                e[k] = ref(c[k])
        for k in ["note_ar", "khaldun_extra", "same_as"]:
            if c.get(k):
                e[k] = c[k]
        collective[n] = e
    unexplained = sorted(n for n in todo if n not in entities and n not in collective and COLLECTIVE.search(n))
    return {
        "_meta": {
            "source": "Wikidata (CC0) عبر SPARQL، بمطابقة صارمة بالاسم والصنف والمدة (انظر رأس scripts/build_entity_defs.py).",
            "note": "الوصف والأبعاد كما في ويكي بيانات للعنصر المطابَق، لا من الأطلس. التسميات الجامعة تُعرَّف بمعنى التسمية وحده.",
            "dims_labels": {k: lab for k, (_, lab) in DIMS.items()},
            "collective_unexplained": unexplained,
            "rejected": REJECT,
            "counts": {"names_without_info": len(todo), "matched": len(entities), "collective": len(collective),
                       "people": sum(1 for e in entities.values() if e["kind"] == "people"),
                       "polity": sum(1 for e in entities.values() if e["kind"] == "polity"),
                       "ambiguous_resolved": sum(1 for e in entities.values() if e["candidates"] > 1)},
        },
        "entities": entities,
        "collective": collective,
        "collective_meta": {k: COLL[k] for k in ["what_ar", "editorial_note_ar", "dims_labels", "modes", "general_khaldun"]},
    }


if __name__ == "__main__":
    data = build()
    if CHECK:
        print(json.dumps(data["_meta"]["counts"], ensure_ascii=False))
        sys.exit(0)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"كُتب {OUT}: {data['_meta']['counts']}")
