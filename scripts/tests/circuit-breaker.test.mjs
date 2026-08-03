// scripts/tests/circuit-breaker.test.mjs
//
// Run: node --test scripts/tests/circuit-breaker.test.mjs
//
// This is a safety primitive — its entire job is to reliably stop a loop
// before it becomes a cost incident. Tests are adversarial on purpose:
// every off-by-one at every boundary, exact-limit vs one-over, exceptions
// that must not be swallowable, and a corrupted ledger that must not
// silently reset a trip.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  CircuitBreakerError,
  LedgerError,
  hashInput,
  breakerLedgerPath,
  loadBreakerLedger,
  recordTurn,
  accumulatedTokens,
  turnCount,
  checkBreaker,
  preflightCheck,
  defaultBudgetFor,
  DEFAULT_BUDGETS,
} from "../circuit-breaker.mjs";

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "breaker-"));
}

// ---------------------------------------------------------------------------
describe("hashInput — never store raw text", () => {
  test("identical inputs hash identically", () => {
    assert.equal(hashInput("some CI error text"), hashInput("some CI error text"));
  });
  test("different inputs hash differently", () => {
    assert.notEqual(hashInput("error A"), hashInput("error B"));
  });
  test("objects are hashed via stable JSON stringification", () => {
    const a = hashInput({ error: "timeout", file: "x.test.ts" });
    const b = hashInput({ error: "timeout", file: "x.test.ts" });
    assert.equal(a, b);
  });
  test("the hash never contains the input text itself", () => {
    const h = hashInput("super secret PII, an API key, whatever");
    assert.equal(h.includes("secret"), false);
    assert.match(h, /^[0-9a-f]{16}$/, "hash is a fixed-length hex digest, not the input");
  });
});

// ---------------------------------------------------------------------------
describe("checkBreaker — the actual boundary logic, exhaustively", () => {
  const budget = { turn_limit: 3, token_limit: 1000 };

  test("turn 1 of 3 (currentTurn=0) is allowed", () => {
    const r = checkBreaker({ turnCount: 0, accumulatedTokens: 0, budget, sessionId: "s" });
    assert.equal(r.ok, true);
    assert.equal(r.nextTurn, 1);
  });

  test("turn 3 of 3 (currentTurn=2) is allowed — the limit-th turn is fine, no grace period needed because it's still within budget", () => {
    const r = checkBreaker({ turnCount: 2, accumulatedTokens: 0, budget, sessionId: "s" });
    assert.equal(r.ok, true);
    assert.equal(r.nextTurn, 3);
  });

  test("turn 4 of 3 (currentTurn=3) trips immediately — no grace period", () => {
    assert.throws(
      () => checkBreaker({ turnCount: 3, accumulatedTokens: 0, budget, sessionId: "s" }),
      CircuitBreakerError
    );
  });

  test("the error names the correct reason and the exact numbers involved", () => {
    try {
      checkBreaker({ turnCount: 3, accumulatedTokens: 0, budget, sessionId: "s" });
      assert.fail("should have thrown");
    } catch (e) {
      assert.ok(e instanceof CircuitBreakerError);
      assert.equal(e.detail.reason, "turn_limit");
      assert.equal(e.detail.nextTurn, 4);
      assert.equal(e.detail.limit, 3);
    }
  });

  test("massively over the turn limit still trips on the same check, not a crash", () => {
    assert.throws(() => checkBreaker({ turnCount: 999, accumulatedTokens: 0, budget, sessionId: "s" }), CircuitBreakerError);
  });

  test("token limit: exactly at the limit is allowed", () => {
    const r = checkBreaker({ turnCount: 0, accumulatedTokens: 1000, budget, sessionId: "s" });
    assert.equal(r.ok, true, "tokens AT the limit, not over it, must still pass");
  });

  test("token limit: one token over trips immediately", () => {
    assert.throws(
      () => checkBreaker({ turnCount: 0, accumulatedTokens: 1001, budget, sessionId: "s" }),
      CircuitBreakerError
    );
  });

  test("token breach reason is distinguishable from turn breach reason", () => {
    try {
      checkBreaker({ turnCount: 0, accumulatedTokens: 1001, budget, sessionId: "s" });
    } catch (e) {
      assert.equal(e.detail.reason, "token_limit");
    }
  });

  test("both limits breached simultaneously: turn_limit is checked and reported first, deterministically", () => {
    try {
      checkBreaker({ turnCount: 3, accumulatedTokens: 1001, budget, sessionId: "s" });
      assert.fail("should have thrown");
    } catch (e) {
      assert.equal(e.detail.reason, "turn_limit", "order must be deterministic, not whichever check happens to run first");
    }
  });

  test("zero-turn, zero-token budget: the very first turn already trips if turn_limit is 0", () => {
    assert.throws(
      () => checkBreaker({ turnCount: 0, accumulatedTokens: 0, budget: { turn_limit: 0, token_limit: 1000 }, sessionId: "s" }),
      CircuitBreakerError
    );
  });

  test("a missing or malformed budget is fatal, not silently treated as unlimited", () => {
    assert.throws(() => checkBreaker({ turnCount: 0, accumulatedTokens: 0, budget: null, sessionId: "s" }), LedgerError);
    assert.throws(() => checkBreaker({ turnCount: 0, accumulatedTokens: 0, budget: {}, sessionId: "s" }), LedgerError);
    assert.throws(
      () => checkBreaker({ turnCount: 0, accumulatedTokens: 0, budget: { turn_limit: "five", token_limit: 100 }, sessionId: "s" }),
      LedgerError
    );
  });

  test("negative accumulated tokens (should never happen, but must not crash or bypass the check) is handled sanely", () => {
    const r = checkBreaker({ turnCount: 0, accumulatedTokens: -50, budget, sessionId: "s" });
    assert.equal(r.ok, true, "negative is nonsensical but strictly under the limit, so it passes rather than throwing a type error");
  });
});

// ---------------------------------------------------------------------------
describe("CircuitBreakerError cannot be silently ignored", () => {
  test("it is a real exception, not a return value — a caller that does nothing with the result still stops", () => {
    let reached = false;
    assert.throws(() => {
      checkBreaker({ turnCount: 99, accumulatedTokens: 0, budget: { turn_limit: 1, token_limit: 100 }, sessionId: "s" });
      reached = true; // must never execute
    });
    assert.equal(reached, false, "code after a tripped check must not run");
  });

  test("it is distinguishable from LedgerError by instanceof, so a caller can handle the two differently if it wants to", () => {
    try {
      checkBreaker({ turnCount: 99, accumulatedTokens: 0, budget: { turn_limit: 1, token_limit: 100 }, sessionId: "s" });
    } catch (e) {
      assert.ok(e instanceof CircuitBreakerError);
      assert.equal(e instanceof LedgerError, false);
    }
  });

  test("the error message is human-readable and names what to do next", () => {
    try {
      checkBreaker({ turnCount: 99, accumulatedTokens: 0, budget: { turn_limit: 1, token_limit: 100 }, sessionId: "s" });
    } catch (e) {
      assert.match(e.message, /stop retrying/i);
      assert.match(e.message, /report to the human/i);
    }
  });
});

// ---------------------------------------------------------------------------
describe("ledger read/write — append-only, corruption-safe", () => {
  test("no ledger yet: present=false, zero turns, zero tokens, not an error", () => {
    const repo = tmpRepo();
    const ledger = loadBreakerLedger(repo, "session-1");
    assert.equal(ledger.present, false);
    assert.equal(turnCount(ledger), 0);
    assert.equal(accumulatedTokens(ledger), 0);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("a corrupted ledger is fatal, not silently treated as a fresh session", () => {
    const repo = tmpRepo();
    const file = breakerLedgerPath(repo, "session-1");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "{ not json at all");
    assert.throws(() => loadBreakerLedger(repo, "session-1"), LedgerError);
    try {
      loadBreakerLedger(repo, "session-1");
    } catch (e) {
      assert.match(e.message, /silently reset a trip/);
    }
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("missing turns array is fatal", () => {
    const repo = tmpRepo();
    const file = breakerLedgerPath(repo, "session-1");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ sessionId: "session-1" }));
    assert.throws(() => loadBreakerLedger(repo, "session-1"), LedgerError);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("recordTurn writes a real record and it's readable back", () => {
    const repo = tmpRepo();
    const result = recordTurn(repo, "session-1", { input: "some CI failure text", tokenDelta: 500, passFail: false, breachReason: null });
    assert.equal(result.wrote.turn, 1);
    assert.equal(result.wrote.token_delta, 500);
    assert.equal(result.wrote.pass_fail, 0);
    assert.match(result.wrote.input_hash, /^[0-9a-f]{16}$/);
    assert.ok(!("input" in result.wrote), "raw input text must never be written to the ledger");

    const reloaded = loadBreakerLedger(repo, "session-1");
    assert.equal(turnCount(reloaded), 1);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("tokens accumulate correctly across multiple turns", () => {
    const repo = tmpRepo();
    recordTurn(repo, "s", { input: "a", tokenDelta: 100 });
    recordTurn(repo, "s", { input: "b", tokenDelta: 250 });
    recordTurn(repo, "s", { input: "c", tokenDelta: 75 });
    const ledger = loadBreakerLedger(repo, "s");
    assert.equal(turnCount(ledger), 3);
    assert.equal(accumulatedTokens(ledger), 425);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("append-only: earlier turns are never mutated by a later append", () => {
    const repo = tmpRepo();
    recordTurn(repo, "s", { input: "first attempt at fixing the test", tokenDelta: 100 });
    recordTurn(repo, "s", { input: "second attempt, different approach", tokenDelta: 200 });
    const ledger = loadBreakerLedger(repo, "s");
    assert.equal(ledger.turns[0].token_delta, 100, "first record untouched by the second append");
    assert.equal(ledger.turns[0].turn, 1);
    assert.equal(ledger.turns[1].turn, 2);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("a missing token delta defaults to 0, not NaN or a crash", () => {
    const repo = tmpRepo();
    const r = recordTurn(repo, "s", { input: "x" });
    assert.equal(r.wrote.token_delta, 0);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("session IDs cannot escape repoRoot via path traversal, even when they contain traversal-shaped text", () => {
    const repo = tmpRepo();
    // The sanitizer strips '/' and '\', which is what actually prevents
    // traversal -- literal '.' characters are allowed through (needed for
    // ordinary filenames) and can survive as harmless leftover text inside
    // a single path segment. Checking for the substring ".." is the wrong
    // property to assert; what matters is that the resolved path can never
    // leave repoRoot, checked below directly.
    const evilIds = [
      "../../etc/passwd",
      "..\\..\\windows\\system32",
      "/etc/passwd",
      "foo/../../bar",
      "a/b/../../../c",
    ];
    for (const evilId of evilIds) {
      const p = breakerLedgerPath(repo, evilId);
      const resolved = path.resolve(p);
      const resolvedRepo = path.resolve(repo);
      assert.ok(
        resolved.startsWith(resolvedRepo + path.sep),
        `session id ${JSON.stringify(evilId)} produced a path escaping repoRoot: ${resolved}`
      );
      // No path separator survives the sanitizer, so the ledger can never
      // be written outside .dev-agent/circuit-breaker/ as a subdirectory
      // escape -- checked by confirming the result is a single filename
      // directly inside that directory, not by a substring check on the
      // sanitized text (which legitimately can contain literal '..' as
      // harmless leftover characters once no '/' remains for it to act on).
      const rel = path.relative(path.join(resolvedRepo, ".dev-agent", "circuit-breaker"), resolved);
      assert.equal(path.dirname(rel), ".", "result must be a single file directly in circuit-breaker/, not a subdirectory");
    }
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("two different session IDs never collide even with similar sanitized names", () => {
    const repo = tmpRepo();
    recordTurn(repo, "pr-42-ci", { input: "a", tokenDelta: 10 });
    recordTurn(repo, "pr-42_ci", { input: "b", tokenDelta: 20 });
    const l1 = loadBreakerLedger(repo, "pr-42-ci");
    const l2 = loadBreakerLedger(repo, "pr-42_ci");
    assert.equal(turnCount(l1), 1);
    assert.equal(turnCount(l2), 1);
    fs.rmSync(repo, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
describe("the realistic loop: check, act, record, repeat, eventually trip", () => {
  test("a session that hits its turn limit trips on exactly the right call, not one before or after", () => {
    const repo = tmpRepo();
    const budget = { turn_limit: 3, token_limit: 100000 };
    const sessionId = "pr-99-ci-remediation";

    for (let i = 1; i <= 3; i++) {
      const ledger = loadBreakerLedger(repo, sessionId);
      const check = checkBreaker({
        turnCount: turnCount(ledger), accumulatedTokens: accumulatedTokens(ledger), budget, sessionId,
      });
      assert.equal(check.ok, true, `turn ${i} of 3 must be allowed`);
      recordTurn(repo, sessionId, { input: `attempt ${i} at fixing the CI failure`, tokenDelta: 500, passFail: false });
    }

    // The 4th attempt is where it must trip.
    const ledger = loadBreakerLedger(repo, sessionId);
    assert.throws(
      () => checkBreaker({ turnCount: turnCount(ledger), accumulatedTokens: accumulatedTokens(ledger), budget, sessionId }),
      CircuitBreakerError
    );
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("token budget trips independently of turn count — few turns, expensive each", () => {
    const repo = tmpRepo();
    const budget = { turn_limit: 100, token_limit: 1000 };
    const sessionId = "expensive-session";

    recordTurn(repo, sessionId, { input: "one huge attempt", tokenDelta: 1200 });
    const ledger = loadBreakerLedger(repo, sessionId);
    // Only 1 turn used (well under turn_limit=100), but tokens already over.
    assert.throws(
      () => checkBreaker({ turnCount: turnCount(ledger), accumulatedTokens: accumulatedTokens(ledger), budget, sessionId }),
      CircuitBreakerError
    );
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("preflightCheck combines load + check in one call and returns the input hash for the caller to reuse in recordTurn", () => {
    const repo = tmpRepo();
    const budget = { turn_limit: 5, token_limit: 50000 };
    const result = preflightCheck(repo, "s", { input: "the CI error text", budget });
    assert.equal(result.ok, true);
    assert.equal(result.nextTurn, 1);
    assert.match(result.inputHash, /^[0-9a-f]{16}$/);
    fs.rmSync(repo, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
describe("defaultBudgetFor / DEFAULT_BUDGETS", () => {
  test("known job types return their specific budget", () => {
    assert.deepEqual(defaultBudgetFor("sync-prs-ci-remediation"), DEFAULT_BUDGETS["sync-prs-ci-remediation"]);
    assert.deepEqual(defaultBudgetFor("fix-bug-attempt"), DEFAULT_BUDGETS["fix-bug-attempt"]);
  });
  test("an unknown job type falls back to generic rather than throwing", () => {
    assert.deepEqual(defaultBudgetFor("something-nobody-registered"), DEFAULT_BUDGETS.generic);
  });
  test("every default budget has finite, positive limits — a default of 0 or Infinity would be a real footgun", () => {
    for (const [name, b] of Object.entries(DEFAULT_BUDGETS)) {
      assert.ok(Number.isFinite(b.turn_limit) && b.turn_limit > 0, `${name}.turn_limit must be finite and positive`);
      assert.ok(Number.isFinite(b.token_limit) && b.token_limit > 0, `${name}.token_limit must be finite and positive`);
    }
  });
});
