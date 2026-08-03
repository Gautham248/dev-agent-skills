# Ledger integration

`scripts/ledger-scan.mjs` reads `fix-bug`'s fix-attempt ledger
(`.dev-agent/fix-attempts/*.json` in the target repo, one file per issue,
written by `fix-bug/scripts/ledger-lib.mjs`) directly -- by parsing the same
JSON artifact `fix-bug` writes, not by importing `fix-bug`'s own modules.

## Why read the file, not import the code

Two reasons, both about keeping this skill decoupled from `fix-bug`'s
internal layout:

1. If `fix-bug` is ever restructured, this script only needs the ledger's
   JSON shape to stay stable -- not any particular function signature.
2. This matches a pattern already used elsewhere in this repo:
   `coding-standards` reads `graphify`'s `.graphify_stack.json` output
   directly rather than calling into `graphify`'s internals. Read the
   artifact, not the implementation.

## What it produces

```bash
node scripts/ledger-scan.mjs summary --repo-root <target-repo-root>
```

Two things `SKILL.md` Step 4 consumes:

### Defect clustering

Per-file counts of accepted / rejected / pending fix attempts, sorted by
rejected-count descending. A file with three rejected attempts before a fix
finally landed has demonstrated -- not guessed -- that it's error-prone.
Step 2's error-guessing technique weights toward these files first.

Superseded attempts are resolved before counting: if attempt #1 was
`rejected` and attempt #2 later `supersedes: 1` with `accepted`, only the
effective (#2, accepted) outcome counts. The original rejection is real
history and still informs *that this file needed more than one attempt*,
but it doesn't double-count as a currently-live rejection once resolved.

### Regression candidates

Every effectively-`accepted` attempt, with its issue description,
hypothesis, diff summary, files changed, and commit SHA (when present).
Each one is a confirmed bug with a known trigger and a known fix -- turning
it into a permanent test means that exact case can never silently regress.

This is the direct, mechanical answer to the pesticide-paradox principle:
regression candidates come from real, specific history, not from re-running
the same generic BVA/EP checklist that already found everything it's going
to find.

## When `fix-bug` invokes this skill directly

If `generate-tests` is triggered as the offered follow-up from `fix-bug`
right after a fix lands (see `SKILL.md`'s trigger conditions), the specific
attempt that was just accepted is already known from that conversation --
there's no need to re-scan the whole ledger to find it. Use
`ledger-scan.mjs summary` for the broader defect-clustering signal across
the rest of the file/repo, but write the regression test for the just-fixed
case directly from what `fix-bug` already reported, rather than re-deriving
it.

## Deliberately more forgiving than `fix-bug`'s own ledger reads

`fix-bug/scripts/ledger-lib.mjs`'s `loadLedger()` fails loud on a malformed
ledger file, on purpose -- silently treating a corrupt "known dead end"
record as empty risks re-proposing a fix a human already rejected, which is
a correctness bug for that one skill's exact job.

`ledger-scan.mjs` is a broad summary across every ledger file in the repo,
not a single issue's dead-end check. One corrupt file here shouldn't blank
out the defect-clustering signal from every other file, so corrupt or
malformed entries are skipped and reported (`summary.skipped`), not fatal.
This is a deliberate difference from `ledger-lib.mjs`'s behavior, not an
oversight -- see the comment at the top of `ledger-scan.mjs` if this ever
needs re-deriving.

## Empty ledger is normal, not an error

A repo with no `.dev-agent/fix-attempts/` directory at all (new repo, or
`fix-bug` has never run there) returns an empty summary, not an error.
`SKILL.md` Step 4 says this plainly and proceeds with Step 2's techniques
alone -- there is no defect history to weight against yet, which is the
expected state for a repo before its first `fix-bug` run.
