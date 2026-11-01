// مناطق شريط القارات في الأطلس (web/data/base/regions.json)، محسوبة من Natural Earth (ملك عام) لا مكتوبة يدوياً.
// لكل قارة (CONTINENT) ولإقليم «غرب آسيا وشمال أفريقيا» (SUBREGION: Western Asia وNorthern Africa) مستطيل من نقاط
// تسمية دولها (LABEL_X/Y): بين المئين الخامس والخامس والتسعين، فلا تمدّ روسيا (أوروبا في المصدر) أوروبا إلى سيبيريا،
// ولا تمدّ الجزر البعيدة القارة، ثم هامش 4 درجات. وأوقيانوسيا تعبر خط الطول 180 فتُحسب أطوالها السالبة بعده.
// الاستعمال: node scripts/build_regions.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ne = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/naturalearth/ne_50m_admin_0_countries.geojson"), "utf8"));
const REGIONS = [
  { id: "mena", ar: "غرب آسيا وشمال أفريقيا", test: (p) => p.SUBREGION === "Western Asia" || p.SUBREGION === "Northern Africa" },
  { id: "asia", ar: "آسيا", test: (p) => p.CONTINENT === "Asia" },
  { id: "africa", ar: "أفريقيا", test: (p) => p.CONTINENT === "Africa" },
  { id: "europe", ar: "أوروبا", test: (p) => p.CONTINENT === "Europe" },
  { id: "namerica", ar: "أمريكا الشمالية", test: (p) => p.CONTINENT === "North America" },
  { id: "samerica", ar: "أمريكا الجنوبية", test: (p) => p.CONTINENT === "South America" },
  { id: "oceania", ar: "أوقيانوسيا", test: (p) => p.CONTINENT === "Oceania", wrap: true },
];
const PAD = 4;
const quantile = (xs, q) => { const s = [...xs].sort((a, b) => a - b); const i = (s.length - 1) * q; const lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
const r2 = (x) => Math.round(x * 100) / 100;
const regions = REGIONS.map(({ id, ar, test, wrap }) => {
  const pts = ne.features.map((f) => f.properties).filter((p) => test(p) && Number.isFinite(p.LABEL_X)).map((p) => [wrap && p.LABEL_X < 0 ? p.LABEL_X + 360 : p.LABEL_X, p.LABEL_Y]);
  if (pts.length < 3) throw new Error(`منطقة بلا دول كافية: ${id}`);
  const bbox = [quantile(pts.map((p) => p[0]), 0.05) - PAD, Math.max(-80, quantile(pts.map((p) => p[1]), 0.05) - PAD), quantile(pts.map((p) => p[0]), 0.95) + PAD, Math.min(80, quantile(pts.map((p) => p[1]), 0.95) + PAD)].map(r2);
  return { id, ar, countries: pts.length, bbox };
});
const out = { _meta: { source: "Natural Earth ne_50m_admin_0_countries (ملك عام): CONTINENT وSUBREGION وLABEL_X/Y", rule: "مستطيل نقاط تسمية الدول بين المئين 5 و95، وهامش 4 درجات؛ أوقيانوسيا بأطوال بعد خط 180" }, regions };
fs.writeFileSync(path.join(ROOT, "web/data/base/regions.json"), JSON.stringify(out, null, 1) + "\n");
for (const r of regions) console.log(`${r.ar}: ${r.countries} دولة، ${JSON.stringify(r.bbox)}`);
