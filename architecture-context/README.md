# architecture-context

An Agent Skill that answers "what kind of system is this project,
architecturally" once, caches the answer per subsystem, and only redoes
the expensive part for the subsystems an actual change touches.

Built because `graphify`'s knowledge graph is purely structural for
code-only repositories (its own semantic-extraction step is skipped when
there are no docs, papers, or images to reason about) — it can tell you
what calls what, but nothing about what a cluster of files is *for*. A PR
review, bug fix, or feature plan that needs to know "this is
server-authoritative state sync for a multiplayer game" has nowhere to get
that from a structural graph alone.

## Who it's for

Other skills in this repo (`review-pr`, `fix-bug`, `plan-feature`,
`investigate-issue`) that need standing project understanding before their
own narrower, task-scoped work. Not meant to be invoked directly by a
developer for a one-off question — a `graphify query` is the right tool
for that.

## What it does

1. Checks whether `graphify-out/.project-architecture.json` is still
   fresh against `graphify-out/graph.json` (tier 1 — free).
2. If the graph changed, checks which specific subsystems' anchor files
   were actually touched since the cache's own recorded git state (tier 2
   — cheap, no LLM call, reuses `graphify affected`).
3. Only for subsystems that changed (or on first run, for every
   community `graphify`'s own clustering detected), does one reasoning
   pass to write a plain-language summary and anchor file list (tier 3 —
   the only step that costs real reasoning).
4. Returns the subsystem(s) relevant to whatever files the calling skill
   is currently working on.

## Prerequisites

- `graphify` already run for this repo (`graphify-out/graph.json` and
  `graphify-out/.graphify_analysis.json` must exist) — this skill
  consumes graphify's output, it does not build it.
- `git` — used to determine what changed since the cache was last
  written. A non-git working tree falls back to full regeneration on
  every graph change (see `SKILL.md` Step 3).
- Node.js (`node:` builtins only, no npm install) for
  `scripts/architecture-context-lib.mjs`.

## Tests

```bash
node --test scripts/tests/architecture-context-lib.test.mjs
```

The staleness-check tests run against real git repos created in a temp
directory (`git init`, real commits, real `git diff`) rather than mocked
git output — a false "not stale" is exactly the failure mode this design
exists to prevent.
