---
name: sync-prs
description: >
  Use when the user asks to sync, check, refresh, or triage their own open
  GitHub pull requests — phrases like "sync my PRs", "check my PRs", "merge the
  base into my conflicting PRs", "fix CI on my PRs", or "address review comments
  on my PRs". Merges each PR's base branch when GitHub flags it conflicting,
  triages CI failures (auto-fixing safe lint/format issues), and surfaces
  unresolved review threads — each PR worked in an isolated git worktree.
---

<!-- BEGIN dev-agent-skills clarification protocol (managed by setup.sh -- do not edit this block manually; edit CLARIFICATION-PROTOCOL.md instead) -->
Before doing anything else in this skill, read and follow the clarification protocol at:
/home/gautham/10xMinds/AI-Dev-Agent/dev-agent-skills/CLARIFICATION-PROTOCOL.md
<!-- END dev-agent-skills clarification protocol -->

# Sync PRs

Lists the running user's open PRs in a GitHub repo, merges each PR's base
branch when GitHub flags it `CONFLICTING`, triages CI, and lists unresolved
review threads. Conflicting PRs that auto-merge cleanly are committed and
pushed; PRs that need manual conflict edits are reported and skipped.

When the user asks to **fix failures** (not just report them), treat the
script output as a starting checkpoint — then complete Step 7 for every PR
that still has ❌ CI or 💬 review work.

## Run

Prefer the script over hand-rolling the steps below:

```bash
pnpm tsx scripts/sync.ts
```

Add `--dry-run` to print the report without fetch/merge/push/commit writes.

By default only PRs **opened within the last 2 calendar months** are synced,
triaged, and reported. Older open PRs appear in the table as
`⏭️ skipped: older than 2 months` with no GitHub fetches. Include a specific
older PR with `--pr`:

```bash
pnpm tsx scripts/sync.ts --pr 1798
pnpm tsx scripts/sync.ts --pr 1798,3405
```

When the user names a PR number ("sync #1798", "fix CI on PR 3405"), pass
`--pr` for that number even if it is older than 2 months.

Agents should invoke the script (or follow the steps below when the script
cannot run — e.g. auto-fix commits blocked by a local commit hook).

## Configuration

Nothing is hardcoded to one repo or machine. Resolution order:

| Setting | Flag | Env var | Default |
|---|---|---|---|
| Repo | `--repo owner/name` | `SYNC_PRS_REPO` | `gh repo view` of the current repo |
| Worktrees dir | `--worktrees-dir <path>` | `SYNC_PRS_WORKTREES_DIR` | `<repo-root>/.worktrees/` |
| Auto-fix command | — | `SYNC_PRS_LINTFIX_CMD` | `pnpm run lint:fix` |
| Skipped-check pattern | — | `SYNC_PRS_SKIP_CHECK_PATTERN` | `argos\|visual-test\|percy\|chromatic` |
| Recency window (months) | — | `SYNC_PRS_MAX_AGE_MONTHS` | `2` |

Each PR's **base branch** is read per-PR from `baseRefName` via the GitHub
API — there is no global base-branch setting to configure.

Add the worktrees directory to your `.gitignore` if it lives inside the repo
(the default does). The script sets `HUSKY=0` so Husky `post-checkout` hooks
don't fail worktree creation in directories without installed dependencies —
harmless if you don't use Husky.

## Step 1 — Identify the running user

```bash
ME=$(gh api user --jq .login)
```

If `gh` is unauthenticated, stop with: "`gh auth login` first."

## Step 2 — List candidate PRs

```bash
gh pr list \
  --repo <owner/name> \
  --author "@me" \
  --state open \
  --json number,title,headRefName,baseRefName,isDraft,mergeable,mergeStateStatus,createdAt
```

Drafts are included. The skill targets all PRs the user owns regardless of
review state.

**Recency filter (default):** after listing, only process PRs whose `createdAt`
is within the last 2 calendar months. Skip older PRs unless their number was
passed via `--pr <number>` (comma-separated for multiple). Skipped PRs still
appear in the Step 8 table as `⏭️ skipped: older than 2 months` with CI and
reviews marked `(skipped)` — no merge, CI, or review fetches for them.

If the list is empty, print `No open PRs by @<user> in <owner/name>.` and exit.

## Step 3 — Classify each PR

| `mergeable` | Action |
|---|---|
| `MERGEABLE` | ✅ up-to-date — skip, no work |
| `CONFLICTING` | 🔄 proceed to Step 4 |
| `UNKNOWN` | Wait 3s, re-query once. If still UNKNOWN, report and skip. |

GitHub returns `UNKNOWN` briefly after a push while it recomputes mergeability.

## Step 4 — Sync flow (per conflicting PR)

### 4a. Find or create the worktree

Parse `git -C <repo-root> worktree list --porcelain`. Match by the line
`branch refs/heads/<headRefName>`. If a worktree exists, reuse its path — even
if it lives outside the configured worktrees directory. Discovery is by branch,
not by path heuristics, so any existing worktree for the branch is reused.

If no worktree exists, create one. Set `HUSKY=0` so husky post-checkout hooks
do not fail the add when dependencies are not installed in the worktree. If
`<worktrees-dir>/<short-name>` already exists but is not registered (orphan
dir), `worktree add --force` alone is not enough — remove the orphan directory,
then add fresh. The script does this automatically.

```bash
export HUSKY=0
SHORT=$(echo "<headRefName>" | sed 's|^[^/]*/||')   # alice/foo → foo; foo → foo
WT="<worktrees-dir>/$SHORT"
git -C <repo-root> worktree add "$WT" "<headRefName>"
# orphan dir on disk: rm -rf "$WT" first, then worktree add
```

(`git merge origin/<base> --no-edit` creates the merge commit; a separate
`git commit` is only needed when the merge leaves staged changes without
committing.)

### 4b. Refuse if dirty

```bash
git -C "<worktree>" status --porcelain
```

If non-empty, skip this PR with result "❌ error: worktree dirty" and move on.

### 4c. Fetch and fast-forward

```bash
git -C "<worktree>" fetch origin "<headRefName>" "<baseRefName>"
git -C "<worktree>" pull --ff-only origin "<headRefName>"
```

If fast-forward fails (local diverged from remote head), skip with result
"❌ error: local diverged from remote — needs manual reconciliation".

### 4d. Merge base into head

```bash
git -C "<worktree>" merge "origin/<baseRefName>" --no-edit
```

Check the result:

- **Clean auto-merge** (exit 0, no conflict markers): go to 4f.
- **Lockfile-only conflicts** (exit non-zero, every unmerged path is
  `pnpm-lock.yaml`, `package-lock.json`, or `yarn.lock` — including under a
  package subdir): the script keeps the merge open, removes the conflicted
  lockfile(s), runs `pnpm install --lockfile-only` (falls back to full
  `pnpm install`) to regenerate from the merged `package.json` tree, commits
  with `--no-edit`, and pushes. Report `🔄 synced (lockfile regenerated)`.
  Merge commits are hook-exempt like clean auto-merges.
- **Any other conflicts** (exit non-zero with non-lockfile files mixed in):
  ```bash
  git -C "<worktree>" diff --name-only --diff-filter=U   # list unmerged files
  git -C "<worktree>" merge --abort
  ```
  Skip this PR with result "⚠️ manual: N files need resolution" and the file
  list. Move to the next PR.

### 4e. Commit (manual agent flow only)

When following these steps by hand rather than running the script, stage any
leftover merge changes and commit. The script relies on `git merge --no-edit`,
which creates the merge commit directly:

```bash
git -C "<worktree>" add -u
git -C "<worktree>" commit --no-edit
```

Merge commits carry forward already-reviewed upstream content, so no fresh
code review of the merge is needed. (See *Commit hooks* below if your repo
gates commits.)

### 4f. Push

```bash
git -C "<worktree>" push origin "<headRefName>"
```

If push is rejected (concurrent push from another machine):

```bash
git -C "<worktree>" fetch origin "<headRefName>"
git -C "<worktree>" pull --ff-only origin "<headRefName>"
git -C "<worktree>" push origin "<headRefName>"
```

If still rejected after one retry, report "❌ error: push rejected after
fetch + ff" and continue.

## Step 5 — Check and remediate CI failures (every PR)

Run for **every** PR — `MERGEABLE`, just-synced, or otherwise — except those
that ended Step 4 with `⚠️ manual` or `❌ error` (their state is too unstable
to act on CI).

### 5a. Fetch check status

```bash
gh pr view <number> --repo <owner/name> --json statusCheckRollup
```

### 5b. Bucket each check

| Bucket | Criterion |
|---|---|
| ✅ green | conclusion `SUCCESS` / `NEUTRAL` / `SKIPPED` |
| ⏳ in-progress | status `IN_PROGRESS`, `QUEUED`, or `PENDING` (conclusion empty) |
| 🎨 visual | name matches the skipped-check pattern (Argos, Percy, Chromatic, …) — regardless of state |
| ❌ failed | conclusion `FAILURE` / `CANCELLED` / `TIMED_OUT` and not 🎨 |

If **any** non-visual check is ⏳, record `⏳ CI in progress` for the PR and
skip the rest of Step 5 for it. The user can re-run the skill later to pick
up newly-failed checks.

🎨 checks are ignored — visual regressions are reviewed in their own
service UI, not auto-fixed here.

### 5c. Categorise each failed check

For each ❌ check, fetch the failed step log:

```bash
gh run view <run-id> --log-failed --repo <owner/name>
```

To get `<run-id>` from `statusCheckRollup`, parse the failing check's
`detailsUrl` (format `…/actions/runs/<run-id>/job/<job-id>`), or run
`gh run list --branch <headRefName> --limit 10 --json databaseId,name,conclusion`
and match by check name.

Match the failure against this table:

| Category | Detection (log / check-name signals) | Treatment |
|---|---|---|
| ESLint | `ESLint:` errors, `lint` step | **auto-fix** — run `$SYNC_PRS_LINTFIX_CMD` (default `pnpm run lint:fix`) |
| Prettier | `prettier` step, "Code style issues" | **auto-fix** — run `$SYNC_PRS_LINTFIX_CMD` |
| Vitest snapshot mismatch | "Snapshot `…` mismatched" / "obsolete snapshot" | **investigate** — propose `vitest -u <spec>` in the report; do not auto-update (could mask real regressions) |
| TypeScript (`tsc`) | TS error codes | **investigate** — do not edit |
| Unit / E2E test failure | unit / playwright assertion | **investigate** — do not edit |
| Build / install / config | build, install errors | **investigate** — do not edit |
| Other | unmatched | **investigate** |

### 5d. Auto-fix flow (per fixable failure)

The PR's worktree was either created in Step 4a or, for a PR that skipped
Step 4 because it was already `MERGEABLE`, open one now using the same
Step 4a discovery logic. Then:

```bash
# Run the configured auto-fix command (default shown).
pnpm run lint:fix

# If the fix produced no diff, the issue was already resolved upstream.
# Record ✅ green for this check and move on.
git -C "<worktree>" diff --quiet && echo "no diff — skip commit"

# Otherwise commit and push. Include the PR number in the subject.
git -C "<worktree>" add -u
git -C "<worktree>" commit -m "fix: auto-fix <category> from CI (#<number>)"
git -C "<worktree>" push origin "<headRefName>"
```

These commits are **not** merge commits. If your repo gates commits with a
hook (review gate, commit signing, conventional-commit lint), it fires here —
satisfy it before retrying. See *Commit hooks* below.

If the auto-fix command itself exits non-zero (e.g. lint failures that
`--fix` cannot resolve), treat the category as **investigate** instead. Do
not commit a half-fix.

### 5e. Investigate flow (per non-fixable failure)

Capture for the Step 6 report:

- Check name + run URL (`gh run view <run-id> --json url`)
- ~10-line excerpt from the failed step log
- A 1–2 sentence proposed fix grounded in the error message

For **E2E / Playwright** failures, also download the shard artifact when
available:

```bash
gh run download <run-id> --repo <owner/name> -n playwright-report-<shard-name>
```

Read `test-results/*/error-context.md` for the failing spec. The script
prints the run URL; the agent does the download + fix in Step 7.

The script stops at reporting for these categories. **Step 7 is mandatory**
when the user asked to fix failures.

## Step 6 — Review comments (every PR)

Run for every PR, including those skipped for CI in Step 5.

### 6a. Fetch unresolved threads

```bash
gh api graphql -f query='…' -f owner='<owner>' -f repo='<name>' -F number=<N>
```

Query `reviewThreads` on the pull request. Collect threads where
`isResolved == false` and `isOutdated == false`. For each thread, record
`path`, `line`, `author.login`, and the first comment body (trimmed).

Also note top-level reviews with `state: CHANGES_REQUESTED` from reviewers
other than `@me` when the review body is non-empty.

### 6b. Bucket

| Bucket | Criterion |
|---|---|
| ✅ none | No unresolved threads and no outstanding `CHANGES_REQUESTED` |
| 💬 N unresolved | One or more open threads and/or change-request reviews |
| (skipped) | Only when the whole PR was skipped before any GitHub fetch succeeded |

Ignore threads where the only comment is from `@me` (already addressed locally
or self-notes). Bot authors (e.g. `cursor`, `bugbot`, `github-actions`) still
count.

The script performs 6a–6b automatically. Agents implement fixes in Step 7.

## Step 7 — Agent remediation (when fixing failures)

**Run this step when the user wants CI fixed and/or review comments addressed**
— including the common phrase "sync my PRs check CI status and fix failures".

For each PR with `⚠️` CI investigations, `💬` unresolved reviews, or
`⏳ CI in progress` after a push you just made:

1. **Worktree** — reuse or create per Step 4a. If dirty, stop and tell the
   user; do not clobber local work.
2. **Review threads** — read each `path`/`line`/`body`, implement the
   requested change in the worktree, push. Use judgement on obsolete threads
   (push + reply) vs still-valid feedback. Do not resolve threads on GitHub
   until the fix is pushed.
3. **CI failures** — fix root cause in the worktree (not symptomatic retries).
   - Lint/format: script may have already auto-fixed; verify by re-running the
     auto-fix command / lint check if unsure.
   - E2E: reproduce from `error-context.md`, fix selectors/behavior, push.
   - Unit/tsc/build: fix the reported errors; run the narrowest local check
     that validates the fix.
4. **Commit hooks** — if a non-merge fix commit is rejected by a local hook,
   resolve per your team's process, then re-commit.
5. **Re-check** — `gh pr checks <N> --repo <owner/name>` or re-run the sync
   script. Repeat until green or blocked on something that needs a human
   (visual-diff approval, merge conflict you cannot resolve, ambiguous review).

Do **not** stop after printing investigation proposals when the user asked
to fix failures.

## Step 8 — Final report

Print a table of every PR processed:

| PR | Title | Sync | CI | Reviews |
|---|---|---|---|---|
| `#NNNN` | … | ✅ already clean | ✅ green | ✅ none |
| `#NNNN` | … | 🔄 synced | 🔧 auto-fixed ESLint, pushed | ✅ none |
| `#NNNN` | … | 🔄 synced (lockfile regenerated) | ✅ green | ✅ none |
| `#NNNN` | … | ⚠️ manual | (skipped) | 💬 1 unresolved |
| `#NNNN` | … | ❌ error: <reason> | (skipped) | (skipped) |
| `#NNNN` | … | ✅ already clean | ⚠️ 2 failures need investigation | 💬 2 unresolved |
| `#NNNN` | … | 🔄 synced | ⏳ CI in progress | ✅ none |
| `#NNNN` | … | ⏭️ skipped: older than 2 months | (skipped) | (skipped) |

Sync legend:

| Symbol | Meaning |
|---|---|
| ✅ already clean | `MERGEABLE` — no Step 4 |
| 🔄 synced | Was `CONFLICTING`, merged and pushed |
| 🔄 synced (lockfile regenerated) | Lockfile-only conflict — `pnpm install` regen + push |
| ⚠️ manual | Auto-merge produced conflicts; user must finish |
| ❌ error | Worktree dirty / diverged / push rejected twice — reason quoted |
| ⏭️ skipped | Outside the recency window — pass `--pr` to include |

CI legend:

| Symbol | Meaning |
|---|---|
| ✅ green | Every non-visual check is success / neutral / skipped |
| 🔧 auto-fixed `<category>`, pushed | Auto-fix applied for a known-safe category |
| ⚠️ N failures need investigation | Listed in detail below the table |
| ⏳ CI in progress | At least one check is still running — re-run later |
| (skipped) | Step 5 not attempted because Step 4 ended `⚠️ manual` or `❌ error` |

Reviews legend:

| Symbol | Meaning |
|---|---|
| ✅ none | No unresolved review threads |
| 💬 N unresolved | Open inline threads and/or `CHANGES_REQUESTED` reviews |
| (skipped) | Could not fetch review data for this PR |

Below the table, for any PR with investigation entries, print:

```
#NNNN / <check name>:
  <run URL>
  …last ~10 lines of failed step log…
  Proposed fix: <one-sentence diagnosis + suggested action>
```

For any PR with 💬 unresolved reviews, print:

```
#NNNN / review @<author> on <path>:<line>:
  <first ~200 chars of comment>
  Action: <what to change, or "reply — outdated after <commit>">
```

## Commit hooks

Auto-fix commits (Step 5d) are ordinary non-merge commits, so any local commit
hook fires on them. The **merge** commits in Step 4 do not need the same
treatment — Git's merge/cherry-pick/revert/rebase hooks differ, and most review
or commit-gate hooks exempt merges (they mechanically carry forward
already-reviewed content). If a hook blocks an auto-fix commit, the script
reports the failed commit and resets it; satisfy the hook (run the required
review/sign/lint step) and re-commit before pushing.

## Failure modes

| Condition | Behaviour |
|---|---|
| `gh` unauthenticated | Fail fast at Step 1 |
| Repo not resolvable | Fail fast — pass `--repo owner/name` or set `SYNC_PRS_REPO` |
| Not inside a git repo | Fail fast at startup |
| No open PRs for user | Print message at Step 2 and exit |
| PR older than recency window | Skip sync/CI/review work; list as `⏭️ skipped` unless `--pr` names it |
| `--pr` names a closed or missing PR | Warn on stderr; ignore that number |
| Worktree dirty | Skip with reason; continue to next PR |
| Local ahead of remote head (diverged) | Skip with reason; no force-push, no rebase |
| Auto-merge needs manual edit | `git merge --abort`, report files, continue |
| Lockfile-only merge conflict | `git rm` lockfile → `pnpm install --lockfile-only` → `git commit --no-edit` → push |
| Lockfile regen fails (`pnpm install` or commit) | `git merge --abort`, report `❌ error: lockfile auto-resolve failed` |
| Push rejected | One retry after fetch + ff; otherwise report and continue |
| CI check in progress on a PR | Skip Step 5 for that PR; record `⏳ CI in progress` |
| Auto-fix command exits non-zero | Treat as investigate-and-report; do not commit a half-fix |
| Auto-fix produces an empty diff | Skip commit + push; report as investigation (issue may need manual fix) |

## What this skill explicitly does NOT do

- Resolve conflicts that need file edits without agent/user judgment — except
  **lockfile-only** conflicts (`pnpm-lock.yaml` / `package-lock.json` /
  `yarn.lock`), which the script regenerates via `pnpm install --lockfile-only`
  (full `pnpm install` as fallback). All other conflict files are reported and
  aborted; Step 7 may resolve them if the agent can infer the correct merge
  outcome.
- Run the full test suite locally by default. CI is the source of truth;
  agents run targeted local checks while fixing Step 7 failures.
- Investigate visual-regression failures (Argos / Percy / Chromatic / the
  configured skip pattern). Visual diffs are reviewed in their own UI.
- Auto-fix (in the script) anything beyond the configured lint/format command.
  Type errors, test failures, and build errors are fixed in Step 7 when the
  user asked to fix failures — not left as report-only.
- Touch PRs by other authors. Only `@me` PRs.
- Process PRs older than the recency window unless `--pr <number>` includes
  them (or the user explicitly names that PR in the request).
- Modify the user's current working directory or active branch. All work
  happens in worktrees under the configured worktrees directory or other
  existing worktree paths discovered via `git worktree list`.

## Notes / gotchas

- `git merge --abort` is safe and always brings the worktree back to a clean
  state before reporting "manual needed".
- `mergeable: UNKNOWN` is common immediately after a push while GitHub
  recomputes; the 3-second wait + single re-query is enough in practice.
- Worktree discovery uses `git worktree list --porcelain` and matches by
  branch (`branch refs/heads/<headRefName>`), not by path heuristics.
- The lockfile regeneration step assumes a pnpm project. For npm/yarn,
  override `SYNC_PRS_LINTFIX_CMD` for auto-fix and adapt the regen step.
