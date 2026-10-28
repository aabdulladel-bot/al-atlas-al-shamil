// يبني الرحلات السردية من journeys/*.json إلى web/data/journeys/.
// كل نص تاريخي يُؤخذ من السُّنّة أو الادعاء الموثّق أو الاختبار الكمي؛ وجمل الربط وحدها مكتوبة في ملف الرحلة.
// يفشل البناء إن لم تُغطَّ كل شواهد السُّنّة المؤيدة والمقيِّدة، أو وُجد رقم في جملة ربط.
// الاستعمال: node scripts/build_journeys.mjs [--check]   (--check يتحقق دون أن يكتب)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { claimEras } from "./lib/eras.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const KINDS = new Set(["khaldun", "evidence", "limits", "quant", "end"]);
const TITLES = { khaldun: "ابن خلدون", limits: "ما يقيّد السُّنّة", quant: "الاختبار الكمي", end: "خلاصة" };
const BORDERS = new Set([-4000, -1000, -1, 700, 1200, 1600, 1800, 1914, 1945, 2010, "modern"]);
const DIGITS = /[0-9٠-٩۰-۹]/;
const MAX_WORDS = 25;
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const errors = [];

const sunanList = (() => { const s = read("sunan/sunan.json"); return s.sunan ?? s; })();
const webSunanList = (() => { const s = read("web/data/sunan.json"); return s.sunan ?? s; })();

const claims = new Map();
for (const era of claimEras(ROOT)) for (const c of read(`verification/era${era}/claims.json`)) claims.set(c.id, { ...c, era });

// أسماء الحقب من web/app.js (مصدر واحد للتسميات، لا نسخة ثانية)
const appJs = fs.readFileSync(path.join(ROOT, "web/app.js"), "utf8");
const eraLabel = new Map([...appJs.matchAll(/border: (-?\d+|"modern"), label: "([^"]+)"/g)].map((m) => [m[1].replaceAll('"', ""), m[2]]));

const points = read("web/data/claim_points.geojson").features;
const placesOf = (id) => points.filter((f) => f.properties.claim_ids.includes(`,${id},`));

const item = (c) => ({ id: c.id, era: c.era, statement: c.statement, attributed_to: c.attributed_to, hedge: c.hedge, quote: c.quote });
const checked = (c, where) => {
  if (c.checks?.quote_match !== true) errors.push(`${where}: ${c.id} لم يطابق اقتباسه`);
  if (c.status === "rejected") errors.push(`${where}: ${c.id} مرفوض`);
};

function cameraFor(st, ids, where) {
  if (st.camera === "world") return { world: true };
  if (st.camera !== "places") { errors.push(`${where}: كاميرا غير معروفة ${st.camera}`); return { world: true }; }
  const feats = [...new Map(ids.flatMap(placesOf).map((f) => [f.id ?? f.properties.slug, f])).values()];
  if (!feats.length) { errors.push(`${where}: لا مكان لأي من الادعاءات، والكاميرا تحتاج مكاناً`); return { world: true }; }
  const coords = [...new Set(feats.map((f) => f.geometry.coordinates.join(",")))].map((s) => s.split(",").map(Number));
  const camera = coords.length === 1 ? { point: coords[0] } : { bbox: [Math.min(...coords.map((c) => c[0])), Math.min(...coords.map((c) => c[1])), Math.max(...coords.map((c) => c[0])), Math.max(...coords.map((c) => c[1]))] };
  camera.placeName = feats[0].properties.name_ar;
  return camera;
}

const journeys = [];
for (const file of fs.readdirSync(path.join(ROOT, "journeys")).filter((f) => f.endsWith(".json")).sort()) {
  const spec = read(`journeys/${file}`);
  const sn = sunanList.find((s) => s.id === spec.sunna);
  const web = webSunanList.find((s) => s.id === spec.sunna);
  if (!sn || !web) { errors.push(`${spec.id}: لا سُنّة ${spec.sunna}`); continue; }
  const supporting = new Set(sn.supporting.map((s) => s.claim));
  const limitingClaims = new Set(sn.limiting.filter((l) => l.kind === "claim").map((l) => l.claim));
  const covered = new Set();
  const steps = [];

  spec.steps.forEach((st, i) => {
    const where = `${spec.id} خطوة ${i + 1}`;
    if (!KINDS.has(st.kind)) errors.push(`${where}: نوع غير معروف ${st.kind}`);
    const border = st.border === "modern" ? "modern" : Number(st.border);
    if (!BORDERS.has(border)) errors.push(`${where}: حدود غير معروفة ${st.border}`);
    if (typeof st.frame !== "string" || DIGITS.test(st.frame)) errors.push(`${where}: جملة الربط فيها رقم أو ليست نصاً`);
    else if (st.frame.trim().split(/\s+/).length > MAX_WORDS) errors.push(`${where}: جملة الربط أطول من ${MAX_WORDS} كلمة`);

    let items = [];
    let ids = [];
    if (st.kind === "evidence") {
      for (const id of st.claims ?? []) {
        const c = claims.get(id);
        if (!c) { errors.push(`${where}: ادعاء ${id} غير موجود`); continue; }
        if (!supporting.has(id)) errors.push(`${where}: ${id} ليس شاهداً مؤيداً لـ ${sn.id}`);
        checked(c, where);
        covered.add(id);
        ids.push(id);
        items.push(item(c));
      }
      if (!items.length) errors.push(`${where}: خطوة شواهد بلا شاهد`);
    } else if (st.kind === "limits") {
      for (const l of sn.limiting) {
        if (l.kind === "claim") {
          const c = claims.get(l.claim);
          if (!c) { errors.push(`${where}: ادعاء ${l.claim} غير موجود`); continue; }
          checked(c, where);
          covered.add(l.claim);
          ids.push(l.claim);
          items.push({ ...item(c), note: l.note });
        } else items.push({ caution: l.note });
      }
    } else if (st.kind === "quant") {
      if (!web.quantitative?.length) errors.push(`${where}: لا اختبار كمي لـ ${sn.id}`);
      items = (web.quantitative ?? []).map((q) => ({ scope: q.scope, verdict: q.verdict, text: q.text }));
    } else if (st.kind === "khaldun") {
      items = [{ hypothesis: sn.hypothesis, khaldun: sn.khaldun }];
    }

    const camera = cameraFor(st, ids, where);
    const title = st.kind === "evidence"
      ? `${camera.placeName ?? "شاهد بلا مكان محدد"} · ${eraLabel.get(String(border)) ?? ""}`
      : TITLES[st.kind];
    steps.push({ kind: st.kind, border, title, frame: st.frame, camera, items });
  });

  for (const id of [...supporting, ...limitingClaims]) if (!covered.has(id)) errors.push(`${spec.id}: الشاهد ${id} لا يظهر في أي خطوة`);
  journeys.push({ id: spec.id, title: spec.title, sunna: spec.sunna, steps });
}

if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`فشل التحقق: ${errors.length} خطأ`);
  process.exit(1);
}
if (CHECK) {
  console.log(journeys.map((j) => `${j.id}: ${j.steps.length} خطوات، تغطية كاملة للشواهد`).join("\n"));
  process.exit(0);
}
const out = path.join(ROOT, "web/data/journeys");
fs.mkdirSync(out, { recursive: true });
for (const j of journeys) fs.writeFileSync(path.join(out, `${j.id}.json`), JSON.stringify(j, null, 2) + "\n");
fs.writeFileSync(path.join(out, "index.json"), JSON.stringify(journeys.map((j) => ({ id: j.id, title: j.title, sunna: j.sunna, steps: j.steps.length })), null, 2) + "\n");
console.log(journeys.map((j) => `كُتب ${j.id}: ${j.steps.length} خطوات`).join("\n"));
