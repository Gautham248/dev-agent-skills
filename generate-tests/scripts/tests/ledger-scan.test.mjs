// generate-tests/scripts/tests/ledger-scan.test.mjs
//
// Run: node --test generate-tests/scripts/tests/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { ledgerDir, readAllLedgers, buildSummary } from "../ledger-scan.mjs";

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ledger-scan-"));
}

function writeLedger(repoRoot, key, data) {
  const dir = ledgerDir(repoRoot);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${key}.json`), JSON.stringify(data));
}

// ---------------------------------------------------------------------------
describe("readAllLedgers", () => {
  test("a repo with no .dev-agent/fix-attempts directory returns empty results, not an error", () => {
    const repo = tmpRepo();
    const result = readAllLedgers(repo);
    assert.deepEqual(result.entries, []);
    assert.deepEqual(result.skipped, []);
  });

  test("reads a single valid ledger file", () => {
    const repo = tmpRepo();
    writeLedger(repo, "abc123", {
      issue: "playstore link wrong",
      attempts: [{ n: 1, outcome: "accepted", files_changed: ["src/links.ts"], hypothesis: "wrong app id", diff_summary: "fixed app id constant" }],
    });
    const result = readAllLedgers(repo);
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].issue, "playstore link wrong");
  });

  test("a non-JSON file in the ledger directory is skipped, not fatal", () => {
    const repo = tmpRepo();
    writeLedger(repo, "good", { issue: "x", attempts: [{ n: 1, outcome: "accepted", files_changed: [] }] });
    fs.writeFileSync(path.join(ledgerDir(repo), "corrupt.json"), "{ not valid json ");
    const result = readAllLedgers(repo);
    assert.equal(result.entries.length, 1);
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /invalid JSON/);
  });

  test("a ledger file missing the attempts array is skipped, not fatal", () => {
    const repo = tmpRepo();
    writeLedger(repo, "malformed", { issue: "x" }); // no attempts array
    const result = readAllLedgers(repo);
    assert.equal(result.entries.length, 0);
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /attempts/);
  });

  test("ignores non-.json files in the ledger directory", () => {
    const repo = tmpRepo();
    fs.mkdirSync(ledgerDir(repo), { recursive: true });
    fs.writeFileSync(path.join(ledgerDir(repo), "README.md"), "not a ledger");
    const result = readAllLedgers(repo);
    assert.equal(result.entries.length, 0);
    assert.equal(result.skipped.length, 0);
  });

  test("one corrupt file among several does not blank out the others (deliberately more forgiving than fix-bug's own loadLedger)", () => {
    const repo = tmpRepo();
    writeLedger(repo, "a", { issue: "a", attempts: [{ n: 1, outcome: "accepted", files_changed: ["a.ts"] }] });
    writeLedger(repo, "b", { issue: "b", attempts: [{ n: 1, outcome: "rejected", files_changed: ["b.ts"] }] });
    fs.writeFileSync(path.join(ledgerDir(repo), "c.json"), "not json at all {{{");
    const result = readAllLedgers(repo);
    assert.equal(result.entries.length, 2);
    assert.equal(result.skipped.length, 1);
  });
});

// ---------------------------------------------------------------------------
describe("buildSummary — defect clustering", () => {
  test("counts accepted/rejected/pending per file across multiple ledgers", () => {
    const repo = tmpRepo();
    writeLedger(repo, "issue1", {
      issue: "bug 1",
      attempts: [{ n: 1, outcome: "rejected", files_changed: ["src/a.ts"] }],
    });
    writeLedger(repo, "issue2", {
      issue: "bug 2",
      attempts: [{ n: 1, outcome: "rejected", files_changed: ["src/a.ts"] }],
    });
    writeLedger(repo, "issue3", {
      issue: "bug 3",
      attempts: [{ n: 1, outcome: "accepted", files_changed: ["src/a.ts"] }],
    });
    const summary = buildSummary(repo);
    const aFile = summary.byFile.find((f) => f.file === "src/a.ts");
    assert.ok(aFile);
    assert.equal(aFile.rejected, 2);
    assert.equal(aFile.accepted, 1);
    assert.equal(aFile.attempts, 3);
  });

  test("files with the most rejected attempts sort first (defect clustering signal)", () => {
    const repo = tmpRepo();
    writeLedger(repo, "i1", { issue: "x", attempts: [{ n: 1, outcome: "rejected", files_changed: ["hot.ts"] }] });
    writeLedger(repo, "i2", { issue: "y", attempts: [{ n: 1, outcome: "rejected", files_changed: ["hot.ts"] }] });
    writeLedger(repo, "i3", { issue: "z", attempts: [{ n: 1, outcome: "rejected", files_changed: ["hot.ts"] }] });
    writeLedger(repo, "i4", { issue: "w", attempts: [{ n: 1, outcome: "accepted", files_changed: ["cold.ts"] }] });
    const summary = buildSummary(repo);
    assert.equal(summary.byFile[0].file, "hot.ts");
  });

  test("every accepted attempt becomes a regression-test candidate with enough detail to act on", () => {
    const repo = tmpRepo();
    writeLedger(repo, "i1", {
      issue: "playstore link wrong",
      attempts: [
        { n: 1, outcome: "rejected", files_changed: ["src/links.ts"], hypothesis: "wrong url scheme" },
        {
          n: 2,
          outcome: "accepted",
          files_changed: ["src/links.ts"],
          hypothesis: "app id constant was stale",
          diff_summary: "updated APP_ID constant to match current Play Store listing",
          commit_sha: "abc123",
          supersedes: 1,
        },
      ],
    });
    const summary = buildSummary(repo);
    assert.equal(summary.regressionCandidates.length, 1);
    const candidate = summary.regressionCandidates[0];
    assert.equal(candidate.issue, "playstore link wrong");
    assert.equal(candidate.hypothesis, "app id constant was stale");
    assert.equal(candidate.diff_summary, "updated APP_ID constant to match current Play Store listing");
    assert.deepEqual(candidate.files_changed, ["src/links.ts"]);
  });

  test("a rejected attempt that was later superseded by an accepted one is not double-counted as both", () => {
    // attempt #1 rejected, attempt #2 (supersedes 1) accepted -- the
    // EFFECTIVE outcome for this issue's history is just "accepted";
    // attempt #1 on its own should not still register as a live rejected
    // count once it's been superseded, since it no longer represents this
    // issue's current state.
    const repo = tmpRepo();
    writeLedger(repo, "i1", {
      issue: "x",
      attempts: [
        { n: 1, outcome: "rejected", files_changed: ["a.ts"] },
        { n: 2, outcome: "accepted", files_changed: ["a.ts"], supersedes: 1, diff_summary: "real fix" },
      ],
    });
    const summary = buildSummary(repo);
    const aFile = summary.byFile.find((f) => f.file === "a.ts");
    assert.equal(aFile.rejected, 0, "superseded attempt #1 must not still count as a live rejection");
    assert.equal(aFile.accepted, 1);
  });

  test("an attempt touching multiple files is counted against every one of them", () => {
    const repo = tmpRepo();
    writeLedger(repo, "i1", { issue: "x", attempts: [{ n: 1, outcome: "accepted", files_changed: ["a.ts", "b.ts"] }] });
    const summary = buildSummary(repo);
    assert.ok(summary.byFile.find((f) => f.file === "a.ts"));
    assert.ok(summary.byFile.find((f) => f.file === "b.ts"));
  });

  test("an attempt with no files_changed does not crash and contributes nothing to byFile", () => {
    const repo = tmpRepo();
    writeLedger(repo, "i1", { issue: "x", attempts: [{ n: 1, outcome: "accepted" }] }); // files_changed omitted entirely
    assert.doesNotThrow(() => buildSummary(repo));
    const summary = buildSummary(repo);
    assert.equal(summary.byFile.length, 0);
    // The attempt itself is still a valid regression candidate even with no
    // file list -- the issue description and diff summary are still useful.
    assert.equal(summary.regressionCandidates.length, 1);
  });

  test("pending attempts are counted separately and never appear as regression candidates", () => {
    const repo = tmpRepo();
    writeLedger(repo, "i1", { issue: "x", attempts: [{ n: 1, outcome: "pending", files_changed: ["a.ts"] }] });
    const summary = buildSummary(repo);
    assert.equal(summary.byFile.find((f) => f.file === "a.ts").pending, 1);
    assert.equal(summary.regressionCandidates.length, 0);
  });

  test("an empty repo (no ledger dir at all) returns a well-formed, empty summary", () => {
    const repo = tmpRepo();
    const summary = buildSummary(repo);
    assert.deepEqual(summary.byFile, []);
    assert.deepEqual(summary.regressionCandidates, []);
    assert.equal(summary.ledgerCount, 0);
  });
});

// ---------------------------------------------------------------------------
describe("CLI", () => {
  const cliPath = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "ledger-scan.mjs");

  test("summary command runs cleanly against an empty repo", () => {
    const repo = tmpRepo();
    const out = execFileSync("node", [cliPath, "summary", "--repo-root", repo]).toString();
    assert.match(out, /No fix-attempt ledger entries found/);
  });

  test("summary --json writes a machine-readable report matching buildSummary's shape", () => {
    const repo = tmpRepo();
    writeLedger(repo, "i1", { issue: "x", attempts: [{ n: 1, outcome: "accepted", files_changed: ["a.ts"] }] });
    const jsonOut = path.join(repo, "out.json");
    execFileSync("node", [cliPath, "summary", "--repo-root", repo, "--json", jsonOut]);
    const parsed = JSON.parse(fs.readFileSync(jsonOut, "utf8"));
    assert.equal(parsed.regressionCandidates.length, 1);
  });

  test("missing --repo-root exits non-zero with a clear message", () => {
    assert.throws(() => {
      execFileSync("node", [cliPath, "summary"], { stdio: "pipe" });
    });
  });
});
