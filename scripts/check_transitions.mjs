// يفحص ملفات لوحة التحولات (web/data/transitions): وجود كل الأزواج الزمنية، ومطابقة العدّ للقوائم،
// وتناظر الخلافة وبقاء الاسم من الجهتين، وأن كل اسم في الصلات موجود في السنة الأخرى، وأن الأنصبة بين 0 و1.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "web/data/transitions");
const KEYS = ["-4000", "-1000", "-1", "700", "1200", "1600", "1800", "1914", "1945", "2010", "modern"];
const FATES = new Set(["kept", "name_moved", "succeeded", "split", "absorbed", "reduced", "dispersed", "vanished"]);
const ORIGINS = new Set(["kept", "name_moved", "successor", "merged", "carved", "expanded", "assembled", "new_land"]);
const errors = [];
let pairs = 0;
for (let i = 0; i < KEYS.length; i++) {
  for (let j = i + 1; j < KEYS.length; j++) {
    const name = `${KEYS[i]}__${KEYS[j]}.json`;
    const file = path.join(DIR, name);
    if (!fs.existsSync(file)) { errors.push(`مفقود: ${name}`); continue; }
    const d = JSON.parse(fs.readFileSync(file, "utf8"));
    pairs++;
    const err = (m) => errors.push(`${name}: ${m}`);
    const fromNames = new Set(d.from.map((r) => r.name));
    const toNames = new Set(d.to.map((r) => r.name));
    const tally = (rows, k) => rows.reduce((o, r) => ((o[r[k].type] = (o[r[k].type] ?? 0) + 1), o), {});
    for (const [side, k, allowed] of [["from", "fate", FATES], ["to", "origin", ORIGINS]]) {
      const t = tally(d[side], k);
      for (const type of new Set([...Object.keys(t), ...Object.keys(d.counts[side])])) {
        if (!allowed.has(type)) err(`نوع غير معروف: ${type}`);
        if ((t[type] ?? 0) !== (d.counts[side][type] ?? 0)) err(`عدّ ${side}.${type} لا يطابق القائمة`);
      }
    }
    const toByName = new Map(d.to.map((r) => [r.name, r]));
    for (const r of d.from) {
      const f = r.fate;
      const sameName = toNames.has(r.name);
      if (sameName !== (f.type === "kept" || f.type === "name_moved")) err(`${r.name}: بقاء الاسم لا يطابق النوع ${f.type}`);
      if (sameName && toByName.get(r.name).origin.type !== f.type) err(`${r.name}: بقاء الاسم غير متناظر`);
      if (f.type === "succeeded") {
        const o = toByName.get(f.by)?.origin;
        if (!o || o.type !== "successor" || o.of !== r.name) err(`${r.name}: الخلافة غير متناظرة مع ${f.by}`);
      }
      for (const l of r.links) {
        if (!toNames.has(l[0])) err(`${r.name}: صلة باسم غير موجود ${l[0]}`);
        if (!(l[1] >= 0 && l[1] <= 1.001 && l[2] >= 0 && l[2] <= 1.001)) err(`${r.name}: نصيب خارج المدى`);
      }
    }
    for (const r of d.to) for (const l of r.links) if (!fromNames.has(l[0])) err(`${r.name}: صلة باسم غير موجود ${l[0]}`);
  }
}
if (errors.length) { console.error(errors.slice(0, 40).join("\n") + (errors.length > 40 ? `\n… و${errors.length - 40} غيرها` : "")); process.exit(1); }
console.log(`لوحة التحولات سليمة: ${pairs} زوجاً من السنين، العدّ مطابق، والخلافة وبقاء الاسم متناظران`);
