// يبني مواقع الحقب 6 و7 و8 (web/data/places_era{6,7,8}.geojson) من Natural Earth، وفق scripts/config/era_cities.json.
// الاسم العربي والإحداثيات من المصدر، لا مكتوبة يدوياً. يفشل كاملاً إن لم تُطابق مدينةٌ مكاناً واحداً بالضبط.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "data/raw/naturalearth/ne_50m_populated_places.geojson");
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/config/era_cities.json"), "utf8"));
const raw = fs.readFileSync(SRC);
const ne = JSON.parse(raw).features;
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim(); // في المصدر أسماء بمسافتين ("St.  Petersburg")
const round4 = (n) => Math.round(n * 1e4) / 1e4;
const slug = (s) => norm(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function feature(f, era) {
  const p = f.properties;
  const [lon, lat] = f.geometry.coordinates;
  return {
    type: "Feature",
    id: slug(`${p.NAME}-${p.ADM0NAME}`),
    geometry: { type: "Point", coordinates: [round4(lon), round4(lat)] },
    properties: { name_ar: p.NAME_AR, name_en: norm(p.NAME), era, coord_status: "natural-earth-modern-city", pleiades_id: null, pleiades_title: null, source_name: norm(p.NAME), source_country: p.ADM0NAME },
  };
}

const errors = [];
const out = {};
for (const [eraKey, spec] of Object.entries(config.eras)) {
  const era = Number(eraKey);
  if (spec === "admin0-capitals") {
    out[era] = ne.filter((f) => f.properties.FEATURECLA === "Admin-0 capital").map((f) => feature(f, era));
    continue;
  }
  out[era] = [];
  for (const [name, country] of spec) {
    const hits = ne.filter((f) => norm(f.properties.NAME) === name && f.properties.ADM0NAME === country);
    if (hits.length !== 1) { errors.push(`الحقبة ${era}: ${hits.length} مطابقات لـ ${name} في ${country}`); continue; }
    if (!hits[0].properties.NAME_AR) { errors.push(`الحقبة ${era}: لا اسم عربياً لـ ${name}`); continue; }
    out[era].push(feature(hits[0], era));
  }
}
if (errors.length) { console.error("أخطاء، لم يُكتب شيء:\n" + errors.join("\n")); process.exit(1); }

const sha = crypto.createHash("sha256").update(raw).digest("hex");
for (const [era, features] of Object.entries(out)) {
  const file = path.join(ROOT, "web/data", `places_era${era}.geojson`);
  const meta = {
    era: Number(era),
    source: "Natural Earth (ملك عام): ne_50m_populated_places",
    raw_sha256: sha,
    rule: config.eras[era] === "admin0-capitals" ? "عواصم الدول اليوم (Admin-0 capital)" : "اختيار تحريري لمراكز كبرى في الحقبة",
    generated_by: "scripts/build_era_cities.mjs",
  };
  fs.writeFileSync(file, JSON.stringify({ type: "FeatureCollection", _meta: meta, features }) + "\n");
  console.log(`الحقبة ${era}: ${features.length} مدينة في ${path.relative(ROOT, file)}`);
}
