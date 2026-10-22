// يبني طبقة السكان للحقبتين 6 و8 من بيانات Gapminder (CC BY 4.0).
// لكل حقبة سنة تمثيلية: أكثر سنة مرصودة فيها عدداً للدول، والإسقاطات (بعد 2023) مستبعدة.
// يفشل البناء إن لم تتوفر إحداثيات دولة ذات بيانات، فلا تُسقط بصمت.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POP = path.join(ROOT, "data/raw/gapminder/ddf--datapoints--total_population_with_projections--by--geo--time.csv");
const ENT = path.join(ROOT, "data/raw/gapminder/ddf--entities--geo--country.csv");
const OUT = path.join(ROOT, "web/data");
const LAST_OBSERVED = 2023;
const ERAS = [
  { id: 6, from: 1450, to: 1760, file: "demography_era6.geojson" },
  { id: 7, from: 1760, to: 1914, file: "demography_era7.geojson" },
  { id: 8, from: 1914, to: 2025, file: "demography_era8.geojson" },
];

const rows = (f) => fs.readFileSync(f, "utf8").trim().split("\n");
const parse = (line) => line.split(",");

// جدول الإحداثيات والأسماء من ملف الكيانات
const eh = rows(ENT)[0].split(",");
const ci = eh.indexOf("country"), li = eh.indexOf("latitude"), lo = eh.indexOf("longitude"), ni = eh.indexOf("name");
const geoInfo = new Map();
for (const line of rows(ENT).slice(1)) {
  const c = parse(line);
  if (c[li] && c[lo]) geoInfo.set(c[ci], { name: c[ni], lat: +c[li], lon: +c[lo] });
}

// بيانات السكان حسب السنة
const popByYear = new Map();
for (const line of rows(POP).slice(1)) {
  const [g, t, v] = parse(line);
  const y = +t;
  if (v === "" || y > LAST_OBSERVED) continue;
  if (!popByYear.has(y)) popByYear.set(y, new Map());
  popByYear.get(y).set(g, +v);
}

fs.mkdirSync(OUT, { recursive: true });
const sourceInfo = {
  source: "Gapminder, Systema Globalis (ddf--gapminder--systema_globalis)",
  license: "CC BY 4.0",
  attribution: "Population data from Gapminder (Systema Globalis, CC BY 4.0). https://www.gapminder.org",
  note: "أرقام الدول بحدودها الحديثة. الإحداثيات نقطة مركز الدولة. ما قبل 1800 تقديري. الإسقاطات بعد 2023 مستبعدة.",
};

for (const era of ERAS) {
  const candidates = [...popByYear.keys()].filter((y) => y >= era.from && y <= era.to);
  if (!candidates.length) throw new Error(`لا سنوات مرصودة للحقبة ${era.id}`);
  const year = candidates.reduce((best, y) => {
    const a = popByYear.get(y).size, b = popByYear.get(best).size;
    return a > b || (a === b && y > best) ? y : best;
  });
  const pops = popByYear.get(year);
  const features = [], unplaced = [];
  for (const [geo, population] of pops) {
    const info = geoInfo.get(geo);
    if (!info) { unplaced.push(geo); continue; }
    features.push({
      type: "Feature",
      properties: { geo, name_en: info.name, population, year },
      geometry: { type: "Point", coordinates: [info.lon, info.lat] },
    });
  }
  if (!features.length) throw new Error(`لا دول قابلة للوضع على الخريطة في الحقبة ${era.id}`);
  features.sort((a, b) => b.properties.population - a.properties.population);
  const out = {
    _meta: { ...sourceInfo, era: era.id, year, countries: features.length, unplaced_count: unplaced.length, unplaced },
    type: "FeatureCollection",
    features,
  };
  fs.writeFileSync(path.join(OUT, era.file), JSON.stringify(out) + "\n");
  console.log(`حقبة ${era.id}: سنة ${year}، ${features.length} دولة، بدون إحداثيات ${unplaced.length}`);
}
