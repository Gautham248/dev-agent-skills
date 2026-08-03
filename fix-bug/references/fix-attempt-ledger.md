# Fix-attempt ledger

## The problem this solves

Without this, a second pass at the same bug has no memory of the first. A
fix gets proposed, applied, reported as not working, reverted — and the
next proposal can re-derive and re-propose the exact same idea, because
nothing on disk says it was already tried and rejected. The developer ends
up correcting the same mistake twice, sometimes more, with no visible sign
that anything was learned between attempts.

This is a memory gap, not a reasoning gap. The fix isn't a smarter prompt —
it's a place to write down what was tried and what a human said about it,
checked mechanically before every new proposal rather than trusted to the
model's own recollection of a conversation that may have moved on.

## Why this is not commit history

Step 10 (`fix-bug/SKILL.md`) gates committing behind explicit developer
opt-in, defaulting to **not** committing. Most fix attempts — rejected ones
especially — are never committed at all. A ledger keyed to commit history
would be blind to exactly the case it most needs to cover: the failed
attempt nobody committed. The ledger is written at file-edit time (Step 9),
independent of whether Step 10's commit gate ever fires.

It's also not a git diff for a second reason: a diff shows *what* changed,
never *why it was rejected*. "Still 404s, wrong app ID entirely" is not
recoverable from a diff — it only exists in what the developer typed. The
ledger's `human_feedback` field exists specifically to capture the one
piece of information a diff structurally cannot hold.

## Why append-only, and why `supersedes` instead of editing

Records are never edited or removed once written — the same principle
`dev-agent`'s own `ledger.db` uses (one row per turn, no updates, no
deletes), for the same reason: a record that can be silently rewritten
after the fact is not evidence.

Step 9 writes a `pending` record before the outcome is known. When the
outcome becomes known — Step 10's commit, or Step 13's developer feedback —
that's a **new** record with `supersedes: <n>`, not an edit to record `n`.
The original `pending` record is never touched; `resolveEffectiveAttempts()`
walks the chain so callers see the corrected state (`isKnownDeadEnd`,
`hasAcceptedAttempt`, `renderLedgerBrief`) without the underlying history
ever changing.

A pending record can only be resolved once. Attempting to `supersedes` an
already-resolved attempt fails loudly — found as a real bug during manual
testing, not designed in from the start: the naive check (`target.outcome
!== "pending"`) always passed, because a superseded record's own outcome
field stays literally `"pending"` on disk forever. The correct check scans
for an *earlier* record that already claims to resolve the same attempt
number.

## Issue identity

There is no PR number and often no commit on attempt 1 — the only thing
guaranteed to exist from the start is the bug description text. The key is
a SHA-256 hash of that description, lowercased, punctuation stripped,
whitespace collapsed, so trivial rephrasing ("Fix the playstore link!" vs
"fix the playstore link") resolves to the same file. This is normalization,
not semantic matching — a materially different bug report will not collide
by accident, and a near-miss fails in the safe direction (a new ledger
rather than a false collision with an unrelated issue).

## Dead-end matching

`isKnownDeadEnd()` checks a proposed hypothesis against every `rejected`
attempt (after chain resolution) using two layers, both deliberately loose:

1. **Normalized substring**, either direction — catches near-identical
   rewording that preserves word order.
2. **Word-overlap ratio** (≥ 0.7 of the smaller hypothesis's significant
   words, common stopwords excluded) — catches reordering, which substring
   matching structurally cannot: "app ID constant in config/links.ts was
   wrong" and "config/links.ts app ID was wrong" share every significant
   word but in a different sequence, and only the second layer catches it.

Both layers risk an occasional false positive on a genuinely new but
similarly-worded idea. That's the accepted failure direction — a false
positive just prompts a second look; a false negative silently re-proposes
something already refuted, which is the exact bug this file exists to
prevent.

## Schema

```jsonc
{
  "issue": "fix the playstore link",   // the description as first given
  "key": "878588dfd824bc91",           // sha256(normalized description).slice(0,16)
  "attempts": [
    {
      "n": 1,
      "timestamp": "2026-07-30T02:59:43.055Z",
      "hypothesis": "hardcoded URL in Footer.tsx was stale",
      "diff_summary": "Footer.tsx:42 -- updated href to new URL",
      "files_changed": ["Footer.tsx"],
      "commit_sha": null,
      "outcome": "pending",            // accepted | rejected | pending
      "human_feedback": null,
      "supersedes": null
    },
    {
      "n": 2,
      "hypothesis": "hardcoded URL in Footer.tsx was stale",
      "diff_summary": "Footer.tsx:42 -- updated href to new URL",
      "outcome": "rejected",
      "human_feedback": "still 404s, points to the wrong app entirely",
      "supersedes": 1                  // resolves #1 without editing it
    }
  ]
}
```

A `rejected` attempt requires `human_feedback` — validated at write time.
Without it, "rejected" carries no information beyond "not accepted," and a
future pass can't tell an untested idea from a specifically-refuted one.

## Where it lives

`.dev-agent/fix-attempts/<key>.json` in the **target repository**, not in
`dev-agent-skills`. This is a record about one project's bug, the same
reasoning `review-pr`'s repo-local conventions file
(`.dev-agent/review-conventions.md`) already uses — it belongs to the repo
it describes, not to the skill that wrote it.
