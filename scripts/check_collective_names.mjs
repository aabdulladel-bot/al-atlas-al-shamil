// يفحص تعريفات التسميات الجامعة (scripts/config/collective_names.json):
// 1) كل نص لابن خلدون يطابق تفريغ ويكي مصدر حرفياً مرة واحدة (checkQuote)، بعد قالب الصفحة،
// 2) كل تسمية موجودة في أسماء الخرائط (web/data/names/hb_names.json)، وكل نمط عيش معرَّف،
// 3) كل إقليم أو جماعة لها مدخل في خريطة ويكي بيانات المثبَّتة، 4) كل نمط له الأبعاد الأربعة.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkQuote } from "../pipeline/normalize.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/config/collective_names.json"), "utf8"));
const hb = JSON.parse(fs.readFileSync(path.join(ROOT, "web/data/names/hb_names.json"), "utf8")).names;
const src = path.join(ROOT, "data/raw/wikisource_muqaddima");
const bodies = {};
const bodyOf = (file) => {
  if (!bodies[file]) {
    const t = fs.readFileSync(path.join(src, file), "utf8");
    const i = t.indexOf("{{نثر}}");
    bodies[file] = (i >= 0 ? t.slice(i) : t).replace(/\s+/g, " ");
  }
  return bodies[file];
};
const errors = [];
let quotes = 0;
const checkK = (k, where) => {
  quotes++;
  if (!fs.existsSync(path.join(src, k.file))) return errors.push(`${where}: ملف غير موجود ${k.file}`);
  const r = checkQuote(bodyOf(k.file), k.quote);
  if (r.status !== "ok") errors.push(`${where}: نص ابن خلدون لا يطابق (${r.status}/${r.reason}): ${k.quote.slice(0, 40)}`);
  if (!k.reading_ar) errors.push(`${where}: قراءة بلا نص`);
};
const DIMS = Object.keys(cfg.dims_labels);
for (const [id, m] of Object.entries(cfg.modes)) {
  if (!m.label_ar || !m.def_ar) errors.push(`نمط ${id}: تسمية أو تعريف ناقص`);
  for (const d of DIMS) if (!m.dims?.[d]) errors.push(`نمط ${id}: بُعد ناقص ${d}`);
  (m.khaldun ?? []).forEach((k, i) => checkK(k, `نمط ${id} [${i}]`));
}
checkK(cfg.general_khaldun, "النص العام");
for (const [name, n] of Object.entries(cfg.names)) {
  if (!hb[name]) errors.push(`${name}: ليس في أسماء الخرائط`);
  if (!n.modes?.length) errors.push(`${name}: بلا نمط عيش`);
  for (const m of n.modes ?? []) if (!cfg.modes[m]) errors.push(`${name}: نمط غير معرّف ${m}`);
  for (const k of ["region", "group"]) if (n[k] && !(n[k] in cfg.wikidata)) errors.push(`${name}: ${k} بلا مدخل ويكي بيانات (${n[k]})`);
  if (!hb[name]?.ar && !n.ar) errors.push(`${name}: بلا اسم عربي`);
  (n.khaldun_extra ?? []).forEach((k, i) => checkK(k, `${name} [${i}]`));
}
console.log(`التسميات الجامعة: ${Object.keys(cfg.names).length} تسمية، ${Object.keys(cfg.modes).length} أنماط، ${quotes} نصاً لابن خلدون`);
if (errors.length) { for (const e of errors) console.log("  - " + e); process.exit(1); }
console.log("كل نصوص ابن خلدون مطابقة، وكل التسميات مربوطة بأنماطها.");
