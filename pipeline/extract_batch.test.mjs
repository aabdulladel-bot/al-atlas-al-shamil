import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  customId,
  buildRequest,
  estimateBatch,
  oversized,
  parseClaims,
  processResult,
  fillTemplate,
  checkLicense,
  MAX_INPUT_TOKENS,
} from "./extract_batch.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const load = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const sample = JSON.parse(load("fixtures/sample_claims.json"));
const passage = {
  ...sample.passage,
  source_title: "نص تجريبي",
  author: "مؤلف تجريبي",
  composed_year: 900,
};
const ctx = { system: "دستور تجريبي", template: load("prompts/claim_extraction_v1.md") };

test("معرّف الطلب يطابق قيود الدفعة", () => {
  const id = customId(passage.id);
  assert.match(id, /^[a-zA-Z0-9_-]{1,64}$/);
  assert.equal(id, customId(passage.id), "المعرّف ثابت للمقطع نفسه");
});

test("الطلب يحمل الطراز والدستور والنص داخل القالب", () => {
  const req = buildRequest(passage, ctx);
  assert.equal(req.params.model, "claude-haiku-5-5");
  assert.equal(req.params.system, "دستور تجريبي");
  const prompt = req.params.messages[0].content;
  assert.ok(prompt.includes(passage.text), "نص المقطع داخل الطلب");
  assert.ok(prompt.includes("نص تجريبي"), "عنوان المصدر داخل الطلب");
  assert.ok(!/\{passage_text\}/.test(prompt), "لا تبقى حاصرات بلا قيمة");
});

test("القالب لا يعيد فحص قيم المقاطع", () => {
  const out = fillTemplate("أ {x} ب", { x: "{y} نص" });
  assert.equal(out, "أ {y} نص ب");
});

test("التقدير يعطي كلفة موجبة وعدداً صحيحاً من الطلبات", () => {
  const est = estimateBatch([buildRequest(passage, ctx)]);
  assert.equal(est.requests, 1);
  assert.ok(est.usd > 0 && est.usd < 0.01, `كلفة طلب واحد صغيرة، وصلت ${est.usd}`);
});

test("يكشف الطلب الذي يتجاوز حد الرموز", () => {
  const huge = { ...passage, text: "ا".repeat(MAX_INPUT_TOKENS * 3 + 10) };
  const req = buildRequest(huge, ctx);
  assert.deepEqual(oversized([req]), [req.custom_id]);
  assert.deepEqual(oversized([buildRequest(passage, ctx)]), []);
});

test("يقرأ JSON محاطاً بنص", () => {
  const items = parseClaims('إليك النتيجة:\n[{"quote":"أ"}]\nانتهى.');
  assert.equal(items[0].quote, "أ");
});

test("يعيد الفشل عند غياب JSON", () => {
  assert.throws(() => parseClaims("لا توجد مصفوفة هنا"));
});

function succeeded(text) {
  return {
    custom_id: customId(passage.id),
    result: { type: "succeeded", message: { content: [{ type: "text", text }] } },
  };
}

test("ادعاء مطابق يُقبل مرشحاً، وادعاء مختلق يُرفض، وادعاء بعلامة مراجعة يُحال", () => {
  const output = JSON.stringify([
    {
      quote: "فبنى الخليفة مدينة السلام",
      statement: "بنى الخليفة مدينة السلام",
      type: "event",
      layer: "later_historian",
    },
    {
      quote: "عبارة لم ترد في المقطع أبداً",
      statement: "ادعاء مختلق",
      type: "event",
      layer: "later_historian",
    },
    {
      quote: "كانت مدورة الشكل",
      statement: "كانت المدينة مدورة",
      type: "description",
      layer: "later_historian",
      attributed_to: "الراوي",
      needs_review: true,
      review_reason: "نسبة الخبر غير واضحة",
    },
  ]);
  const r = processResult(succeeded(output), passage);

  assert.equal(r.outcome, "ok");
  assert.equal(r.accepted.length, 2);
  assert.equal(r.accepted[0].status, "draft");
  assert.equal(r.accepted[1].status, "escalated");
  assert.equal(r.accepted[1].reason, "نسبة الخبر غير واضحة");
  assert.equal(r.flagged.length, 1);
  assert.equal(r.flagged[0].reason, "not_found");
});

test("ادعاء بنوع غير مسموح يُرفض بسبب المخطط", () => {
  const output = JSON.stringify([
    { quote: "فبنى الخليفة مدينة السلام", statement: "x", type: "rumor", layer: "later_historian" },
  ]);
  const r = processResult(succeeded(output), passage);
  assert.equal(r.accepted.length, 0);
  assert.equal(r.flagged[0].reason, "schema");
});

test("رد غير صالح للتحليل يُعدّ فشلاً ولا يُنتج ادعاءات", () => {
  const r = processResult(succeeded("ليس JSON على الإطلاق"), passage);
  assert.equal(r.outcome, "failed");
  assert.equal(r.reason, "invalid_json");
  assert.equal(r.accepted.length, 0);
});

test("طلب انتهت صلاحيته يُعدّ فشلاً بسببه", () => {
  const r = processResult({ custom_id: "x", result: { type: "expired" } }, passage);
  assert.equal(r.outcome, "failed");
  assert.equal(r.reason, "expired");
});

test("الطبقة C والطبقة غير المعلنة تُرفضان من الاستخراج، والطبقتان A وB مقبولتان", () => {
  const rows = [
    { id: "a:1:1", license_tier: "A" },
    { id: "b:1:1", license_tier: "B" },
    { id: "c:1:1", license_tier: "C" },
    { id: "d:1:1" },
  ];
  const refused = checkLicense(rows).map((r) => r.id);
  assert.deepEqual(refused, ["c:1:1", "d:1:1"]);
});
