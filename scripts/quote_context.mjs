// يطبع عدد مرات ورود عبارة في ملف نصي (بعد توحيد المسافات)، والجملة التي تحتويها كما هي حرفياً،
// لنسخها اقتباساً في ملف مواصفات add_claims.mjs دون تصحيح أخطاء OCR.
// الاستعمال: node scripts/quote_context.mjs <ملف> "<عبارة>" [عدد أحرف السياق، الافتراضي 300]
import fs from "node:fs";

const [file, anchor, ctxArg] = process.argv.slice(2);
if (!file || !anchor) { console.error('الاستعمال: node scripts/quote_context.mjs <ملف> "<عبارة>" [سياق]'); process.exit(2); }
const ctx = Number(ctxArg ?? 300);
const text = fs.readFileSync(file, "utf8").replace(/\s+/g, " ");
const hits = [];
for (let i = text.indexOf(anchor); i >= 0; i = text.indexOf(anchor, i + 1)) hits.push(i);
console.log(`مرات الورود: ${hits.length}`);
const ENDS = /[.!?؟;:»)]/;
for (const i of hits.slice(0, 5)) {
  let a = i; while (a > 0 && i - a < 600 && !ENDS.test(text[a - 1])) a--;
  let b = i + anchor.length; while (b < text.length && b - i < 600 && !ENDS.test(text[b])) b++;
  const sentence = text.slice(a, b + 1).trim();
  console.log(`\n--- عند الموضع ${i}`);
  console.log(`الجملة (${sentence.length} حرفاً، ترد ${text.split(sentence).length - 1} مرة):\n${sentence}`);
  console.log(`\nالسياق:\n…${text.slice(Math.max(0, i - ctx), i + anchor.length + ctx)}…`);
}
