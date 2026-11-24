// يفحص اللغة التقديرية (verification/ESTIMATIVE.md) في نصوص الأطلس التحليلية: فرضيات السنن وتقديراتها وأسباب شواهدها
// وملاحظات المقيِّد، وأوجه الشبه والاختلاف وتحفّظات السوابق. ألفاظ الاحتمال المرسلة («ربما»، «على الأرجح»...) مرفوضة فيها،
// لأن الاحتمال يُقال بلفظ من المقياس وحده، في حقل التقدير، مع مستوى الثقة. نصوص المصادر المقتبسة لا تُفحص هنا.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const EST = read("scripts/config/estimative.json");
const loose = new RegExp(`(^|[\\s«(،؛])[وف]?(${EST.loose_terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?=$|[\\s»).،؛])`, "u");
const fields = [];
for (const s of read("sunan/sunan.json").sunan) {
  fields.push([`${s.id}: الفرضية`, s.hypothesis], [`${s.id}: سبب التقدير`, s.assessment?.why]);
  for (const a of s.assessment?.assumptions ?? []) fields.push([`${s.id}: افتراض`, a]);
  for (const x of s.supporting) fields.push([`${s.id}: سبب شاهد`, x.why]);
  for (const x of s.limiting) fields.push([`${s.id}: مقيِّد`, x.note]);
}
for (const p of read("scripts/config/precedents.json").precedents) {
  for (const t of p.similarities ?? []) fields.push([`${p.id}: شبه`, t]);
  for (const t of p.differences ?? []) fields.push([`${p.id}: اختلاف`, t]);
  fields.push([`${p.id}: تحفّظ`, p.hedge]);
}
const errors = fields.filter(([, t]) => t && loose.test(t)).map(([where, t]) => `${where}: «${t.match(loose)[2]}» لفظ احتمال مرسل؛ استعمل المقياس في حقل التقدير`);
console.log(`اللغة التقديرية: ${fields.filter(([, t]) => t).length} نصاً تحليلياً`);
if (errors.length) { for (const e of errors) console.log("  - " + e); process.exit(1); }
console.log("لا ألفاظ احتمال مرسلة في نصوص الأطلس التحليلية.");
