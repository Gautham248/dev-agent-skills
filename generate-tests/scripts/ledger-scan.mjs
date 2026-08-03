#!/usr/bin/env node
// generate-tests/scripts/ledger-scan.mjs
//
//   summary --repo-root <dir> [--json out.json]
//
// Reads every fix-attempt ledger file fix-bug has written under
// <repo-root>/.dev-agent/fix-attempts/*.json and turns them into two things
// this skill actually needs:
//
//   1. Defect clustering -- which files have accumulated the most rejected
//      or repeated fix attempts, so adversarial test effort gets weighted
//      toward files with a real history of going wrong, not spread evenly
//      (the seven-principles "80% of defects live in 20% of modules"
//      observation, applied mechanically instead of left as an intuition).
//   2. Regression candidates -- every ACCEPTED attempt is a confirmed bug
//      with a known trigger and a known fix. Each one is a permanent
//      regression-test candidate: encode the exact case that broke, once,
//      so it can never silently regress. This is also the direct answer to
//      the "pesticide paradox" -- new real cases from real history, not the
//      same generic boundary cases run again.
//
// Deliberately reads the ledger's own JSON files directly rather than
// importing fix-bug/scripts/ledger-lib.mjs. Two reasons: (a) it keeps this
// skill decoupled from fix-bug's internal module layout -- if fix-bug is
// ever restructured, this script only needs the file format to stay stable,
// not any particular export shape; (b) it matches the pattern already used
// elsewhere in this repo (coding-standards reads graphify's
// .graphify_stack.json output directly rather than calling into graphify's
// internals) -- read the artifact, not the implementation.
//
// Also deliberately more forgiving than ledger-lib.loadLedger() about a
// malformed file: loadLedger() fails loud for a SINGLE issue's own ledger,
// because silently treating a corrupt "known dead end" record as empty
// risks re-proposing an already-rejected fix -- a correctness bug. This
// script is a broad summary across every ledger file in the repo; one
// corrupt file here should not blank out the defect-clustering signal from
// every other file. Corrupt files are skipped and reported, not fatal.

import fs from "node:fs";
import path from "node:path";

export function ledgerDir(repoRoot) {
  return path.join(repoRoot, ".dev-agent", "fix-attempts");
}

/**
 * Reads every *.json file in the ledger directory. Returns
 * { entries: [{ file, issue, attempts }], skipped: [{ file, reason }] }.
 * Missing directory is the normal "no fixes recorded yet" case, not an
 * error -- returns empty results.
 */
export function readAllLedgers(repoRoot) {
  const dir = ledgerDir(repoRoot);
  const entries = [];
  const skipped = [];

  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch (err) {
    if (err.code === "ENOENT") return { entries, skipped };
    throw err;
  }

  for (const f of files) {
    const full = path.join(dir, f);
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(full, "utf8"));
    } catch (err) {
      skipped.push({ file: full, reason: `invalid JSON: ${err.message}` });
      continue;
    }
    if (!parsed || !Array.isArray(parsed.attempts)) {
      skipped.push({ file: full, reason: 'missing "attempts" array' });
      continue;
    }
    entries.push({ file: full, issue: parsed.issue || null, attempts: parsed.attempts });
  }

  return { entries, skipped };
}

/**
 * Resolves supersede chains the same way fix-bug does conceptually (a
 * pending attempt's real outcome is whatever the record that supersedes it
 * says), but simplified for a read-only summary: we don't need
 * resolveEffectiveAttempts()'s full guarantees here, just "what is the
 * latest known outcome for each attempt number in this issue's file."
 */
function effectiveOutcomes(attempts) {
  const byN = new Map(attempts.map((a) => [a.n, a]));
  const supersededBy = new Map(); // n -> the record that resolved it
  for (const a of attempts) {
    if (a.supersedes != null) supersededBy.set(a.supersedes, a);
  }
  const effective = [];
  for (const a of attempts) {
    if (supersededBy.has(a.n)) continue; // an earlier record that was later resolved -- use the resolution instead
    effective.push(a);
  }
  return effective;
}

/**
 * Builds the summary this skill actually consumes:
 *  - byFile: file path -> { attempts, rejected, accepted, pending }
 *  - regressionCandidates: one entry per accepted attempt, with enough
 *    detail (issue text, hypothesis, diff_summary, files_changed) to write
 *    a regression test from, without re-deriving it from git history.
 */
export function buildSummary(repoRoot) {
  const { entries, skipped } = readAllLedgers(repoRoot);
  const byFile = new Map();
  const regressionCandidates = [];

  function bump(file, key) {
    if (!byFile.has(file)) byFile.set(file, { attempts: 0, rejected: 0, accepted: 0, pending: 0 });
    byFile.get(file)[key]++;
    byFile.get(file).attempts++;
  }

  for (const entry of entries) {
    const effective = effectiveOutcomes(entry.attempts);
    for (const attempt of effective) {
      const files = Array.isArray(attempt.files_changed) ? attempt.files_changed : [];
      for (const f of files) {
        if (attempt.outcome === "rejected") bump(f, "rejected");
        else if (attempt.outcome === "accepted") bump(f, "accepted");
        else bump(f, "pending");
      }
      if (attempt.outcome === "accepted") {
        regressionCandidates.push({
          issue: entry.issue,
          hypothesis: attempt.hypothesis || null,
          diff_summary: attempt.diff_summary || null,
          files_changed: files,
          commit_sha: attempt.commit_sha || null,
          timestamp: attempt.timestamp || null,
        });
      }
    }
  }

  const byFileArray = Array.from(byFile.entries())
    .map(([file, counts]) => ({ file, ...counts }))
    .sort((a, b) => b.rejected - a.rejected || b.attempts - a.attempts);

  return { byFile: byFileArray, regressionCandidates, skipped, ledgerCount: entries.length };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function cmdSummary(a) {
  if (!a["repo-root"]) die("--repo-root is required");
  const summary = buildSummary(a["repo-root"]);

  if (summary.ledgerCount === 0) {
    console.log("No fix-attempt ledger entries found yet -- no defect-clustering signal available. Proceeding without it is normal for a repo with no fix-bug history.");
  } else {
    console.log(`${summary.ledgerCount} ledger file(s) read${summary.skipped.length ? `, ${summary.skipped.length} skipped (corrupt)` : ""}.`);
    if (summary.byFile.length) {
      console.log("\nFiles with fix-attempt history (most rejected attempts first):");
      for (const f of summary.byFile.slice(0, 20)) {
        console.log(`  ${f.file} -- ${f.attempts} attempt(s): ${f.accepted} accepted, ${f.rejected} rejected, ${f.pending} pending`);
      }
    }
    if (summary.regressionCandidates.length) {
      console.log(`\n${summary.regressionCandidates.length} confirmed fix(es) available as regression-test candidates.`);
    }
    for (const s of summary.skipped) {
      console.log(`  ⚠️  skipped ${s.file}: ${s.reason}`);
    }
  }

  if (a.json && typeof a.json === "string") {
    fs.writeFileSync(a.json, JSON.stringify(summary, null, 2));
  }
}

function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const a = parseArgs(argv.slice(1));
  if (cmd === "summary") return cmdSummary(a);
  die(`unknown command ${JSON.stringify(cmd)} -- expected "summary"`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
