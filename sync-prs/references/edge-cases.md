## 2026-09-24 — Repo with no CI at all (Step 5 assumes checks exist)

What happened: Step 5 (`gh pr view <n> --json statusCheckRollup`) returned an
empty array for every PR, and `gh pr checks <n>` exited 1 with "no checks
reported on the '<branch>' branch". Root cause turned out to be that the repo
has no `.github/workflows/` directory at all — CI simply doesn't exist there,
so an empty rollup was the correct, expected result rather than a broken
pipeline or a permissions problem.
What I did: Did not bucket it as ✅ green. Reported CI as "none configured —
nothing verified" and treated the repo's own local scripts (`tsc --noEmit`,
the project's `test:*` npm/pnpm scripts, production build) as the only
available verification, offering to run those locally. Distinguishing "no CI
configured" from "CI failed to report" matters for a merge-readiness call:
the former means nothing has been verified, not that everything passed. A
quick `ls .github/workflows/` (or checking `gh run list` returns nothing
historically) tells the two apart.

## 2026-09-24 — Request covers PRs by other authors, and a target branch that is no PR's base

What happened: The request was "review all the PRs in <repo> and tell me if
they're ready to merge to <branch>". Every open PR was authored by someone
else, and every open PR's `baseRefName` was a different feature branch, not
the `<branch>` named in the request. The skill is explicitly `@me`-only
("Touch PRs by other authors. Only `@me` PRs.") and reads base per-PR, so
neither the attribution nor the base-mismatch case is described.
What I did: Treated the run as report-only (Steps 1-6 + Step 9) and skipped
every Step 8 remediation path, since neither auto-fixing another author's
branch nor pushing to it is in scope. Made the base-branch mismatch the
headline finding rather than working around it: answered the actual question
("are these ready for <branch>?") with "no — none of them target it", then
mapped the real topology with `git rev-list --left-right --count` and
`git merge-base --is-ancestor` to show whether a fast-forward into the named
branch was even possible. Do not silently retarget a PR's base to make the
question answer cleanly; report the mismatch and let the user decide.

## 2026-09-24 — `../config/...` and other bundled paths don't resolve when the skill dir is a symlink

What happened: SKILL.md's injected pointers (`../config/CLARIFICATION-PROTOCOL.md`,
`../config/SELF-IMPROVEMENT-PROTOCOL.md`, `../config/SESSION-MEMORY-PROTOCOL.md`)
failed to open when resolved against the reported skill base dir
(`~/.commandcode/skills/sync-prs`), because that path is a symlink into
`~/Code/personal/dev-agent-skills/` and `..` resolved against the symlink
location rather than the real directory — the `config/` dir doesn't exist
next to the symlink.
What I did: Resolved the symlink first (`ls -la` on the skill dir showed the
target) and read the protocols from
`~/Code/personal/dev-agent-skills/config/`. Related: when the harness's file
tool is scoped to the project workspace, bundled skill resources outside it
can't be read with that tool at all — fall back to reading them through the
shell. Worth doing the symlink resolution up front instead of assuming the
injected relative paths are broken.

## 2026-09-29 — Monorepo where the pnpm project (and the sync script) is not at the repo root

What happened: The skill's run command is `pnpm tsx scripts/sync.ts` relative to
the repo root, and the default auto-fix command is `pnpm run lint:fix` also from
the repo root. This repo's root is an Xcode project (`Lio.xcodeproj`) with no root
`package.json` and no root `scripts/` directory at all — the pnpm project lives at
`packages/backend` (its own deps, lockfile, lint/test scripts, and the CI
workflow's `defaults.run.working-directory`). So the script could not be run and
neither command would have resolved from the root.
What I did: Fell back to the hand-rolled steps (Steps 1-6 + Step 9), running every
`pnpm`-adjacent check with an explicit `cwd: packages/backend`, and used
`git merge-tree --write-tree` + `git commit-tree` to chain-simulate candidate
merge orders without creating a worktree or writing any ref. Report only — no
Step 8, since nothing was being fixed. Worth detecting up front: run
`test -f package.json && test -f scripts/sync.ts` at the repo root and, if either
is missing, look for the real pnpm project (`find . -maxdepth 3 -name pnpm-lock.yaml`)
before concluding the script is broken.

## 2026-09-29 — Fresh worktree + pnpm: symlinking node_modules fails, and a stale generated client lies to tsc

What happened: To change a PR branch without disturbing the main checkout (which
had uncommitted work), I added a worktree and wanted to typecheck fast, so I
symlinked the parent repo's `packages/backend/node_modules` into the worktree
instead of installing. Two separate traps followed. (1) `pnpm run <anything>`
then aborted with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` — pnpm's
deps-status check decides a symlinked modules dir is out of date and tries to
purge it, and refuses without a TTY. Calling the binary directly
(`./node_modules/.bin/tsc`) worked, so the install step looked skippable.
(2) Because the shared client was generated from a different branch's schema,
`tsc` reported two errors that were pure artifacts — `Extract<MembershipStatus,
"left" | "removed">` resolved to `never` because the generated enum only had
`pending | active` — and they looked exactly like bugs in the new code.
What I did: Removed the symlink and did a real `CI=true pnpm install
--frozen-lockfile` in the worktree (warm store, a few seconds), then
`pnpm generate` with a dummy `DATABASE_URL` — prisma's config file requires the
env var even for codegen that never connects. Verify `git diff --exit-code --
prisma/schema.prisma` afterwards: regenerating is only safe if it produces no
drift, since CI checks exactly that. Lesson: never trust `tsc` in a worktree
until `pnpm generate` has run there; a stale generated client produces
confident, wrong errors.

## 2026-09-30 — Resolving a PR's conflicts can turn a stacked PR that targets it CONFLICTING

What happened: PR #16's base was `develop`; PR #18 (`feat/space-member-role-ui`) was
stacked on PR #16's branch (`baseRefName: feat/join-approval`) and was `MERGEABLE`
beforehand. After merging `origin/develop` into `feat/join-approval` and pushing the
merge commit, #18 immediately became `CONFLICTING`/`DIRTY`. The skill's steps only
consider each `@me` PR against its own base and never account for other open PRs
stacked on the branch being rewritten.
What I did: Reported #18's new conflicting state as an explicit side effect of
resolving #16 and flagged it for a follow-up sync, rather than ignoring it or
touching it mid-run. Worth checking up front: `gh pr list --json
number,headRefName,baseRefName` and note any open PR whose `baseRefName` equals the
branch you're about to rewrite — it will need its own sync afterward.

## 2026-09-30 — A conflict resolution can require editing lines that were not in conflict

What happened: Resolving `getSpaces` to filter on `status: "active"` (this branch's
side) silently changed the meaning of a *different, non-conflicted* comment that had
auto-merged cleanly from develop: the `/active-spaces` route doc still asserted "the
filter is ... any status, not active". git flagged no conflict there, so resolving
only the marked hunks would have left a factually wrong comment in the tree.
What I did: Treated the chosen behavior as the source of truth and corrected the
adjacent comment too, even with no conflict markers on it. Lesson: after picking a
resolution, grep the whole file (not just conflict regions) for prose describing the
pre-resolution behavior.

## 2026-09-30 — Skill says add the worktrees dir to .gitignore; standing rules require asking first

What happened: The skill's Notes say to add the worktrees directory to `.gitignore`
when it lives inside the repo. The project's standing rules (Rule 0b) require
explicit consent before editing `.gitignore`, so doing that automatically would have
violated them, while leaving the worktree untracked would dirty `git status`.
What I did: Placed the worktree at `<repo>/.worktrees/` and added `.worktrees/` to
the local-only `.git/info/exclude` instead — invisible to `git status`, no tracked
mutation, removed at cleanup. Bonus: keeping the worktree inside the repo also let
workspace-scoped read/edit tools reach it (a scratchpad path outside the workspace
did not).
