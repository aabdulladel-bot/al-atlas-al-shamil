// يبني web/data/crises.json: الأوبئة والمجاعات الموثّقة في ويكي بيانات (CC0) قبل 1950، من اللقطة data/raw/wikidata/crises_qlever_raw.json.
// لا شبكة هنا: البناء من اللقطة وحدها، فيكون ناتجه ثابتاً ويُفحص بـ --check.
// الحدث الذي لا إحداثيات له لا يُرسم، ويُعدّ في _meta.without_coordinates ويُذكر في الواجهة كفجوة معلنة، لا يُقدَّر له موقع.
// إحداثيات العنصر نفسه (P625) تُعدّ «موقع الحدث»، وإلا فإحداثيات مكانه (P276) وتُسمّى «موقع المكان التقريبي».
// الاستعمال: node scripts/build_crises.mjs [--check]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(ROOT, "data/raw/wikidata/crises_qlever_raw.json");
const OUT = path.join(ROOT, "web/data/crises.json");
const CHECK = process.argv.includes("--check");
const CUTOFF = 1950;

const raw = JSON.parse(fs.readFileSync(RAW, "utf8"));
const v = (b, k) => b[k]?.value;
const qid = (uri) => uri?.split("/").pop();
const year = (t) => {
  const m = /^(-?)(\d+)-/.exec(t ?? "");
  return m ? (m[1] ? -Number(m[2]) : Number(m[2])) : null;
};
const point = (wkt) => {
  const m = /POINT\(([-\d.]+) ([-\d.]+)\)/.exec(wkt ?? "");
  return m ? [Number(m[1]), Number(m[2])] : null;
};

const items = new Map(); // معرّف العنصر -> سجل مجمّع (تتكرر العناصر بسبب الصفوف المتعددة من المواقع والروابط)
for (const kind of ["epidemic", "famine"]) {
  for (const b of raw[kind]) {
    const id = qid(v(b, "item"));
    const key = `${kind}:${id}`;
    const y = year(v(b, "s") ?? v(b, "pt"));
    const own = point(v(b, "c0"));
    const place = point(v(b, "c1"));
    let r = items.get(key);
    if (!r) {
      r = { id, kind, year: y, ar: v(b, "ar") ?? null, en: v(b, "en") ?? null, den: v(b, "den") ?? null, dar: v(b, "dar") ?? null,
        arwiki: v(b, "arwiki") ?? null, enwiki: v(b, "enwiki") ?? null, own: null, place: null, places: new Set() };
      items.set(key, r);
    }
    if (r.year === null && y !== null) r.year = y;
    if (!r.ar && v(b, "ar")) r.ar = v(b, "ar");
    if (!r.en && v(b, "en")) r.en = v(b, "en");
    if (!r.arwiki && v(b, "arwiki")) r.arwiki = v(b, "arwiki");
    if (!r.enwiki && v(b, "enwiki")) r.enwiki = v(b, "enwiki");
    if (!r.own && own) r.own = own;
    if (!r.place && place) r.place = { coords: place, en: v(b, "locen") ?? null, ar: v(b, "locar") ?? null };
    if (v(b, "locen") || v(b, "locar")) r.places.add(v(b, "locen") ?? v(b, "locar"));
  }
}

const features = [];
let before = 0, noCoords = 0, noYear = 0;
for (const r of items.values()) {
  if (r.year === null) { noYear++; continue; }
  if (r.year >= CUTOFF) continue;
  before++;
  const c = r.own ?? r.place?.coords ?? null;
  if (!c) { noCoords++; continue; }
  features.push({
    type: "Feature",
    properties: {
      id: r.id, kind: r.kind, year: r.year,
      name_ar: r.ar, name_en: r.en,
      desc_en: r.den, desc_ar: r.dar,
      arwiki: r.arwiki, enwiki: r.enwiki,
      precision: r.own ? "event" : "place",
      place_ar: r.place?.ar ?? null, place_en: r.place?.en ?? null,
    },
    geometry: { type: "Point", coordinates: [Number(c[0].toFixed(4)), Number(c[1].toFixed(4))] },
  });
}
features.sort((a, b) => a.properties.year - b.properties.year || String(a.properties.name_en).localeCompare(String(b.properties.name_en)));

const out = {
  _meta: {
    source: "Wikidata (CC0)، اللقطة data/raw/wikidata/crises_qlever_raw.json، عبر scripts/build_crises.mjs",
    note: "الأوبئة والمجاعات الموثّقة قبل 1950 التي لها إحداثيات. precision=event: إحداثيات الحدث نفسه في ويكي بيانات. precision=place: إحداثيات المكان الذي وقع فيه الحدث، وهي تقريبية. لا تقدير لموقع حدث بلا إحداثيات.",
    cutoff_year: CUTOFF,
    counts: {
      items_before_cutoff: before,
      with_coordinates: features.length,
      without_coordinates: noCoords,
      without_year: noYear,
      by_kind: { epidemic: features.filter((f) => f.properties.kind === "epidemic").length, famine: features.filter((f) => f.properties.kind === "famine").length },
      with_arabic_name: features.filter((f) => f.properties.name_ar).length,
    },
  },
  type: "FeatureCollection",
  features,
};
const text = JSON.stringify(out, null, 1) + "\n";
if (CHECK) {
  if (!fs.existsSync(OUT) || fs.readFileSync(OUT, "utf8") !== text) { console.error("web/data/crises.json لا يطابق مولّده من اللقطة: شغّل node scripts/build_crises.mjs"); process.exit(1); }
  console.log(`الأوبئة والمجاعات: مطابقة (${features.length} حدثاً بإحداثيات، ${noCoords} بلا إحداثيات)`);
} else {
  fs.writeFileSync(OUT, text);
  console.log(`كُتب ${OUT}: ${features.length} حدثاً بإحداثيات من ${before} قبل ${CUTOFF}، و${noCoords} بلا إحداثيات`);
}
