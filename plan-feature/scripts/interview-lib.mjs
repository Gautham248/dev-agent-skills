// plan-feature/scripts/interview-lib.mjs
//
// The problem this solves: plan-feature's Step 1 ("gather information")
// currently gathers what the developer thought to say. CLARIFICATION-PROTOCOL.md
// already forces a stop-and-ask when the agent is genuinely unsure about
// something -- but that only fires for gaps the agent notices. It does
// nothing for constraints the developer knows subconsciously and never
// thought to mention (failure-mode handling, what must never happen,
// rollback plan) because nothing prompted them to say it.
//
// The fix: a fixed, standard question set asked once, before Step 5 (write
// the plan). Not a substitute for CLARIFICATION-PROTOCOL.md's judgment-call
// clarification -- this runs unconditionally, every time, regardless of
// whether the agent feels uncertain about anything.
//
// "n/a" or "none" are accepted as real answers -- the point is that the
// question got asked and the developer had to actively decide it doesn't
// apply, not that every constraint category applies to every feature.
// Truly blank means the question was never surfaced at all, which is the
// one failure mode this exists to prevent.
//
// Dependency-free (node: builtins only), matching ledger-lib.mjs and
// deviation-log-lib.mjs.

import fs from "node:fs";
import path from "node:path";

import { normalizeTitle, titleKey as featureKey } from "../../scripts/title-key-lib.mjs";

export class InterviewError extends Error {}

export const STANDARD_QUESTIONS = [
  { id: "failure_modes", prompt: "What should happen when this fails partway through?" },
  { id: "must_never", prompt: "What must this feature NEVER do, even on edge-case input?" },
  { id: "perf_constraints", prompt: "Any latency, throughput, or cost constraint this has to respect?" },
  { id: "rollback", prompt: "If this ships and turns out wrong, how do we turn it off or roll it back?" },
  { id: "out_of_scope", prompt: "What's explicitly OUT of scope for this pass?" },
];

const QUESTION_IDS = STANDARD_QUESTIONS.map((q) => q.id);

export function interviewDir(repoRoot) {
  return path.join(repoRoot, ".dev-agent", "interviews");
}

export { featureKey };

export function interviewPath(repoRoot, title) {
  return path.join(interviewDir(repoRoot), `${featureKey(title)}.json`);
}

// ---------------------------------------------------------------------------

export function openInterview(repoRoot, title) {
  if (!title || !String(title).trim()) throw new InterviewError("title is required");
  const dir = interviewDir(repoRoot);
  fs.mkdirSync(dir, { recursive: true });
  const record = {
    title,
    status: "pending",
    openedAt: new Date().toISOString(),
    questions: STANDARD_QUESTIONS,
    answers: {},
    closedAt: null,
  };
  fs.writeFileSync(interviewPath(repoRoot, title), JSON.stringify(record, null, 2));
  return record;
}

export function loadInterview(repoRoot, title) {
  const p = interviewPath(repoRoot, title);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function answerInterview(repoRoot, title, answers) {
  const record = loadInterview(repoRoot, title);
  if (!record) throw new InterviewError(`no open interview for "${title}" — call openInterview first`);
  const missing = QUESTION_IDS.filter((id) => !answers[id] || !String(answers[id]).trim());
  if (missing.length) {
    throw new InterviewError(
      `unanswered: ${missing.join(", ")} — use "n/a" if a category genuinely doesn't apply, ` +
        `a blank means the question was never surfaced`
    );
  }
  record.answers = answers;
  record.status = "answered";
  record.closedAt = new Date().toISOString();
  fs.writeFileSync(interviewPath(repoRoot, title), JSON.stringify(record, null, 2));
  return record;
}

/**
 * The gate plan-feature's Step 1 checks before proceeding to Step 5 (write
 * the plan).
 */
export function isReadyToPlan(repoRoot, title) {
  const record = loadInterview(repoRoot, title);
  return !!record && record.status === "answered";
}
