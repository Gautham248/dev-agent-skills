---
name: first-principles-review
description: >
  Critical, first-principles PR review that enumerates and challenges every
  assumption the author made, traces real code paths to validate (or break)
  those assumptions, and questions the diagnosis, the chosen mechanism, the test
  discipline, the rollback story, and the design alternatives — not just
  convention adherence. Use when someone asks for "a critical review", "what
  would the toughest reviewer say", "tear this PR apart", "first-principles
  look", "anything we're missing here", or when an apparently green checklist
  hides a misframed problem. Pairs with — does not replace — a conventions/style
  review pass: that one checks how the code is written; this one questions
  whether the change should exist at all.
---

# First-principles PR review

A conventions review makes sure a PR meets the project's checklist — style,
naming, patterns. This skill makes sure the PR is the *right change in the first
place*. Run it **before** the convention pass — if the change is wrong in its
premises, convention nits don't matter.

## Stance

- The author is wrong by default until the change argues itself. Performative
  agreement ("nice work!") is worse than silence — it dilutes the signal of real
  approval.
- "It passes tests / lint / typecheck" is necessary, not sufficient. Tests can
  pass on the wrong abstraction.
- Conventions are heuristics. If the change violates them but is correct, defend
  the change; if it follows them but is wrong, kill it.
- Disagreement is the work. If you only ever say "approve with minor nits," you
  are not reviewing.

## The two pillars

### Pillar 1 — Enumerate every assumption, then break each one

Before judging the diff, write down — explicitly — every assumption you can
detect the author making. Then walk through each and ask: **what would have to
be true for this assumption to be wrong?** If you can construct a plausible
counterexample, the assumption is the bug, regardless of how nicely the code is
written.

Categories of assumption to look for:

- **About the data shape.** "This field is always set." "This array is
  non-empty." "IDs are UUIDs." "Timestamps are UTC." "This response has at most
  N rows."
- **About concurrency and ordering.** "This runs after that." "Only one of these
  fires at a time." "The cache is consistent." "This callback runs before
  teardown."
- **About authentication and authorization.** "The user is logged in." "The user
  owns this resource." "The middleware already checked X." "This endpoint isn't
  public."
- **About environment.** "We're on the server." "We're in the browser." "This
  runs in a single process." "The feature flag is rolled out."
- **About library or framework behavior.** "The framework re-runs its
  data-loading hook on this navigation." "The ORM's `include`/join returns a
  fully-populated relation." "The validation library strips unknown keys." "The
  row-level-security policy applies here."
- **About callers and callsites.** "Only this one path invokes this function."
  "No one passes `undefined` here." "This is only called from authenticated
  routes."
- **About correctness of the diagnosis itself.** "The bug is in X." "The slow
  path is Y." "This regression started in commit Z."

For each, ask: did the author *check*, or *believe*? An assumption checked once
and not written down is a future regression.

### Pillar 2 — Trace, don't read

Reading the diff tells you what changed. Tracing tells you what *happens*. For
every non-trivial assumption you identified, validate it by walking actual code
paths — not by re-reading the diff.

What "tracing" looks like in practice:

- `git grep` every caller of every function the PR touches. Read those callers'
  assumptions about return shape, side effects, and error behavior. Note any
  caller that the PR's change quietly breaks.
- For schema or type changes: enumerate every reader of the field (`git grep
  <field>` across source, templates, schema definitions, SQL, JSON fixtures,
  *and* tests). One unupdated reader is a runtime crash waiting for the right
  input.
- For added branches: walk the control flow with realistic inputs in your head.
  Identify what makes a branch fire that the author may not have considered
  (empty array, null, very large values, mixed casing, retried requests).
- For added I/O: trace the failure path. What happens when the network call
  times out? When the DB returns 0 rows where the code expected 1? When the
  response shape changes server-side?
- For ORM / row-level-policy layers: trace what gets **generated**, not what's
  typed. A `where` that looks tight can compose with policy clauses (recursive
  ownership checks, joined ACL tables) into something pathological. Verify
  against real query timings or `EXPLAIN`, not against how the API reads.
- For race-sensitive code: build a mental two-thread (or two-request)
  interleaving and find the bad one. If you can't, you don't yet understand the
  change.
- For tests: invert each test mentally — what is the smallest change to the
  system under test that would make this test pass while still being wrong? If
  that change is plausible, the test isn't load-bearing.

The point of tracing is to **find the case the author didn't think of, by
visiting code the diff doesn't touch**.

## Questions, in priority order

Each level destroys more value than the next if missed.

### 1. Is the framing correct?

For a **bug fix**: is the diagnosis right?
- Does the symptom the author describes match what you'd see if the proposed fix
  were correct? (If the fix is "add retry," but the symptom is data corruption,
  the diagnosis is wrong.)
- Could the real bug be one level deeper (e.g., "this caching layer is racy" vs
  "we shouldn't be caching at all")?
- Are there other reports that suggest the symptom comes from a different cause?
- If you removed the change, does the original problem really come back? If you
  can't say yes, the diagnosis isn't pinned down.

For a **feature or refactor**: is this the right artifact to solve the stated
problem?
- Is the user/business problem stated, and is it real? "Users want X" needs
  evidence — a ticket, a usage stat, a stakeholder ask — not vibe.
- Is this PR the smallest artifact that resolves it, or has scope drifted (a
  refactor that "had to happen along the way," a new abstraction unlocking
  nothing concrete)?
- Could the same outcome be reached by changing config, a one-line policy, or
  removing code, rather than adding?

A misframed PR ships a band-aid over the real wound, or builds machinery whose
only customer is itself. Either way, "we already fixed that" forecloses the
actual fix.

### 2. Is the smallest sufficient change being proposed?

- What's the *one line* that resolves the bug or delivers the feature? Is
  everything else around it necessary?
- Has a refactor crept in that wasn't required? Refactors hide their own bugs;
  bundling them with a fix doubles the failure surface.
- Has the author added a new abstraction (helper, type, hook) when an inline
  pattern would do? Two repetitions is fine; three is suspicious; neither is
  automatically wrong.
- Does the diffstat match the change description? A "fix a typo" PR with 400
  lines of diff is a lie about itself.

### 3. What invariant did this codebase rely on that this change breaks?

Every codebase has unwritten promises — orderings, idempotencies,
immutabilities, "this struct is JSON-safe," "this function never throws," "this
is single-tenant." A change that *adds* a feature can break an invariant
*somewhere else* the original author never wrote down. This is where Pillar 2
earns its keep.

- Trace one caller of every changed function and ask: did its assumptions still
  hold?
- If the change touches a shared module (auth, request shape, IDs, time), the
  blast radius is the whole codebase, not the PR diff.
- Are there subtle ordering assumptions in adjacent code that this PR rearranges?

### 4. Does the test prove the property, or just exercise the code path?

- Read the assertions, not the test titles. A test called "rejects invalid
  input" that only checks status code 400 doesn't tell you which inputs are
  rejected.
- For a fix: would the test have *failed* against the pre-fix code? If not, it's
  not a regression test; it's a sanity check. Verify by reverting the system
  under test mentally and replaying the test.
- For a feature: does the test verify the *outcome the user cares about*, or just
  that the new code ran?
- Mocks: does the mock model the real dependency's failure modes, or only its
  happy path? A test that mocks "the database returns these rows" doesn't catch
  "the database times out under load."

### 5. What's the rollback story?

- If this is wrong in prod, how does it get reverted? A simple `git revert`? A
  migration? Data backfill?
- Does the change introduce state (DB rows, cached entries, set flags) that
  survives the revert?
- For schema changes: is there a one-way door (drop column, narrow type, add NOT
  NULL with data fill) that prevents revert?
- Is the change gated by a feature flag, and does the flag actually let you turn
  it off without a code redeploy?

A change that is *correct* but *unrevertable* is more dangerous than one that is
wrong but easy to back out.

### 6. What are the alternative designs, and why is this one chosen?

List two or three alternatives — explicitly, with their tradeoffs — and say why
the PR's approach beats them. If you can't list alternatives, you don't
understand the design space, and you can't tell whether the chosen design is
local-optimum or global-optimum.

Common alternatives worth surfacing:
- Do nothing (is the bug worth fixing? is the feature paying for its
  complexity?).
- Fix one layer up or down (caller vs callee; UI vs server; client cache vs
  server cache).
- Smaller scope (fix this one user's symptom; defer the general case).
- Larger scope (this PR is patching a symptom — the real fix is the refactor it
  avoids).

### 7. What does this lock in that the team will regret?

- Does a new abstraction make future change *harder* (forces consumers to
  refactor with you to evolve)?
- Is the new public API the right shape, or just the easiest shape today?
- Will a future reader spend 20 minutes understanding why this was done if it's
  revisited in a year? If the *why* isn't obvious from names and structure,
  that's the case for a comment — one that explains the *why*, not the *what*.

## How to write the review

Specific > general. Quote the line, name the failure mode, name the fix or
alternative.

```
- `foo.ts:42` — `cache.get(id) || fetch(id)` races when two requests hit `fetch`
  simultaneously; second one's result overwrites the first's. Either dedupe on
  in-flight promises (one extra `Map<id, Promise>` field) or drop the cache and
  rely on the request-level deduplication that already exists in `RequestQueue`.
```

NOT:

```
- Consider thread safety here.
```

Bucket findings by severity so a single PR doesn't produce two incompatible
reports:

- **Blocker** — must change before merge. Quote the line; describe the failure
  mode; offer a fix or specific alternative.
- **Should** — push back unless the author can defend it. Design choice worth
  revisiting; framing concern; missing alternative analysis.
- **Nit** — strictly cosmetic. If you have many, you have a style argument that
  belongs in a separate PR.

Avoid "Suggestion" — it's the lowest-signal label and lets a reviewer dodge
committing to a position. If you run this skill alongside a conventions review,
merge the findings into one bucketed list — don't emit two reviews.

## What this skill is NOT

- Not a substitute for a conventions/style review. Run that after this one
  passes.
- Not a license to be rude. Critical and rude are different things — the harshest
  reviews are short, specific, and dispassionate.
- Not "find more bugs." If you've enumerated assumptions, traced code paths, and
  walked the priority questions and there are no real concerns, say so in two
  sentences and move on. Manufactured findings poison the signal.

## When to invoke

- Someone asks for "a critical review," "first-principles look," "tear this
  apart," "what would the toughest reviewer say."
- A PR has passed CI + the conventions checklist but you suspect the *premise* is
  wrong.
- A PR is large or touches load-bearing infrastructure; the convention pass is
  necessary but insufficient.
- The author wants a real read, not encouragement.
