// يتحقق أن مراجع العهود (scripts/config/abbasid_phases.json) موجودة في scripts/config/abbasid_references.json،
// وأن كل مرجع بحالة صحيحة، وأن المراجع المحمية (reference_only) لا تحمل نصاً مقتبساً.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const phases = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/config/abbasid_phases.json"), "utf8"));
const refs = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/config/abbasid_references.json"), "utf8"));
const byId = new Map(refs.references.map((r) => [r.id, r]));
const valid = new Set(Object.keys(refs._meta.status_values));
const errors = [];
for (const r of refs.references) {
  if (!valid.has(r.status)) errors.push(`${r.id}: حالة غير معروفة ${r.status}`);
  if (r.status === "reference_only" && (r.quote || r.quotes)) errors.push(`${r.id}: مرجع محمي لا يحمل نصاً مقتبساً`);
}
for (const ph of phases.phases) {
  if (!ph.refs?.length) errors.push(`العهد ${ph.id}: بلا مراجع`);
  for (const id of ph.refs ?? []) if (!byId.has(id)) errors.push(`العهد ${ph.id}: مرجع غير معروف ${id}`);
}
// نصوص المقدمة: كل اقتباس يطابق الملف حرفياً مرة واحدة، ومعرّفه في المراجع
const kh = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/config/abbasid_khaldun_passages.json"), "utf8"));
const khText = fs.readFileSync(path.join(ROOT, kh._meta.file), "utf8");
for (const p of kh.passages) {
  const n = khText.split(p.quote).length - 1;
  if (n !== 1) errors.push(`${p.id}: الاقتباس يطابق الملف ${n} مرة، والمطلوب مرة واحدة`);
  if (p.supports_phase !== null && !phases.phases.some((ph) => ph.id === p.supports_phase)) errors.push(`${p.id}: عهد غير معروف ${p.supports_phase}`);
}
console.log(`مراجع العهود: ${refs.references.length} مرجع، ${phases.phases.length} عهود، ${kh.passages.length} اقتباس من المقدمة`);
if (errors.length) {
  console.error(`مراجع العهود: ${errors.length} مشكلة`);
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log("مراجع العهود: مطابقة");
