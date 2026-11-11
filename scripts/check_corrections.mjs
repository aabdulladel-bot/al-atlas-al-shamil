// يتحقق من التصحيحات التاريخية المعلنة في scripts/config/historical_corrections.json:
// (أ) الكيان موجود فعلاً في مصدر تلك السنة الخام، فلا يكون التصحيح بلا أثر؛
// (ب) تاريخه في web/data/names/hb_names.json (ويكي بيانات) يقع خارج السنة، فلا يُسقط كيان داخل مدته؛
// (ج) سجل التصحيح مكتوب بتاريخ الكيان نفسه (dates) إن وُجد، وليس بتخمين.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { drop } = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/config/historical_corrections.json"), "utf8"));
const names = JSON.parse(fs.readFileSync(path.join(ROOT, "web/data/names/hb_names.json"), "utf8")).names;
const errors = [];
for (const c of drop) {
  const file = c.year < 0 ? `world_bc${-c.year}.geojson` : `world_${c.year}.geojson`;
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/historical-basemaps", file), "utf8"));
  if (c.record && !names[c.record]) errors.push(`${c.year}: السجل ${c.record} غير موجود في hb_names`);
  if (!raw.features.some((f) => f.properties.NAME === c.name)) errors.push(`${c.year}: ${c.name} غير موجود في المصدر الخام (تصحيح بلا أثر)`);
  const rec = names[c.record ?? c.name] ?? {};
  const inception = rec.inception ?? null, dissolved = rec.dissolved ?? null;
  if (c.dates) {
    if (c.dates[0] !== inception || c.dates[1] !== dissolved) errors.push(`${c.year}: ${c.name} يخالف سجل ويكي بيانات: المسجّل [${c.dates}] والسجل [${inception}, ${dissolved}]`);
  }
  const outside = (inception !== null && c.year < inception) || (dissolved !== null && c.year > dissolved);
  if (!outside) errors.push(`${c.year}: ${c.name} داخل مدته في سجله [${inception}, ${dissolved}]، فلا يُسقط`);
}
console.log(`التصحيحات التاريخية: ${drop.length} تصحيح`);
if (errors.length) {
  console.error(`التصحيحات التاريخية: ${errors.length} مشكلة`);
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log("التصحيحات التاريخية: مطابقة");
