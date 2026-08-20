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

describe("review-cli.mjs post --pre-existing-compile-errors / --sibling-context — real subprocess", () => {
  test("both flags together render in the dry-run body and console summary", () => {
    const dir = makeTmpDir();
    const diffPath = path.join(dir, "pr.diff");
    const findingsPath = path.join(dir, "findings.json");
    const preExistingPath = path.join(dir, "pre-existing.json");
    const siblingPath = path.join(dir, "sibling.json");

    fs.writeFileSync(diffPath, SAMPLE_DIFF);
    fs.writeFileSync(findingsPath, JSON.stringify([]));
    fs.writeFileSync(
      preExistingPath,
      JSON.stringify([{ file: "src/Other.ts", line: 12, message: "Property 'foo' does not exist on type 'Bar'." }])
    );
    fs.writeFileSync(
      siblingPath,
      JSON.stringify({ generalCommentCount: 2, siblingPr: { owner: "10xMinds", repo: "fluffy-memory", number: 17 } })
    );

    const { stdout, status } = runCli([
      "post",
      "--repo", "org/game",
      "--pr", "42",
      "--diff", diffPath,
      "--findings", findingsPath,
      "--pre-existing-compile-errors", preExistingPath,
      "--sibling-context", siblingPath,
      "--head-sha", "deadbeef",
      "--dry-run",
    ]);

    assert.equal(status, 0);
    assert.match(stdout, /pre-existing compile errors: 1 \(not blocking, listed in summary\)/);
    assert.match(stdout, /context considered: 2 general comment\(s\), sibling PR #17/);

    const jsonStart = stdout.indexOf("{");
    const payload = JSON.parse(stdout.slice(jsonStart));
    assert.ok(payload.body.includes("Pre-existing compile errors"));
    assert.ok(payload.body.includes("src/Other.ts:12"));
    assert.ok(payload.body.includes("Context considered"));
    assert.ok(payload.body.includes("10xMinds/fluffy-memory#17"));
    // Never inline comments -- there's no diff line to anchor either of these to.
    assert.equal(payload.comments.length, 0);
  });

  test("neither flag given: no context/pre-existing sections, unaffected otherwise", () => {
    const dir = makeTmpDir();
    const diffPath = path.join(dir, "pr.diff");
    const findingsPath = path.join(dir, "findings.json");
    fs.writeFileSync(diffPath, SAMPLE_DIFF);
    fs.writeFileSync(findingsPath, JSON.stringify([]));

    const { stdout, status } = runCli([
      "post", "--repo", "org/game", "--pr", "42",
      "--diff", diffPath, "--findings", findingsPath,
      "--head-sha", "deadbeef", "--dry-run",
    ]);
    assert.equal(status, 0);
    assert.ok(!stdout.includes("pre-existing compile errors"));
    assert.ok(!stdout.includes("context considered"));
  });

  test("a missing --pre-existing-compile-errors file fails loudly, not silently", () => {
    const dir = makeTmpDir();
    const diffPath = path.join(dir, "pr.diff");
    const findingsPath = path.join(dir, "findings.json");
    fs.writeFileSync(diffPath, SAMPLE_DIFF);
    fs.writeFileSync(findingsPath, JSON.stringify([]));

    const { status, stderr } = runCli([
      "post", "--repo", "org/game", "--pr", "42",
      "--diff", diffPath, "--findings", findingsPath,
      "--pre-existing-compile-errors", path.join(dir, "does-not-exist.json"),
      "--head-sha", "deadbeef", "--dry-run",
    ]);
    assert.notEqual(status, 0);
    assert.match(stderr, /--pre-existing-compile-errors file not found/);
  });

  test("malformed JSON in --sibling-context fails loudly, not silently", () => {
    const dir = makeTmpDir();
    const diffPath = path.join(dir, "pr.diff");
    const findingsPath = path.join(dir, "findings.json");
    const siblingPath = path.join(dir, "sibling.json");
    fs.writeFileSync(diffPath, SAMPLE_DIFF);
    fs.writeFileSync(findingsPath, JSON.stringify([]));
    fs.writeFileSync(siblingPath, "{not valid json");

    const { status, stderr } = runCli([
      "post", "--repo", "org/game", "--pr", "42",
      "--diff", diffPath, "--findings", findingsPath,
      "--sibling-context", siblingPath,
      "--head-sha", "deadbeef", "--dry-run",
    ]);
    assert.notEqual(status, 0);
    assert.match(stderr, /--sibling-context file is not valid JSON/);
  });

  test("a wrong-shape (non-array) --pre-existing-compile-errors file fails loudly, not silently", () => {
    const dir = makeTmpDir();
    const diffPath = path.join(dir, "pr.diff");
    const findingsPath = path.join(dir, "findings.json");
    const preExistingPath = path.join(dir, "pre-existing.json");
    fs.writeFileSync(diffPath, SAMPLE_DIFF);
    fs.writeFileSync(findingsPath, JSON.stringify([]));
    fs.writeFileSync(preExistingPath, JSON.stringify({ file: "src/Other.ts", line: 12, message: "nope" }));

    const { status, stderr } = runCli([
      "post", "--repo", "org/game", "--pr", "42",
      "--diff", diffPath, "--findings", findingsPath,
      "--pre-existing-compile-errors", preExistingPath,
      "--head-sha", "deadbeef", "--dry-run",
    ]);
    assert.notEqual(status, 0);
    assert.match(stderr, /--pre-existing-compile-errors must be a JSON array/);
  });

  test("a wrong-shape (array) --sibling-context file fails loudly, not silently", () => {
    const dir = makeTmpDir();
    const diffPath = path.join(dir, "pr.diff");
    const findingsPath = path.join(dir, "findings.json");
    const siblingPath = path.join(dir, "sibling.json");
    fs.writeFileSync(diffPath, SAMPLE_DIFF);
    fs.writeFileSync(findingsPath, JSON.stringify([]));
    fs.writeFileSync(siblingPath, JSON.stringify([{ generalCommentCount: 1 }]));

    const { status, stderr } = runCli([
      "post", "--repo", "org/game", "--pr", "42",
      "--diff", diffPath, "--findings", findingsPath,
      "--sibling-context", siblingPath,
      "--head-sha", "deadbeef", "--dry-run",
    ]);
    assert.notEqual(status, 0);
    assert.match(stderr, /--sibling-context must be a JSON object/);
  });
});

describe("review-cli.mjs post --completeness-checks — real subprocess", () => {
  test("renders the counts in both console output and the posted body", () => {
    const dir = makeTmpDir();
    const diffPath = path.join(dir, "pr.diff");
    const findingsPath = path.join(dir, "findings.json");
    const completenessPath = path.join(dir, "completeness.json");

    fs.writeFileSync(diffPath, SAMPLE_DIFF);
    fs.writeFileSync(findingsPath, JSON.stringify([]));
    fs.writeFileSync(completenessPath, JSON.stringify({ stateMutation: 2, identity: 1, resourceCleanup: 0 }));

    const { stdout, status } = runCli([
      "post",
      "--repo", "org/game",
      "--pr", "42",
      "--diff", diffPath,
      "--findings", findingsPath,
      "--completeness-checks", completenessPath,
      "--head-sha", "deadbeef",
      "--dry-run",
    ]);

    assert.equal(status, 0);
    assert.match(stdout, /completeness gate: 2 state-mutation, 1 identity, 0 resource-cleanup candidate\(s\) traced/);

    const jsonStart = stdout.indexOf("{");
    const payload = JSON.parse(stdout.slice(jsonStart));
    assert.ok(payload.body.includes("Completeness gate"));
    assert.ok(payload.body.includes("2 state-mutation"));
  });

  test("all-zero counts are omitted from the posted body (nothing to prove ran)", () => {
    const dir = makeTmpDir();
    const diffPath = path.join(dir, "pr.diff");
    const findingsPath = path.join(dir, "findings.json");
    const completenessPath = path.join(dir, "completeness.json");
    fs.writeFileSync(diffPath, SAMPLE_DIFF);
    fs.writeFileSync(findingsPath, JSON.stringify([]));
    fs.writeFileSync(completenessPath, JSON.stringify({ stateMutation: 0, identity: 0, resourceCleanup: 0 }));

    const { stdout, status } = runCli([
      "post", "--repo", "org/game", "--pr", "42",
      "--diff", diffPath, "--findings", findingsPath,
      "--completeness-checks", completenessPath,
      "--head-sha", "deadbeef", "--dry-run",
    ]);
    assert.equal(status, 0);
    const jsonStart = stdout.indexOf("{");
    const payload = JSON.parse(stdout.slice(jsonStart));
    assert.ok(!payload.body.includes("Completeness gate"));
  });

  test("flag omitted entirely: no completeness line anywhere, unaffected otherwise", () => {
    const dir = makeTmpDir();
    const diffPath = path.join(dir, "pr.diff");
    const findingsPath = path.join(dir, "findings.json");
    fs.writeFileSync(diffPath, SAMPLE_DIFF);
    fs.writeFileSync(findingsPath, JSON.stringify([]));

    const { stdout, status } = runCli([
      "post", "--repo", "org/game", "--pr", "42",
      "--diff", diffPath, "--findings", findingsPath,
      "--head-sha", "deadbeef", "--dry-run",
    ]);
    assert.equal(status, 0);
    assert.ok(!stdout.includes("completeness gate"));
  });

  test("malformed JSON in --completeness-checks fails loudly", () => {
    const dir = makeTmpDir();
    const diffPath = path.join(dir, "pr.diff");
    const findingsPath = path.join(dir, "findings.json");
    const completenessPath = path.join(dir, "completeness.json");
    fs.writeFileSync(diffPath, SAMPLE_DIFF);
    fs.writeFileSync(findingsPath, JSON.stringify([]));
    fs.writeFileSync(completenessPath, "{not valid json");

    const { status, stderr } = runCli([
      "post", "--repo", "org/game", "--pr", "42",
      "--diff", diffPath, "--findings", findingsPath,
      "--completeness-checks", completenessPath,
      "--head-sha", "deadbeef", "--dry-run",
    ]);
    assert.notEqual(status, 0);
    assert.match(stderr, /--completeness-checks file is not valid JSON/);
  });

  test("--completeness-checks given a JSON array instead of an object fails with the correct shape hint, not sibling-context's", () => {
    const dir = makeTmpDir();
    const diffPath = path.join(dir, "pr.diff");
    const findingsPath = path.join(dir, "findings.json");
    const completenessPath = path.join(dir, "completeness.json");
    fs.writeFileSync(diffPath, SAMPLE_DIFF);
    fs.writeFileSync(findingsPath, JSON.stringify([]));
    fs.writeFileSync(completenessPath, JSON.stringify(["not", "an", "object"]));

    const { status, stderr } = runCli([
      "post", "--repo", "org/game", "--pr", "42",
      "--diff", diffPath, "--findings", findingsPath,
      "--completeness-checks", completenessPath,
      "--head-sha", "deadbeef", "--dry-run",
    ]);
    assert.notEqual(status, 0);
    assert.match(stderr, /--completeness-checks must be a JSON object of \{ stateMutation, identity, resourceCleanup \}/);
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

describe("review-cli.mjs plan — real lens-registry.json, real skills-root", () => {
  // Loads the ACTUAL shipped registry and skill directories (SKILLS_ROOT
  // below, resolved from this test file's own location) rather than a
  // synthetic fixture -- this is the test that would catch a typo in
  // lens-registry.json or a missing SKILL.md path, which a fixture-based
  // test cannot, since the fixture would just encode the same mistake.
  const SKILLS_ROOT = path.join(HERE, "..", "..", "..");

  function planForDiff(diffText) {
    const dir = makeTmpDir();
    const diffPath = path.join(dir, "pr.diff");
    fs.writeFileSync(diffPath, diffText);
    return runCli([
      "plan",
      "--diff", diffPath,
      "--skills-root", SKILLS_ROOT,
      "--repo-root", dir,
      "--domains", "",
    ]);
  }

  test("a Swift-only PR selects swift-conventions and skips typescript/webapp-conventions", () => {
    const diff = [
      "diff --git a/Sources/App/GameRoom.swift b/Sources/App/GameRoom.swift",
      "new file mode 100644",
      "index 0000000..1111111",
      "--- /dev/null",
      "+++ b/Sources/App/GameRoom.swift",
      "@@ -0,0 +1,3 @@",
      "+struct GameRoom {",
      "+  let code: String",
      "+}",
      "",
    ].join("\n");

    const { stdout, status } = planForDiff(diff);
    assert.equal(status, 0);
    assert.match(stdout, /65\s+swift-conventions/);
    assert.match(stdout, /typescript-conventions: no changed file matches applies_to/);
    assert.match(stdout, /webapp-conventions: no changed file matches applies_to/);
  });

  test("a TypeScript-only PR does not select swift-conventions", () => {
    const diff = [
      "diff --git a/web/utils.ts b/web/utils.ts",
      "new file mode 100644",
      "index 0000000..2222222",
      "--- /dev/null",
      "+++ b/web/utils.ts",
      "@@ -0,0 +1,1 @@",
      "+export const x = 1;",
      "",
    ].join("\n");

    const { stdout, status } = planForDiff(diff);
    assert.equal(status, 0);
    assert.match(stdout, /60\s+typescript-conventions/);
    assert.match(stdout, /swift-conventions: no changed file matches applies_to/);
  });

  test("a mixed Swift + TypeScript PR selects both, each scoped to its own matched files", () => {
    const diff = [
      "diff --git a/Sources/App/GameRoom.swift b/Sources/App/GameRoom.swift",
      "new file mode 100644",
      "index 0000000..1111111",
      "--- /dev/null",
      "+++ b/Sources/App/GameRoom.swift",
      "@@ -0,0 +1,1 @@",
      "+struct GameRoom {}",
      "diff --git a/web/utils.ts b/web/utils.ts",
      "new file mode 100644",
      "index 0000000..2222222",
      "--- /dev/null",
      "+++ b/web/utils.ts",
      "@@ -0,0 +1,1 @@",
      "+export const x = 1;",
      "",
    ].join("\n");

    const { stdout, status } = planForDiff(diff);
    assert.equal(status, 0);
    assert.match(stdout, /swift-conventions[\s\S]*matched: Sources\/App\/GameRoom\.swift/);
    assert.match(stdout, /typescript-conventions[\s\S]*matched: web\/utils\.ts/);
  });

  test("a Swift PR touching a CloudKit-named file selects cloudkit-conventions in addition to swift-conventions", () => {
    const diff = [
      "diff --git a/Lio/Services/CloudKitService.swift b/Lio/Services/CloudKitService.swift",
      "new file mode 100644",
      "index 0000000..3333333",
      "--- /dev/null",
      "+++ b/Lio/Services/CloudKitService.swift",
      "@@ -0,0 +1,2 @@",
      "+import CloudKit",
      "+final class CloudKitService {}",
      "",
    ].join("\n");

    const { stdout, status } = planForDiff(diff);
    assert.equal(status, 0);
    assert.match(stdout, /65\s+swift-conventions/);
    assert.match(stdout, /66\s+cloudkit-conventions/);
  });

  test("a Swift PR with no CloudKit-named file does not select cloudkit-conventions", () => {
    const diff = [
      "diff --git a/Lio/Screens/Main/TasksViews.swift b/Lio/Screens/Main/TasksViews.swift",
      "new file mode 100644",
      "index 0000000..4444444",
      "--- /dev/null",
      "+++ b/Lio/Screens/Main/TasksViews.swift",
      "@@ -0,0 +1,1 @@",
      "+struct TasksView {}",
      "",
    ].join("\n");

    const { stdout, status } = planForDiff(diff);
    assert.equal(status, 0);
    assert.match(stdout, /65\s+swift-conventions/);
    assert.match(stdout, /cloudkit-conventions: no changed file matches applies_to/);
  });
});
