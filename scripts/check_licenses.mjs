// بوابة الإطلاق: تتحقق من LICENSES.md قبل نشر الموقع.
// لا تدخل في check:all حتى لا تُعيق تطوير المواد غير المرخّصة في المستودع.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATUS_OK = "موثّق";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const errors = [];
const fail = (msg) => errors.push(msg);

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full));
    else out.push(path.relative(ROOT, full).split(path.sep).join("/"));
  }
  return out;
}

const tokens = (cell) => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);

// المسار: ملف بعينه، أو مجلد ينتهي بـ "/"، أو نمط فيه "*" لا يعبر "/".
function matcherFor(p) {
  if (p.endsWith("/")) return (f) => f.startsWith(p);
  if (p.includes("*")) {
    const re = new RegExp(
      "^" + p.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*") + "$",
    );
    return (f) => re.test(f);
  }
  return (f) => f === p;
}

// ---- قراءة الجداول ----
const md = fs.readFileSync(path.join(ROOT, "LICENSES.md"), "utf8");
let section = "";
const pathRows = [];
const textRows = [];
for (const raw of md.split(/\r?\n/)) {
  if (raw.startsWith("## ")) {
    section = raw;
    continue;
  }
  if (!raw.startsWith("|") || /^\|\s*-{3,}/.test(raw)) continue;
  const cells = raw.split("|").slice(1, -1).map((c) => c.trim());
  if (cells[0] === "المسار" || cells[0] === "المعرّف") continue;
  if (cells.length !== 6) {
    fail(`صف بعدد أعمدة غير 6: ${raw.slice(0, 80)}`);
    continue;
  }
  if (section.startsWith("## أ.")) pathRows.push(cells);
  else if (section.startsWith("## ب.")) textRows.push(cells);
}

// ---- القسم أ: كل صف مرخّص، والمسارات تطابق ملفات حقيقية ----
const webFiles = walk(path.join(ROOT, "web"));
const matchers = [];
for (const cells of pathRows) {
  const [pathCell, , lic, terms, date, status] = cells;
  const toks = tokens(pathCell);
  if (toks.length === 0) fail(`صف بلا مسار: ${cells[1]}`);
  for (const t of toks) {
    const m = matcherFor(t);
    if (!webFiles.some(m)) fail(`مسار لا يطابق أي ملف في web/: ${t}`);
    matchers.push(m);
  }
  if (!lic || !terms) fail(`ترخيص أو شروط فارغة: ${pathCell}`);
  if (status !== STATUS_OK) {
    fail(`غير موثّق (الحالة: ${status || "بلا حالة"}): ${pathCell}`);
  } else if (!DATE_RE.test(date)) {
    fail(`موثّق بلا تاريخ تحقق بصيغة YYYY-MM-DD: ${pathCell}`);
  }
}

// تغطية: كل ملف منشور تحت web/ يجب أن يقع تحت صف في القسم أ.
for (const f of webFiles) {
  if (!matchers.some((m) => m(f))) fail(`ملف منشور غير مغطّى بترخيص: ${f}`);
}

// ---- القسم ب: كل نص مقتبس في verification/eraN يجب أن يكون له صف موثّق ----
const passageIds = new Set();
const passagesBySource = {};
for (const dir of fs.readdirSync(path.join(ROOT, "verification"))) {
  if (!/^era\d+$/.test(dir)) continue;
  const p = path.join(ROOT, "verification", dir, "passages.json");
  if (!fs.existsSync(p)) continue;
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  const list = Array.isArray(data) ? data : data.passages || Object.values(data);
  for (const x of list) if (x && x.source_id) (passagesBySource[x.source_id] ||= []).push(x.text || "");
}
for (const id of Object.keys(passagesBySource)) passageIds.add(id);

// الطبعة الموثّقة يجب أن تكون هي مصدر المقاطع فعلاً: كل مقطع يُوجد في ملف المانيفست
// (90% على الأقل من نوافذه ذات الأربع كلمات، لتحمّل أخطاء OCR).
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "sources/manifest.json"), "utf8")).sources;
const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z؀-ۿ一-鿿]+/g, " ").trim();
function passageCoverage(id) {
  const src = manifest.find((s) => s.id === id);
  if (!src || !src.file) return null;
  const file = path.join(ROOT, src.file);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return null;
  const text = norm(fs.readFileSync(file, "utf8"));
  let worst = 100;
  for (const p of passagesBySource[id]) {
    const w = norm(p).split(" ");
    let n = 0, hit = 0;
    for (let i = 0; i + 4 <= w.length; i += 4) {
      n++;
      if (text.includes(w.slice(i, i + 4).join(" "))) hit++;
    }
    if (n > 0) worst = Math.min(worst, Math.round((100 * hit) / n));
  }
  return { file: src.file, worst };
}

for (const id of [...passageIds].sort()) {
  const rows = textRows.filter((cells) => tokens(cells[0]).includes(id));
  if (rows.length === 0) {
    fail(`نص مقتبس بلا صف في القسم ب: ${id}`);
    continue;
  }
  const ok = rows.find((cells) => cells[5] === STATUS_OK && DATE_RE.test(cells[4]));
  if (!ok) {
    fail(`نص مقتبس غير موثّق: ${id} (${rows[0][5]})`);
    continue;
  }
  const cov = passageCoverage(id);
  if (cov && cov.worst < 90) fail(`المقاطع غير موجودة في ملف الطبعة الموثّقة: ${id} (${cov.file}، ${cov.worst}%)`);
}

// ---- النتيجة ----
console.log(
  `سجل التراخيص: ${pathRows.length} صف ملفات، ${textRows.length} صف نصوص، ` +
    `${passageIds.size} نص مقتبس، ${webFiles.length} ملف في web/`,
);
if (errors.length > 0) {
  console.error(`بوابة الإطلاق مغلقة: ${errors.length} مشكلة`);
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log("بوابة الإطلاق مفتوحة: كل المواد موثّقة ومغطّاة.");
