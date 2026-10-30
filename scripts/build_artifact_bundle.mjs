// يبني نسخة الأطلس المنشورة صفحةً على claude.ai (Artifact) في out/artifact/.
// الصفحة المنشورة لا تصل إلى أي مضيف خارجي، فتُحزم معها بلاطات صور NASA Blue Marble (حتى المستوى SAT_MAX)
// وبلاطات التضاريس (حتى DEM_MAX) في ملفات ثنائية لكل مستوى تقريب مع فهرس بإزاحاتها. يقرؤها بروتوكول pack في app.js
// حين يُعرِّف tilepacks.js المتغيّر TILE_PACKS، وبغيره يبقى الأطلس يجلب البلاطات من الشبكة كالمعتاد.
// والصفحة تُغلَّف عند النشر بهيكل HTML خاص بالمنصة، فتُنزع منها وسوم المستند، وتُضبط اللغة والاتجاه بسكربت.
// الاستعمال: node scripts/build_artifact_bundle.mjs   (يحتاج curl ووصولاً إلى GIBS وTerrain Tiles؛ البلاطات تُخبَّأ في out/tile-cache)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out/artifact");
const CACHE = path.join(ROOT, "out/tile-cache");
const SAT_MAX = 4;
const DEM_MAX = 3;
const MAX_FILE = 15 * 1024 * 1024; // حدّ الملف الثنائي في النشر
const UA = "al-atlas-al-shamil/1.0 (artifact bundle)";
const SAT_URL = (z, x, y) => `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/${z}/${y}/${x}.jpeg`;
const DEM_URL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

function tile(url, file) {
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    execFileSync("curl", ["-sSf", "-m", "60", "-A", UA, "-o", file, url]);
  }
  return fs.readFileSync(file);
}

function pack(layer, urlOf, maxz, ext) {
  const files = {};
  for (let z = 0; z <= maxz; z++) {
    const n = 2 ** z;
    const parts = [];
    const index = {};
    let offset = 0;
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        const buf = tile(urlOf(z, x, y), path.join(CACHE, layer, String(z), String(x), `${y}.${ext}`));
        index[`${x}/${y}`] = [offset, buf.length];
        parts.push(buf);
        offset += buf.length;
      }
    }
    if (offset > MAX_FILE) throw new Error(`${layer} z${z}: ${offset} بايت يتجاوز حدّ الملف`);
    const bin = `tiles/${layer}_z${z}.bin`;
    fs.writeFileSync(path.join(OUT, bin), Buffer.concat(parts));
    fs.writeFileSync(path.join(OUT, `${bin}.json`), JSON.stringify(index));
    files[z] = bin;
    console.log(`${layer} z${z}: ${n * n} بلاطة، ${(offset / 1048576).toFixed(1)} م.ب`);
  }
  return { maxzoom: maxz, files };
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, "web"), OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, "tiles"), { recursive: true });

const packs = { sat: pack("sat", SAT_URL, SAT_MAX, "jpeg"), dem: pack("dem", DEM_URL, DEM_MAX, "png") };
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
