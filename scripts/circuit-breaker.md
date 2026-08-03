# Circuit breaker

`scripts/circuit-breaker.mjs` / `scripts/circuit-breaker-cli.mjs`

## The problem this solves

A "repeat until X" step with no exit condition is a real cost incident, not
a theoretical one — <cite>a Claude Code recursion loop burned $16K–$50K in 5
hours; a 4-agent LangChain loop ran 11 days and cost $47K. Both cases:
agents did exactly what they were told, indefinitely, because nobody
defined an exit condition.</cite> Every skill with a loop shaped like
"keep retrying until it works" needs a bound on that loop. Before this
existed, `sync-prs` Step 7 had exactly that shape — *"Repeat until green or
blocked on something that needs a human"* — with no cap at all.

This is a shared primitive, not a per-skill one, because a cap hand-rolled
independently in `sync-prs`, `fix-bug`, and any future looping skill would
drift out of sync with the others in exactly the way `fix-bug`'s
fix-attempt ledger and `review-pr`'s dedup logic were built once and reused
rather than reimplemented per skill.

## Three properties, all deliberate

**Pre-flight, not post-flight.** `checkBreaker()` / `check` is called
*before* the risky action — before another fix attempt, before another
LLM-driven CI re-check — never after. By the time a post-flight check
fires, the cost of that turn is already spent; checking after the fact only
tells you the breaker *should have* stopped you.

**Raises, never returns a code.** `CircuitBreakerError` is a thrown
exception, not a boolean or a status field a caller could forget to check.
A skill that ignores the return value of a normal function call can
accidentally continue past a tripped breaker; a skill cannot accidentally
continue past a thrown exception without an explicit (and visible) `catch`
that swallows it.

**No grace period.** `turnCount == turn_limit` is allowed — the Nth turn,
right up to the limit, is fine. `turnCount + 1 > turn_limit` trips
immediately on the very next check. Tested explicitly at both boundaries
(`scripts/tests/circuit-breaker.test.mjs`), since an off-by-one here in
either direction is exactly the kind of bug this file exists to prevent —
one direction lets a loop run one turn too many, the other blocks a
legitimate final attempt.

## Why `input_hash`, never raw input

The ledger records that a turn happened and what its input hashed to, never
the input text itself — the same principle `dev-agent`'s own `ledger.db`
uses (`input_hash`, never raw input). Two reasons: identical inputs are
still detectable for loop-detection purposes without storing the text, and
a CI error log, a bug description, or a review comment — any of which can
contain something sensitive — never ends up sitting in a file that persists
on disk indefinitely.

## Sessions are per-loop-instance, not global

A session ID identifies *one specific loop*, not "all circuit-breaker usage
in this repo." `sync-prs` keys its session as `pr-<N>-ci-remediation` — one
PR's remediation attempts are bounded independently of every other PR's.
Fixing PR #12 tripping its breaker does not consume any budget that PR #47
needs, because they're different sessions with different ledger files. The
breaker itself doesn't invent a session ID; the calling skill picks one,
since only that skill knows what actually identifies "the same loop" for
its own job shape.

## Budgets are starting proposals, not measured constants

`DEFAULT_BUDGETS` in `circuit-breaker.mjs` are reasonable starting points
for each registered job type, explicitly not tuned from real usage — the
same caveat the original architecture doc attached to its own numbers.
Treat them as a floor to override once real data exists, not as a settled
answer. A skill can always pass its own explicit `--turn-limit` /
`--token-limit` instead of relying on the default for its job type.

## Where the ledger lives

`.dev-agent/circuit-breaker/<session-id>.json` in the **target repository**
— the same `.dev-agent/` convention `fix-bug`'s fix-attempt ledger and
`review-pr`'s repo-local conventions file already use. It belongs to the
repo whose loop it's bounding, not to `dev-agent-skills`.

## What a caller actually does

```bash
# Before the risky action:
node scripts/circuit-breaker-cli.mjs check \
  --repo-root "$REPO_DIR" --session-id "<per-loop id>" \
  --job-type <registered type, or omit for generic defaults> \
  --input "<what this attempt is about>"
# exit 0: proceed. exit 1: stop, report to the human, do not retry with a
# different session name or a larger budget on your own initiative.

# After the action, with the real outcome known:
node scripts/circuit-breaker-cli.mjs record \
  --repo-root "$REPO_DIR" --session-id "<same id>" \
  --input "<what this attempt actually did>" \
  --token-delta <approximate tokens used, 0 if unknown> \
  --pass-fail <true if this attempt succeeded, false otherwise>
```

`check` and `record` are separate calls on purpose — at the moment of
checking, the turn hasn't happened yet and its outcome isn't known; only
after the action completes is there a real `pass_fail` and `token_delta` to
write.
