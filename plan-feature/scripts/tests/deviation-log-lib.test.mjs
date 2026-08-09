// plan-feature/scripts/tests/deviation-log-lib.test.mjs
//
// Run: node --test plan-feature/scripts/tests/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  planKey,
  recordDeviation,
  readDeviations,
  hasDeviations,
  DeviationError,
} from "../deviation-log-lib.mjs";

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "deviation-"));
}

// ---------------------------------------------------------------------------
describe("planKey", () => {
  test("trivial rephrasing of the same plan title resolves to the same key", () => {
    const a = planKey("Add Slack identity mapping!");
    const b = planKey("add slack identity mapping");
    assert.equal(a, b);
  });

  test("materially different titles do not collide", () => {
    const a = planKey("Add Slack identity mapping");
    const b = planKey("Add Notion identity mapping");
    assert.notEqual(a, b);
  });
});

// ---------------------------------------------------------------------------
describe("recordDeviation — validation", () => {
  test("requires planTitle, planned, actual, and reason", () => {
    const repo = tmpRepo();
    assert.throws(() => recordDeviation(repo, { planned: "x", actual: "y", reason: "z" }), DeviationError);
    assert.throws(() => recordDeviation(repo, { planTitle: "t", actual: "y", reason: "z" }), DeviationError);
    assert.throws(() => recordDeviation(repo, { planTitle: "t", planned: "x", reason: "z" }), DeviationError);
    assert.throws(() => recordDeviation(repo, { planTitle: "t", planned: "x", actual: "y" }), DeviationError);
  });
});

// ---------------------------------------------------------------------------
describe("recordDeviation — writing", () => {
  test("first entry creates the file with a plan-title header", () => {
    const repo = tmpRepo();
    const { file } = recordDeviation(repo, {
      planTitle: "Slack identity mapping",
      planned: "Use Slack's SCIM API for user matching.",
      actual: "Used email-domain matching instead.",
      reason: "Workspace admin has not enabled SCIM yet.",
    });
    assert.ok(fs.existsSync(file));
    const content = fs.readFileSync(file, "utf8");
    assert.match(content, /# Deviation log — Slack identity mapping/);
    assert.match(content, /Use Slack's SCIM API/);
    assert.match(content, /Workspace admin has not enabled SCIM/);
  });

  test("second entry on the same plan appends without a second header", () => {
    const repo = tmpRepo();
    recordDeviation(repo, {
      planTitle: "Slack identity mapping",
      planned: "A", actual: "B", reason: "C",
    });
    recordDeviation(repo, {
      planTitle: "Slack identity mapping",
      planned: "D", actual: "E", reason: "F",
    });
    const content = readDeviations(repo, "Slack identity mapping");
    const headerCount = (content.match(/# Deviation log/g) || []).length;
    assert.equal(headerCount, 1);
    assert.match(content, /\*\*Planned:\*\* A/);
    assert.match(content, /\*\*Planned:\*\* D/);
  });

  test("rephrased plan title still finds the same deviation file", () => {
    const repo = tmpRepo();
    recordDeviation(repo, {
      planTitle: "Add Slack identity mapping!",
      planned: "A", actual: "B", reason: "C",
    });
    assert.ok(hasDeviations(repo, "add slack identity mapping"));
    const content = readDeviations(repo, "add   slack  identity mapping");
    assert.match(content, /\*\*Planned:\*\* A/);
  });
});

// ---------------------------------------------------------------------------
describe("readDeviations / hasDeviations", () => {
  test("both report cleanly on a plan with no deviations yet", () => {
    const repo = tmpRepo();
    assert.equal(readDeviations(repo, "Untouched plan"), null);
    assert.equal(hasDeviations(repo, "Untouched plan"), false);
  });
});
