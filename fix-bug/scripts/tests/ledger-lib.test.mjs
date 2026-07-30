// fix-bug/scripts/tests/ledger-lib.test.mjs
//
// Run: node --test fix-bug/scripts/tests/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  normalizeDescription,
  issueKey,
  isSafeIssueKey,
  ledgerPath,
  loadLedger,
  appendAttempt,
  isKnownDeadEnd,
  renderLedgerBrief,
  hasAcceptedAttempt,
  rejectedHypotheses,
  resolveEffectiveAttempts,
  LedgerError,
  OUTCOMES,
} from "../ledger-lib.mjs";

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ledger-"));
}

// ---------------------------------------------------------------------------
describe("normalizeDescription / issueKey — the identity problem", () => {
  test("case and punctuation differences normalize to the same key", () => {
    const a = issueKey("Fix the PlayStore link!!");
    const b = issueKey("fix the playstore link");
    assert.equal(a, b);
  });

  test("whitespace differences normalize to the same key", () => {
    const a = issueKey("fix   the    playstore  link");
    const b = issueKey("fix the playstore link");
    assert.equal(a, b);
  });

  test("a materially different bug description produces a different key", () => {
    const a = issueKey("fix the playstore link");
    const b = issueKey("login button does nothing on mobile safari");
    assert.notEqual(a, b);
  });

  test("key is a safe filename shape", () => {
    const key = issueKey("some bug with / and \\ and ../../ in it");
    assert.ok(isSafeIssueKey(key), `expected safe key, got ${key}`);
    assert.equal(key.length, 16);
  });

  test("empty and null descriptions still produce a valid (if degenerate) key rather than throwing", () => {
    assert.ok(isSafeIssueKey(issueKey("")));
    assert.ok(isSafeIssueKey(issueKey(null)));
  });
});

// ---------------------------------------------------------------------------
describe("loadLedger — absence is normal, corruption is not", () => {
  test("no ledger file yet: present=false, empty attempts, no error", () => {
    const repo = tmpRepo();
    const ledger = loadLedger(repo, "fix the playstore link");
    assert.equal(ledger.present, false);
    assert.deepEqual(ledger.attempts, []);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("malformed JSON is fatal, not silently treated as empty", () => {
    const repo = tmpRepo();
    const key = issueKey("fix the playstore link");
    const dir = path.join(repo, ".dev-agent", "fix-attempts");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${key}.json`), "{ not json");
    assert.throws(() => loadLedger(repo, "fix the playstore link"), LedgerError);
    try {
      loadLedger(repo, "fix the playstore link");
    } catch (e) {
      assert.match(e.message, /re-proposing/);
    }
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("missing attempts array is fatal", () => {
    const repo = tmpRepo();
    const key = issueKey("x");
    const dir = path.join(repo, ".dev-agent", "fix-attempts");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${key}.json`), JSON.stringify({ issue: "x" }));
    assert.throws(() => loadLedger(repo, "x"), LedgerError);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("an attempt record with an invalid outcome is fatal, not silently skipped", () => {
    const repo = tmpRepo();
    const key = issueKey("x");
    const dir = path.join(repo, ".dev-agent", "fix-attempts");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `${key}.json`),
      JSON.stringify({ issue: "x", attempts: [{ n: 1, outcome: "maybe-fine" }] })
    );
    assert.throws(() => loadLedger(repo, "x"), LedgerError);
    fs.rmSync(repo, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
describe("appendAttempt — validation and append-only behavior", () => {
  test("a well-formed accepted attempt is written and readable back", () => {
    const repo = tmpRepo();
    const result = appendAttempt(repo, "fix the playstore link", {
      hypothesis: "hardcoded URL in Footer.tsx was stale",
      diff_summary: "Footer.tsx:42 -- updated href",
      outcome: "accepted",
      commit_sha: "abc123",
    });
    assert.equal(result.wrote.n, 1);
    assert.equal(result.wrote.outcome, "accepted");

    const reloaded = loadLedger(repo, "fix the playstore link");
    assert.equal(reloaded.present, true);
    assert.equal(reloaded.attempts.length, 1);
    assert.equal(reloaded.attempts[0].hypothesis, "hardcoded URL in Footer.tsx was stale");
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("a rejected attempt REQUIRES human_feedback -- this is the field a diff can never contain", () => {
    const repo = tmpRepo();
    assert.throws(
      () =>
        appendAttempt(repo, "x", {
          hypothesis: "some hypothesis",
          diff_summary: "changed something",
          outcome: "rejected",
          // no human_feedback
        }),
      /human_feedback/
    );
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("a rejected attempt WITH human_feedback succeeds", () => {
    const repo = tmpRepo();
    const result = appendAttempt(repo, "x", {
      hypothesis: "app ID constant was wrong",
      diff_summary: "config/links.ts:8",
      outcome: "rejected",
      human_feedback: "still 404s, wrong app ID entirely, not what I described",
    });
    assert.equal(result.wrote.outcome, "rejected");
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("missing hypothesis, diff_summary, or invalid outcome are all rejected with a clear reason", () => {
    const repo = tmpRepo();
    assert.throws(() => appendAttempt(repo, "x", { diff_summary: "y", outcome: "accepted" }), /hypothesis/);
    assert.throws(() => appendAttempt(repo, "x", { hypothesis: "y", outcome: "accepted" }), /diff_summary/);
    assert.throws(() => appendAttempt(repo, "x", { hypothesis: "y", diff_summary: "z", outcome: "bogus" }), /outcome/);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("second attempt increments n and preserves the first", () => {
    const repo = tmpRepo();
    appendAttempt(repo, "x", { hypothesis: "first hypothesis tried", diff_summary: "d1", outcome: "rejected", human_feedback: "nope" });
    const r2 = appendAttempt(repo, "x", { hypothesis: "second hypothesis tried", diff_summary: "d2", outcome: "accepted" });
    assert.equal(r2.wrote.n, 2);
    assert.equal(r2.attempts.length, 2);
    assert.equal(r2.attempts[0].hypothesis, "first hypothesis tried", "first attempt untouched");
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("append-only: an existing attempt's fields are never mutated by a later append", () => {
    const repo = tmpRepo();
    appendAttempt(repo, "x", { hypothesis: "first hypothesis tried", diff_summary: "d1", outcome: "rejected", human_feedback: "f1" });
    appendAttempt(repo, "x", { hypothesis: "second hypothesis tried", diff_summary: "d2", outcome: "rejected", human_feedback: "f2" });
    appendAttempt(repo, "x", { hypothesis: "third hypothesis tried", diff_summary: "d3", outcome: "accepted" });
    const ledger = loadLedger(repo, "x");
    assert.equal(ledger.attempts.length, 3);
    assert.deepEqual(ledger.attempts.map((a) => a.n), [1, 2, 3]);
    assert.equal(ledger.attempts[0].human_feedback, "f1");
    assert.equal(ledger.attempts[1].human_feedback, "f2");
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("files_changed defaults to an empty array when omitted", () => {
    const repo = tmpRepo();
    const r = appendAttempt(repo, "x", { hypothesis: "some hypothesis tried", diff_summary: "d", outcome: "accepted" });
    assert.deepEqual(r.wrote.files_changed, []);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("creates the .dev-agent/fix-attempts directory if it doesn't exist yet", () => {
    const repo = tmpRepo();
    assert.equal(fs.existsSync(path.join(repo, ".dev-agent")), false);
    appendAttempt(repo, "x", { hypothesis: "some hypothesis tried", diff_summary: "d", outcome: "pending" });
    assert.equal(fs.existsSync(path.join(repo, ".dev-agent", "fix-attempts")), true);
    fs.rmSync(repo, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
describe("isKnownDeadEnd — the actual mechanism that fixes the reported bug", () => {
  test("re-proposing an EXACTLY previously-rejected hypothesis is caught", () => {
    const repo = tmpRepo();
    appendAttempt(repo, "playstore link wrong", {
      hypothesis: "hardcoded URL in Footer.tsx was stale",
      diff_summary: "Footer.tsx:42",
      outcome: "rejected",
      human_feedback: "still wrong, points to a different app entirely",
    });
    const ledger = loadLedger(repo, "playstore link wrong");
    const check = isKnownDeadEnd(ledger, "hardcoded URL in Footer.tsx was stale");
    assert.equal(check.match, true);
    assert.equal(check.attempt.n, 1);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("re-proposing a REWORDED but same-substance hypothesis is still caught -- this is the realistic case", () => {
    const repo = tmpRepo();
    appendAttempt(repo, "playstore link wrong", {
      hypothesis: "the hardcoded URL in Footer.tsx was stale and pointed to the old app",
      diff_summary: "Footer.tsx:42",
      outcome: "rejected",
      human_feedback: "nope, still wrong",
    });
    const ledger = loadLedger(repo, "playstore link wrong");
    // A second pass re-deriving the same idea rarely types it identically --
    // this is the realistic failure mode from the bug report, not a
    // synthetic edge case.
    const check = isKnownDeadEnd(ledger, "url in Footer.tsx was stale");
    assert.equal(check.match, true);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("a genuinely different hypothesis is NOT flagged", () => {
    const repo = tmpRepo();
    appendAttempt(repo, "playstore link wrong", {
      hypothesis: "hardcoded URL in Footer.tsx was stale",
      diff_summary: "Footer.tsx:42",
      outcome: "rejected",
      human_feedback: "nope",
    });
    const ledger = loadLedger(repo, "playstore link wrong");
    const check = isKnownDeadEnd(ledger, "the app ID constant in config/links.ts is wrong");
    assert.equal(check.match, false);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("an ACCEPTED prior attempt does not count as a dead end", () => {
    const repo = tmpRepo();
    appendAttempt(repo, "x", {
      hypothesis: "app ID constant was wrong",
      diff_summary: "config/links.ts:8",
      outcome: "accepted",
    });
    const ledger = loadLedger(repo, "x");
    const check = isKnownDeadEnd(ledger, "app ID constant was wrong");
    assert.equal(check.match, false, "an accepted hypothesis is not a dead end -- it's the answer");
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("a PENDING attempt does not count as a dead end", () => {
    const repo = tmpRepo();
    appendAttempt(repo, "x", { hypothesis: "some idea", diff_summary: "d", outcome: "pending" });
    const ledger = loadLedger(repo, "x");
    assert.equal(isKnownDeadEnd(ledger, "some idea").match, false);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("empty ledger never flags anything", () => {
    const ledger = { present: false, attempts: [] };
    assert.equal(isKnownDeadEnd(ledger, "anything").match, false);
  });

  test("an empty candidate hypothesis never matches", () => {
    const repo = tmpRepo();
    appendAttempt(repo, "x", { hypothesis: "some hypothesis tried", diff_summary: "d", outcome: "rejected", human_feedback: "f" });
    const ledger = loadLedger(repo, "x");
    assert.equal(isKnownDeadEnd(ledger, "").match, false);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("the full realistic loop: attempt 1 rejected, attempt 2 (different) rejected, attempt 3 must not repeat either", () => {
    const repo = tmpRepo();
    appendAttempt(repo, "playstore link wrong", {
      hypothesis: "hardcoded URL in Footer.tsx was stale",
      diff_summary: "Footer.tsx:42",
      outcome: "rejected",
      human_feedback: "still 404s",
    });
    appendAttempt(repo, "playstore link wrong", {
      hypothesis: "app ID constant in config/links.ts was wrong",
      diff_summary: "config/links.ts:8",
      outcome: "rejected",
      human_feedback: "that wasn't it either, the constant was already correct",
    });
    const ledger = loadLedger(repo, "playstore link wrong");
    assert.equal(rejectedHypotheses(ledger).length, 2);
    // A third pass re-deriving EITHER prior idea must be caught, not just the first one checked.
    assert.equal(isKnownDeadEnd(ledger, "Footer.tsx URL was stale").match, true);
    assert.equal(isKnownDeadEnd(ledger, "config/links.ts app ID was wrong").match, true);
    // But a genuinely third idea is clear.
    assert.equal(isKnownDeadEnd(ledger, "the build cache was serving a stale bundle").match, false);
    fs.rmSync(repo, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
describe("hasAcceptedAttempt / rejectedHypotheses", () => {
  test("detects an already-accepted fix on this issue", () => {
    const repo = tmpRepo();
    appendAttempt(repo, "x", { hypothesis: "some hypothesis tried", diff_summary: "d", outcome: "accepted" });
    const ledger = loadLedger(repo, "x");
    assert.equal(hasAcceptedAttempt(ledger), true);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("false when nothing accepted yet", () => {
    const repo = tmpRepo();
    appendAttempt(repo, "x", { hypothesis: "some hypothesis tried", diff_summary: "d", outcome: "rejected", human_feedback: "f" });
    const ledger = loadLedger(repo, "x");
    assert.equal(hasAcceptedAttempt(ledger), false);
    fs.rmSync(repo, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
describe("renderLedgerBrief", () => {
  test("empty ledger renders a clear no-history message", () => {
    const ledger = { present: false, attempts: [] };
    assert.match(renderLedgerBrief(ledger), /no prior attempts/i);
  });

  test("a ledger with attempts renders outcome, hypothesis, and feedback per attempt", () => {
    const repo = tmpRepo();
    appendAttempt(repo, "x", {
      hypothesis: "hardcoded URL was stale",
      diff_summary: "Footer.tsx:42",
      outcome: "rejected",
      human_feedback: "still 404s",
    });
    const ledger = loadLedger(repo, "x");
    const brief = renderLedgerBrief(ledger);
    assert.match(brief, /rejected/);
    assert.match(brief, /hardcoded URL was stale/);
    assert.match(brief, /still 404s/);
    fs.rmSync(repo, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
describe("OUTCOMES vocabulary", () => {
  test("exactly three outcomes, no silent fourth state", () => {
    assert.deepEqual(OUTCOMES, ["accepted", "rejected", "pending"]);
  });
});

// ---------------------------------------------------------------------------
describe("supersedes — resolving a pending attempt without mutating it", () => {
  test("a pending attempt superseded by a rejected one no longer counts as pending, and IS a dead end", () => {
    const repo = tmpRepo();
    appendAttempt(repo, "x", {
      hypothesis: "hardcoded URL in Footer.tsx was stale",
      diff_summary: "Footer.tsx:42",
      outcome: "pending",
    });
    appendAttempt(repo, "x", {
      hypothesis: "hardcoded URL in Footer.tsx was stale",
      diff_summary: "Footer.tsx:42",
      outcome: "rejected",
      human_feedback: "still 404s",
      supersedes: 1,
    });
    const ledger = loadLedger(repo, "x");
    assert.equal(ledger.attempts.length, 2, "both records exist -- append-only");
    assert.equal(ledger.attempts[0].outcome, "pending", "the ORIGINAL record is untouched");
    assert.equal(isKnownDeadEnd(ledger, "URL in Footer.tsx was stale").match, true);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("a pending attempt superseded by ACCEPTED counts toward hasAcceptedAttempt", () => {
    const repo = tmpRepo();
    appendAttempt(repo, "x", { hypothesis: "app ID constant was wrong", diff_summary: "d1", outcome: "pending" });
    appendAttempt(repo, "x", {
      hypothesis: "app ID constant was wrong", diff_summary: "d1", outcome: "accepted", supersedes: 1,
    });
    const ledger = loadLedger(repo, "x");
    assert.equal(hasAcceptedAttempt(ledger), true);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("a still-open pending attempt (never superseded) is neither accepted nor rejected", () => {
    const repo = tmpRepo();
    appendAttempt(repo, "x", { hypothesis: "some idea not yet confirmed", diff_summary: "d", outcome: "pending" });
    const ledger = loadLedger(repo, "x");
    assert.equal(hasAcceptedAttempt(ledger), false);
    assert.equal(rejectedHypotheses(ledger).length, 0);
    assert.equal(isKnownDeadEnd(ledger, "some idea not yet confirmed").match, false);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("cannot supersede an attempt number that doesn't exist yet", () => {
    const repo = tmpRepo();
    assert.throws(
      () => appendAttempt(repo, "x", {
        hypothesis: "some hypothesis", diff_summary: "d", outcome: "rejected",
        human_feedback: "f", supersedes: 99,
      }),
      /does not exist yet/
    );
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("superseding an ACCEPTED attempt with a DIFFERENT outcome is allowed -- this is reopening a fix later found broken", () => {
    const repo = tmpRepo();
    appendAttempt(repo, "x", { hypothesis: "an already accepted hypothesis", diff_summary: "d1", outcome: "accepted" });
    const result = appendAttempt(repo, "x", {
      hypothesis: "an already accepted hypothesis", diff_summary: "d1", outcome: "rejected",
      human_feedback: "broke something else in production, has to be reverted", supersedes: 1,
    });
    assert.equal(result.wrote.outcome, "rejected");
    const ledger = loadLedger(repo, "x");
    assert.equal(isKnownDeadEnd(ledger, "an already accepted hypothesis").match, true, "now correctly a dead end");
    assert.equal(hasAcceptedAttempt(ledger), false, "no longer counts as accepted once reopened as rejected");
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("superseding with the SAME outcome again is rejected -- not a resolution, just a duplicate", () => {
    const repo = tmpRepo();
    appendAttempt(repo, "x", { hypothesis: "an already accepted hypothesis", diff_summary: "d1", outcome: "accepted" });
    assert.throws(
      () => appendAttempt(repo, "x", {
        hypothesis: "an already accepted hypothesis", diff_summary: "d1", outcome: "accepted", supersedes: 1,
      }),
      /records nothing new/
    );
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("a target already resolved once cannot be superseded a second time regardless of the new outcome -- must supersede the CURRENT resolution instead", () => {
    const repo = tmpRepo();
    appendAttempt(repo, "x", { hypothesis: "first hypothesis in the chain", diff_summary: "d1", outcome: "pending" });
    appendAttempt(repo, "x", {
      hypothesis: "first hypothesis in the chain", diff_summary: "d1", outcome: "accepted", supersedes: 1,
    });
    // Trying to resolve #1 AGAIN (it's already resolved by #2) must fail,
    // even with yet another different outcome -- the fix is to supersede
    // #2, the current live resolution, not to re-target #1.
    assert.throws(
      () => appendAttempt(repo, "x", {
        hypothesis: "first hypothesis in the chain", diff_summary: "d1", outcome: "rejected",
        human_feedback: "f", supersedes: 1,
      }),
      /already resolved by attempt #2.*supersede #2 instead/
    );
    // Superseding #2 (the correct target) succeeds.
    const result = appendAttempt(repo, "x", {
      hypothesis: "first hypothesis in the chain", diff_summary: "d1", outcome: "rejected",
      human_feedback: "actually broke in prod", supersedes: 2,
    });
    assert.equal(result.wrote.n, 3);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("a full reopen-then-reject chain resolves to the correct FINAL state, not an intermediate one", () => {
    const repo = tmpRepo();
    appendAttempt(repo, "x", { hypothesis: "hypothesis that gets accepted then reopened", diff_summary: "d1", outcome: "pending" });
    appendAttempt(repo, "x", {
      hypothesis: "hypothesis that gets accepted then reopened", diff_summary: "d1", outcome: "accepted", supersedes: 1,
    });
    appendAttempt(repo, "x", {
      hypothesis: "hypothesis that gets accepted then reopened", diff_summary: "d1", outcome: "rejected",
      human_feedback: "broke in prod after all", supersedes: 2,
    });
    const ledger = loadLedger(repo, "x");
    assert.equal(ledger.attempts.length, 3, "all three records preserved, none mutated");
    assert.equal(ledger.attempts[0].outcome, "pending", "record #1 field never changed");
    assert.equal(ledger.attempts[1].outcome, "accepted", "record #2 field never changed");
    const effective = resolveEffectiveAttempts(ledger.attempts);
    assert.equal(effective.length, 1, "only the un-superseded leaf record is effective");
    assert.equal(effective[0].n, 3);
    assert.equal(effective[0].outcome, "rejected");
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("append-only guarantee holds even through a supersedes chain: original pending record's fields never change on disk", () => {
    const repo = tmpRepo();
    appendAttempt(repo, "x", { hypothesis: "original hypothesis text", diff_summary: "original diff", outcome: "pending" });
    const beforeResolve = loadLedger(repo, "x").attempts[0];
    appendAttempt(repo, "x", {
      hypothesis: "original hypothesis text", diff_summary: "original diff",
      outcome: "rejected", human_feedback: "nope", supersedes: 1,
    });
    const afterResolve = loadLedger(repo, "x").attempts[0];
    assert.deepEqual(beforeResolve, afterResolve, "record #1 is byte-identical before and after being superseded");
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("renderLedgerBrief shows the resolved relationship in both directions", () => {
    const repo = tmpRepo();
    appendAttempt(repo, "x", { hypothesis: "some pending idea", diff_summary: "d", outcome: "pending" });
    appendAttempt(repo, "x", {
      hypothesis: "some pending idea", diff_summary: "d", outcome: "rejected", human_feedback: "nope", supersedes: 1,
    });
    const brief = renderLedgerBrief(loadLedger(repo, "x"));
    assert.match(brief, /resolved by #2/);
    assert.match(brief, /resolves #1/);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("a chain of pending -> rejected -> (new pending) -> accepted resolves correctly end to end", () => {
    const repo = tmpRepo();
    appendAttempt(repo, "x", { hypothesis: "first idea tried", diff_summary: "d1", outcome: "pending" });
    appendAttempt(repo, "x", {
      hypothesis: "first idea tried", diff_summary: "d1", outcome: "rejected", human_feedback: "no", supersedes: 1,
    });
    appendAttempt(repo, "x", { hypothesis: "second idea tried", diff_summary: "d2", outcome: "pending" });
    appendAttempt(repo, "x", {
      hypothesis: "second idea tried", diff_summary: "d2", outcome: "accepted", supersedes: 3,
    });
    const ledger = loadLedger(repo, "x");
    assert.equal(ledger.attempts.length, 4, "all four records preserved");
    assert.equal(hasAcceptedAttempt(ledger), true);
    assert.equal(isKnownDeadEnd(ledger, "first idea tried").match, true);
    assert.equal(isKnownDeadEnd(ledger, "second idea tried").match, false, "accepted, not rejected");
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("REGRESSION: a pending attempt already resolved once cannot be superseded a second time", () => {
    // Found by running the CLI end-to-end, not by unit tests: the original
    // validation checked target.outcome !== "pending", but append-only
    // means a superseded attempt's own outcome field stays "pending"
    // forever on disk -- it is never mutated. That check therefore always
    // passed for any target that started pending, and a second
    // supersedes: N silently succeeded, producing a ledger where two
    // different records both claim to resolve the same attempt.
    const repo = tmpRepo();
    appendAttempt(repo, "x", { hypothesis: "first idea to try here", diff_summary: "d1", outcome: "pending" });
    appendAttempt(repo, "x", {
      hypothesis: "first idea to try here", diff_summary: "d1",
      outcome: "rejected", human_feedback: "no good", supersedes: 1,
    });
    assert.throws(
      () => appendAttempt(repo, "x", {
        hypothesis: "second attempt to resolve the same pending record",
        diff_summary: "d2", outcome: "accepted", supersedes: 1,
      }),
      /already resolved by attempt #2/
    );
    const ledger = loadLedger(repo, "x");
    assert.equal(ledger.attempts.length, 2, "the failed third append must not have written anything");
    fs.rmSync(repo, { recursive: true, force: true });
  });
});
