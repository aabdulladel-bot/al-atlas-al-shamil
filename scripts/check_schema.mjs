// يتحقق من كل الادعاءات والمقاطع بالمدقق الرسمي (pipeline/validate.mjs، وضع صارم)، ومن تفرّد المعرّفات.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateItems } from "../pipeline/validate.mjs";
import { claimEras } from "./lib/eras.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let bad = 0, total = 0;
const ids = new Set(), dups = [];
for (const era of claimEras(ROOT)) {
  const claims = JSON.parse(fs.readFileSync(path.join(ROOT, "verification", `era${era}`, "claims.json"), "utf8"));
  for (const r of validateItems("Claim", claims)) {
    total++;
    if (!r.ok) { bad++; console.log(`era${era} ${claims[r.index].id}: ${JSON.stringify(r.errors.slice(0, 2))}`); }
  }
  for (const c of claims) { if (ids.has(c.id)) dups.push(c.id); ids.add(c.id); }
}
console.log(`المخطط: ${total - bad}/${total} صالح، معرّفات مكررة: ${dups.length}`);
// كل ادعاء له مجال أو أكثر من التصنيف الحاكم، ولا تصنيف لادعاء غير موجود
const valid = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/config/domains.json"), "utf8")).domains.map((d) => d.id));
const dom = JSON.parse(fs.readFileSync(path.join(ROOT, "verification/claim_domains.json"), "utf8")).claims;
const domBad = [...ids].filter((id) => !dom[id] || !dom[id].domains.length || dom[id].domains.some((d) => !valid.has(d)) || !["model_draft", "reviewed"].includes(dom[id].status));
const domExtra = Object.keys(dom).filter((id) => !ids.has(id));
console.log(`المجالات: ${ids.size - domBad.length}/${ids.size} مصنّف، تصنيفات بلا ادعاء: ${domExtra.length}`);
if (domBad.length) console.log(`بلا مجال صالح: ${domBad.slice(0, 10).join(" ")}`);
// سجل المصادر المرجعية: مجالاته من التصنيف الحاكم، وإحالاته إلى المانيفست قائمة، ولا «متحقق» بلا وسيلة تحقق
const reg = JSON.parse(fs.readFileSync(path.join(ROOT, "sources/registry.json"), "utf8")).sources;
const man = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, "sources/manifest.json"), "utf8")).sources.map((m) => m.id));
const regBad = reg.filter((e) => !e.domains?.length || e.domains.some((d) => !valid.has(d)) || (e.manifest_id && !man.has(e.manifest_id)) || (e.license_status === "verified" && !e.verified_via) || !["verified", "unverified"].includes(e.license_status));
console.log(`سجل المصادر: ${reg.length - regBad.length}/${reg.length} سليم`);
if (regBad.length) console.log(`مداخل معيبة: ${regBad.map((e) => e.id).join(" ")}`);
if (bad || dups.length || domBad.length || domExtra.length || regBad.length) process.exit(1);
