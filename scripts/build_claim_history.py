# يبني web/data/claim_history.json: لكل ادعاء، أول commit أضافه (وتاريخه) وآخر commit عدّله، من تاريخ Git نفسه.
# لا يحوي الملف مراجعين ولا قرارات مراجعة، لأن المشروع لا يسجّلها بعد؛ ويُقال ذلك صراحة في _meta.
# الاستعمال: python3 -I scripts/build_claim_history.py [--check]
import glob
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web/data/claim_history.json"
CHECK = "--check" in sys.argv


def git(*args):
    return subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, text=True, check=True).stdout


def claim_ids():
    ids = []
    for f in sorted(glob.glob(str(ROOT / "verification/era*/claims.json"))):
        ids += [c["id"] for c in json.loads(Path(f).read_text(encoding="utf-8"))]
    return ids


def history(cid):
    out = git("log", "-S", cid, "--format=%h|%as|%s", "--", "verification/").strip().splitlines()
    if not out:
        return None
    parse = lambda line: dict(zip(["commit", "date", "subject"], line.split("|", 2)))
    return {"added": parse(out[-1]), "last": parse(out[0]), "changes": len(out)}


def build():
    hist = {}
    for cid in claim_ids():
        h = history(cid)
        if h:
            hist[cid] = h
    return {
        "_meta": {
            "source": "تاريخ Git لملفات verification/era*/claims.json (git log -S)",
            "note": "أول commit أضاف الادعاء، وآخر commit عدّله، وعدد التعديلات. لا يوجد سجل لمن راجع الادعاء أو قراره؛ هذا ما لا يُسجَّل بعد.",
        },
        "claims": hist,
    }


if __name__ == "__main__":
    data = build()
    text = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
    if CHECK:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
            print("claim_history.json لا يطابق تاريخ Git", file=sys.stderr); sys.exit(1)
        print(f"سجل الادعاءات: مطابق ({len(data['claims'])} ادعاء)")
        sys.exit(0)
    OUT.write_text(text, encoding="utf-8")
    print(f"كُتب {OUT}: {len(data['claims'])} ادعاء")
