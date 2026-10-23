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
if (bad || dups.length) process.exit(1);
