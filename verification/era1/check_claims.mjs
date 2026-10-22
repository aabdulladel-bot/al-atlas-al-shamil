import fs from "node:fs";
import path from "node:path";
import { checkQuote } from "../../pipeline/normalize.mjs";
const dir = path.resolve("verification/era1");
const claims = JSON.parse(fs.readFileSync(path.join(dir, "claims.json"), "utf8"));
const passages = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(dir, "passages.json"), "utf8")).map((p) => [p.id, p]));
let ok = 0;
for (const c of claims) {
  const p = passages[c.passage_id];
  const r = checkQuote(p ? p.text : "", c.quote);
  c.checks.quote_match = r.status === "ok";
  if (r.status === "ok") ok++;
  console.log(`${r.status.padEnd(9)} ${c.id} ${c.status}`);
}
fs.writeFileSync(path.join(dir, "claims.json"), JSON.stringify(claims, null, 2));
console.log(`quote_match ok: ${ok}/${claims.length}`);
