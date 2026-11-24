// يفحص تقييم المصدر والمعلومة (verification/GRADING.md): لكل ادعاء معروض درجة، ولكل مصدر مستعمل درجة،
// والدرجات داخل المقياس، ولكل درجة سبب، والواقعة المؤكدة (1) تسمّي مؤيدها.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { claimEras } from "./lib/eras.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const scale = read("scripts/config/admiralty.json");
const S = read("verification/source_grades.json").sources;
const G = read("verification/claim_grades.json").claims;
const STATUS = new Set(Object.keys(scale.status));
const CORROBORATION = /يؤيد|تؤيد|يؤكد|تؤكد|ثابت|صحيح|معروف ومنشور/;
const errors = [];
const usedSources = new Set();
let n = 0;
for (const era of claimEras(ROOT)) {
  const passages = new Map(read(`verification/era${era}/passages.json`).map((p) => [p.id, p]));
  for (const c of read(`verification/era${era}/claims.json`)) {
    if (c.status === "rejected") continue;
    n++;
    const g = G[c.id];
    const sid = passages.get(c.passage_id)?.source_id;
    usedSources.add(sid);
    if (!g) { errors.push(`${c.id}: بلا درجة معلومة`); continue; }
    if (g.source !== sid) errors.push(`${c.id}: مصدر الدرجة (${g.source}) غير مصدر المقطع (${sid})`);
    if (!scale.info[g.scope]) errors.push(`${c.id}: نطاق غير معروف ${g.scope}`);
    else if (!scale.info[g.scope][String(g.info)]) errors.push(`${c.id}: درجة خارج المقياس ${g.info}`);
    if (!g.why?.trim()) errors.push(`${c.id}: درجة بلا سبب`);
    if (!STATUS.has(g.status)) errors.push(`${c.id}: حالة غير معروفة ${g.status}`);
    if (g.scope === "fact" && g.info === 1 && !CORROBORATION.test(g.why)) errors.push(`${c.id}: واقعة مؤكدة بلا مؤيد مذكور في السبب`);
  }
}
for (const sid of usedSources) {
  const s = S[sid];
  if (!s) { errors.push(`المصدر ${sid}: بلا درجة`); continue; }
  if (!scale.source[s.grade]) errors.push(`المصدر ${sid}: درجة خارج المقياس ${s.grade}`);
  if (!s.why?.trim()) errors.push(`المصدر ${sid}: درجة بلا سبب`);
  if (!STATUS.has(s.status)) errors.push(`المصدر ${sid}: حالة غير معروفة ${s.status}`);
}
console.log(`التقييم: ${n} ادعاء، ${usedSources.size} مصدراً`);
if (errors.length) { for (const e of errors) console.log("  - " + e); process.exit(1); }
console.log("كل ادعاء معروض ومصدره مقيَّمان بسبب مكتوب.");
