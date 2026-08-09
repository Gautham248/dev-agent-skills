// fix-bug/scripts/quiz-back-lib.mjs
//
// The problem this solves: fix-bug can report "done" on a fix the developer
// never actually understood -- the agent explains what it did, the developer
// nods, and six weeks later nobody remembers why that line is there. A
// verbal explanation the developer never had to engage with is not evidence
// they understood it, the same way "the agent said PASS" is not evidence a
// test passed (see ledger-lib.mjs and this repo's evidence-first principle
// generally).
//
// The fix: before a fix-bug run can report status "done", it must open a
// quiz with three DIFFERENT questions (not three phrasings of "does this
// look right") and record the developer's actual answers. Blank answers are
// rejected -- a blank means the question was never really asked, not that
// there's nothing to say.
//
// This is deliberately NOT a re-review of the fix. The reviewing already
// happened at Step 7b (present the fix and STOP). This is a comprehension
// check, after the fact, and it's for the developer's benefit as much as
// the record's -- the three question categories exist so the developer
// walks away actually knowing what changed, not just that something did.
//
// Keyed the same way as the ledger (repoRoot + issue key), stored
// separately under .dev-agent/quiz/ since answers here are meant to be
// read, unlike the ledger's deliberately-hashed input.
//
// Dependency-free (node: builtins only), matching ledger-lib.mjs.

import fs from "node:fs";
import path from "node:path";

export class QuizError extends Error {}

export const QUESTION_IDS = ["design", "edgeCase", "blastRadius"];

/**
 * Fixed prompts for the three categories a quiz must cover. The agent fills
 * in the SPECIFIC question text for a given fix (e.g. "why did you change
 * the redirect constant instead of the routing logic?") -- these are the
 * category definitions the specific question must satisfy, not the literal
 * text to ask. Enforced at openQuiz() only by requiring exactly these three
 * keys, not by checking question wording (that judgment call stays with the
 * agent authoring the question).
 */
export const QUESTION_CATEGORIES = {
  design: "The key design choice made, and what was deliberately NOT done instead.",
  edgeCase: "One edge case this fix does not handle.",
  blastRadius: "What else this change could affect, even indirectly.",
};

export function quizDir(repoRoot) {
  return path.join(repoRoot, ".dev-agent", "quiz");
}

export function quizPath(repoRoot, key) {
  if (!isSafeKey(key)) throw new QuizError(`unsafe quiz key: ${key}`);
  return path.join(quizDir(repoRoot), `${key}.json`);
}

const SAFE_KEY_RE = /^[a-zA-Z0-9._-]{1,120}$/;
export function isSafeKey(key) {
  return typeof key === "string" && SAFE_KEY_RE.test(key);
}

// ---------------------------------------------------------------------------

export function openQuiz(repoRoot, key, { questions, prLink } = {}) {
  if (!questions) throw new QuizError("questions is required");
  for (const id of QUESTION_IDS) {
    if (!questions[id] || !String(questions[id]).trim()) {
      throw new QuizError(`questions.${id} is required and cannot be blank`);
    }
  }
  const dir = quizDir(repoRoot);
  fs.mkdirSync(dir, { recursive: true });
  const record = {
    key,
    status: "pending",
    openedAt: new Date().toISOString(),
    prLink: prLink || null,
    questions,
    answers: null,
    closedAt: null,
  };
  fs.writeFileSync(quizPath(repoRoot, key), JSON.stringify(record, null, 2));
  return record;
}

export function loadQuiz(repoRoot, key) {
  const p = quizPath(repoRoot, key);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function answerQuiz(repoRoot, key, answers) {
  const record = loadQuiz(repoRoot, key);
  if (!record) throw new QuizError(`no open quiz for key ${key} — call openQuiz first`);
  if (record.status === "answered") {
    throw new QuizError(`quiz for ${key} was already answered at ${record.closedAt}`);
  }
  const missing = QUESTION_IDS.filter((id) => !answers[id] || !String(answers[id]).trim());
  if (missing.length) {
    throw new QuizError(
      `unanswered: ${missing.join(", ")} — an unanswered question means the verdict stays ` +
        `"uncertain", not "done"`
    );
  }
  record.answers = answers;
  record.status = "answered";
  record.closedAt = new Date().toISOString();
  fs.writeFileSync(quizPath(repoRoot, key), JSON.stringify(record, null, 2));
  return record;
}

/**
 * The gate fix-bug's Step 12b actually checks before it will let a run's
 * status read "done" instead of "pending-quiz".
 */
export function isClosable(repoRoot, key) {
  const record = loadQuiz(repoRoot, key);
  return !!record && record.status === "answered";
}
