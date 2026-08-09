#!/usr/bin/env node
// plan-feature/scripts/interview-cli.mjs
//
//   open     --repo-root <d> --title <featureTitle>
//   answer   --repo-root <d> --title <featureTitle>
//            --failure-modes <a> --must-never <a> --perf-constraints <a>
//            --rollback <a> --out-of-scope <a>
//   status   --repo-root <d> --title <featureTitle>

import { openInterview, loadInterview, answerInterview, isReadyToPlan, InterviewError, STANDARD_QUESTIONS } from "./interview-lib.mjs";

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function requireRepoRoot(a) {
  if (!a["repo-root"]) die("--repo-root is required");
  return a["repo-root"];
}
function requireTitle(a) {
  if (!a.title) die("--title is required");
  return a.title;
}

function cmdOpen(a) {
  const repoRoot = requireRepoRoot(a);
  const title = requireTitle(a);
  openInterview(repoRoot, title);
  console.log(`✓ interview opened for "${title}"`);
  for (const q of STANDARD_QUESTIONS) console.log(`  [${q.id}] ${q.prompt}`);
}

function cmdAnswer(a) {
  const repoRoot = requireRepoRoot(a);
  const title = requireTitle(a);
  try {
    answerInterview(repoRoot, title, {
      failure_modes: a["failure-modes"],
      must_never: a["must-never"],
      perf_constraints: a["perf-constraints"],
      rollback: a.rollback,
      out_of_scope: a["out-of-scope"],
    });
    console.log(`✓ interview answered for "${title}" — readyToPlan: true`);
  } catch (err) {
    if (err instanceof InterviewError) die(err.message);
    throw err;
  }
}

function cmdStatus(a) {
  const repoRoot = requireRepoRoot(a);
  const title = requireTitle(a);
  const record = loadInterview(repoRoot, title);
  if (!record) { console.log("no interview found"); return; }
  console.log(`status: ${record.status}`);
  console.log(`readyToPlan: ${isReadyToPlan(repoRoot, title)}`);
  if (record.status === "answered") {
    for (const q of STANDARD_QUESTIONS) {
      console.log(`\n[${q.id}] ${q.prompt}`);
      console.log(`  → ${record.answers[q.id]}`);
    }
  }
}

const [, , cmd, ...rest] = process.argv;
const a = args(rest);

switch (cmd) {
  case "open": cmdOpen(a); break;
  case "answer": cmdAnswer(a); break;
  case "status": cmdStatus(a); break;
  default:
    console.error("usage: interview-cli.mjs <open|answer|status> [options]");
    process.exit(1);
}
