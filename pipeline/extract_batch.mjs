// استخراج الادعاءات عبر Message Batches API (نصف السعر، غير متزامن).
//
// المراحل:
//   plan    <passages.jsonl> <outDir>            يبني الطلبات ويقدّر الكلفة. لا يتصل بالشبكة.
//   submit  <outDir> --budget-usd <N>            يرسل الدفعة. يرفض إن تجاوزت الكلفة السقف.
//   collect <passages.jsonl> <outDir>            ينتظر الدفعة ويفحص كل ادعاء بمطابقة الاقتباس.
//
// كل ادعاء يمر بـ checkQuote قبل أن يُعدّ مرشحاً. ما لا يطابق يذهب إلى flagged.jsonl.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { checkQuote } from "./normalize.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

// الطراز الذي سمّاه المالك في خطة التشغيل.
export const MODEL = "claude-haiku-5-5";
export const MAX_TOKENS = 4000;
// تحت 100 ألف رمز، لأن هايكو 5.5 يتغير سعره فوق هذا الحد.
export const MAX_INPUT_TOKENS = 90_000;
// أسعار هايكو 5.5 لكل مليون رمز. يُحدَّث من جدول الأسعار قبل كل دفعة.
export const PRICE_PER_MTOK = { input: 0.1, output: 0.5 };
export const BATCH_FACTOR = 0.5;
// تقدير متحفظ للعربية. يُستبدل بـ count_tokens عند التشغيل الفعلي.
const CHARS_PER_TOKEN = 3;

export const TYPES = ["event", "state", "quantity", "cause", "description", "judgment", "reported_belief"];
export const LAYERS = ["scripture", "tradition", "contemporary_witness", "later_historian", "material", "modern_scholarship"];

export function loadText(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

export function readJsonl(file) {
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

export function writeJsonl(file, rows) {
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
}

// معرّف الطلب في الدفعة: الحروف والأرقام والشرطة السفلية فقط، بحد 64 حرفاً.
// معرّف المقطع نفسه يحوي نقطتين، فنشتق منه قيمة ثابتة.
export function customId(passageId) {
  return "p_" + crypto.createHash("sha1").update(passageId).digest("hex").slice(0, 40);
}

export function withHash(passage) {
  if (passage.text_hash) return passage;
  const hash = crypto.createHash("sha256").update(passage.text).digest("hex");
  return { ...passage, text_hash: `sha256:${hash}` };
}

export function fillTemplate(template, vars) {
  // يستبدل الحاصرات الموجودة في القالب فقط. قيم المقاطع لا تُفحص مجدداً.
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

export function buildRequest(passage, { system, template }) {
  const prompt = fillTemplate(template, {
    source_title: passage.source_title,
    author: passage.author,
    composed_year: passage.composed_year,
    chapter: passage.chapter ?? "",
    annal_year: passage.annal_year ?? "لا يوجد",
    passage_id: passage.id,
    passage_text: passage.text,
  });
  return {
    custom_id: customId(passage.id),
    params: {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content: prompt }],
    },
  };
}

export function estimateTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function requestText(request) {
  return request.params.system + request.params.messages[0].content;
}

export function estimateBatch(requests, { outputTokensPerRequest = 1500 } = {}) {
  const inputTokens = requests.reduce((sum, r) => sum + estimateTokens(requestText(r)), 0);
  const outputTokens = requests.length * outputTokensPerRequest;
  const raw = (inputTokens * PRICE_PER_MTOK.input + outputTokens * PRICE_PER_MTOK.output) / 1_000_000;
  return {
    requests: requests.length,
    inputTokens,
    outputTokens,
    usd: Number((raw * BATCH_FACTOR).toFixed(4)),
  };
}

export function oversized(requests) {
  return requests
    .filter((r) => estimateTokens(requestText(r)) > MAX_INPUT_TOKENS)
    .map((r) => r.custom_id);
}

// يقبل JSON صافياً، أو JSON محاطاً بنص. لا يقبل أكثر من مصفوفة واحدة.
export function parseClaims(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("[");
    const end = trimmed.lastIndexOf("]");
    if (start === -1 || end <= start) throw new Error("no_json_array");
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

// يفحص نتيجة طلب واحد مقابل المقطع الأصلي.
export function processResult(entry, passage) {
  const base = { passage_id: passage.id };
  if (entry.result.type !== "succeeded") {
    return { ...base, outcome: "failed", reason: entry.result.type, accepted: [], flagged: [] };
  }

  const block = entry.result.message.content.find((b) => b.type === "text");
  let items;
  try {
    items = parseClaims(block?.text ?? "");
  } catch {
    return { ...base, outcome: "failed", reason: "invalid_json", accepted: [], flagged: [] };
  }
  if (!Array.isArray(items)) {
    return { ...base, outcome: "failed", reason: "not_an_array", accepted: [], flagged: [] };
  }

  const accepted = [];
  const flagged = [];
  for (const item of items) {
    const valid =
      typeof item.quote === "string" &&
      typeof item.statement === "string" &&
      TYPES.includes(item.type) &&
      LAYERS.includes(item.layer);
    if (!valid) {
      flagged.push({ ...base, item, status: "rejected", reason: "schema" });
      continue;
    }

    const match = checkQuote(passage.text, item.quote);
    if (match.status !== "ok") {
      flagged.push({ ...base, item, status: match.status, reason: match.reason });
      continue;
    }

    accepted.push({
      ...base,
      ...item,
      quote_index: match.index,
      status: item.needs_review ? "escalated" : "draft",
      reason: item.needs_review ? item.review_reason ?? "needs_review" : null,
    });
  }

  return { ...base, outcome: "ok", accepted, flagged };
}

// الطبقات: A = في الملك العام، B = مرخّص أو محمي بإذن موثّق، C = مرجع للإحالة فقط.
// الطبقة C لا تدخل الاستخراج أبداً، وأي مقطع بلا طبقة معلنة يُرفض.
export function checkLicense(passages) {
  return passages
    .filter((p) => !["A", "B"].includes(p.license_tier))
    .map((p) => ({ id: p.id, license_tier: p.license_tier ?? null }));
}

// ---------- سطر الأوامر ----------

async function cmdPlan(passagesFile, outDir) {
  const passages = readJsonl(passagesFile).map(withHash);
  const refused = checkLicense(passages);
  if (refused.length) {
    throw new Error(`رُفضت ${refused.length} مقاطع: طبقة غير مسموحة أو غير معلنة. أول الرفض: ${JSON.stringify(refused.slice(0, 3))}`);
  }
  const ctx = { system: loadText("prompts/constitution.md"), template: loadText("prompts/claim_extraction_v1.md") };
  const requests = passages.map((p) => buildRequest(p, ctx));

  fs.mkdirSync(outDir, { recursive: true });
  writeJsonl(path.join(outDir, "requests.jsonl"), requests);

  const estimate = estimateBatch(requests);
  const tooBig = oversized(requests);
  console.log(JSON.stringify({ ...estimate, oversized: tooBig }, null, 2));
  if (tooBig.length) {
    console.error(`تعذّر الإرسال: ${tooBig.length} طلب يتجاوز ${MAX_INPUT_TOKENS} رمزاً. قسّم المقاطع أولاً.`);
  }
}

async function cmdSubmit(outDir, budgetUsd) {
  const requests = readJsonl(path.join(outDir, "requests.jsonl"));
  const estimate = estimateBatch(requests);

  if (oversized(requests).length) {
    console.error("تعذّر الإرسال: توجد طلبات فوق حد الرموز. شغّل plan بعد تقسيم المقاطع.");
    process.exit(1);
  }
  if (!(budgetUsd > 0)) {
    console.error("أدخل سقف الإنفاق بالدولار: --budget-usd <N>");
    process.exit(1);
  }
  if (estimate.usd > budgetUsd) {
    console.error(`الكلفة المقدّرة ${estimate.usd}$ تتجاوز السقف ${budgetUsd}$. لن يُرسل شيء.`);
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("لا يوجد ANTHROPIC_API_KEY في البيئة.");
    process.exit(1);
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const batch = await client.messages.batches.create({ requests });
  fs.writeFileSync(
    path.join(outDir, "batch.json"),
    JSON.stringify({ id: batch.id, submitted: new Date().toISOString(), estimate, budget_usd: budgetUsd }, null, 2),
  );
  console.log(`أُرسلت الدفعة ${batch.id}. الكلفة المقدّرة ${estimate.usd}$.`);
}

async function cmdCollect(passagesFile, outDir) {
  const { id } = JSON.parse(fs.readFileSync(path.join(outDir, "batch.json"), "utf8"));
  const passages = readJsonl(passagesFile).map(withHash);
  const byCustomId = new Map(passages.map((p) => [customId(p.id), p]));

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  let batch;
  while (true) {
    batch = await client.messages.batches.retrieve(id);
    if (batch.processing_status === "ended") break;
    console.log(`قيد المعالجة: ${batch.request_counts.processing}`);
    await new Promise((resolve) => setTimeout(resolve, 60_000));
  }

  const accepted = [];
  const flagged = [];
  const failed = [];
  for await (const entry of await client.messages.batches.results(id)) {
    const passage = byCustomId.get(entry.custom_id);
    if (!passage) {
      failed.push({ custom_id: entry.custom_id, reason: "unknown_custom_id" });
      continue;
    }
    const r = processResult(entry, passage);
    if (r.outcome === "failed") failed.push({ passage_id: r.passage_id, reason: r.reason });
    accepted.push(...r.accepted);
    flagged.push(...r.flagged);
  }

  writeJsonl(path.join(outDir, "claims.candidates.jsonl"), accepted);
  writeJsonl(path.join(outDir, "flagged.jsonl"), flagged);
  writeJsonl(path.join(outDir, "failed.jsonl"), failed);
  console.log(JSON.stringify({ accepted: accepted.length, flagged: flagged.length, failed: failed.length }, null, 2));
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const [cmd, ...args] = process.argv.slice(2);
  const budgetIdx = args.indexOf("--budget-usd");
  const budget = budgetIdx >= 0 ? Number(args[budgetIdx + 1]) : undefined;
  const skip = budgetIdx >= 0 ? [budgetIdx, budgetIdx + 1] : [];
  const positional = args.filter((_, i) => !skip.includes(i));

  const run = {
    plan: () => cmdPlan(positional[0], positional[1]),
    submit: () => cmdSubmit(positional[0], budget),
    collect: () => cmdCollect(positional[0], positional[1]),
  }[cmd];

  if (!run) {
    console.error("الاستعمال: plan <passages.jsonl> <outDir> | submit <outDir> --budget-usd N | collect <passages.jsonl> <outDir>");
    process.exit(2);
  }
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
