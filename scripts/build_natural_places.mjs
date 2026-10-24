// يضيف مدناً إسلامية من Natural Earth إلى طبقة الحقبة، ولا يحذف مواقع Pleiades.
// الاستخدام: node scripts/build_natural_places.mjs [config] [neGeojson]
// يفشل إن لم يُطابق اسم المدينة والدولة مكاناً واحداً بالضبط، فلا يكتب ملفاً ناقصاً.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(ROOT, process.argv[2] ?? "scripts/config/natural_places.json");
const nePath = path.join(ROOT, process.argv[3] ?? "data/raw/naturalearth/ne_50m_populated_places_simple.geojson");
const STATUS = "natural-earth-modern-city";
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const ne = JSON.parse(fs.readFileSync(nePath, "utf8")).features;
const round4 = (n) => Math.round(n * 1e4) / 1e4;

const errors = [];
const byEra = new Map();
for (const p of config.places) {
  const hits = ne.filter((f) => f.properties.name === p.ne_name && f.properties.adm0name === p.ne_adm0);
  if (hits.length !== 1) { errors.push(`${p.slug}: ${hits.length} مطابقات لـ ${p.ne_name} في ${p.ne_adm0}`); continue; }
  const [lon, lat] = hits[0].geometry.coordinates;
  const feature = {
    type: "Feature",
    id: p.slug,
    geometry: { type: "Point", coordinates: [round4(lon), round4(lat)] },
    properties: {
      name_ar: p.name_ar, name_en: p.name_en, era: p.era,
      coord_status: STATUS, pleiades_id: null, pleiades_title: null,
      source_name: p.ne_name, source_country: p.ne_adm0,
    },
  };
  byEra.set(p.era, [...(byEra.get(p.era) ?? []), feature]);
}
if (errors.length) { console.error("أخطاء، لم يُكتب شيء:\n" + errors.join("\n")); process.exit(1); }

for (const [era, added] of byEra) {
  const out = path.join(ROOT, "web/data", `places_era${era}.geojson`);
  const base = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : { type: "FeatureCollection", features: [] };
  const kept = base.features.filter((f) => f.properties.coord_status !== STATUS);
  base.features = [...kept, ...added];
  fs.writeFileSync(out, JSON.stringify(base) + "\n");
  console.log(`الحقبة ${era}: أُضيف ${added.length} مدينة إلى ${path.relative(ROOT, out)} (المجموع ${base.features.length})`);
}
