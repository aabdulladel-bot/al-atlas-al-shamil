// يبني طبقات الأساس للخريطة من Natural Earth (ملك عام): اليابسة والأنهار والبحيرات بدقة 1:50 مليون.
// يحذف الخصائص غير اللازمة ويقرّب الإحداثيات لتخفيف الحجم.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "data/raw/naturalearth");
const OUT = path.join(ROOT, "web/data/base");
fs.mkdirSync(OUT, { recursive: true });

const round = (c) => (typeof c[0] === "number" ? [Math.round(c[0] * 1000) / 1000, Math.round(c[1] * 1000) / 1000] : c.map(round));
const layers = [
  ["ne_50m_land.geojson", "land.geojson", () => ({})],
  ["ne_50m_lakes.geojson", "lakes.geojson", () => ({})],
  ["ne_50m_rivers_lake_centerlines.geojson", "rivers.geojson", (p) => ({ name: p.name || null, scalerank: p.scalerank ?? null })],
];
for (const [src, out, props] of layers) {
  const g = JSON.parse(fs.readFileSync(path.join(SRC, src), "utf8"));
  const features = g.features.map((f) => ({ type: "Feature", properties: props(f.properties || {}), geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) } }));
  fs.writeFileSync(path.join(OUT, out), JSON.stringify({ type: "FeatureCollection", features }));
  console.log(out, features.length, "عنصر،", Math.round(fs.statSync(path.join(OUT, out)).size / 1024), "ك.ب");
}
