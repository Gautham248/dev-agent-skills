# Why Step 12b exists

An explanation the developer never had to engage with is not evidence they
understood it — the same evidence-over-self-report standard this skill
already applies to its own claims (Step 9's re-read/verify before Step 10
commits) applies here to the human side of the handoff too. "I explained
the fix and they said thanks" is not proof anyone will remember why that
line is there in six weeks.

The reviewing already happened at Step 7b (present the fix and STOP). Step
12b is not a second review — it's a comprehension check, after the fact,
run for the developer's own benefit as much as the record's.

## Why three DIFFERENT questions, not three phrasings of one

A single "does this make sense?" invites a reflexive yes. The three fixed
categories force distinct engagement:

- **design** — what was chosen, and what was deliberately NOT done instead.
  Surfaces whether the developer registered the trade-off, not just the diff.
- **edgeCase** — one case this fix does not handle. Surfaces whether the fix
  is understood as a fix for THIS bug, not a general-purpose solution.
- **blastRadius** — what else this change could touch. Surfaces whether the
  developer has thought past the one file that was edited.

## Why a blank answer is rejected, not defaulted

`quiz-back-lib.mjs`'s `answerQuiz()` throws on any blank category. The
alternative — silently treating "no response" as "fine, moving on" — is
exactly the failure mode this exists to prevent: a status that reads "done"
on a fix nobody actually engaged with. If the developer doesn't respond,
the honest status is "awaiting quiz," and that should be visible wherever
status is reported, not smoothed over.

## Scope

Only runs when Step 10 or Step 11 actually applied the fix. A `pending` or
rejected attempt, or a run with no git repo per Step 0, has nothing to quiz
back on yet.

## See also

- `../scripts/quiz-back-lib.mjs` — the gate `isClosable()` checks.
- `../scripts/quiz-back-cli.mjs` — `open` / `answer` / `status`.
- `fix-attempt-ledger.md` — the different, code-hypothesis-focused record
  this is not a replacement for.
