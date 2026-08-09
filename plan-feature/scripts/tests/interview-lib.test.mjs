// plan-feature/scripts/tests/interview-lib.test.mjs
//
// Run: node --test plan-feature/scripts/tests/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  openInterview,
  loadInterview,
  answerInterview,
  isReadyToPlan,
  STANDARD_QUESTIONS,
  InterviewError,
} from "../interview-lib.mjs";

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "interview-"));
}

const FULL_ANSWERS = {
  failure_modes: "Escalate to a human reviewer, never auto-retry silently.",
  must_never: "Never auto-merge, regardless of confidence.",
  perf_constraints: "n/a — this is an offline batch job.",
  rollback: "Feature-flagged; flip SLACK_MAPPING_ENABLED=false to disable instantly.",
  out_of_scope: "Group DMs — only 1:1 mapping for this pass.",
};

// ---------------------------------------------------------------------------
describe("STANDARD_QUESTIONS", () => {
  test("covers five distinct categories, not three phrasings of one thing", () => {
    const ids = STANDARD_QUESTIONS.map((q) => q.id);
    assert.equal(new Set(ids).size, 5);
  });
});

// ---------------------------------------------------------------------------
describe("openInterview", () => {
  test("requires a title", () => {
    const repo = tmpRepo();
    assert.throws(() => openInterview(repo, ""), InterviewError);
  });

  test("writes a pending record with all five standard questions attached", () => {
    const repo = tmpRepo();
    openInterview(repo, "Slack identity mapping");
    const record = loadInterview(repo, "Slack identity mapping");
    assert.equal(record.status, "pending");
    assert.equal(record.questions.length, 5);
  });
});

// ---------------------------------------------------------------------------
describe("answerInterview", () => {
  test("throws if the interview was never opened", () => {
    const repo = tmpRepo();
    assert.throws(() => answerInterview(repo, "never opened", FULL_ANSWERS), InterviewError);
  });

  test("rejects if even one category is truly blank", () => {
    const repo = tmpRepo();
    openInterview(repo, "Slack identity mapping");
    assert.throws(
      () => answerInterview(repo, "Slack identity mapping", { ...FULL_ANSWERS, rollback: "" }),
      InterviewError
    );
    assert.equal(isReadyToPlan(repo, "Slack identity mapping"), false);
  });

  test("accepts 'n/a' as a real answer, not a blank", () => {
    const repo = tmpRepo();
    openInterview(repo, "Slack identity mapping");
    answerInterview(repo, "Slack identity mapping", FULL_ANSWERS);
    assert.equal(isReadyToPlan(repo, "Slack identity mapping"), true);
  });

  test("full answer set flips isReadyToPlan to true", () => {
    const repo = tmpRepo();
    openInterview(repo, "Slack identity mapping");
    assert.equal(isReadyToPlan(repo, "Slack identity mapping"), false);
    answerInterview(repo, "Slack identity mapping", FULL_ANSWERS);
    assert.equal(isReadyToPlan(repo, "Slack identity mapping"), true);
    const record = loadInterview(repo, "Slack identity mapping");
    assert.equal(record.answers.must_never, FULL_ANSWERS.must_never);
  });
});

// ---------------------------------------------------------------------------
describe("isReadyToPlan", () => {
  test("false when no interview exists at all", () => {
    const repo = tmpRepo();
    assert.equal(isReadyToPlan(repo, "Nothing here"), false);
  });
});
