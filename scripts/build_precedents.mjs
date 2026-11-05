// يبني web/data/precedents.json من scripts/config/precedents.json بعد التحقق منه.
// الاستعمال: node scripts/build_precedents.mjs [--check]
import fs from "fs";
import { CONFIG, OUT, loadConfig, loadPassages, validate, publicData } from "./precedents_lib.mjs";

const cfg = loadConfig();
const errors = validate(cfg, loadPassages());
if (errors.length) {
  console.error(`السوابق: ${errors.length} خطأ، لم يُبنَ شيء`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
const out = JSON.stringify(publicData(cfg), null, 2) + "\n";
if (process.argv.includes("--check")) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (cur !== out) {
    console.error("web/data/precedents.json لا يطابق مولّده: شغّل npm run build:precedents");
    process.exit(1);
  }
  console.log("السوابق: مطابقة");
} else {
  fs.writeFileSync(OUT, out);
  console.log(`السوابق: كُتب ${OUT}`);
}
