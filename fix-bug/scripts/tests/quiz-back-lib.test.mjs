// fix-bug/scripts/tests/quiz-back-lib.test.mjs
//
// Run: node --test fix-bug/scripts/tests/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { openQuiz, loadQuiz, answerQuiz, isClosable, QuizError } from "../quiz-back-lib.mjs";

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "quiz-"));
}

const QUESTIONS = {
  design: "Why did you change the redirect constant instead of the routing logic?",
  edgeCase: "What happens if the Play Store app id changes again next quarter?",
  blastRadius: "Does anything else read this same constant?",
};

const ANSWERS = {
  design: "The constant was wrong in one place; the routing logic was already correct.",
  edgeCase: "Not handled — it will silently point at the old id again until someone notices.",
  blastRadius: "Checked: only the landing page footer reads this constant.",
};

// ---------------------------------------------------------------------------
describe("openQuiz", () => {
  test("requires all three question categories", () => {
    const repo = tmpRepo();
    assert.throws(
      () => openQuiz(repo, "abc123", { questions: { design: "x", edgeCase: "y" } }),
      QuizError
    );
  });

  test("rejects a blank question", () => {
    const repo = tmpRepo();
    assert.throws(
      () => openQuiz(repo, "abc123", { questions: { ...QUESTIONS, edgeCase: "   " } }),
      QuizError
    );
  });

  test("writes a pending record readable by loadQuiz", () => {
    const repo = tmpRepo();
    openQuiz(repo, "abc123", { questions: QUESTIONS, prLink: "https://github.com/x/y/pull/42" });
    const record = loadQuiz(repo, "abc123");
    assert.equal(record.status, "pending");
    assert.equal(record.answers, null);
    assert.equal(record.prLink, "https://github.com/x/y/pull/42");
  });
});

// ---------------------------------------------------------------------------
describe("answerQuiz", () => {
  test("throws if no quiz was opened for this key", () => {
    const repo = tmpRepo();
    assert.throws(() => answerQuiz(repo, "never-opened", ANSWERS), QuizError);
  });

  test("throws on a blank answer to any single category, even if the other two are filled", () => {
    const repo = tmpRepo();
    openQuiz(repo, "abc123", { questions: QUESTIONS });
    assert.throws(
      () => answerQuiz(repo, "abc123", { ...ANSWERS, blastRadius: "" }),
      QuizError
    );
    // And the quiz must still read as NOT closable after the rejected attempt.
    assert.equal(isClosable(repo, "abc123"), false);
  });

  test("accepts a full set of non-blank answers and flips isClosable to true", () => {
    const repo = tmpRepo();
    openQuiz(repo, "abc123", { questions: QUESTIONS });
    assert.equal(isClosable(repo, "abc123"), false);
    answerQuiz(repo, "abc123", ANSWERS);
    assert.equal(isClosable(repo, "abc123"), true);
    const record = loadQuiz(repo, "abc123");
    assert.equal(record.status, "answered");
    assert.equal(record.answers.design, ANSWERS.design);
  });

  test("refuses to re-answer an already-answered quiz", () => {
    const repo = tmpRepo();
    openQuiz(repo, "abc123", { questions: QUESTIONS });
    answerQuiz(repo, "abc123", ANSWERS);
    assert.throws(() => answerQuiz(repo, "abc123", ANSWERS), QuizError);
  });
});

// ---------------------------------------------------------------------------
describe("isClosable", () => {
  test("false when no quiz exists at all", () => {
    const repo = tmpRepo();
    assert.equal(isClosable(repo, "nonexistent"), false);
  });
});
