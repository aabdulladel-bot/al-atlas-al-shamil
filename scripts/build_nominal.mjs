// يبني طبقة النفوذ الاسمي للخلافة (web/data/borders/nominal_{سنة}.geojson) ووسمها في labels_{سنة}.json.
// المضلع هو مضلع الدولة المضيفة نفسه من borders_{سنة}.geojson، لا مضلع مرسوم للخلافة.
// التعريف في scripts/config/abbasid_phases.json (nominal). الاستعمال: node scripts/build_nominal.mjs
// --check: لا يكتب، ويفشل إن اختلف الناتج عمّا في الملفات.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BORDERS = path.join(ROOT, "web/data/borders");
const CHECK = process.argv.includes("--check");
const { nominal } = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/config/abbasid_phases.json"), "utf8"));
const problems = [];

// لكل سنة: مجموعة النفوذ الاسمي في ملف واحد
const byYear = new Map();
for (const n of nominal) (byYear.get(n.year) ?? byYear.set(n.year, []).get(n.year)).push(n);
for (const [year, items] of byYear) {
  const bordersFile = path.join(BORDERS, `borders_${year}.geojson`);
  const labelsFile = path.join(BORDERS, `labels_${year}.json`);
  const borders = JSON.parse(fs.readFileSync(bordersFile, "utf8"));
  const labelsDoc = JSON.parse(fs.readFileSync(labelsFile, "utf8"));
  const features = [];
  for (const n of items) {
    const hostFeatures = borders.features.filter((f) => f.properties.NAME === n.host);
    if (!hostFeatures.length) { problems.push(`${year}: الدولة المضيفة ${n.host} غير موجودة في الحدود`); continue; }
    const hostLabel = labelsDoc.labels.find((l) => l.en === n.host);
    if (!hostLabel) { problems.push(`${year}: لا تسمية للدولة المضيفة ${n.host}`); continue; }
    for (const f of hostFeatures) {
      features.push({ type: "Feature", properties: { NAME: n.label_en, NAME_AR: n.label_ar, NOMINAL: true, HOST: n.host }, geometry: f.geometry });
    }
    // التسمية في الموضع نفسه، تحت تسمية الدولة الفعلية بمسافة ثابتة (تخطيط، لا معطى تاريخي)
    labelsDoc.labels = labelsDoc.labels.filter((l) => l.en !== n.label_en);
    labelsDoc.labels.push({ en: n.label_en, ar: n.label_ar, x: hostLabel.x, y: Math.round((hostLabel.y - 2.5) * 1e4) / 1e4, a: 0, min: hostLabel.min, st: "nominal" });
  }
  const out = { type: "FeatureCollection", _meta: { year, nominal: true, source: "مضلع الدولة المضيفة من Historical Basemaps (GPL-3)؛ التعريف في scripts/config/abbasid_phases.json" }, features };
  const outFile = path.join(BORDERS, `nominal_${year}.geojson`);
  const outText = JSON.stringify(out) + "\n";
  const labelsText = JSON.stringify(labelsDoc) + "\n";
  if (CHECK) {
    if (!fs.existsSync(outFile) || fs.readFileSync(outFile, "utf8") !== outText) problems.push(`nominal_${year}.geojson لا يطابق مولّده: شغّل npm run build:nominal`);
    if (fs.readFileSync(labelsFile, "utf8") !== labelsText) problems.push(`labels_${year}.json لا يطابق مولّده: شغّل npm run build:nominal`);
  } else {
    fs.writeFileSync(outFile, outText);
    fs.writeFileSync(labelsFile, labelsText);
    console.log(`نفوذ اسمي ${year}: ${features.length} مضلعاً`);
  }
}
if (problems.length) {
  console.error(`النفوذ الاسمي: ${problems.length} مشكلة`);
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}
// كل سنة لها ملف، حتى بلا نفوذ اسمي (مجموعة فارغة): لا يُطلب ملف غير موجود عند التحوّل بين السنين
const emptyText = JSON.stringify({ type: "FeatureCollection", _meta: { nominal: true, source: "لا نفوذ اسمي لهذه السنة" }, features: [] }) + "\n";
const allYears = fs.readdirSync(BORDERS).map((f) => f.match(/^borders_(-?\d+)\.geojson$/)?.[1]).filter(Boolean).map(Number);
for (const year of [...allYears, "modern"]) {
  if (byYear.has(year)) continue;
  const outFile = path.join(BORDERS, `nominal_${year}.geojson`);
  if (CHECK) { if (!fs.existsSync(outFile) || fs.readFileSync(outFile, "utf8") !== emptyText) problems.push(`nominal_${year}.geojson ناقص: شغّل npm run build:nominal`); }
  else fs.writeFileSync(outFile, emptyText);
}
if (problems.length) {
  console.error(`النفوذ الاسمي: ${problems.length} مشكلة`);
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}
if (CHECK) console.log("النفوذ الاسمي: مطابق");
