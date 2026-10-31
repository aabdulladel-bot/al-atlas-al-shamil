// يبني نسخة الأطلس المنشورة صفحةً على claude.ai (Artifact) في out/artifact/.
// الصفحة المنشورة لا تصل إلى أي مضيف خارجي، فتُحزم معها بلاطات صور NASA Blue Marble وبلاطات التضاريس:
// العالم كله حتى مستوى، ثم مستويات أعمق لإقليم العالم القديم وحده (REGION). لكل مستوى فهرس بمواضع بلاطاته
// وقطع لا تتجاوز حدّ الملف. يقرؤها بروتوكولا pack وdem0 في app.js حين يُعرِّف tilepacks.js المتغيّر TILE_PACKS،
// ويشتقّان ما خارج الإقليم من أقرب سلف محزوم. وبغيرها يبقى الأطلس يجلب البلاطات من الشبكة كالمعتاد.
// والصفحة تُغلَّف عند النشر بهيكل HTML خاص بالمنصة، فتُنزع منها وسوم المستند، وتُضبط اللغة والاتجاه بسكربت.
// الاستعمال: node scripts/build_artifact_bundle.mjs   (يحتاج curl ووصولاً إلى GIBS وTerrain Tiles؛ البلاطات تُخبَّأ في out/tile-cache)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out/artifact");
const CACHE = path.join(ROOT, "out/tile-cache");
// المستويات: «global» العالم كله، والمستطيل [غرب، جنوب، شرق، شمال] إقليم وحده
const SAT_LEVELS = { 0: "global", 1: "global", 2: "global", 3: "global", 4: "global", 5: "global", 6: [-20, -5, 80, 60], 7: [-12, 8, 68, 50], 8: [-10, 12, 62, 46] };
const DEM_LEVELS = { 0: "global", 1: "global", 2: "global", 3: "global", 4: [-20, -5, 80, 60], 5: [-12, 8, 68, 50] };
// المنصة لا تقدّم ملفات ثنائية عامة، فتُكتب الحزمة نصاً بترميز base64، وحدّ الملف النصي 16 م.ب
const MAX_FILE = 16 * 1024 * 1024;
const CHUNK_RAW = Math.floor((MAX_FILE * 3) / 4) - 65536; // ما يتّسع له ملف واحد قبل الترميز
const UA = "al-atlas-al-shamil/1.0 (artifact bundle)";
const SAT_URL = (z, x, y) => `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/${z}/${y}/${x}.jpeg`;
const DEM_URL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const LIGHTS_URL = (z, x, y) => `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/${z}/${y}/${x}.png`;
// أضواء الليل (NASA Black Marble 2016): العالم حتى 4 والإقليم في 5، وتُحوَّل PNG إلى JPEG لأن أكثرها سواد
const LIGHTS_LEVELS = { 0: "global", 1: "global", 2: "global", 3: "global", 4: "global", 5: [-20, -5, 80, 60] };

function tile(url, file, toJpeg = false) {
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    execFileSync("curl", ["-sSf", "-m", "60", "-A", UA, "-o", file, url]);
  }
  if (!toJpeg) return fs.readFileSync(file);
  const jpg = file.replace(/\.png$/, ".jpg");
  if (!fs.existsSync(jpg)) execFileSync("convert", [file, "-background", "black", "-flatten", "-quality", "82", jpg]);
  return fs.readFileSync(jpg);
}

// نطاق البلاطات في مستوى: العالم كله أو ما يغطي المستطيل
function tileRange(z, area) {
  const n = 2 ** z;
  if (area === "global") return { x0: 0, x1: n - 1, y0: 0, y1: n - 1 };
  const tx = (lon) => Math.min(n - 1, Math.max(0, Math.floor(((lon + 180) / 360) * n)));
  const ty = (lat) => { const r = (lat * Math.PI) / 180; return Math.min(n - 1, Math.max(0, Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n))); };
  const [w, s, e, nn] = area;
  return { x0: tx(w), x1: tx(e), y0: ty(nn), y1: ty(s) };
}

function pack(layer, urlOf, levels, ext, toJpeg = false) {
  const files = {};
  for (const [zs, area] of Object.entries(levels)) {
    const z = Number(zs);
    const { x0, x1, y0, y1 } = tileRange(z, area);
    const index = {};
    const chunks = [];
    let parts = [], offset = 0, count = 0, total = 0;
    const flush = () => {
      if (!parts.length) return;
      const name = `tiles/${layer}_z${z}_${chunks.length}.txt`;
      const b64 = Buffer.concat(parts).toString("base64");
      if (b64.length > MAX_FILE) throw new Error(`${name}: ${b64.length} بايت يتجاوز حدّ الملف`);
      fs.writeFileSync(path.join(OUT, name), b64);
      chunks.push(name);
      parts = [];
      offset = 0;
    };
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const buf = tile(urlOf(z, x, y), path.join(CACHE, layer, String(z), String(x), `${y}.${ext}`), toJpeg);
        if (offset + buf.length > CHUNK_RAW) flush();
        index[`${x}/${y}`] = [chunks.length, offset, buf.length];
        parts.push(buf);
        offset += buf.length;
        count++;
        total += buf.length;
      }
    }
    flush();
    const idx = `tiles/${layer}_z${z}.json`;
    fs.writeFileSync(path.join(OUT, idx), JSON.stringify(index));
    files[z] = { index: idx, chunks };
    console.log(`${layer} z${z}${area === "global" ? "" : " (إقليمي)"}: ${count} بلاطة، ${(total / 1048576).toFixed(1)} م.ب في ${chunks.length} قطعة`);
  }
  return { maxzoom: Math.max(...Object.keys(levels).map(Number)), files };
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, "web"), OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, "tiles"), { recursive: true });

const packs = { sat: pack("sat", SAT_URL, SAT_LEVELS, "jpeg"), dem: pack("dem", DEM_URL, DEM_LEVELS, "png"), lights: pack("lights", LIGHTS_URL, LIGHTS_LEVELS, "png", true) };
fs.writeFileSync(path.join(OUT, "tilepacks.js"), `// بلاطات محزومة مع النسخة المنشورة (scripts/build_artifact_bundle.mjs)\nwindow.TILE_PACKS = ${JSON.stringify(packs)};\n`);

let html = fs.readFileSync(path.join(ROOT, "web/index.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "web/vendor/maplibre-gl.css"), "utf8");
const bodyAttr = /<body([^>]*)>/i.exec(html)?.[1] ?? "";
const mode = /data-mode="([^"]*)"/.exec(bodyAttr)?.[1];
html = html
  .replace(/<!doctype html>\s*/i, "")
  .replace(/<html[^>]*>\s*/i, "")
  .replace(/<\/html>\s*/i, "")
  .replace(/<head>\s*/i, "")
  .replace(/<\/head>\s*/i, "")
  .replace(/<body[^>]*>\s*/i, "")
  .replace(/<\/body>\s*/i, "")
  .replace(/<meta charset[^>]*>\s*/i, "")
  .replace(/<meta name="viewport"[^>]*>\s*/i, "")
  .replace(/<link rel="stylesheet" href="vendor\/maplibre-gl\.css">/, () => `<style>${css}</style>`);
// اللغة والاتجاه ونمط العرض كانت على وسمَي html وbody، والهيكل المنشور لا يحملها
const setup = `<script>document.documentElement.lang = "ar"; document.documentElement.dir = "rtl";${mode ? ` document.body.dataset.mode = "${mode}";` : ""}</script>`;
html = html.replace(/(<title>[^<]*<\/title>)/, `$1\n  ${setup}`);
if (!html.includes('<script src="app.js"></script>')) throw new Error("لم يُعثر على وسم app.js في الصفحة");
html = html.replace('<script src="app.js"></script>', '<script src="tilepacks.js"></script>\n  <script src="app.js"></script>');
fs.writeFileSync(path.join(OUT, "index.html"), html);

const all = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else all.push(p); } };
walk(OUT);
const big = all.filter((f) => fs.statSync(f).size > MAX_FILE);
if (big.length) throw new Error(`ملفات تتجاوز الحدّ: ${big.join("، ")}`);
const total = all.reduce((s, f) => s + fs.statSync(f).size, 0);
console.log(`النسخة المنشورة: ${all.length} ملفاً، ${(total / 1048576).toFixed(1)} م.ب في ${path.relative(ROOT, OUT)}`);
