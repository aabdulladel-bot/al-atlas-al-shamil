// يبني طبقات الحدود السياسية للحقب من Historical Basemaps (GPL-3) في web/data/borders/.
// يبسّط الإحداثيات إلى أربع خانات عشرية ويُبقي حقول الاسم والدقة فقط، لتبقى الملفات صغيرة.
// المصدر محفوظ في data/raw/historical-basemaps، ومسجل في sources/manifest.json بتجزئته.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(ROOT, "data/raw/historical-basemaps");
const OUT = path.join(ROOT, "web/data/borders");
// السنة التي تمثّل كل حقبة (من الملفات المتاحة في الفهرس)
const YEARS = [-4000, -1000, -1, 700, 1200, 1600, 1800, 1914, 1945, 2010];
const r4 = (n) => Math.round(n * 1e4) / 1e4;
const roundRing = (ring) => ring.map(([x, y]) => [r4(x), r4(y)]);
const roundGeom = (g) => {
  if (g.type === "Polygon") return { type: "Polygon", coordinates: g.coordinates.map(roundRing) };
  if (g.type === "MultiPolygon") return { type: "MultiPolygon", coordinates: g.coordinates.map((p) => p.map(roundRing)) };
  return null;
};

fs.mkdirSync(OUT, { recursive: true });
// حدود الدول اليوم من Natural Earth (ملك عام): تُعامل كالدقة الثالثة (محددة بالقانون الدولي)
{
  const ne = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/naturalearth/ne_50m_admin_0_countries.geojson"), "utf8"));
  const features = [];
  for (const f of ne.features) {
    const geometry = roundGeom(f.geometry);
    if (!geometry) continue;
    const p = f.properties;
    features.push({ type: "Feature", properties: { NAME: p.NAME, NAME_AR: p.NAME_AR || p.NAME, PARTOF: null, BORDERPRECISION: 3 }, geometry });
  }
  fs.writeFileSync(path.join(OUT, "modern_countries.geojson"), JSON.stringify({ type: "FeatureCollection", _meta: { source: "Natural Earth (public domain)" }, features }) + "\n");
  // أسماء الدول بالعربية ومواضعها: الاسم (NAME_AR) ونقطة التسمية (LABEL_X/Y) وأدنى تقريب تظهر عنده (MIN_LABEL)،
  // كلها من Natural Earth نفسه، لا ترجمة ولا مواضع مكتوبة يدوياً
  const labels = ne.features
    .filter((f) => f.properties.NAME_AR && Number.isFinite(f.properties.LABEL_X) && Number.isFinite(f.properties.LABEL_Y))
    .map((f) => ({ ar: f.properties.NAME_AR, en: f.properties.NAME, x: r4(f.properties.LABEL_X), y: r4(f.properties.LABEL_Y), min: f.properties.MIN_LABEL ?? 5 }))
    .sort((a, b) => a.min - b.min);
  fs.writeFileSync(path.join(OUT, "modern_labels.json"), JSON.stringify({ _meta: { source: "Natural Earth (public domain): NAME_AR, LABEL_X/Y, MIN_LABEL" }, labels }) + "\n");
  console.log(`أسماء الدول بالعربية: ${labels.length}`);
  console.log(`الدول اليوم: ${features.length} حدود`);
}
for (const year of YEARS) {
  const name = year < 0 ? `world_bc${-year}.geojson` : `world_${year}.geojson`;
  const src = JSON.parse(fs.readFileSync(path.join(RAW, name), "utf8"));
  const features = [];
  for (const f of src.features) {
    const geometry = roundGeom(f.geometry);
    if (!geometry) continue;
    features.push({ type: "Feature", properties: { NAME: f.properties.NAME, PARTOF: f.properties.PARTOF ?? null, BORDERPRECISION: f.properties.BORDERPRECISION ?? null }, geometry });
  }
  const out = { type: "FeatureCollection", _meta: { year, source: "Historical Basemaps (GPL-3)", note: "حدود تقريبية؛ انظر sources/manifest.json" }, features };
  fs.writeFileSync(path.join(OUT, `borders_${year}.geojson`), JSON.stringify(out) + "\n");
  console.log(`سنة ${year}: ${features.length} حدود`);
}
