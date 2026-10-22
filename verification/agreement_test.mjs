import fs from "node:fs";
import { compareRuns } from "../pipeline/agreement.mjs";
const runA = JSON.parse(fs.readFileSync("verification/era1/claims.json", "utf8"));
// اختبار 1: مقارنة الاستخراج بنفسه يجب أن تعطي اتفاقاً كاملاً
console.log("self:", compareRuns(runA, runA).status, compareRuns(runA, runA).rate);
// اختبار 2: نسخة مختلفة فيها ادعاء ناقص وآخر بنوع مختلف
const runB = runA.slice(0, 8).map((c, i) => (i === 0 ? { ...c, type: "event" } : c));
const r = compareRuns(runA, runB);
console.log("altered:", r.status, r.rate, "onlyInB", r.onlyInB);
