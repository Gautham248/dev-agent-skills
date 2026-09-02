# Step 2b mechanics — the renamed/relocated file sweep

Full detail for SKILL.md's Step 2b. SKILL.md keeps the trigger condition
and the command sequence; this file has the reasoning behind why the sweep
exists and how it works.

## Why this exists

A confirmed real miss motivated this: a 372-file PR moved a set of
existing, working iOS services and backend services into new package
directories with no content changes (`git diff` emits these as pure
renames — a header line, zero hunks). The line-anchored review pass
correctly found real issues in the *newly added* code, but three
pre-existing bugs already living in the *relocated* files were never
looked at, because there was nothing in the diff to anchor a comment to
and nothing that told the review to look at those files' actual content
rather than their diff (which is empty).

This is a distinct failure from the "pure rename with nothing to comment
on" case already documented in `edge-cases.md` — that entry is about not
crashing/erroring when a finding can't be anchored to a rename. This sweep
is about actively generating findings from a rename's full content in the
first place, which nothing did before.

## When this runs

Part of Step 2b, so it only runs when `check-scope` already said
`RUN_ARCHITECT_CHECK` — a small, localized PR doesn't carry the same risk
of a relocated file hiding in a sea of legitimately-new files, and this
sweep would just be reviewing the same handful of files Step 4's normal
lens pass already covers directly. If Step 2b is skipped, this sub-step is
skipped with it.

## What counts as a sweep candidate

From the same `parseUnifiedDiff` output already in hand: every file whose
`status` is `"renamed"` **and** whose anchor set is empty (a pure rename —
content genuinely unchanged, not a rename-plus-edit, which already has
real hunks and gets reviewed normally through Step 4). A rename with edits
is not a sweep candidate; it has diff hunks and Step 4's lens pass already
covers it the ordinary way.

## What the sweep actually does

For each candidate file:

1. Read its **full current content** from the real checked-out working
   tree (Step 1 already has this locally) — not the diff, since the diff
   for this file is empty by construction.
2. Resolve which lenses would apply to this file's path the same way
   Step 3 resolves lenses for the rest of the PR (`selectLensesForFiles`
   against the real `lens-registry.json`), plus `first-principles-review`,
   which applies to everything.
3. Run those lenses' review criteria against the file's full content, and
   apply `first-principles-review`'s Pillar 2 ("trace, don't read") the
   same way you would for any file under review — this is not a lighter
   pass just because the file happens to have no diff hunks.
4. Any confirmed issue — not a maybe, not a style nit worth a passing
   mention, an actual confirmed problem — becomes a `type: "renamed-file"`
   entry in the same `coverageFindings` array Step 2b's subsystem-coverage
   findings go in (see the JSON shape in Step 2b of SKILL.md).
   `validateCoverageFinding` accepts both `type: "coverage"` and
   `type: "renamed-file"` entries in one array, discriminated by `type`.

## Why these can't be normal findings

A normal finding (`lens`/`file`/`line`/`evidence`) requires `line` to
land inside a diff hunk — `validateFinding` enforces this specifically
because a finding that can't quote its own line verbatim from the diff is
a finding about a line that may not exist in the form claimed. A pure
rename has no hunks by definition, so there is genuinely no diff line to
anchor to, even though the bug is real and the file is real. The
coverage-finding pipeline already has the right shape for "informational,
not line-anchored, but must still be structurally sound" — `subsystem`
generalizes to `file`, and a real confirmed bug gets the same `severity`
vocabulary a normal finding would (`blocker`/`should`/`nit`), unlike a
subsystem-coverage guess, which doesn't carry severity today.

## Setting severity correctly

Set `severity` explicitly on every `renamed-file` finding. Unlike a
subsystem-coverage finding (an educated guess), this is a bug you have
already confirmed by reading the actual file — it deserves the same
severity discipline as a Step 4 finding, including `blocker`'s
regardless-of-confidence escalation in `partitionByConfidence`. Leaving
`severity` unset does not error, but it silently loses that escalation and
the finding is treated as informational-only, which is wrong for anything
you'd call a `blocker` if it had a line to anchor to.

## What this sweep is not

Not a second full lens pass over every file in a large PR — only files
that are pure renames with zero hunks qualify. Not a substitute for
`architecture-context`'s subsystem-coverage reasoning in the rest of
Step 2b — a renamed file with a real bug and an untouched subsystem the
PR should have touched are two independent things, and both can be true
of the same PR.
