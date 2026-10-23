// يستورد ورقة المراجعة البشرية (review/sunan_evidence_review.csv) ويحدّث حالة الادعاءات.
// الاستعمال: node scripts/import_review.mjs --reviewer "<اسم المراجع>" [--csv <مسار>] [--dry-run] [--self-review]
// --self-review: قراءة نموذج لا مراجع بشري. تُسجَّل الحالة self_reviewed، ولا تُغيَّر حالة الادعاء (تبقى مسودة)،
// ولا يُرفض ادعاء: "خطأ" يُسجَّل تعديلاً معلقاً لأن الرفض قرار بشري.
// الأحكام: "صحيح" يرفع الحالة إلى verified، و"خطأ" يرفضها (rejected)،
// و"يحتاج تعديلاً" لا يغيّر الادعاء بل يُسجَّل في review/pending_edits.json.
// الذرّية: إن وُجد أي خطأ في الورقة لا يُكتب أي ملف.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { claimEras } from "./lib/eras.mjs";
import { validateItems } from "../pipeline/validate.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const reviewer = opt("--reviewer");
const csvPath = path.resolve(ROOT, opt("--csv") ?? "review/sunan_evidence_review.csv");
const dry = args.includes("--dry-run");
const selfReview = args.includes("--self-review");
if (!reviewer) { console.error('الاستعمال: node scripts/import_review.mjs --reviewer "<اسم المراجع>" [--csv <مسار>] [--dry-run]'); process.exit(2); }

const COL_ID = "المعرّف";
const COL_VERDICT = "حكم المراجع (صحيح / يحتاج تعديلاً / خطأ)";
const COL_NOTE = "ملاحظات المراجع";
const VERDICTS = new Set(["صحيح", "يحتاج تعديلاً", "خطأ"]);

// تحميل كل الادعاءات مع ملفها
const byId = new Map();
for (const era of claimEras(ROOT)) {
  const file = path.join(ROOT, "verification", `era${era}`, "claims.json");
  const claims = JSON.parse(fs.readFileSync(file, "utf8"));
  claims.forEach((c, index) => byId.set(c.id, { file, claims, index, c, era }));
}

const rows = parse(fs.readFileSync(csvPath, "utf8"), { columns: true, bom: true, skip_empty_lines: true });
const errors = [];
const changed = new Set();
const pending = [];
const today = new Date().toISOString().slice(0, 10);
const counts = { "صحيح": 0, "خطأ": 0, "يحتاج تعديلاً": 0 };

rows.forEach((row, n) => {
  const id = (row[COL_ID] ?? "").trim();
  const verdict = (row[COL_VERDICT] ?? "").trim();
  const note = (row[COL_NOTE] ?? "").trim();
  if (!verdict) return;
  const hit = byId.get(id);
  if (!hit) { errors.push(`السطر ${n + 2}: معرّف غير موجود: ${id}`); return; }
  if (!VERDICTS.has(verdict)) { errors.push(`السطر ${n + 2} (${id}): حكم غير مقبول: "${verdict}"`); return; }
  counts[verdict]++;
  if (verdict === "يحتاج تعديلاً" || (selfReview && verdict === "خطأ")) {
    const text = selfReview && verdict === "خطأ" ? `خطأ (قراءة نموذج): ${note}` : note;
    pending.push({ id, reviewer, note: text, date: today });
    return;
  }
  const c = hit.c;
  c.checks.meaning = { status: selfReview ? "self_reviewed" : "independently_reviewed", reviewer };
  if (!selfReview && verdict === "صحيح" && c.checks.quote_match === true) c.status = "verified";
  if (!selfReview && verdict === "خطأ") c.status = "rejected";
  c.version = (c.version ?? 1) + 1;
  changed.add(hit);
});

if (errors.length) {
  console.error("أخطاء في الورقة، لم يُكتب شيء:\n" + errors.join("\n"));
  process.exit(1);
}

// التحقق من المخطط للادعاءات المتغيرة قبل الكتابة
const touched = [...changed].map((h) => h.c);
const schemaBad = touched.length ? validateItems("Claim", touched).filter((r) => !r.ok) : [];
if (schemaBad.length) {
  console.error("ادعاءات متغيرة لا تطابق المخطط، لم يُكتب شيء:\n" + schemaBad.map((r) => `${touched[r.index].id}: ${r.errors.map((e) => e.message).join("، ")}`).join("\n"));
  process.exit(1);
}

const summary = `صحيح: ${counts["صحيح"]}، خطأ: ${counts["خطأ"]}، يحتاج تعديلاً: ${counts["يحتاج تعديلاً"]}`;
if (dry) {
  console.log(`تجربة فقط: ${summary}. ادعاءات ستتغير: ${changed.size}. لم يُكتب شيء.`);
  process.exit(0);
}

const files = new Map();
for (const h of changed) files.set(h.file, h.claims);
for (const [file, claims] of files) fs.writeFileSync(file, JSON.stringify(claims, null, 2) + "\n");
if (pending.length) {
  const pf = path.join(ROOT, "review", "pending_edits.json");
  const old = fs.existsSync(pf) ? JSON.parse(fs.readFileSync(pf, "utf8")) : [];
  fs.writeFileSync(pf, JSON.stringify([...old, ...pending], null, 2) + "\n");
}
console.log(`استُورد: ${summary}. ادعاءات حُدّثت: ${changed.size}.`);
