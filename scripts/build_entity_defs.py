# يبني web/data/names/entity_defs.json: تعريفات لأسماء الخرائط التي لا تعريف لها في entity_info.json.
# المصدر ويكي بيانات (CC0)، بمطابقة صارمة:
#   - الاسم الإنجليزي في المصدر يطابق اسم العنصر أو أحد أسمائه البديلة حرفياً، أو معرّفه المسجّل في hb_names.json.
#   - العنصر من صنف شعب أو قبيلة أو ثقافة أثرية، أو من صنف كيان سياسي (بلد، دولة تاريخية، إمبراطورية، مملكة،
#     سلطنة، خلافة، خانية، اتحاد، مشيخة، دولة مدينة، إمارة).
#   - التعريف يُختار لكل سنة من سنوات الخريطة على حدة: الكيان السياسي لا يُقبل لسنة إلا إذا وقعت في مدته (بتسامح TOL)،
#     والكيان السياسي بلا تواريخ لا يُقبل بالاسم وحده. فالاسم الواحد قد يأخذ عنصراً مختلفاً في كل خريطة
#     (Albania: إمارة 1914، وجمهورية 2010)، أو لا يأخذ شيئاً في سنة لا يغطيها عنصر.
#   - إن بقي لسنة أكثر من مرشح، يُقدَّم ذو التواريخ على غيره، ثم الأكثر روابط ويكيبيديا، ويُسجَّل عدد المرشحين.
# الأبعاد (النوع، والحكم، والعاصمة، واللغة، والدين، والعملة، والسلف والخلف، والمصادر) من خصائص العنصر نفسه.
# التسميات الجامعة (قبائل، رحّل، صيادون جامعون…) تُعرَّف من scripts/config/collective_names.json: نمط العيش وأبعاده (نص تحريري معلن)،
# والإقليم والجماعة بمعرّفات ويكي بيانات مثبّتة، ونص ابن خلدون المطابَق (scripts/check_collective_names.mjs).
#
# اللقطة: كل ما يُجلب من ويكي بيانات يُحفظ في data/raw/wikidata/entity_defs_extract.json (CC0، مسجّل في المانيفست)،
# فيُبنى الملف بلا شبكة ونتائجه ثابتة. الشبكة لا تُستعمل إلا لما ينقص اللقطة، أو للتحديث الصريح بـ --refresh.
# الاستعلام عبر QLever (qlever.dev، نسخة عامة من ويكي بيانات قد تتأخر أسابيع) أولاً، ثم خدمة ويكي بيانات الرسمية احتياطاً.
# وتفاصيل العناصر من Special:EntityData.
#
# الاستعمال: python3 -I scripts/build_entity_defs.py [--check | --refresh]
#   --check: يبني من اللقطة وحدها ويقارن بالملف المنشور (بلا شبكة). --refresh: يعيد جلب كل شيء ويكتب لقطة جديدة.
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web/data/names/entity_defs.json"
SNAP = ROOT / "data/raw/wikidata/entity_defs_extract.json"
UA = "al-atlas-cards/1.0 (project maintainer; https://github.com/aabdulladel-bot/al-atlas-al-shamil)"
CHECK = "--check" in sys.argv
REFRESH = "--refresh" in sys.argv
ENDPOINTS = [("QLever", "https://qlever.dev/api/wikidata"), ("WDQS", "https://query.wikidata.org/sparql")]
PREFIXES = ("PREFIX wd: <http://www.wikidata.org/entity/> PREFIX wdt: <http://www.wikidata.org/prop/direct/> "
            "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX skos: <http://www.w3.org/2004/02/skos/core#> "
            "PREFIX schema: <http://schema.org/> ")
PEOPLE = {"Q41710": "جماعة عرقية", "Q4204501": "جماعة عرقية تاريخية", "Q2472587": "شعب", "Q133311": "قبيلة", "Q465299": "ثقافة أثرية"}
POLITY = {"Q3024240": "دولة تاريخية", "Q48349": "إمبراطورية", "Q417175": "مملكة", "Q12759805": "سلطنة", "Q131401": "خلافة",
          "Q331644": "خانية", "Q170156": "اتحاد", "Q1642488": "مشيخة", "Q133442": "دولة مدينة", "Q208500": "إمارة", "Q6256": "بلد"}
CLASSES = {**PEOPLE, **POLITY}
GENERIC = {"Q6256"}  # الصنف الأعم: يُستعمل وسماً حين لا صنف أخص
COLL = json.loads((ROOT / "scripts/config/collective_names.json").read_text(encoding="utf-8"))
OVR = json.loads((ROOT / "scripts/config/entity_defs_overrides.json").read_text(encoding="utf-8"))
REJECT, PREFER = OVR["reject_items"], OVR["prefer_items"]
TOL = 10  # سنوات تسامح حول مدة الكيان، لأن سنة الخريطة لقطة تقريبية
COLLECTIVE = re.compile(r"\b(tribes|nomads|nomadic|hunter-gatherers|gatherers|pastoral|pastoralists|peoples|farmers|herders|chiefdoms|clans|villages|cultures|bands|foragers|fishermen)\b", re.I)
DIMS = {
    "type": ("P31", "النوع"), "gov": ("P122", "شكل الحكم"), "capital": ("P36", "العاصمة"),
    "lang": ("P37", "اللغة الرسمية"), "lang_used": ("P2936", "اللغات المستعملة"), "religion": ("P140", "الدين"),
    "currency": ("P38", "العملة"), "replaces": ("P1365", "حلّ محل"), "replaced_by": ("P1366", "حلّ محله"),
    "follows": ("P155", "سبقه"), "followed_by": ("P156", "تلاه"), "sources": ("P1343", "مذكور في"),
}
KEEP = {"P571", "P576", "P1549", *[p for p, _ in DIMS.values()]}
CLS = " ".join(f"wd:{c}" for c in CLASSES)

snap = {} if REFRESH or not SNAP.exists() else json.loads(SNAP.read_text(encoding="utf-8"))
for k in ("label_candidates", "qid_candidates", "items"):
    snap.setdefault(k, {})
used_endpoints = set()
fetched = {"sparql": 0, "items": 0}


def need_network(what):
    if CHECK:
        sys.exit(f"اللقطة ناقصة ({what})، و--check لا يستعمل الشبكة. شغّل البناء بلا --check ليكملها.")


def sparql(q):
    last = None
    for name, url in ENDPOINTS:
        for attempt in range(3):
            try:
                if name == "QLever":
                    req = urllib.request.Request(url, data=urllib.parse.urlencode({"query": PREFIXES + q}).encode(),
                                                 headers={"User-Agent": UA, "Accept": "application/sparql-results+json",
                                                          "Content-Type": "application/x-www-form-urlencoded"})
                else:
                    req = urllib.request.Request(url + "?" + urllib.parse.urlencode({"query": q}),
                                                 headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
                with urllib.request.urlopen(req, timeout=180) as r:
                    rows = json.load(r)["results"]["bindings"]
                used_endpoints.add(name)
                fetched["sparql"] += 1
                time.sleep(0.5 if name == "QLever" else 61)
                return rows
            except Exception as e:  # noqa: BLE001
                last = f"{name}: {e}"
                time.sleep(5 + attempt * 10 if name == "QLever" else 65)
    raise RuntimeError(f"SPARQL: {last}")


def v(b, k):
    return b.get(k, {}).get("value")


def qid(uri):
    return uri.rsplit("/", 1)[-1] if uri else None


def year(s):
    m = re.match(r"^(-?\d+)-", s or "")
    return int(m.group(1)) if m else None


def cand(b):
    return {"q": qid(v(b, "item")), "c": qid(v(b, "c")), "inc": year(v(b, "inc")), "dis": year(v(b, "dis")), "links": int(v(b, "links") or 0)}


def candidates_by_label(names):
    missing = [n for n in names if n not in snap["label_candidates"]]
    if missing:
        need_network(f"مرشحو {len(missing)} اسماً")
    for i in range(0, len(missing), 35):
        batch = missing[i:i + 35]
        vals = " ".join(json.dumps(n) + "@en" for n in batch)
        q = (f"SELECT ?l ?item ?c ?inc ?dis (COUNT(DISTINCT ?sl) AS ?links) WHERE {{ VALUES ?l {{ {vals} }} "
             f"?item rdfs:label|skos:altLabel ?l . ?item wdt:P31/wdt:P279* ?c . VALUES ?c {{ {CLS} }} "
             f"OPTIONAL {{ ?item wdt:P571 ?inc }} OPTIONAL {{ ?item wdt:P576 ?dis }} OPTIONAL {{ ?sl schema:about ?item }} }} "
             f"GROUP BY ?l ?item ?c ?inc ?dis")
        got = {n: [] for n in batch}
        for b in sparql(q):
            if v(b, "l") in got:
                got[v(b, "l")].append(cand(b))
        snap["label_candidates"].update(got)
        print(f"مرشحون بالاسم {i + len(batch)}/{len(missing)}", flush=True)
    return {n: snap["label_candidates"][n] for n in names}


def candidates_by_qid(qs):
    missing = sorted({q for q in qs if q not in snap["qid_candidates"]})
    if missing:
        need_network(f"مرشحو {len(missing)} معرّفاً")
    for i in range(0, len(missing), 60):
        batch = missing[i:i + 60]
        vals = " ".join(f"wd:{q}" for q in batch)
        q = (f"SELECT ?item ?c ?inc ?dis (COUNT(DISTINCT ?sl) AS ?links) WHERE {{ VALUES ?item {{ {vals} }} "
             f"?item wdt:P31/wdt:P279* ?c . VALUES ?c {{ {CLS} }} OPTIONAL {{ ?item wdt:P571 ?inc }} OPTIONAL {{ ?item wdt:P576 ?dis }} "
             f"OPTIONAL {{ ?sl schema:about ?item }} }} GROUP BY ?item ?c ?inc ?dis")
        got = {q_: [] for q_ in batch}
        for b in sparql(q):
            got.setdefault(qid(v(b, "item")), []).append(cand(b))
        snap["qid_candidates"].update(got)
    return {q: snap["qid_candidates"][q] for q in qs}


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
    """عنصر ويكي بيانات من اللقطة، وإلا من Special:EntityData. يُحفظ منه ما يلزم فقط."""
    if q in snap["items"]:
        return snap["items"][q]
    need_network(f"العنصر {q}")
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
    snap["items"][q] = slim
    fetched["items"] += 1
    time.sleep(0.4)
    return slim


def wd_year(t):
    m = re.match(r"^([+-]?)(\d+)-", t or "")
    return (-int(m.group(2)) if m.group(1) == "-" else int(m.group(2))) if m else None


def details(q, used):
    e = entity(q)
    used.add(q)
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
            used.add(vq)
            item = {"ar": lab.get("ar"), "en": lab.get("en")}
            if (item["ar"] or item["en"]) and item not in lst:
                lst.append(item)
        if lst:
            r.setdefault("dims", {})[k] = lst
    return {k: x for k, x in r.items() if x is not None}


def covers(c, y):
    if c["inc"] is None and c["dis"] is None:
        return c["c"] in PEOPLE  # الشعب بلا تواريخ يصدق على كل سنة، والكيان السياسي بلا تواريخ لا يُقبل بالاسم وحده
    lo = c["inc"] if c["inc"] is not None else -10**6
    hi = c["dis"] if c["dis"] is not None else 10**6
    return lo - TOL <= y <= hi + TOL


def merge_classes(cands, collective_name):
    """صف لكل عنصر: الصنف الأخص (الكيان السياسي للأسماء غير الجامعة، والأخص من «بلد»)، وأول تاريخ."""
    out = {}
    for c in cands:
        p = out.get(c["q"])
        if not p:
            out[c["q"]] = dict(c)
            continue
        better = (c["c"] in POLITY and p["c"] in PEOPLE and not collective_name) or (p["c"] in GENERIC and c["c"] in POLITY and c["c"] not in GENERIC)
        if better:
            p["c"] = c["c"]
        for k in ("inc", "dis"):
            if p[k] is None and c[k] is not None:
                p[k] = c[k]
        p["links"] = max(p["links"], c["links"])
    return out


def build():
    hb = json.loads((ROOT / "web/data/names/hb_names.json").read_text(encoding="utf-8"))["names"]
    have = json.loads((ROOT / "web/data/names/entity_info.json").read_text(encoding="utf-8"))["entities"]
    todo = sorted(n for n in hb if n not in have)
    years = {n: sorted({y for y in hb[n].get("years", []) if isinstance(y, int)}) for n in todo}
    by_label = candidates_by_label(todo)
    by_q = candidates_by_qid([hb[n]["qid"] for n in todo if hb[n].get("qid")])
    used, items, entities, collective = set(), {}, {}, {}
    for n in todo:
        if n in COLL["names"]:
            continue  # التسمية الجامعة تتقدم على أي مطابقة بالاسم: «قبائل الطوارق» ليست عنصر «الطوارق» نفسه
        cands = merge_classes((by_q.get(hb[n].get("qid"), []) if hb[n].get("qid") else []) + by_label.get(n, []), bool(COLLECTIVE.search(n)))
        for q_ in REJECT.get(n, {}):
            cands.pop(q_, None)
        per_year = {}
        for y in years[n]:
            pool = [c for c in cands.values() if covers(c, y)]
            if not pool:
                per_year[str(y)] = None
                continue
            pool.sort(key=lambda c: (c["q"] not in PREFER.get(n, {}), c["inc"] is None and c["dis"] is None, -c["links"], c["q"]))
            best = pool[0]
            if best["q"] not in items:
                d = details(best["q"], used)
                if not (d.get("d_ar") or d.get("d_en") or d.get("dims")):
                    per_year[str(y)] = None
                    continue
                items[best["q"]] = {**d, "kind": "people" if best["c"] in PEOPLE else "polity", "class": CLASSES[best["c"]]}
            per_year[str(y)] = {"q": best["q"], "n": len(pool), "match": "prefer" if best["q"] in PREFER.get(n, {}) else "hb_qid" if best["q"] == hb[n].get("qid") else "label"}
        if any(per_year.values()):
            entities[n] = {"by_year": per_year}
    wd = {k: w for k, w in COLL["wikidata"].items() if not k.startswith("_")}

    def ref(label):
        w = wd.get(label)
        if not w:
            return None
        d = details(w["q"], used) if w.get("q") else {}
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
    slots = [s for e in entities.values() for s in e["by_year"].values()]
    data = {
        "_meta": {
            "source": "Wikidata (CC0) من اللقطة data/raw/wikidata/entity_defs_extract.json، بمطابقة صارمة بالاسم والصنف والمدة لكل سنة (انظر رأس scripts/build_entity_defs.py).",
            "note": "الوصف والأبعاد كما في ويكي بيانات للعنصر المطابَق، لا من الأطلس. التعريف يُختار لكل سنة خريطة على حدة. التسميات الجامعة تُعرَّف تحريرياً.",
            "tolerance_years": TOL,
            "dims_labels": {k: lab for k, (_, lab) in DIMS.items()},
            "collective_unexplained": unexplained,
            "overrides": {"reject_items": REJECT, "prefer_items": PREFER},
            "counts": {"names_without_info": len(todo), "names_defined": len(entities), "collective": len(collective),
                       "map_years_defined": sum(1 for s in slots if s), "map_years_undefined": sum(1 for s in slots if not s),
                       "names_with_several_items": sum(1 for e in entities.values() if len({s["q"] for s in e["by_year"].values() if s}) > 1),
                       "ambiguous_years": sum(1 for s in slots if s and s["n"] > 1), "items": len(items)},
        },
        "items": items,
        "entities": entities,
        "collective": collective,
        "collective_meta": {k: COLL[k] for k in ["what_ar", "editorial_note_ar", "dims_labels", "modes", "general_khaldun"]},
    }
    return data, used


def write_snapshot(used):
    out = {
        "_meta": {
            "source": "Wikidata (CC0): مرشحو الأسماء من SPARQL، وتفاصيل العناصر من Special:EntityData. يُبنى بـ scripts/build_entity_defs.py.",
            "license": "CC0 1.0: All data in Wikidata has a CC0 license.",
            "endpoints": sorted(set(snap.get("_meta", {}).get("endpoints", [])) | used_endpoints),
            "updated": snap.get("_meta", {}).get("updated") if not (fetched["sparql"] or fetched["items"]) else date.today().isoformat(),
            "classes": CLASSES,
        },
        "label_candidates": dict(sorted(snap["label_candidates"].items())),
        "qid_candidates": dict(sorted(snap["qid_candidates"].items())),
        "items": {q: snap["items"][q] for q in sorted(used)},
    }
    SNAP.parent.mkdir(parents=True, exist_ok=True)
    SNAP.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":"), sort_keys=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    data, used = build()
    text = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
    if CHECK:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
            sys.exit("entity_defs.json لا يطابق مولّده من اللقطة: شغّل python3 -I scripts/build_entity_defs.py")
        print(f"التعريفات: مطابقة {data['_meta']['counts']}")
        sys.exit(0)
    write_snapshot(used)
    OUT.write_text(text, encoding="utf-8")
    print(f"كُتب {OUT}: {data['_meta']['counts']} | جُلب: {fetched} عبر {sorted(used_endpoints) or 'اللقطة وحدها'}")
