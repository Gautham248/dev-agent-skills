// scripts/circuit-breaker.mjs
//
// A shared primitive any skill can call to bound a repeat/retry loop —
// "keep trying until X" without an exit condition is the exact failure
// mode documented as a real cost incident: a recursion loop that burned
// $16K-$50K in 5 hours because nobody defined a turn limit. This exists so
// that every skill with a "repeat until..." step (sync-prs's CI
// remediation, fix-bug's re-propose-a-fix loop, any future one) shares one
// tested implementation instead of each hand-rolling its own cap that
// drifts out of sync with the others.
//
// Three properties carried over deliberately from the production-safety
// design this implements:
//   1. Pre-flight, not post-flight. check() is called BEFORE the risky
//      action (an LLM call, a fix attempt, a CI re-check), never after --
//      by the time a post-flight check fires, the cost is already spent.
//   2. Raises, never returns a code. A CircuitBreakerError is an
//      exception. A skill that "forgets" to check the return value cannot
//      accidentally continue past a tripped breaker, because there is no
//      value to forget to check -- the call either returns normally or
//      the loop stops.
//   3. No grace period. turn_count == limit is fine (the Nth turn is
//      allowed); turn_count == limit + 1 trips immediately. Off-by-one in
//      either direction here is exactly the kind of bug this file's own
//      tests exist to catch before it ships.
//
// Dependency-free (node: builtins only), matching every other scripts/
// file in this repo -- `git clone && bash setup.sh` remains the whole
// install story.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export class CircuitBreakerError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = "CircuitBreakerError";
    this.detail = detail;
  }
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/**
 * Starting budgets, one per job shape. Not universal constants -- a skill
 * calling checkBreaker() always passes its own explicit limits; these exist
 * so a skill that hasn't decided its own numbers yet has a reasonable
 * default rather than an unbounded one, and so every skill's default lives
 * in one place instead of being copy-pasted per skill and drifting.
 *
 * These are STARTING proposals, not measured from real usage -- the same
 * caveat the original architecture doc attached to its own numbers. Tune
 * per skill once real data exists; don't treat these as load-bearing.
 */
export const DEFAULT_BUDGETS = {
  "sync-prs-ci-remediation": { turn_limit: 5, token_limit: 60000 },
  "fix-bug-attempt": { turn_limit: 3, token_limit: 40000 },
  generic: { turn_limit: 10, token_limit: 50000 },
};

export function defaultBudgetFor(jobType) {
  return DEFAULT_BUDGETS[jobType] || DEFAULT_BUDGETS.generic;
}

// ---------------------------------------------------------------------------
// Input hashing -- never store raw input text
// ---------------------------------------------------------------------------

/**
 * The ledger records that a turn happened and what its input HASHED to,
 * never the input itself. Two reasons, both load-bearing: identical inputs
 * are still detectable for loop-detection (the actual point of this file),
 * and PII in a bug description, a CI error log, or a review comment never
 * enters a file that persists on disk indefinitely.
 */
export function hashInput(input) {
  const normalized = typeof input === "string" ? input : JSON.stringify(input);
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

// ---------------------------------------------------------------------------
// Ledger read/write
// ---------------------------------------------------------------------------
//
// One ledger file per (repo, session). "Session" here means one continuous
// attempt at one job -- e.g. one PR's CI-remediation loop, or one bug's
// fix-attempt sequence -- not a whole conversation. A skill picks its own
// session_id; the breaker doesn't invent one, since only the calling skill
// knows what actually identifies "the same loop" for its own job shape.

export function breakerLedgerPath(repoRoot, sessionId) {
  const safeId = sessionId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  return path.join(repoRoot, ".dev-agent", "circuit-breaker", `${safeId}.json`);
}

export class LedgerError extends Error {}

export function loadBreakerLedger(repoRoot, sessionId, opts = {}) {
  const readFile = opts.readFile || ((p) => fs.readFileSync(p, "utf8"));
  const existsFn = opts.exists || ((p) => fs.existsSync(p));

  const file = breakerLedgerPath(repoRoot, sessionId);
  if (!existsFn(file)) {
    return { present: false, path: file, sessionId, turns: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(readFile(file));
  } catch (err) {
    // A corrupt ledger must not silently read as "zero turns so far" --
    // that would let a breaker that already tripped reset itself for
    // free, which defeats the entire mechanism. Fail loud.
    throw new LedgerError(
      `Circuit-breaker ledger at ${file} is not valid JSON (${err.message}). ` +
        `Refusing to treat this as a fresh session -- that would silently reset a trip.`
    );
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.turns)) {
    throw new LedgerError(`Circuit-breaker ledger at ${file} is malformed: missing "turns" array.`);
  }
  return { present: true, path: file, sessionId, turns: parsed.turns };
}

/**
 * Appends one turn record. Append-only, matching every other ledger in this
 * repo (fix-bug's fix-attempt ledger, dev-agent's own ledger.db) -- a
 * record of what already happened is audit evidence, and evidence that can
 * be silently rewritten after the fact is not evidence.
 */
export function recordTurn(repoRoot, sessionId, turn, opts = {}) {
  const writeFile = opts.writeFile || ((p, c) => fs.writeFileSync(p, c));
  const mkdirFn = opts.mkdir || ((p) => fs.mkdirSync(p, { recursive: true }));

  const current = loadBreakerLedger(repoRoot, sessionId, opts);
  const turnCount = current.turns.length + 1;

  const record = {
    turn: turnCount,
    timestamp: turn.timestamp || new Date().toISOString(),
    input_hash: hashInput(turn.input),
    token_delta: Number.isFinite(turn.tokenDelta) ? turn.tokenDelta : 0,
    pass_fail: turn.passFail === false ? 0 : 1,
    breach_reason: turn.breachReason || null,
  };

  const updated = { sessionId: current.sessionId, turns: [...current.turns, record] };
  mkdirFn(path.dirname(current.path));
  writeFile(current.path, JSON.stringify(updated, null, 2) + "\n");

  return { ...current, present: true, turns: updated.turns, wrote: record };
}

export function accumulatedTokens(ledger) {
  return ledger.turns.reduce((sum, t) => sum + (t.token_delta || 0), 0);
}

export function turnCount(ledger) {
  return ledger.turns.length;
}

// ---------------------------------------------------------------------------
// The actual check — pre-flight, throws on breach
// ---------------------------------------------------------------------------

/**
 * Call this BEFORE the risky action — before the LLM call, before
 * attempting another fix, before re-checking CI again. Never after.
 *
 * Deliberately takes the CURRENT ledger state as an argument (turnCount,
 * accumulatedTokens) rather than reading the ledger itself, so a caller
 * that wants to check hypothetically ("would turn N be allowed") can do so
 * without a file on disk — the same separation the original design uses
 * (check() is pure, the ledger is the caller's concern).
 */
export function checkBreaker({ turnCount: currentTurn, accumulatedTokens: currentTokens, budget, sessionId }) {
  if (!budget || !Number.isFinite(budget.turn_limit) || !Number.isFinite(budget.token_limit)) {
    throw new LedgerError(
      `checkBreaker requires a budget with numeric turn_limit and token_limit -- ` +
        `got ${JSON.stringify(budget)}. A missing budget must not silently mean unlimited.`
    );
  }

  // The NEXT turn is currentTurn + 1 -- check() is pre-flight, asking "may
  // I take the turn I am about to take," not "was the turn I just took
  // allowed." currentTurn == turn_limit means the limit-th turn already
  // happened and is fine; currentTurn + 1 > turn_limit means the turn
  // about to be attempted would be the FIRST one over budget, and that is
  // exactly the one that must not run.
  const nextTurn = currentTurn + 1;

  if (nextTurn > budget.turn_limit) {
    printCheckpointBanner({ sessionId, currentTurn, currentTokens, budget, reason: "turn_limit" });
    throw new CircuitBreakerError(
      `Circuit breaker tripped for session "${sessionId}": turn ${nextTurn} would exceed ` +
        `turn_limit ${budget.turn_limit}. Stop retrying and report to the human instead.`,
      { reason: "turn_limit", nextTurn, limit: budget.turn_limit, sessionId }
    );
  }

  if (currentTokens > budget.token_limit) {
    printCheckpointBanner({ sessionId, currentTurn, currentTokens, budget, reason: "token_limit" });
    throw new CircuitBreakerError(
      `Circuit breaker tripped for session "${sessionId}": accumulated tokens ${currentTokens} ` +
        `already exceed token_limit ${budget.token_limit}. Stop retrying and report to the human instead.`,
      { reason: "token_limit", currentTokens, limit: budget.token_limit, sessionId }
    );
  }

  return { ok: true, nextTurn, remainingTurns: budget.turn_limit - currentTurn, remainingTokens: budget.token_limit - currentTokens };
}

/**
 * A human-readable trace printed to stdout the instant a breach occurs,
 * BEFORE the exception is thrown -- so even a swallowed exception (a bug
 * in the caller that catches too broadly) leaves a visible trace in
 * whatever log captured stdout. This is a deliberate belt-and-suspenders:
 * the exception is the primary mechanism, this is the fallback for when
 * something goes wrong with the primary mechanism itself.
 */
function printCheckpointBanner({ sessionId, currentTurn, currentTokens, budget, reason }) {
  console.log(
    [
      "─".repeat(60),
      `⚠ CIRCUIT BREAKER CHECKPOINT — session "${sessionId}"`,
      `  reason:        ${reason}`,
      `  turns so far:  ${currentTurn} / ${budget.turn_limit}`,
      `  tokens so far: ${currentTokens} / ${budget.token_limit}`,
      "─".repeat(60),
    ].join("\n")
  );
}

// ---------------------------------------------------------------------------
// Convenience: check + record in one call, the shape a skill actually uses
// ---------------------------------------------------------------------------

/**
 * What a skill calls in practice: load the ledger, check the breaker
 * against its current state, and — only if the check passes — the caller
 * proceeds with the risky action and then calls recordTurn() itself
 * afterward with the real outcome. This function does the read-and-check
 * half; it deliberately does NOT record the turn, because at the moment
 * of checking, the turn hasn't happened yet and its outcome isn't known.
 */
export function preflightCheck(repoRoot, sessionId, { input, budget, opts = {} }) {
  const ledger = loadBreakerLedger(repoRoot, sessionId, opts);
  const result = checkBreaker({
    turnCount: turnCount(ledger),
    accumulatedTokens: accumulatedTokens(ledger),
    budget,
    sessionId,
  });
  return { ...result, ledger, inputHash: hashInput(input) };
}
