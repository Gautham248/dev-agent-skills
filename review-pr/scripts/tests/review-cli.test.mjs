// review-pr/scripts/tests/review-cli.test.mjs
//
// Runs review-cli.mjs as a real subprocess (not just its library functions)
// for the two things added for the architect-pass (Step 2b): the
// `check-scope` command and the `--architecture-review` flag on `validate`
// and `post --dry-run`. Library-level tests already cover the underlying
// functions in review-lib.test.mjs; this file exists specifically to catch
// wiring mistakes (a flag not actually read, a JSON shape mismatch between
// what SKILL.md tells the model to write and what the CLI parses) that only
// show up by actually invoking the CLI, matching this repo's convention of
// running real commands before documenting them.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(HERE, "..", "review-cli.mjs");

function runCli(args, opts = {}) {
  // spawnSync, not execFileSync -- execFileSync only exposes stderr when the
  // process exits non-zero (it's attached to the thrown error object), so a
  // successful run that still writes warnings to stderr (e.g. the "dropping
  // invalid coverage finding" case below) would silently look empty.
  // spawnSync captures both streams unconditionally.
  const result = spawnSync("node", [CLI, ...args], { encoding: "utf8", ...opts });
  return { stdout: result.stdout || "", stderr: result.stderr || "", status: result.status ?? 1 };
}

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "review-cli-test-"));
}

// A minimal, real unified diff -- one file, one added line -- enough for
// `validate`/`post --dry-run` to build an anchor index against.
const SAMPLE_DIFF = [
  "diff --git a/net/sync.ts b/net/sync.ts",
  "index 1111111..2222222 100644",
  "--- a/net/sync.ts",
  "+++ b/net/sync.ts",
  "@@ -1,2 +1,3 @@",
  " export function syncState() {",
  "+  // updated",
  " }",
  "",
].join("\n");

describe("review-cli.mjs check-scope — real subprocess", () => {
  test("RUN_ARCHITECT_CHECK when changed-files crosses the 10-file default threshold", () => {
    const { stdout, status } = runCli(["check-scope", "--changed-files", "12"]);
    assert.equal(status, 0);
    assert.match(stdout, /^RUN_ARCHITECT_CHECK/m);
    assert.match(stdout, /threshold 10/);
  });

  test("SKIP_ARCHITECT_CHECK under both thresholds", () => {
    const { stdout, status } = runCli(["check-scope", "--changed-files", "3"]);
    assert.equal(status, 0);
    assert.match(stdout, /^SKIP_ARCHITECT_CHECK/m);
  });

  test("does not trigger at 9 files (one below the 10-file default)", () => {
    const { stdout } = runCli(["check-scope", "--changed-files", "9"]);
    assert.match(stdout, /^SKIP_ARCHITECT_CHECK/m);
  });

  test("triggers at exactly 10 files (the boundary itself)", () => {
    const { stdout } = runCli(["check-scope", "--changed-files", "10"]);
    assert.match(stdout, /^RUN_ARCHITECT_CHECK/m);
  });

  test("RUN_ARCHITECT_CHECK from subsystem span alone, under the file threshold", () => {
    const { stdout, status } = runCli(["check-scope", "--changed-files", "3", "--matched-subsystems", "4"]);
    assert.equal(status, 0);
    assert.match(stdout, /^RUN_ARCHITECT_CHECK/m);
  });

  test("errors out (not a silent default) when --changed-files is missing", () => {
    const { status, stderr } = runCli(["check-scope"]);
    assert.notEqual(status, 0);
    assert.match(stderr, /--changed-files/);
  });

  test("custom --file-threshold overrides the default", () => {
    const { stdout } = runCli(["check-scope", "--changed-files", "5", "--file-threshold", "5"]);
    assert.match(stdout, /^RUN_ARCHITECT_CHECK/m);
  });
});

describe("review-cli.mjs validate --architecture-review — real subprocess", () => {
  test("reports coverage findings alongside line findings", () => {
    const dir = makeTmpDir();
    const diffPath = path.join(dir, "pr.diff");
    const findingsPath = path.join(dir, "findings.json");
    const archPath = path.join(dir, "architecture-review.json");

    fs.writeFileSync(diffPath, SAMPLE_DIFF);
    fs.writeFileSync(findingsPath, JSON.stringify([]));
    fs.writeFileSync(
      archPath,
      JSON.stringify({
        narrative: "Touches sync but not matchmaking.",
        subsystemsTouched: ["state-sync"],
        coverageFindings: [
          {
            type: "coverage",
            subsystem: "matchmaking",
            rationale: "This diff changes sync timing but matchmaking's own timeout assumptions were not revisited.",
            confidence: 0.7,
          },
        ],
      })
    );

    const { stdout, status } = runCli([
      "validate",
      "--diff", diffPath,
      "--findings", findingsPath,
      "--architecture-review", archPath,
    ]);

    assert.equal(status, 0);
    assert.match(stdout, /Architecture review \(coverage findings\)/);
    assert.match(stdout, /submitted: 1/);
    assert.match(stdout, /postable:  1/);
    assert.match(stdout, /\[coverage\] matchmaking/);
  });

  test("drops an invalid coverage finding with a warning, does not crash the command", () => {
    const dir = makeTmpDir();
    const diffPath = path.join(dir, "pr.diff");
    const findingsPath = path.join(dir, "findings.json");
    const archPath = path.join(dir, "architecture-review.json");

    fs.writeFileSync(diffPath, SAMPLE_DIFF);
    fs.writeFileSync(findingsPath, JSON.stringify([]));
    fs.writeFileSync(
      archPath,
      JSON.stringify({
        narrative: "n/a",
        subsystemsTouched: [],
        coverageFindings: [
          { type: "coverage", subsystem: "", rationale: "too short", confidence: 0.9 }, // invalid: empty subsystem, short rationale
        ],
      })
    );

    const { stdout, stderr, status } = runCli([
      "validate",
      "--diff", diffPath,
      "--findings", findingsPath,
      "--architecture-review", archPath,
    ]);

    assert.equal(status, 0, "an invalid coverage finding must not fail the whole validate command");
    assert.match(stderr, /dropping invalid coverage finding/);
    assert.match(stdout, /submitted: 1/);
    assert.match(stdout, /valid:     0/);
  });

  test("no --architecture-review flag at all: no architecture section printed, unaffected otherwise", () => {
    const dir = makeTmpDir();
    const diffPath = path.join(dir, "pr.diff");
    const findingsPath = path.join(dir, "findings.json");
    fs.writeFileSync(diffPath, SAMPLE_DIFF);
    fs.writeFileSync(findingsPath, JSON.stringify([]));

    const { stdout, status } = runCli(["validate", "--diff", diffPath, "--findings", findingsPath]);
    assert.equal(status, 0);
    assert.ok(!stdout.includes("Architecture review"));
  });
});

describe("review-cli.mjs post --dry-run --architecture-review — real subprocess", () => {
  test("the dry-run payload body includes the Architecture review section", () => {
    const dir = makeTmpDir();
    const diffPath = path.join(dir, "pr.diff");
    const findingsPath = path.join(dir, "findings.json");
    const archPath = path.join(dir, "architecture-review.json");

    fs.writeFileSync(diffPath, SAMPLE_DIFF);
    fs.writeFileSync(findingsPath, JSON.stringify([]));
    fs.writeFileSync(
      archPath,
      JSON.stringify({
        narrative: "This PR is part of a broader sync-timing change.",
        subsystemsTouched: ["state-sync"],
        coverageFindings: [
          {
            type: "coverage",
            subsystem: "matchmaking",
            rationale: "Matchmaking's own timeout assumptions may now be inconsistent with the new sync timing.",
            confidence: 0.65,
          },
        ],
      })
    );

    const { stdout, status } = runCli([
      "post",
      "--repo", "org/game",
      "--pr", "42",
      "--diff", diffPath,
      "--findings", findingsPath,
      "--architecture-review", archPath,
      "--head-sha", "deadbeef",
      "--dry-run",
    ]);

    assert.equal(status, 0);
    assert.match(stdout, /architecture review: 1 coverage finding\(s\) shown, 0 held back/);

    const jsonStart = stdout.indexOf("{");
    const payload = JSON.parse(stdout.slice(jsonStart));
    assert.ok(payload.body.includes("### Architecture review"));
    assert.ok(payload.body.includes("This PR is part of a broader sync-timing change."));
    assert.ok(payload.body.includes("**matchmaking**"));
    // Coverage findings are body text, never inline comments -- there is no
    // diff line to anchor them to.
    assert.equal(payload.comments.length, 0);
  });
});
