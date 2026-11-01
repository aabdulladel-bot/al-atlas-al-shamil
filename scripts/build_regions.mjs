// مناطق شريط القارات في الأطلس (web/data/base/regions.json)، محسوبة من Natural Earth (ملك عام) لا مكتوبة يدوياً.
// لكل قارة (CONTINENT) ولإقليم «غرب آسيا وشمال أفريقيا» (SUBREGION: Western Asia وNorthern Africa) مستطيل من نقاط
// تسمية دولها (LABEL_X/Y): بين المئين الخامس والخامس والتسعين، فلا تمدّ روسيا (أوروبا في المصدر) أوروبا إلى سيبيريا،
// ولا تمدّ الجزر البعيدة القارة، ثم يُمدّ ليشمل البرّ الرئيس لكل دولة نقطتها داخله، ثم هامش 4 درجات. وأوقيانوسيا تعبر خط الطول 180 فتُحسب أطوالها السالبة بعده.
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
// مستطيل أكبر مضلع للدولة (برّها الرئيس، بلا جزرها وأقاليمها البعيدة)
const ringArea = (r) => Math.abs(r.reduce((s, [x, y], i) => { const [x2, y2] = r[(i + 1) % r.length]; return s + x * y2 - x2 * y; }, 0)) / 2;
function mainlandBox(g, wrap) {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  const main = polys.reduce((a, b) => (ringArea(b[0]) > ringArea(a[0]) ? b : a));
  const xs = main[0].map(([x]) => (wrap && x < 0 ? x + 360 : x)), ys = main[0].map(([, y]) => y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
const regions = REGIONS.map(({ id, ar, test, wrap }) => {
  const feats = ne.features.filter((f) => test(f.properties) && Number.isFinite(f.properties.LABEL_X));
  const lx = (p) => (wrap && p.LABEL_X < 0 ? p.LABEL_X + 360 : p.LABEL_X);
  const pts = feats.map((f) => [lx(f.properties), f.properties.LABEL_Y]);
  if (pts.length < 3) throw new Error(`منطقة بلا دول كافية: ${id}`);
  const box = [quantile(pts.map((p) => p[0]), 0.05), quantile(pts.map((p) => p[1]), 0.05), quantile(pts.map((p) => p[0]), 0.95), quantile(pts.map((p) => p[1]), 0.95)];
  // كل دولة نقطة تسميتها داخل المستطيل يُمدّ لها ليشمل برّها الرئيس، فلا تُقطع أستراليا لأن أكثر دول أوقيانوسيا جزر شرقها
  for (const f of feats) {
    const [x, y] = [lx(f.properties), f.properties.LABEL_Y];
    if (x < box[0] - PAD || x > box[2] + PAD || y < box[1] - PAD || y > box[3] + PAD) continue; // داخل المستطيل بهامشه
    const m = mainlandBox(f.geometry, wrap);
    box[0] = Math.min(box[0], m[0]); box[1] = Math.min(box[1], m[1]); box[2] = Math.max(box[2], m[2]); box[3] = Math.max(box[3], m[3]);
  }
  const bbox = [box[0] - PAD, Math.max(-80, box[1] - PAD), box[2] + PAD, Math.min(80, box[3] + PAD)].map(r2);
  return { id, ar, countries: pts.length, bbox };
});
const out = { _meta: { source: "Natural Earth ne_50m_admin_0_countries (ملك عام): CONTINENT وSUBREGION وLABEL_X/Y", rule: "مستطيل نقاط تسمية الدول بين المئين 5 و95، ممدوداً ليشمل البرّ الرئيس لكل دولة داخله، وهامش 4 درجات؛ أوقيانوسيا بأطوال بعد خط 180" }, regions };
fs.writeFileSync(path.join(ROOT, "web/data/base/regions.json"), JSON.stringify(out, null, 1) + "\n");
for (const r of regions) console.log(`${r.ar}: ${r.countries} دولة، ${JSON.stringify(r.bbox)}`);
