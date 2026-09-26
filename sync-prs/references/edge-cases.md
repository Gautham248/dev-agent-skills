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
