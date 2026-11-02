// يبني web/data/layers_info.json لزرّ «عن الطبقة» في لوحة الطبقات: وصف كل طبقة (scripts/config/layer_info.json)
// ومصادرها من sources/manifest.json (الترخيص والإسناد والفئة)، وتغطيتها الزمنية وأعدادها من ملفات البيانات نفسها.
// الاستعمال: node scripts/build_layer_info.mjs [--check]   (--check يفشل إن اختلف الملف المولَّد عن الموجود)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/config/layer_info.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "sources/manifest.json"), "utf8")).sources;
const byId = new Map(manifest.map((m) => [m.id, m]));
const OUT = path.join(ROOT, "web/data/layers_info.json");
const errors = [];

// نمط اسم الملف بنجمة أو أكثر؛ والجزء الأول من النجمة هو «mid» (السنة أو الحقبة)
const listFiles = (glob) => {
  const dir = path.join(ROOT, path.dirname(glob));
  const re = new RegExp(`^${path.basename(glob).split("*").map((x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("(.*)")}$`);
  return fs.readdirSync(dir).map((f) => [f, re.exec(f)]).filter(([, m]) => m).sort(([a], [b]) => a.localeCompare(b)).map(([f, m]) => ({ f, full: path.join(dir, f), mid: m[1] }));
};
const yearOf = (mid) => (mid === "modern" ? Infinity : mid.startsWith("bc") ? -Number(mid.slice(2)) : Number(mid));
const yearText = (mid) => (mid === "modern" ? "اليوم" : yearOf(mid) < 0 ? `${-yearOf(mid)} ق.م` : String(yearOf(mid)));

function coverage(c) {
  if (c.kind === "text") return { label: "التغطية", text: c.text };
  if (c.kind === "files" && c.era) {
    const eras = new Set();
    for (const { f } of listFiles(c.glob)) { const m = /era(\d+)/.exec(f); if (m) eras.add(Number(m[1])); }
    return { label: "الحقب التي لها بيانات", text: [...eras].sort((a, b) => a - b).join("، ") };
  }
  if (c.kind === "files") {
    const files = listFiles(c.glob).filter(({ full }) => !c.skipEmpty || JSON.parse(fs.readFileSync(full, "utf8")).features?.length);
    const ys = files.map((x) => x.mid).sort((a, b) => yearOf(a) - yearOf(b));
    return { label: c.label, text: ys.map(yearText).join("، "), count: ys.length };
  }
  if (c.kind === "features") {
    const n = listFiles(c.glob).reduce((s, { full }) => s + JSON.parse(fs.readFileSync(full, "utf8")).features.length, 0);
    return { label: c.label, text: `${n} ${c.unit}`, count: n };
  }
  if (c.kind === "claims-index") {
    const idx = JSON.parse(fs.readFileSync(path.join(ROOT, "web/data/claims_index.json"), "utf8"));
    const n = idx.reduce((s, x) => s + x.count, 0);
    return { label: c.label, text: `${n} ادعاءً في ${idx.length} حقب`, count: n };
  }
  errors.push(`نوع تغطية غير معروف: ${c.kind}`);
  return null;
};

const groups = {};
for (const [g, v] of Object.entries(cfg.groups)) {
  let ids = v.sources;
  if (!Array.isArray(ids)) ids = manifest.filter((m) => m.file?.startsWith(ids.prefix)).map((m) => m.id);
  const sources = ids.map((id) => {
    const m = byId.get(id);
    if (!m) { errors.push(`${g}: مصدر غير مسجّل في المانيفست: ${id}`); return null; }
    return { id, tier: m.tier, license: m.license, attribution: m.attribution, landing: m.landing ?? null };
  }).filter(Boolean);
  groups[g] = { ar: v.ar, about: v.about, coverage: coverage(v.coverage), sources };
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
const out = JSON.stringify({ _meta: { note: "مولَّد من scripts/config/layer_info.json وsources/manifest.json وملفات web/data. لا يُعدَّل يدوياً." }, groups }, null, 1) + "\n";
if (process.argv.includes("--check")) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (cur !== out) { console.error("web/data/layers_info.json لا يطابق مولّده: شغّل npm run build:layers"); process.exit(1); }
  console.log(`معلومات الطبقات: ${Object.keys(groups).length} طبقة، مطابقة`);
} else {
  fs.writeFileSync(OUT, out);
  console.log(`معلومات الطبقات: ${Object.keys(groups).length} طبقة`);
}
