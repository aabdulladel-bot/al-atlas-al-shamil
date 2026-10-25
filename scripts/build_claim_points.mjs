// يربط الادعاءات الموثّقة (مطابقة النص) بالأماكن المعرّفة في config/claim_places.json.
// ادعاء يُربط بمكان إذا ذكر أحد مرادفاته في mentions.places. الأماكن غير المعرّفة تُسجَّل ولا تُعرض.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { claimEras } from "./lib/eras.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/config/claim_places.json"), "utf8"));
const places = JSON.parse(fs.readFileSync(path.join(ROOT, "web/data/claim_places.geojson"), "utf8")).features;
// أماكن حديثة من Natural Earth (ملك عام): مدن لا أثرية، توسم بذلك في coord_status
const naturalCfg = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/config/claim_natural_places.json"), "utf8"));
const neFeatures = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/naturalearth/ne_50m_populated_places_simple.geojson"), "utf8")).features;
for (const p of naturalCfg.places) {
  const hits = neFeatures.filter((f) => f.properties.name === p.ne_name && f.properties.adm0name === p.ne_adm0);
  if (hits.length !== 1) throw new Error(`${p.slug}: ${hits.length} مطابقات لـ ${p.ne_name} في ${p.ne_adm0}`);
  const [lon, lat] = hits[0].geometry.coordinates;
  places.push({ type: "Feature", id: p.slug, geometry: { type: "Point", coordinates: [Math.round(lon * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4] }, properties: { name_ar: p.name_ar, name_en: p.name_en, coord_status: "natural-earth-modern-city" } });
}
const bySlug = new Map(places.map((f) => [f.id, f]));
const aliasToSlug = new Map();
for (const p of [...cfg.places, ...naturalCfg.places]) for (const a of p.aliases) aliasToSlug.set(a, p.slug);

const linked = new Map(); // slug -> claims
const unlinked = new Map();
for (const era of claimEras(ROOT)) {
  const claims = JSON.parse(fs.readFileSync(path.join(ROOT, "verification", `era${era}`, "claims.json"), "utf8"));
  for (const c of claims) {
    if (c.checks.quote_match !== true || c.status === "rejected") continue;
    for (const name of (c.mentions && c.mentions.places) || []) {
      const slug = aliasToSlug.get(name);
      if (!slug) { unlinked.set(name, (unlinked.get(name) || 0) + 1); continue; }
      if (!linked.has(slug)) linked.set(slug, []);
      const list = linked.get(slug);
      if (!list.some((x) => x.id === c.id)) list.push({ id: c.id, era, statement: c.statement, quote: c.quote, attributed_to: c.attributed_to, hedge: c.hedge });
    }
  }
}

const features = [];
for (const [slug, claims] of linked) {
  const place = bySlug.get(slug);
  features.push({
    type: "Feature",
    id: slug,
    geometry: place.geometry,
    properties: { slug, name_ar: place.properties.name_ar, name_en: place.properties.name_en, coord_status: place.properties.coord_status, count: claims.length, claim_ids: "," + claims.map((c) => c.id).join(",") + ",", claims: JSON.stringify(claims) },
  });
}
const out = {
  _meta: { note: "ادعاءات موثّقة مرتبطة بأماكن، مطابقة للنص وقيد المراجعة", linked_places: features.length, unlinked_mentions: Object.fromEntries(unlinked) },
  type: "FeatureCollection",
  features,
};
fs.writeFileSync(path.join(ROOT, "web/data/claim_points.geojson"), JSON.stringify(out) + "\n");
console.log("أماكن مرتبطة:", features.map((f) => `${f.properties.name_ar}(${f.properties.count})`).join("، "));
console.log("أسماء غير مرتبطة:", JSON.stringify(Object.fromEntries(unlinked)));
