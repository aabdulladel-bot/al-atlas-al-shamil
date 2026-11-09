# مستخلص ويكي بيانات لأسماء Historical Basemaps بعد تصحيح الهوية.
# يقرأ data/raw/wikidata/hb_titles.json، ويستبدل بما في scripts/config/hb_qid_overrides.json بيانات الكيان الصحيح
# من data/raw/wikidata/hb_entities.json. يستعمله build_names.py وbuild_spatial_links.py وbuild_entity_info.py،
# فتسري التصحيحات على الأسماء العربية والتصنيف (دولة أو شعب) والبطاقة التعريفية معاً.
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TITLES = ROOT / "data/raw/wikidata/hb_titles.json"
OVERRIDES = ROOT / "scripts/config/hb_qid_overrides.json"
ENTITIES = ROOT / "data/raw/wikidata/hb_entities.json"


def load_entities():
    if not ENTITIES.exists():
        return {"entities": {}, "type_labels": {}}
    return json.loads(ENTITIES.read_text(encoding="utf-8"))


def load_overrides():
    return json.loads(OVERRIDES.read_text(encoding="utf-8"))["overrides"] if OVERRIDES.exists() else {}


def load_titles():
    titles = json.loads(TITLES.read_text(encoding="utf-8"))["titles"]
    entities = load_entities()["entities"]
    for name, o in load_overrides().items():
        e = entities.get(o["qid"])
        if e is None:
            raise SystemExit(f"تصحيح الهوية لـ {name} ({o['qid']}) بلا بيانات: شغّل python3 -I scripts/fetch_wikidata_entities.py")
        titles[name] = {"qid": o["qid"], "ar": e["ar"], "arwiki": e["arwiki"], "en": e["en"], "p31": e["p31"],
                        "inception": e["inception"], "dissolved": e["dissolved"], "identity_override": o["why"]}
    return titles
