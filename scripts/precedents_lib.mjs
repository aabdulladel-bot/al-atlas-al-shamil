// مكتبة السوابق: تحميل الإعداد والمقاطع، والتحقق، وبناء ما تعرضه الواجهة.
// كل سابقة تحيل إلى مقطع في verification/*/passages.json، ويُطابَق اقتباسها بالنص عبر checkQuote (pipeline/normalize.mjs).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { checkQuote } from "../pipeline/normalize.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CONFIG = path.join(ROOT, "scripts/config/precedents.json");
export const OUT = path.join(ROOT, "web/data/precedents.json");

export function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG, "utf8"));
}

export function loadPassages() {
  const map = new Map();
  const dir = path.join(ROOT, "verification");
  for (const era of fs.readdirSync(dir).filter((d) => /^era\d+$/.test(d))) {
    const f = path.join(dir, era, "passages.json");
    if (!fs.existsSync(f)) continue;
    for (const p of JSON.parse(fs.readFileSync(f, "utf8"))) map.set(p.id, p);
  }
  return map;
}

// أخطاء الإعداد كاملة لا أولها فقط، لتُصحَّح دفعة واحدة
export function validate(cfg, passages) {
  const errors = [];
  const chokes = new Map();
  for (const c of cfg.chokepoints ?? []) {
    if (chokes.has(c.id)) errors.push(`مضيق مكرر: ${c.id}`);
    chokes.set(c.id, c);
    if (!c.name_ar) errors.push(`${c.id}: بلا اسم عربي`);
  }
  const ids = new Set();
  for (const p of cfg.precedents ?? []) {
    const where = p.id ?? "(بلا معرّف)";
    if (!p.id) errors.push("سابقة بلا معرّف");
    if (ids.has(p.id)) errors.push(`${where}: معرّف مكرر`);
    ids.add(p.id);
    if (!chokes.has(p.chokepoint)) errors.push(`${where}: مضيق غير معروف (${p.chokepoint})`);
    for (const k of ["period", "statement_ar", "attributed_to", "hedge"]) {
      if (!p[k]) errors.push(`${where}: ${k} فارغ`);
    }
    if (!Array.isArray(p.similarities) || p.similarities.length < 1) errors.push(`${where}: لا وجه شبه، والسابقة بلا مقارنة لا تُعرض`);
    if (!Array.isArray(p.differences) || p.differences.length < 1) errors.push(`${where}: لا وجه اختلاف، والإلزام أن يُذكر الاختلاف مع الشبه`);
    const pas = passages.get(p.passage_id);
    if (!pas) {
      errors.push(`${where}: مقطع غير موجود (${p.passage_id})`);
      continue;
    }
    const r = checkQuote(pas.text, p.quote);
    if (r.status !== "ok") errors.push(`${where}: الاقتباس لا يطابق مقطعه بالنص (${r.status}: ${r.reason}، عدد ${r.count})`);
  }
  return errors;
}

// ما تحمله الواجهة: الإعداد بلا حقول التحقق الداخلية
export function publicData(cfg) {
  return {
    _meta: {
      source: "scripts/config/precedents.json، واقتباسات السوابق من verification/*/passages.json (ويُطابَق كل اقتباس بالنص)",
      note: "أوجه الشبه والاختلاف قراءة تحليلية للأطلس، وليست نص المصدر.",
    },
    chokepoints: cfg.chokepoints.map(({ id, name_ar, name_en, today }) => ({ id, name_ar, name_en, today })),
    precedents: cfg.precedents.map(({ id, chokepoint, period, statement_ar, quote, attributed_to, similarities, differences, hedge }) => ({
      id, chokepoint, period, statement_ar, quote, attributed_to, similarities, differences, hedge,
    })),
  };
}
