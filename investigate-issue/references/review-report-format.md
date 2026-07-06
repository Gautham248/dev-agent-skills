# Branch A Review Report — Required Structure

The report is delivered **in chat only** — never posted to the PR, never
submitted as a GitHub review. Cover every file in the diff; a file with no
findings still gets a line saying so, so the developer knows it was read,
not skipped.

## Template

```markdown
# Review: PR #<pr-number> — <pr-title>

**Issue:** #<issue-number> — <issue-title> (<issue-url>)
**PR:** <pr-url> (<state><, draft if isDraft>) by @<author>, last updated <date>
**Other linked PRs:** <none / list with states — reviewed the most recently updated>

## Does the PR actually address the issue?

<2–4 sentences. Map the issue's stated requirements to what the diff
actually changes. Call out any requirement the PR does not touch, and any
change in the PR that the issue never asked for.>

## File-by-file

### `<path/to/file>`
<What changed, whether it is correct against the issue, and any findings.
"No concerns" is a valid entry — but only after actually reading the diff
hunk.>

### `<path/to/next-file>`
...

## Findings (most severe first)

1. **[severity: blocker/major/minor/nit]** <finding — concrete, with the
   file and line, and the failure scenario if it is a correctness issue>
2. ...
(or: "No findings — the diff does what the issue asks.")

## Gaps against the issue

- <requirement from the issue the PR does not cover, or "none">

## Tests

<Does the PR add/modify tests? Do they cover the issue's scenario? If no
tests: say so plainly and state what a minimal test would look like.>

## Verdict

<One of: "Addresses the issue — looks mergeable pending human review" /
"Addresses the issue with reservations — see findings N, M" /
"Does not fully address the issue — see gaps". Never phrase this as an
approval; the human reviewer decides.>
```

## Rules

- Severity-ordered findings, most severe first.
- Every finding names a file (and line where possible) — no vague "the
  error handling could be better."
- The verdict never says "approved" — this skill has no authority to
  approve, and the report must not read like it does.
- If the diff is enormous (dozens of files), say so up front, review the
  files most relevant to the issue first, and list any files given only a
  cursory pass — do not silently skim.
