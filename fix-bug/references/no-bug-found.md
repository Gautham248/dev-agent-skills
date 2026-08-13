# Why Step 6b exists

Confirmed by testing (locale key-parity check against `en.json`/`hi.json`
in a real repo, explicit skill invocation, full investigation via the
graph and both files): fix-bug had no exit path for "investigated
thoroughly, no bug actually exists." The run correctly loaded the skill,
correctly queried the graph, correctly compared the files, correctly
concluded there was nothing to fix — and then had nowhere to go. Steps
9–12, where the fix-attempt ledger, quiz-back, and the work-log call all
live, only run after a fix is actually determined and applied. A clean
"nothing wrong here" investigation left no trace anywhere.

## Distinct from Step 7's "cannot determine the fix with confidence"

Those are two different outcomes and this step is not for the second one:

- **Step 7's existing guidance** — a bug clearly exists, but you're not
  confident what the correct fix is. That still needs developer
  clarification, and once resolved, still ends up going through Steps
  9–12 normally with an actual change.
- **Step 6b** — investigation is complete and the conclusion is that
  nothing needs to change at all. There is no fix to determine, confident
  or otherwise.

Don't route a genuine "I don't know how to fix this" into Step 6b to avoid
asking for clarification — that's a different failure mode (Step 7 already
says "do not guess") and this step doesn't cover it.

## Why no ledger entry and no quiz-back

The fix-attempt ledger (`references/fix-attempt-ledger.md`) exists to track
hypotheses that were tried and either accepted or rejected, so the same
dead end isn't proposed twice. Nothing was proposed here — there's no
hypothesis to record. Quiz-back exists to check the developer actually
understood a change that was made; nothing was made, so there's nothing to
quiz them on. Calling either here would be recording an event that didn't
happen.

## Why status is `done`, not `blocked`

A completed investigation with a confident "nothing to fix" conclusion is
not an unfinished run — it's a finished one with a negative result. Use
`blocked` only if the investigation itself couldn't be completed (missing
access, ambiguous scope that needs developer input before continuing),
which is a genuinely different situation from concluding cleanly.

## See also

- `../scripts/work-log-lib.mjs` — same session-log mechanism Step 12 uses.
- `fix-attempt-ledger.md` — why it's scoped to actual hypotheses, not
  general investigation.
- `quiz-back.md` — why it's scoped to actual changes.
