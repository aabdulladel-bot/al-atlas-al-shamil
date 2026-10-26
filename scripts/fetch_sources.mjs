// يجلب ملفات المصادر المفتوحة ويسجّل بصمتها في manifest.
// الاستخدام: node scripts/fetch_sources.mjs [manifest] [outDir]
// يرفض أي مصدر بلا ترخيص معلن، أو من الطبقة C. الروابط الفارغة تُتخطى ولا تُخمَّن.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const manifestPath = process.argv[2] ?? "sources/manifest.json";
const outDir = process.argv[3] ?? "data/raw";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function refusal(src) {
  if (src.tier === "C") return "الطبقة C لا تُجلب";
  if (!src.license) return "الترخيص غير معلن";
  return null;
}

fs.mkdirSync(outDir, { recursive: true });
let fetched = 0;
for (const src of manifest.sources) {
  // مصادر وقت العرض (بلاطات يجلبها المتصفح) لا تُنزَّل ولا تُخزَّن
  if (src.runtime) continue;
  const why = refusal(src);
  if (why) {
    src.status = `refused: ${why}`;
    continue;
  }
  if (!src.url) {
    src.status = `skipped: لا يوجد رابط ملف مؤكد بعد${src.note ? " (" + src.note + ")" : ""}`;
    continue;
  }
  try {
    // curl يحترم HTTPS_PROXY وCA البيئة، و fetch في Node لا يفعل ذلك.
    const file = path.join(outDir, src.file);
    const r = spawnSync("curl", ["-sSfL", "--max-time", "600", "-o", file, src.url], { encoding: "utf8" });
    if (r.status !== 0) throw new Error(r.stderr.trim() || `curl exit ${r.status}`);
    const buf = fs.readFileSync(file);
    src.sha256 = crypto.createHash("sha256").update(buf).digest("hex");
    src.bytes = buf.length;
    src.retrieved_at = new Date().toISOString();
    src.status = "ok";
    fetched++;
  } catch (err) {
    src.status = `failed: ${err.message}`;
  }
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`جُلب ${fetched} من ${manifest.sources.length}`);
for (const s of manifest.sources) console.log(`${s.id}: ${s.status}`);
