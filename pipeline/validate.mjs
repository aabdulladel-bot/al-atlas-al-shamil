// يتحقق من ملف JSON مقابل تعريف في schemas/atlas.schema.json.
// الاستعمال: node pipeline/validate.mjs <نوع-الكيان> <ملف.json>
// مثال: node pipeline/validate.mjs Claim fixtures/sample_claims.json  (يتحقق من مصفوفة claims)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

export function buildValidator() {
  const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas/atlas.schema.json"), "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  ajv.addSchema(schema, "atlas");
  return ajv;
}

export function validateItems(typeName, items) {
  const ajv = buildValidator();
  const validate = ajv.getSchema(`atlas#/$defs/${typeName}`);
  if (!validate) throw new Error(`نوع غير معروف: ${typeName}`);
  return items.map((item, i) => ({
    index: i,
    ok: validate(item) === true,
    errors: validate.errors ?? [],
  }));
}

// تشغيل من سطر الأوامر
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [typeName, file] = process.argv.slice(2);
  if (!typeName || !file) {
    console.error("الاستعمال: node pipeline/validate.mjs <نوع> <ملف.json>");
    process.exit(2);
  }
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const items = Array.isArray(data) ? data : data[`${typeName.toLowerCase()}s`] ?? data.claims ?? [data];
  const results = validateItems(typeName, items);
  const bad = results.filter((r) => !r.ok);
  for (const r of bad) {
    console.error(`عنصر ${r.index} غير صالح:`);
    for (const e of r.errors) console.error(`  ${e.instancePath || "/"} ${e.message}`);
  }
  console.log(`${results.length - bad.length}/${results.length} صالح`);
  process.exit(bad.length ? 1 : 0);
}
