// يتحقق من إعداد السوابق: كل اقتباس يطابق مقطعه بالنص، ولكل سابقة شبه واختلاف وتحفظ.
// الاستعمال: node scripts/check_precedents.mjs
import { loadConfig, loadPassages, validate } from "./precedents_lib.mjs";

const cfg = loadConfig();
const errors = validate(cfg, loadPassages());
if (errors.length) {
  console.error(`السوابق: ${errors.length} خطأ`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`السوابق: ${cfg.precedents.length} سابقة لـ${cfg.chokepoints.length} مضيقاً، كل الاقتباسات مطابقة`);
