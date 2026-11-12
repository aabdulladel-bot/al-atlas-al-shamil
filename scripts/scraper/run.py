# واجهة السكرابر. الاستعمال:
#   python3 -I scripts/scraper/run.py verify-names [--status arabized,no_match,undated] [--limit N] [--out review/names_verification]
#   python3 -I scripts/scraper/run.py sparql FILE.rq        استعلام SPARQL حر، يطبع النتيجة JSON
#   python3 -I scripts/scraper/run.py wiki-qids "Title 1" "Title 2" ...   عناوين ويكيبيديا ← معرّفات ويكي بيانات
import argparse
import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load(name):
    spec = importlib.util.spec_from_file_location(f"scraper_{name}", HERE / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main():
    p = argparse.ArgumentParser(description="سكرابر الأطلس: جمع وتحقق مجمّع من مصادر مفتوحة")
    sub = p.add_subparsers(dest="cmd", required=True)
    v = sub.add_parser("verify-names", help="تحقق جماعي من الأسماء العربية للكيانات")
    v.add_argument("--status", default="arabized,no_match,undated")
    v.add_argument("--limit", type=int, default=0)
    v.add_argument("--out", default=str(HERE.parents[1] / "review" / "names_verification"))
    s = sub.add_parser("sparql", help="استعلام SPARQL من ملف")
    s.add_argument("file")
    w = sub.add_parser("wiki-qids", help="عناوين ويكيبيديا الإنجليزية إلى معرّفات")
    w.add_argument("titles", nargs="+")
    a = p.parse_args()
    wm = load("wikimedia")
    if a.cmd == "verify-names":
        load("verify_names").run(wm, set(a.status.split(",")), a.limit, a.out)
    elif a.cmd == "sparql":
        print(json.dumps(wm.sparql(Path(a.file).read_text(encoding="utf-8")), ensure_ascii=False, indent=1))
    elif a.cmd == "wiki-qids":
        print(json.dumps(wm.wiki_qids(a.titles), ensure_ascii=False, indent=1))
    st = wm.core.stats
    print(f"الطلبات: {st['requests']}، من الذاكرة المؤقتة: {st['cache_hits']}، إعادات: {st['retries']}", file=sys.stderr)


if __name__ == "__main__":
    main()
