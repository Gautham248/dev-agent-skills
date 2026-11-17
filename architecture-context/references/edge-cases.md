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

## 2026-11-16 — `.graphify_analysis.json` may not exist even when clustering HAS run

Repo: `10xminds/lio` (graphify build of 2026-11-16, 7317 nodes / 626 communities).

Step 4a's command assumes `graphify-out/.graphify_analysis.json`. In this
graphify version that file does not exist at all, yet clustering had plainly
run: `GRAPH_REPORT.md` listed 626 communities and `.graphify_labels.json`
held 626 id→label entries.

Taking Step 4a's instruction literally ("tell the caller to run
`--cluster-only` ... and stop") would have been wrong — it would have asked
for a rebuild that was already done.

**What actually works:** community membership is stored per-node on
`graph.json` itself (`node.community`, an integer) and the human labels in
`.graphify_labels.json` (`{"0": "Celebration & Confetti Components", ...}`).
Group nodes by `community`, count `source_file` citations within each group,
and rank communities by node count — that reproduces
`communitiesToSubsystemSeeds`' output without the missing sidecar.

**Fix for the skill:** Step 4a should try `.graphify_analysis.json` first and
fall back to deriving seeds from `graph.json` + `.graphify_labels.json`,
treating a missing analysis sidecar as a format difference rather than as
"clustering hasn't run". Only report NO_CLUSTERING when `graph.json` nodes
carry no `community` field either.

## 2026-11-16 — anchor paths stored relative to a sub-package silently defeat Tier 2

Same repo. The cached subsystems had been written during a session whose cwd
was `packages/app`, so their `anchor_files` were stored as
`Lio/App/AppState.swift` rather than `packages/app/Lio/App/AppState.swift`.
`getChangedFilesSince` correctly returned 701 repo-relative paths, but
`computeStaleSubsystems` matched only `express-prisma-backend` (the one
subsystem whose anchors happened to carry the `packages/backend/` prefix) and
declared the four iOS subsystems **fresh** — after a month and 701 changed
files, during which `Lio/Components/LioComponents.swift` and
`Lio/Screens/Main/TasksViews.swift` had both ceased to exist.

This is the exact false-negative Step 3 says the design cannot afford, and it
fails silently: nothing in the `{stale, fresh}` output hints that a path never
had a chance of matching.

**Fix for the skill:** `writeCache` should reject (or normalize) any
`anchor_files` entry that does not resolve against the repo root, and Step 3
should treat a subsystem whose anchor files no longer exist on disk as stale
regardless of what the diff says. A cheap guard — `test -e` each anchor before
trusting a `fresh` verdict — would have caught this immediately.
