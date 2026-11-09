// يولّد القسم ب من LICENSES.md (النصوص المقتبسة) من sources/manifest.json وverification/eraN/passages.json.
// الاستخدام: node scripts/build_licenses.mjs [--check]
// --check: يفشل إن كان القسم ب في الملف لا يطابق المولَّد (يُشغَّل من check:launch).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const HEADING = "## ب. النصوص المقتبسة";
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "sources/manifest.json"), "utf8")).sources;
const byId = Object.fromEntries(manifest.map((s) => [s.id, s]));
const { decisions } = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/config/licence_decisions.json"), "utf8"));

// الحقبة التي يظهر فيها كل نص أولاً
const era = {};
for (const dir of fs.readdirSync(path.join(ROOT, "verification")).filter((d) => /^era\d+$/.test(d)).sort((a, b) => a.slice(3) - b.slice(3))) {
  const p = path.join(ROOT, "verification", dir, "passages.json");
  if (!fs.existsSync(p)) continue;
  const d = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const x of Array.isArray(d) ? d : d.passages || Object.values(d)) {
    if (x && x.source_id && !(x.source_id in era)) era[x.source_id] = Number(dir.slice(3));
  }
}

const cell = (s) => String(s).replace(/\|/g, "/").replace(/\s*\n\s*/g, " ");
const rows = [];
for (const id of Object.keys(era).sort((a, b) => era[a] - era[b] || a.localeCompare(b))) {
  const s = byId[id];
  const date = s && (s.license_verified_at || (s.retrieved_at || "").slice(0, 10));
  if (s && s.status === "ok" && date) {
    const terms = s.attribution ? "إسناد: " + s.attribution : "إسناد الطبعة";
    rows.push(`| \`${id}\` | ${era[id]} | ${cell(s.license)} | ${cell(terms)} | ${date} | موثّق |`);
  } else {
    const reason = !s ? "غير مسجّل في المانيفست" : s.license_pending_reason || s.status || "بلا تاريخ تحقق";
    rows.push(`| \`${id}\` | ${era[id]} | ${cell(reason)} | — | غير مسجّل | غير موثّق |`);
  }
}

const section = [
  HEADING,
  "",
  "مولَّد بـ `npm run build:licenses` من المانيفست، فلا يُعدَّل يدوياً. تاريخ التحقق هو `license_verified_at` إن وُجد، وإلا تاريخ قراءة بيانات الطبعة. والحكم بالملك العام المبني على تاريخ النشر يُذكر أساسه صراحة في عمود الترخيص.",
  "",
  "| المعرّف | الحقبة | الترخيص | شروط الاستخدام | تاريخ التحقق | الحالة |",
  "|---|---|---|---|---|---|",
  ...rows,
  "",
  ...decisions.flatMap((d) => [d, ""]),
].join("\n");

const file = path.join(ROOT, "LICENSES.md");
const md = fs.readFileSync(file, "utf8");
const at = md.indexOf(HEADING);
if (at < 0) throw new Error("القسم ب غير موجود في LICENSES.md");
const next = md.slice(0, at) + section;
if (CHECK) {
  if (next !== md) {
    console.error("القسم ب في LICENSES.md لا يطابق المانيفست: شغّل npm run build:licenses");
    process.exit(1);
  }
  console.log("القسم ب في LICENSES.md: مطابق للمانيفست");
} else {
  fs.writeFileSync(file, next);
  console.log(`القسم ب: ${rows.length} نصاً، منها ${rows.filter((r) => r.endsWith("| موثّق |")).length} موثّق`);
}
