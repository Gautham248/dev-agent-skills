#!/usr/bin/env node
// fix-bug/scripts/ledger-cli.mjs
//
//   check  --repo-root <d> --description <text> --hypothesis <text>
//   record --repo-root <d> --description <text> --hypothesis <text>
//          --diff-summary <text> --outcome accepted|rejected|pending
//          [--files <a,b,c>] [--commit-sha <sha>] [--feedback <text>]
//   show   --repo-root <d> --description <text>
//
// Everything here is mechanical. The model supplies the hypothesis and
// outcome text; this decides whether a hypothesis is a known dead end and
// keeps the append-only record.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadLedger,
  appendAttempt,
  isKnownDeadEnd,
  renderLedgerBrief,
  hasAcceptedAttempt,
  LedgerError,
} from "./ledger-lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

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
  const root = a["repo-root"];
  if (!root) die("--repo-root is required");
  return root;
}
function requireDescription(a) {
  const d = a.description;
  if (!d || typeof d !== "string") die("--description is required");
  return d;
}

// ---------------------------------------------------------------------------
function cmdCheck(a) {
  const repoRoot = requireRepoRoot(a);
  const description = requireDescription(a);
  const hypothesis = a.hypothesis;
  if (!hypothesis) die("--hypothesis is required");

  let ledger;
  try {
    ledger = loadLedger(repoRoot, description);
  } catch (e) {
    if (e instanceof LedgerError) die(e.message);
    throw e;
  }

  console.log(renderLedgerBrief(ledger));
  console.log("");

  const dead = isKnownDeadEnd(ledger, hypothesis);
  if (dead.match) {
    console.log(`✗ KNOWN DEAD END — this matches attempt #${dead.attempt.n}, already rejected.`);
    console.log(`  Prior hypothesis: ${dead.attempt.hypothesis}`);
    console.log(`  Rejected because: ${dead.attempt.human_feedback}`);
    console.log(`  Do not propose this again. Find a materially different hypothesis.`);
    process.exitCode = 2;
  } else if (ledger.attempts.length > 0) {
    console.log(`✓ Not a known dead end. ${ledger.attempts.length} prior attempt(s) exist for this issue -- reviewed above, none match this hypothesis.`);
  } else {
    console.log(`✓ No prior attempts for this issue. Clean start.`);
  }

  if (hasAcceptedAttempt(ledger)) {
    console.log("");
    console.log(`⚠ An earlier attempt on this issue was already marked accepted. Confirm with the developer this issue actually needs another fix before proceeding.`);
  }
}

// ---------------------------------------------------------------------------
function cmdRecord(a) {
  const repoRoot = requireRepoRoot(a);
  const description = requireDescription(a);
  const hypothesis = a.hypothesis;
  const diffSummary = a["diff-summary"];
  const outcome = a.outcome;
  if (!hypothesis) die("--hypothesis is required");
  if (!diffSummary) die("--diff-summary is required");
  if (!outcome) die("--outcome is required (accepted | rejected | pending)");

  const attempt = {
    hypothesis,
    diff_summary: diffSummary,
    outcome,
    files_changed: a.files ? String(a.files).split(",").map((s) => s.trim()).filter(Boolean) : [],
    commit_sha: a["commit-sha"] || null,
    human_feedback: a.feedback || null,
    supersedes: a.supersedes !== undefined ? Number(a.supersedes) : null,
  };

  let result;
  try {
    result = appendAttempt(repoRoot, description, attempt);
  } catch (e) {
    if (e instanceof LedgerError) die(e.message);
    throw e;
  }

  console.log(`✓ Recorded attempt #${result.wrote.n} [${outcome}] at ${result.path}`);
  if (outcome === "rejected") {
    console.log(`  This hypothesis will be flagged as a known dead end on future checks.`);
  }
}

// ---------------------------------------------------------------------------
function cmdShow(a) {
  const repoRoot = requireRepoRoot(a);
  const description = requireDescription(a);

  let ledger;
  try {
    ledger = loadLedger(repoRoot, description);
  } catch (e) {
    if (e instanceof LedgerError) die(e.message);
    throw e;
  }

  console.log(`Ledger: ${ledger.path}`);
  console.log(`Present: ${ledger.present}`);
  console.log("");
  console.log(renderLedgerBrief(ledger));
}

// ---------------------------------------------------------------------------
const a = args(process.argv.slice(2));
const cmd = a._[0];
if (cmd === "check") cmdCheck(a);
else if (cmd === "record") cmdRecord(a);
else if (cmd === "show") cmdShow(a);
else {
  console.log(`fix-attempt ledger CLI

  check  --repo-root <d> --description <text> --hypothesis <text>
  record --repo-root <d> --description <text> --hypothesis <text>
         --diff-summary <text> --outcome accepted|rejected|pending
         [--files <a,b,c>] [--commit-sha <sha>] [--feedback <text>]
         [--supersedes <n>]   # resolve a prior PENDING attempt #n instead
                               # of leaving it open; the pending record is
                               # never edited, this appends a new one
  show   --repo-root <d> --description <text>
`);
  process.exit(cmd ? 1 : 0);
}
