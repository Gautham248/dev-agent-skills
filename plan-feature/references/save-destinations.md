# Save Destinations — the three output modes

Exact mechanics behind Step 6 of `SKILL.md`. The mode comes from Step 1 (or
from the calling skill's inputs — see "When invoked by another skill").
Exactly one mode runs; never combine them.

## Mode: `new-issue` (default for direct invocation)

```bash
gh issue create \
  --repo <owner>/<repo> \
  --title "Feature plan: <feature name>" \
  --body "<plan content>" \
  --label "planning"
```

If the `planning` label doesn't exist in the repo, create the issue without
the label rather than failing — mention the missing label in the report.

## Mode: `comment-on-issue <number>`

For when the feature already has an issue (e.g. invoked by
`investigate-issue`). The plan lands on the existing issue; **never create a
new issue in this mode, and never open a plan PR.**

```bash
gh issue comment <number> --repo <owner>/<repo> --body-file <plan-file>
```

Write the plan to a temp file and pass it with `--body-file` — inlining a
multi-page markdown body with `--body` invites shell-quoting breakage.

## Mode: `file-in-repo`

The plan is committed as a file and proposed via PR. The PR contains **only
the plan file** — no implementation code.

```bash
mkdir -p <repo-dir>/plans
# write the plan to <repo-dir>/plans/<feature-slug>-plan.md

git -C <repo-dir> checkout -b agent/plan/<feature-slug>-<YYYYMMDD>
git -C <repo-dir> add plans/<feature-slug>-plan.md
git -C <repo-dir> commit -m "[agent] plan: <feature name>"
git -C <repo-dir> push origin agent/plan/<feature-slug>-<YYYYMMDD>

gh pr create \
  --repo <owner>/<repo> \
  --head agent/plan/<feature-slug>-<YYYYMMDD> \
  --base main \
  --title "[Agent] Plan: <feature name>" \
  --body "Feature implementation plan. See the file for details."
```

Stage only the plan file — never `git add .`.

## If the chosen mode's write fails

Report the exact `gh`/git error. Offer a different mode as a fallback only
if the developer agrees — never silently switch modes.

## Revising a plan after feedback

Update the same artifact Step 6 already created — never create a second one.

- **`new-issue`**: `gh issue edit <number> --body-file <revised-plan-file>` —
  replaces the issue body with the revised plan.
- **`comment-on-issue <number>`**: `gh issue comment <number> --repo
  <owner>/<repo> --body-file <revised-plan-file>` — a new comment carrying
  the revision. The original comment is left as-is; the thread shows the
  history.
- **`file-in-repo`**: commit the revised plan file to the *same* branch
  (`agent/plan/<feature-slug>-<date>` from the original save) and push
  again — the existing PR picks up the new commit. Do not open a second PR.

If the original artifact can't be found (issue closed, branch deleted, PR
merged), stop and ask rather than guessing at a fallback.
