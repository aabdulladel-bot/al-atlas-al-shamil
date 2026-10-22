// يبني ملف مواقع حقبة للواجهة من ملف Pleiades الخام.
// الاستخدام: node scripts/build_places.mjs [config] [pleiadesCsvGz] [out]
// رقم الحقبة يأتي من الإعداد (الافتراضي 1).
// يفشل كاملاً إن لم يطابق أي موقع عنوانه المتوقع، فلا يُكتب ملف ناقص.
import fs from "node:fs";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { parse } from "csv-parse/sync";

const configPath = process.argv[2] ?? "scripts/config/places_era1.json";
const rawPath = process.argv[3] ?? "data/raw/pleiades-places-latest.csv.gz";
const outPath = process.argv[4] ?? "web/data/places_era1.geojson";

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const era = config.era ?? 1;
const gz = fs.readFileSync(rawPath);
const rows = parse(zlib.gunzipSync(gz).toString("utf8"), { columns: true, skip_empty_lines: true });
const byId = new Map(rows.map((r) => [r.id, r]));
const round4 = (n) => Math.round(n * 1e4) / 1e4;

const errors = [];
const features = [];
for (const p of config.places) {
  const base = { id: p.slug, properties: { name_ar: p.name_ar, name_en: p.name_en, era } };

  if (p.pleiades_id) {
    const r = byId.get(p.pleiades_id);
    if (!r) {
      errors.push(`${p.slug}: المعرّف ${p.pleiades_id} غير موجود في Pleiades`);
      continue;
    }
    if (p.expected_title && r.title !== p.expected_title) {
      errors.push(`${p.slug}: العنوان ${JSON.stringify(r.title)} لا يطابق ${JSON.stringify(p.expected_title)}`);
      continue;
    }
    const lon = Number(r.reprLong);
    const lat = Number(r.reprLat);
    if (!r.reprLat || !Number.isFinite(lon) || !Number.isFinite(lat)) {
      errors.push(`${p.slug}: لا توجد إحداثيات تمثيلية للمعرّف ${p.pleiades_id}`);
      continue;
    }
    features.push({
      type: "Feature",
      id: base.id,
      geometry: { type: "Point", coordinates: [round4(lon), round4(lat)] },
      properties: {
        ...base.properties,
        coord_status: "pleiades-representative",
        pleiades_id: p.pleiades_id,
        pleiades_title: r.title,
        pleiades_location_precision: r.locationPrecision || null,
      },
    });
  } else if (p.fallback) {
    features.push({
      type: "Feature",
      id: base.id,
      geometry: { type: "Point", coordinates: [p.fallback.lon, p.fallback.lat] },
      properties: { ...base.properties, coord_status: "approximate", pleiades_id: null, pleiades_title: null },
    });
  } else {
    errors.push(`${p.slug}: لا معرّف ولا إحداثيات تقديرية`);
  }
}

if (errors.length) {
  console.error("فشل البناء، لم يُكتب أي ملف:\n" + errors.join("\n"));
  process.exit(1);
}

const matched = features.filter((f) => f.properties.coord_status === "pleiades-representative").length;
const geojson = {
  type: "FeatureCollection",
  _meta: {
    era,
    status: matched === features.length ? "pleiades-verified" : "partly-verified",
    source: "Pleiades (pleiades.stoa.org)، ملف places-latest، ترخيص CC BY 3.0، يتطلب الإسناد",
    raw_sha256: crypto.createHash("sha256").update(gz).digest("hex"),
    matched: `${matched} من ${features.length}`,
    generated_by: "scripts/build_places.mjs",
    note: "الإحداثيات الممثّلة في Pleiades نقاط تمثيلية لا مواقع مساحية.",
  },
  features,
};
fs.writeFileSync(outPath, JSON.stringify(geojson, null, 2) + "\n");
console.log(`كُتب ${outPath}: ${features.length} موقع، ${matched} بإحداثيات Pleiades`);
