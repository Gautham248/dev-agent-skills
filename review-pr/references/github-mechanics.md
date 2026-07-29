# GitHub review mechanics

The parts that fail in practice, and why the scripts handle them the way
they do.

## Anchoring: `line` + `side`, never `position`

The reviews API accepts two anchoring styles. The legacy `position` is an
offset counted in diff lines from the start of the hunk header — it requires
counting hunk lines exactly right and silently misplaces the comment when it
is off by one, including onto an unrelated file's content.

`line` + `side` addresses the file directly:

- `side: "RIGHT"` + `line` = line number in the **new** file (added/context)
- `side: "LEFT"` + `line` = line number in the **old** file (removed/context)

`review-lib.mjs` only ever emits `line`/`side`, and a test asserts `position`
never appears in a payload.

## Causes of 422 on review submission

A 422 rejects the **entire** review — every line comment in the batch is
lost, not just the offending one. All four are checked before submitting:

1. **Line is not part of the diff.** Anything outside a hunk. Caught by
   `validate`.
2. **`APPROVE` / `REQUEST_CHANGES` on your own PR.** GitHub blocks
   self-review. Since `dev-agent` authors PRs this is the common case, not
   the exception — `resolveReviewEvent` downgrades to `COMMENT` first. The
   same constraint is already documented for `--add-reviewer` in
   `fix-bug/SKILL.md`.
3. **Stale `commit_id`.** If the author pushed since the diff was taken, line
   numbers may refer to code that no longer exists. `assertHeadUnchanged`
   aborts rather than posting shifted comments.
4. **`start_line` >= `line`, or a different `start_side`.** Caught by
   `validate`.

## Idempotency

The reviews API has no natural dedup — submitting twice posts twice. The
summary body carries `<!-- review-pr:<headSha> -->`, and existing reviews are
checked for that marker before submitting. A new push produces a new SHA and
therefore a legitimately new review.

## What cannot be commented on

- **Binary files** — no anchors at all.
- **Pure renames** — zero changed lines, so nothing is anchorable even though
  the file appears in the diff.
- **Lines in the gap between hunks** — context is only 3 lines by default;
  everything else is unanchorable. Widen with `git diff -U10` if a finding
  genuinely needs nearby context, but the finding still has to land on a line
  inside a hunk.

Findings that cannot be anchored are not dropped — they move into the summary
body under "Findings without a diff anchor". That is what makes it safe for
`validate` to reject anchors strictly.

## Rate limits and large reviews

Submitting one review with N comments is a single API call, which is why the
whole batch is assembled first rather than posting comments individually.
Above `DEFAULT_MAX_FINDINGS` (15) the overflow moves into the summary rather
than being posted inline — consistent with the selectivity rule, and it keeps
the payload well inside GitHub's limits.
