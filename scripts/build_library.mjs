// يبني «المكتبة» للباحث: كل الشواهد المعروضة في ملف واحد للتنزيل (web/data/library/claims.json وclaims.csv)،
// بمعرّفها الثابت وحقبتها ونصها واقتباسها وتحفظها ومصدرها ودرجتيه ومجالاتها، ورابط ثابت يفتحها في الأطلس (#c<رقم>).
// يُعرض ما طابق اقتباسه نصه ولم يُرفض، وهو ما تعرضه الواجهة نفسها (scripts/build_claims.mjs).
// الاستعمال: node scripts/build_library.mjs [--check]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { claimEras } from "./lib/eras.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const CHECK = process.argv.includes("--check");
const OUT = path.join(ROOT, "web/data/library");

const sourceGrades = read("verification/source_grades.json").sources;
const claimGrades = read("verification/claim_grades.json").claims;
const domains = read("verification/claim_domains.json").claims;
const rows = [];
for (const era of claimEras(ROOT)) {
  const passages = new Map(read(`verification/era${era}/passages.json`).map((p) => [p.id, p]));
  for (const c of read(`verification/era${era}/claims.json`)) {
    if (c.checks?.quote_match !== true || c.status === "rejected") continue;
    const p = passages.get(c.passage_id);
    const g = claimGrades[c.id];
    const sid = p?.source_id ?? null;
    rows.push({
      id: c.id,
      link: `#c${Number(c.id.slice(3))}`,
      era,
      statement: c.statement,
      attributed_to: c.attributed_to,
      quote: c.quote,
      hedge: c.hedge,
      chapter: p?.chapter ?? null,
      source_id: sid,
      source_grade: sid ? sourceGrades[sid]?.grade ?? null : null,
      info_grade: g?.info ?? null,
      scope: g?.scope ?? null,
      grade_status: g?.status ?? null,
      domains: domains[c.id]?.domains ?? [],
      owner_reviewed: c.status === "verified",
    });
  }
}
rows.sort((a, b) => a.id.localeCompare(b.id));

const meta = {
  title: "مكتبة الأطلس الشامل: الشواهد الموثّقة",
  count: rows.length,
  built_by: "scripts/build_library.mjs من verification/era*/claims.json وpassages.json والدرجات والمجالات",
  rule: "كل اقتباس مطابق لنص مصدره بـ checkQuote. الشاهد فرضية موثّقة الأصل، لا حكم الأطلس، وتحفّظه جزء منه.",
  grading: "source_grade بنظام الأدميرالية (A–F) وinfo_grade (1–6) بنطاقها scope (fact أو attribution)، كما في verification/GRADING.md",
  licence: "النصوص المقتبسة تابعة لتراخيص مصادرها في LICENSES.md (القسم ب)، ويُنسب كل اقتباس إلى مصدره عند إعادة استعماله.",
  cite: "الأطلس الشامل، الشاهد <المعرّف>، مع رابطه الثابت (عنوان الأطلس متبوعاً بحقل link).",
};
const json = JSON.stringify({ _meta: meta, claims: rows }, null, 1) + "\n";
const COLS = ["id", "link", "era", "statement", "attributed_to", "quote", "hedge", "chapter", "source_id", "source_grade", "info_grade", "scope", "grade_status", "domains", "owner_reviewed"];
const cell = (v) => {
  const s = Array.isArray(v) ? v.join(";") : v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
// علامة BOM في أوله ليقرأ Excel العربية صحيحة
const csv = "﻿" + [COLS.join(","), ...rows.map((r) => COLS.map((k) => cell(r[k])).join(","))].join("\r\n") + "\r\n";

const files = [["claims.json", json], ["claims.csv", csv]];
if (CHECK) {
  const bad = files.filter(([f, t]) => !fs.existsSync(path.join(OUT, f)) || fs.readFileSync(path.join(OUT, f), "utf8") !== t).map(([f]) => f);
  if (bad.length) { console.error(`المكتبة لا تطابق مولّدها: ${bad.join("، ")}. شغّل node scripts/build_library.mjs`); process.exit(1); }
  console.log(`المكتبة: مطابقة (${rows.length} شاهداً)`);
} else {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [f, t] of files) fs.writeFileSync(path.join(OUT, f), t);
  console.log(`كُتبت المكتبة: ${rows.length} شاهداً في web/data/library/ (JSON وCSV)`);
}
