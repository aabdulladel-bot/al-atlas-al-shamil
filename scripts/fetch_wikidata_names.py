# يجلب من ويكي بيانات (CC0) التسميات العربية للكيانات التاريخية في Historical Basemaps، بعناوين مقالاتها في ويكيبيديا الإنجليزية.
# يكتب مستخلصاً في data/raw/wikidata/hb_titles.json: لكل اسم في المصدر معرّفه وتسميتاه العربية والإنجليزية،
# ونوعه (P31) وتاريخا نشأته وزواله (P571/P576)، وعنوان المقالة العربية إن وُجدت. ولا يحفظ بقية البيانات.
# الأولوية: الكيانات التي تغطي 90% من الأرض المسمّاة في كل خريطة، وكل كيان مساحته 100 ألف كم² فأكثر.
# الاستعمال: python3 -I scripts/fetch_wikidata_names.py   (بعد build_stack؛ يستعمل curl عبر وكيل البيئة)
# الطلبات قليلة (50 عنواناً في الطلب)، ومتمهّلة، وتحترم Retry-After عند 429.
import json
import subprocess
import sys
import tempfile
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data/raw/wikidata/hb_titles.json"
KEYS = ["-4000", "-1000", "-1", "700", "1200", "1600", "1800", "1914", "1945", "2010"]
UA = "AlAtlasAlShamil/0.1 (https://github.com/aabdulladel-bot/al-atlas-al-shamil; non-commercial research)"
API = "https://www.wikidata.org/w/api.php"
BATCH = 50


def priority_names():
    names = {}
    for k in KEYS:
        ents = sorted(json.loads((ROOT / f"web/data/stack/slice_{k}.json").read_text(encoding="utf-8"))["entities"], key=lambda e: -e["a"])
        total = sum(e["a"] for e in ents)
        cum = 0
        for e in ents:
            if cum < 0.9 * total or e["a"] >= 100000:
                names.setdefault(e["n"], set()).add(k)
            cum += e["a"]
    return {n: sorted(ys, key=KEYS.index) for n, ys in sorted(names.items())}


def get(params):
    # الترويسات والجسم في ملفين منفصلين، ورمز الحالة النهائي من curl نفسه (لا من ترويسة الوكيل)
    url = API + "?" + urllib.parse.urlencode(params)
    with tempfile.TemporaryDirectory() as d:
        body_f, head_f = Path(d) / "body", Path(d) / "head"
        for attempt in range(10):
            r = subprocess.run(["curl", "-sS", "-m", "180", "-A", UA, "-o", str(body_f), "-D", str(head_f), "-w", "%{http_code}", url], capture_output=True, text=True)
            status = r.stdout.strip() or "000"
            if status == "200":
                return json.loads(body_f.read_text(encoding="utf-8"))
            wait = 60 * (attempt + 1)
            for line in (head_f.read_text(errors="replace") if head_f.exists() else "").splitlines():
                if line.lower().startswith("retry-after:"):
                    try:
                        wait = max(wait, int(line.split(":", 1)[1].strip()))
                    except ValueError:
                        pass
            print(f"HTTP {status} {r.stderr.strip()[:120]}، انتظار {wait} ث (محاولة {attempt + 1})", file=sys.stderr, flush=True)
            time.sleep(wait)
    raise SystemExit("تعذّر الجلب بعد عشر محاولات")


def times(claims, prop):
    out = []
    for c in claims.get(prop, []):
        v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
        if isinstance(v, dict) and "time" in v:
            out.append(v["time"])
    return out


def main():
    names = priority_names()
    prev = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {"titles": {}}
    todo = [n for n in names if n not in prev["titles"]]
    print(f"أسماء ذات أولوية: {len(names)}، المطلوب جلبه: {len(todo)}", file=sys.stderr)
    titles = prev["titles"]
    for i in range(0, len(todo), BATCH):
        batch = todo[i:i + BATCH]
        data = get({"action": "wbgetentities", "sites": "enwiki", "titles": "|".join(batch), "props": "labels|claims|sitelinks",
                    "languages": "ar|en", "sitefilter": "enwiki|arwiki", "redirects": "yes", "format": "json"})
        # المطابقة بعنوان المقالة الإنجليزية حرفياً (بعد تكبير الحرف الأول كما تفعل ويكيبيديا).
        # العنوان الذي يُوجَّه إلى مقالة أخرى لا يُطابَق، فيبقى الاسم إنجليزياً بدل تخمين المقصود.
        cap = lambda t: t[:1].upper() + t[1:] if t else t
        by_title = {}
        for qid, ent in data.get("entities", {}).items():
            if "missing" in ent:
                continue
            t = ent.get("sitelinks", {}).get("enwiki", {}).get("title")
            claims = ent.get("claims", {})
            by_title[t] = {
                "qid": qid,
                "ar": ent.get("labels", {}).get("ar", {}).get("value"),
                "en": ent.get("labels", {}).get("en", {}).get("value"),
                "arwiki": ent.get("sitelinks", {}).get("arwiki", {}).get("title"),
                "p31": [c["mainsnak"]["datavalue"]["value"]["id"] for c in claims.get("P31", []) if c.get("mainsnak", {}).get("datavalue")],
                "inception": times(claims, "P571"),
                "dissolved": times(claims, "P576"),
            }
        for n in batch:
            titles[n] = by_title.get(cap(n.replace("_", " ")))
        prev.update({
            "_meta": {
                "source": "Wikidata (CC0)، wbgetentities بعناوين ويكيبيديا الإنجليزية",
                "license": "CC0 1.0",
                "retrieved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "fields": "qid، التسمية العربية والإنجليزية، عنوان المقالة العربية، P31، P571 (النشأة)، P576 (الزوال)",
                "priority_rule": "الكيانات التي تغطي 90% من الأرض المسمّاة في كل خريطة، وكل كيان مساحته 100 ألف كم² فأكثر",
            },
            "years": names,
            "titles": titles,
        })
        OUT.write_text(json.dumps(prev, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
        found = sum(1 for n in batch if titles.get(n))
        print(f"دفعة {i // BATCH + 1}: {found} من {len(batch)} لها مقالة", file=sys.stderr, flush=True)
        time.sleep(8)
    done = sum(1 for n in names if titles.get(n))
    print(f"انتهى: {done} من {len(names)} اسماً له كيان في ويكي بيانات")


if __name__ == "__main__":
    main()
