// يبني طبقة السكان الإقليمية للحقب 1 إلى 7 من سلسلة OWID (HYDE 2016 حتى 1940).
// القيم بعد 1940 من UN ومستبعدة. النقاط تمثيلية للإقليم، وليست مركز حدود تاريخية.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "data/raw/owid/hyde-region-population.csv");
const OUT = path.join(ROOT, "web/data");
const HYDE_LAST = 1940;
const REGION_POINTS = {
  "Africa": { name_en: "Africa", lon: 20, lat: 5 },
  "Asia": { name_en: "Asia", lon: 90, lat: 35 },
  "Europe": { name_en: "Europe", lon: 15, lat: 50 },
  "North and Central America": { name_en: "North and Central America", lon: -100, lat: 40 },
  "South America": { name_en: "South America", lon: -60, lat: -15 },
  "Oceania": { name_en: "Oceania", lon: 140, lat: -25 },
};
// سنة لكل حقبة: أقرب سنة مرصودة في HYDE إلى منتصف الحقبة
const ERAS = [
  { id: 1, year: -2000, file: "demography_regional_era1.geojson" },
  { id: 2, year: -1000, file: "demography_regional_era2.geojson" },
  { id: 3, year: 0, file: "demography_regional_era3.geojson" },
  { id: 4, year: 700, file: "demography_regional_era4.geojson" },
  { id: 5, year: 1200, file: "demography_regional_era5.geojson" },
  { id: 6, year: 1600, file: "demography_regional_era6.geojson" },
  { id: 7, year: 1800, file: "demography_regional_era7.geojson" },
];

const rows = fs.readFileSync(SRC, "utf8").trim().split("\n").slice(1);
const pop = new Map();
for (const line of rows) {
  const m = line.match(/^([^,]+),(-?\d+),([^,]*)/);
  if (!m) continue;
  const [, entity, yearStr, value] = m;
  const year = +yearStr;
  if (year > HYDE_LAST || value === "") continue;
  if (!pop.has(year)) pop.set(year, new Map());
  pop.get(year).set(entity, +value);
}

fs.mkdirSync(OUT, { recursive: true });
for (const era of ERAS) {
  const byRegion = pop.get(era.year);
  if (!byRegion) throw new Error(`لا بيانات HYDE للسنة ${era.year} (الحقبة ${era.id})`);
  const features = [];
  for (const [entity, point] of Object.entries(REGION_POINTS)) {
    const population = byRegion.get(entity);
    if (population === undefined) throw new Error(`إقليم مفقود: ${entity} سنة ${era.year}`);
    features.push({
      type: "Feature",
      properties: { geo: entity, name_en: point.name_en, population, year: era.year, level: "region" },
      geometry: { type: "Point", coordinates: [point.lon, point.lat] },
    });
  }
  const out = {
    _meta: {
      source: "OWID، سلسلة السكان الإقليمية (HYDE 2016 حتى 1940)",
      license: "CC BY 4.0 (OWID). HYDE: CC BY 4.0 بحسب فهرس DataHub. قيم UN بعد 1940 مستبعدة.",
      attribution: "Population data from HYDE (Klein Goldewijk et al., 2016), via Our World in Data (CC BY 4.0). https://ourworldindata.org",
      era: era.id,
      year: era.year,
      countries: 0,
      note: "أرقام إقليمية حديثة التقسيم، وليست حدود الحقبة. النقاط في مركز تقريبي للإقليم.",
    },
    type: "FeatureCollection",
    features,
  };
  fs.writeFileSync(path.join(OUT, era.file), JSON.stringify(out) + "\n");
  const total = features.reduce((s, f) => s + f.properties.population, 0);
  console.log(`حقبة ${era.id}: سنة ${era.year}، ${features.length} أقاليم، المجموع ${total.toLocaleString("en-US")}`);
}
