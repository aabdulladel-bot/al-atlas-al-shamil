# محولات ويكيبيديا وويكي بيانات: طلبات مجمّعة لا طلب لكل اسم.
# ويكيبيديا: 50 عنواناً في الطلب، مع التحويلات وتوحيد العناوين. ويكي بيانات: SPARQL لمئات المعرّفات في استعلام واحد.
import json


def _core():
    import importlib.util
    from pathlib import Path
    spec = importlib.util.spec_from_file_location("scraper_core", Path(__file__).with_name("core.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


core = _core()
SPARQL = "https://query.wikidata.org/sparql"


def wiki_qids(titles, lang="en"):
    """عنوان مقالة ← {resolved, qid, disambiguation}. العنوان الذي لا مقالة له يعود بـ qid = None."""
    out = {}
    titles = list(dict.fromkeys(t for t in titles if t and "|" not in t))
    for i in range(0, len(titles), 50):
        batch = titles[i:i + 50]
        url = f"https://{lang}.wikipedia.org/w/api.php"
        body = core.fetch(url, data={"action": "query", "format": "json", "redirects": "1", "prop": "pageprops|langlinks",
                                     "ppprop": "wikibase_item|disambiguation", "lllang": "ar", "lllimit": "max",
                                     "titles": "|".join(batch)})
        q = json.loads(body).get("query", {})
        step = {}
        for kind in ("normalized", "redirects"):
            for m in q.get(kind, []):
                step[m["from"]] = m["to"]
        pages = {p["title"]: p for p in q.get("pages", {}).values()}
        for t in batch:
            final = t
            for _ in range(3):
                final = step.get(final, final)
            p = pages.get(final, {})
            pp = p.get("pageprops", {})
            ar = [l.get("*") or l.get("title") for l in p.get("langlinks", []) if l.get("lang") == "ar"]
            out[t] = {"resolved": final, "redirected": final != t, "qid": pp.get("wikibase_item"),
                      "disambiguation": "disambiguation" in pp, "ar_title": ar[0] if ar else None}
    return out


def wiki_search(names, lang="en", per_name=3):
    """بحث ويكيبيديا النصي لما لا مقالة له بعنوانه: اقتراحات للمراجعة فقط، لا مطابقة مؤكدة."""
    out = {}
    for n in names:
        body = core.fetch(f"https://{lang}.wikipedia.org/w/api.php",
                          data={"action": "query", "format": "json", "list": "search", "srsearch": n,
                                "srlimit": str(per_name), "srprop": ""})
        out[n] = [h["title"] for h in json.loads(body).get("query", {}).get("search", [])]
    return out


def sparql(query):
    body = core.fetch(SPARQL, data={"query": query}, headers={"Accept": "application/sparql-results+json"})
    return json.loads(body)["results"]["bindings"]


def _year(v):
    # +0618-01-01T00:00:00Z أو -0500-...: السنة بإشارتها
    if not v:
        return None
    s = v.lstrip("+")
    neg = s.startswith("-")
    try:
        y = int(s.lstrip("-").split("-")[0])
    except ValueError:
        return None
    return -y if neg else y


def entity_facts(qids):
    """لكل معرّف: الاسم الإنجليزي والعربي، وعنوان المقالة العربية، والأنواع (P31)، والنشأة والزوال."""
    facts = {}
    qids = list(dict.fromkeys(q for q in qids if q))
    for i in range(0, len(qids), 120):
        batch = qids[i:i + 120]
        q = """SELECT ?item ?en ?ar ?arwiki ?inc ?dis ?start ?end ?type ?typeLabel WHERE {
  VALUES ?item { %s }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?ar FILTER(LANG(?ar) = "ar") }
  OPTIONAL { ?a schema:about ?item; schema:isPartOf <https://ar.wikipedia.org/>; schema:name ?arwiki }
  OPTIONAL { ?item wdt:P571 ?inc } OPTIONAL { ?item wdt:P576 ?dis }
  OPTIONAL { ?item wdt:P580 ?start } OPTIONAL { ?item wdt:P582 ?end }
  OPTIONAL { ?item wdt:P31 ?type . ?type rdfs:label ?typeLabel FILTER(LANG(?typeLabel) = "en") }
}""" % " ".join(f"wd:{x}" for x in batch)
        for b in sparql(q):
            qid = b["item"]["value"].rsplit("/", 1)[-1]
            f = facts.setdefault(qid, {"qid": qid, "en": None, "ar": None, "arwiki": None, "from": None, "to": None, "types": {}})
            for k, src in (("en", "en"), ("ar", "ar"), ("arwiki", "arwiki")):
                if src in b and not f[k]:
                    f[k] = b[src]["value"]
            for k, srcs, pick in (("from", ("inc", "start"), min), ("to", ("dis", "end"), max)):
                ys = [_year(b[s]["value"]) for s in srcs if s in b]
                ys = [y for y in ys if y is not None]
                if ys:
                    f[k] = pick([y for y in (f[k], *ys) if y is not None])
            if "type" in b:
                f["types"][b["type"]["value"].rsplit("/", 1)[-1]] = b.get("typeLabel", {}).get("value", "")
    return facts


def label_candidates(names, per_name=5):
    """بحث بالاسم الإنجليزي المطابق تماماً (الاسم أو الاسم البديل) لما لا مقالة له بعنوانه."""
    out = {n: [] for n in names}
    names = [n for n in names if '"' not in n and "\\" not in n]
    for i in range(0, len(names), 40):
        batch = names[i:i + 40]
        values = " ".join(json.dumps(n) + "@en" for n in batch)
        q = """SELECT DISTINCT ?label ?item WHERE {
  VALUES ?label { %s }
  { ?item rdfs:label ?label } UNION { ?item skos:altLabel ?label }
} LIMIT 2000""" % values
        for b in sparql(q):
            lab = b["label"]["value"]
            qid = b["item"]["value"].rsplit("/", 1)[-1]
            if lab in out and qid not in out[lab] and len(out[lab]) < per_name:
                out[lab].append(qid)
    return out
