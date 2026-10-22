// يبني ورقة المراجعة البشرية: كل ادعاء تعتمد عليه السنن (مؤيداً أو مقيِّداً)، مع نص الفقرة.
// المخرج CSV بترميز UTF-8 مع BOM ليفتح بالعربية في Excel.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sunan = JSON.parse(fs.readFileSync(path.join(ROOT, "sunan/sunan.json"), "utf8")).sunan;
const claims = new Map(), passages = new Map();
for (const era of [1, 2, 3, 4, 5, 6]) {
  const dir = path.join(ROOT, "verification", `era${era}`);
  for (const c of JSON.parse(fs.readFileSync(path.join(dir, "claims.json"), "utf8"))) claims.set(c.id, { ...c, era });
  for (const p of JSON.parse(fs.readFileSync(path.join(dir, "passages.json"), "utf8"))) passages.set(p.id, p);
}
const uses = new Map();
for (const s of sunan) {
  for (const x of s.supporting) uses.set(x.claim, [...(uses.get(x.claim) || []), `${s.name} (مؤيد)`]);
  for (const x of s.limiting) if (x.claim) uses.set(x.claim, [...(uses.get(x.claim) || []), `${s.name} (مقيِّد)`]);
}
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\s+/g, " ").trim()}"`;
const header = ["المعرّف", "الحقبة", "تستعمله السنن", "الادعاء", "الاقتباس", "المصدر", "التحفّظ", "مقطع من الفقرة", "حكم المراجع (صحيح / يحتاج تعديلاً / خطأ)", "ملاحظات المراجع"];
const rows = [...uses.keys()].sort().map((id) => {
  const c = claims.get(id);
  const p = passages.get(c.passage_id);
  const text = p?.text || "";
  const i = text.indexOf(c.quote);
  const excerpt = i >= 0 ? text.slice(Math.max(0, i - 200), i + c.quote.length + 200) : text.slice(0, 400);
  return [id, c.era, uses.get(id).join("؛ "), c.statement, c.quote, c.attributed_to, c.hedge, excerpt, "", ""];
});
const csv = "﻿" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
fs.writeFileSync(path.join(ROOT, "review/sunan_evidence_review.csv"), csv);
console.log(`ورقة المراجعة: ${rows.length} ادعاءً`);
