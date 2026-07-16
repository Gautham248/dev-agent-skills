---
name: plan-feature
description: >
  Use when a developer wants to plan a new feature before building it — phrases
  like "plan this feature", "write a feature plan for X", "how should we
  implement Y", or "create a spec for Z". Reads the repository's knowledge graph
  to understand the existing codebase, then produces a structured markdown
  implementation plan that covers what to build, where it fits, what to change,
  and what to watch out for. Does not write code. Saves the plan as a new
  GitHub issue (default), a comment on an existing issue, or a file committed
  to the repo — calling skills like investigate-issue select the mode
  explicitly.
compatibility: Requires graphify on PATH, an authenticated gh CLI, git, and network access to GitHub. python3 for the bundled path-verification script.
metadata:
  version: 2.0.0
  category: workflow-automation
graph-memory: true
---

<!-- BEGIN dev-agent-skills clarification protocol (managed by setup.sh -- do not edit this block manually; edit CLARIFICATION-PROTOCOL.md instead) -->
Before doing anything else in this skill, read and follow the clarification protocol at:
../config/CLARIFICATION-PROTOCOL.md
<!-- END dev-agent-skills clarification protocol -->

<!-- BEGIN dev-agent-skills self-improvement protocol (managed by setup.sh -- do not edit this block manually; edit SELF-IMPROVEMENT-PROTOCOL.md instead) -->
While using this skill, and especially when you finish, read and follow the self-improvement protocol at:
../config/SELF-IMPROVEMENT-PROTOCOL.md
(Append real edge cases to this skill's own references/edge-cases.md — create it if missing. See the protocol file for what qualifies.)
<!-- END dev-agent-skills self-improvement protocol -->

<!-- BEGIN dev-agent-skills graph-memory protocol (managed by setup.sh -- do not edit this block manually; edit GRAPH-MEMORY-PROTOCOL.md instead) -->
This skill opted in to graph-memory (graph-memory: true). At each point marked
'Graph-memory:' below, read and follow the graph-memory protocol at:
../config/GRAPH-MEMORY-PROTOCOL.md
<!-- END dev-agent-skills graph-memory protocol -->

# Plan feature

Produces a structured implementation plan for a new feature, grounded in the
actual codebase via knowledge-graph queries. The plan is written before any
code is touched — this skill writes no implementation code, ever.

## Prerequisites

- `graphify` installed: `pip install graphifyy`
- `gh` CLI authenticated: `gh auth login`
- `git` configured with access to the repository
- An LLM API key for the configured backend, available in the environment —
  only needed if the repo contains docs, images, or non-code files. Use
  whichever provider is already configured for this deployment; do not
  substitute a different provider's key (same rule as fix-bug — see
  `fix-bug/references/edge-cases.md`, 2026-06-08, for why that fails).

## When invoked by another skill

This skill is composable. Its inputs are:

| Input | Meaning |
|---|---|
| `repository` | `owner/repo`, or the current checkout |
| `feature_description` | What to build and for whom, including constraints |
| `output_mode` | `new-issue` (default) \| `comment-on-issue N` \| `file-in-repo` |

If a calling skill (e.g. `investigate-issue`) already supplies any of these,
do **not** re-ask the developer for them — run Step 1 only for whatever is
still missing. Everything else in this skill applies unchanged, including the
never-do list.

## Step 0 — Determine the operating context

Same decision as fix-bug's Step 0: are you already inside the target
repository's own working directory, or are you the dev-agent service
operating on a persistent clone (`/app/data/repos/<owner>__<repo>`)?

- **Inside the repo's checkout:** skip cloning — work in place
  (confirm with `git rev-parse --is-inside-work-tree`).
- **dev-agent service:** use the persistent paths in
  `references/graph-workflow.md`.
- **No git repository and no repo named:** ask for `owner/repo`; do not
  guess.

Say which mode you're in before proceeding.

## Step 1 — Gather information

Ask the developer for whatever wasn't already supplied (see "When invoked by
another skill"):

1. **Repository** — `owner/repo` format (skip if Step 0 found you inside it)
2. **Feature description** — what should it do, who is it for
3. **Any constraints** — tech stack preferences, things to avoid, deadline
4. **Output mode** — `new-issue` (default) | `comment-on-issue N` |
   `file-in-repo`

Do not proceed without the repository and feature description.

## Steps 2–3 — Clone/pull and build or reuse the knowledge graph

Follow `references/graph-workflow.md`: persistent clone, graph keyed by HEAD
sha, **reuse the graph when fresh, rebuild only when stale**. This is
deliberately identical to fix-bug's Steps 2–3 so both skills share one graph
per repository instead of each rebuilding its own.

## Step 4 — Query the graph for context

Run the four context queries from `references/graph-workflow.md` — related
functionality, data layer, API/routing layer, UI layer — and read the most
relevant files from each result before writing anything.

**Graph-memory:** before relying on these results, check whether anything
here is already flagged as a known dead end or a correction — see
`GRAPH-MEMORY-PROTOCOL.md`.

## Step 5 — Write the plan, then verify its paths

Fill `assets/plan-template.md`. Every file path the plan names must either
exist in the actual codebase (found via the graph or read directly) or be
explicitly listed under "Files to create" — never reference a file you
haven't verified.

That rule is enforced by a script, not trust. After drafting, write the plan
to a file and run — this check is not optional:

```bash
python3 scripts/verify_plan_paths.py <plan-file.md> <repo-dir>
```

It errors on any "Files to change" path missing from the repo and any
"Files to create" path that already exists. Fix the plan and re-run until it
exits 0 — only then move to Step 6.

## Step 6 — Save the plan (by output mode)

Dispatch on the output mode — exact commands in
`references/save-destinations.md`:

- **`new-issue`** → `gh issue create` with the `planning` label.
- **`comment-on-issue N`** → `gh issue comment` on the existing issue.
  Never create a new issue and never open a plan PR in this mode.
- **`file-in-repo`** → `plans/<feature-slug>-plan.md` on an
  `agent/plan/<feature-slug>-<date>` branch, proposed via a plan-only PR.

## Step 7 — Report back

```
✓ Feature plan created: <issue-url / comment-url / pr-url>
  Mode:   <new-issue / comment-on-issue / file-in-repo>
  Graph:  <reused existing / rebuilt>
  Covers: <3-bullet summary of what the plan includes>
```

**Graph-memory:** now that the plan is written, record whether the Step 4
queries were actually useful for it — see `GRAPH-MEMORY-PROTOCOL.md`. Be
honest about `useful`/`dead_end`/`corrected`.

## If something goes wrong

Before improvising a fix, check `references/edge-cases.md` — this may
already be a documented, solved problem. If it's genuinely new once you're
done, follow the self-improvement protocol and add it there.

## Failure modes

| Condition | Behaviour |
|---|---|
| Repository not found | Report and stop. Ask developer to verify the name. |
| No git repository and none named | Ask for `owner/repo`. Do not guess. |
| graphify extract fails | Report the exact error. Do not swap to a different provider's key. |
| Graph queries return nothing relevant | Broaden the query once; if still empty, write the plan from direct file reading and say so in the plan's "Risks" section. |
| `gh issue create`/`comment` fails | Report the exact gh output. Offer another mode as fallback only if the developer agrees — never switch silently. |
| Feature description too thin to plan | Ask targeted questions. Do not pad the plan with invented requirements. |

## What the agent must NOT do

- Write any implementation code.
- Open a PR with code changes (a `file-in-repo` PR contains only the plan file).
- Create a new issue when `comment-on-issue` mode was requested.
- Make assumptions about business requirements not stated by the developer.
- Produce a plan that references files not found in the actual codebase.
- Substitute a different provider's API key when the configured one fails.

## Examples

**Example 1 — direct invocation (default mode)**
Developer says: "Plan the feature to add article tagging in acme/blog-platform"
Actions: Step 0 finds no local checkout → dev-agent-service paths; Step 1
interviews for constraints and confirms `new-issue` mode; Steps 2–4 reuse the
existing graph (fresh at HEAD) and run the four context queries; Step 5 fills
the template and `verify_plan_paths.py` exits 0; Step 6 creates the issue.
Result: `✓ Feature plan created: https://github.com/acme/blog-platform/issues/58`
— a `planning`-labeled issue, zero code written.

**Example 2 — invoked by investigate-issue (comment-on-issue mode)**
investigate-issue classified issue #41 as a feature and supplies all inputs:
`repository` = acme/blog-platform, `feature_description` = issue title + body
+ restatement, `output_mode` = `comment-on-issue 41`.
Actions: Step 1 asks the developer nothing (all inputs supplied); Steps 2–5 as
above; Step 6 posts the plan with `gh issue comment 41 --body-file`.
Result: the plan lands as a comment on issue #41 — no new issue, no PR, no
re-interview.

## See also

- [`references/graph-workflow.md`](./references/graph-workflow.md) — clone,
  graph build/reuse, and the four context queries (kept in sync with fix-bug)
- [`references/save-destinations.md`](./references/save-destinations.md) —
  exact commands for the three output modes
- [`references/edge-cases.md`](./references/edge-cases.md) — accumulated
  field experience; check it when something unexpected happens
- [`assets/plan-template.md`](./assets/plan-template.md) — the plan document
  template Step 5 fills in
- [`scripts/verify_plan_paths.py`](./scripts/verify_plan_paths.py) — the
  mandatory Step 5 path check (plan-file + repo-dir → exit 0 or a list of
  phantom/mislabeled paths)
