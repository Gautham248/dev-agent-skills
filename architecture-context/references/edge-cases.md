# Edge cases

Known edge cases encountered when running the architecture-context skill,
and how to handle them. This file is updated automatically by the agent
when new edge cases are discovered — see
`../../config/SELF-IMPROVEMENT-PROTOCOL.md` for what qualifies. Nothing
here yet; this skill hasn't been run against a real repo in production.

---

## 2026-10-12 — `selectSubsystemsForFiles` silently returns `{}` for repo-relative paths

**Condition:** Called (Step 5) with a real PR's changed files as the target
list — paths like `packages/app/Lio/App/AppState.swift`. It returned `{}`
even though those files plainly belong to cached subsystems. Cause: the
cache's `anchor_files` use **mixed path conventions** — the iOS subsystems
were seeded package-relative (`Lio/App/AppState.swift`, `Lio/Services/*`) while
the backend subsystem is repo-relative (`packages/backend/src/...`) — and the
matcher does no normalization, so a caller's repo-relative paths match no iOS
anchor at all.

**Handling:** Don't treat `{}` as "the PR touches no subsystem". Read
`cache.subsystems` directly and map the changed files to subsystems by
reasoning over their paths, stating in the returned slice that the caller's
paths matched none of the recorded anchors. (Also note the Tier-1 `check` path
can over-trigger badly: a cache generated several commits back lists most of
the repo as "changed", so `computeStaleSubsystems` marks whichever subsystem
owns a touched file stale even when the PR's edits are cosmetic.)
