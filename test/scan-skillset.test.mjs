#!/usr/bin/env node
// skill-add/scripts/scan-skillset.test.mjs
//
// Not wired into any package.json test runner (this repo has none — it's
// a plain Node/bash toolset) — run directly with `node scan-skillset.test.mjs`.
//
// Covers three things:
//   1. The poisoned fixture trips every rule category it was built to
//      exercise, and nothing is silently missed.
//   2. The clean fixture — deliberately written to *look* similar
//      (curl, npm install -g, the word "instructions") — produces zero
//      findings, so the rule set isn't so broad it trains reviewers to
//      ignore it.
//   3. Every real, already-shipped skill in this repo scans clean, so
//      shipping this scanner doesn't retroactively flag production
//      content on day one.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanSkillDir, isBlocking } from "../skill-add/scripts/scan-skillset.mjs";
import { findTopLevelSkillDirs } from "../scripts/skill-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

let pass = 0;
let fail = 0;

function check(label, condition, detail) {
  if (condition) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? `\n      ${detail}` : ""}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Poisoned fixture — every planted technique must be caught
// ---------------------------------------------------------------------------
console.log("== Poisoned fixture ==");
const poisonedDir = path.join(__dirname, "fixtures/poisoned-skill");
const poisonedFindings = scanSkillDir(poisonedDir);
const poisonedIds = new Set(poisonedFindings.map((f) => f.id));

console.log(`  (${poisonedFindings.length} total finding(s))`);
for (const f of poisonedFindings) {
  console.log(`    [${f.id}] ${f.severity}  ${path.relative(poisonedDir, f.file)}:${f.line}`);
}

check("catches curl | sudo bash (SEC-EXEC-001)", poisonedIds.has("SEC-EXEC-001"));
check("catches .env piped to curl (SEC-CRED-002)", poisonedIds.has("SEC-CRED-002"));
check("catches 'ignore previous instructions' (SEC-INJECT-001)", poisonedIds.has("SEC-INJECT-001"));
check("catches 'do not mention to user/developer' (SEC-INJECT-003)", poisonedIds.has("SEC-INJECT-003"));
check("catches zero-width unicode (SEC-UNICODE-001)", poisonedIds.has("SEC-UNICODE-001"));
check("catches front-loaded mandatory script (SEC-STRUCT-001)", poisonedIds.has("SEC-STRUCT-001"));
check(
  "at least one finding is blocking severity",
  poisonedFindings.some(isBlocking),
  `severities seen: ${poisonedFindings.map((f) => f.severity).join(", ")}`
);

// ---------------------------------------------------------------------------
// 2. Clean fixture — must produce zero findings despite superficial overlap
// ---------------------------------------------------------------------------
console.log("\n== Clean fixture (false-positive check) ==");
const cleanDir = path.join(__dirname, "fixtures/clean-skill");
const cleanFindings = scanSkillDir(cleanDir);
if (cleanFindings.length) {
  for (const f of cleanFindings) {
    console.log(`    [${f.id}] ${f.severity}  ${path.relative(cleanDir, f.file)}:${f.line}  -> ${f.evidence}`);
  }
}
check("zero findings on legitimate curl/npm/instructions content", cleanFindings.length === 0,
  `got ${cleanFindings.length} finding(s): ${cleanFindings.map((f) => f.id).join(", ")}`);

// ---------------------------------------------------------------------------
// 3. Real repo skills — must all scan clean (no retroactive false positives)
// ---------------------------------------------------------------------------
console.log("\n== Real repo skills (retroactive false-positive sweep) ==");
const realSkillDirs = findTopLevelSkillDirs(REPO_ROOT);
console.log(`  scanning ${realSkillDirs.length} skill folder(s) under ${REPO_ROOT}`);

// test/fixtures/ lives outside every real skill folder (it's a sibling of
// skill-add/, not nested inside it), so findTopLevelSkillDirs never
// returns it and this sweep only ever touches genuinely shipped skill
// content — no filtering needed here.
let realFindingsTotal = 0;
for (const dir of realSkillDirs) {
  const findings = scanSkillDir(dir);
  if (findings.length) {
    realFindingsTotal += findings.length;
    console.log(`  -- ${path.basename(dir)} --`);
    for (const f of findings) {
      console.log(`    [${f.id}] ${f.severity}  ${path.relative(dir, f.file)}:${f.line}  -> ${f.evidence}`);
    }
  }
}
check("zero findings across all real, already-shipped skills", realFindingsTotal === 0,
  `got ${realFindingsTotal} finding(s) total — see above`);

// ---------------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
