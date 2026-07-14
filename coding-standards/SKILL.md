---
name: coding-standards
description: >
  Company coding standards for frontend, backend, and database work. Use
  whenever writing or modifying application code -- building a page or
  component, adding or changing an API endpoint, writing a database migration
  or query, writing e2e or other tests, fixing a bug, or refactoring -- even
  if the user doesn't mention standards. Universal rules apply always;
  domain-specific standards (frontend, backend, database, TanStack Query,
  e2e, project organization) are dispatched to their own coding-standards-*
  skill only when both the task and the project itself call for that domain.
  Do NOT use for explaining or reviewing code without changing it, docs/README
  edits, or CI/infra config changes. Generic TypeScript and web-framework
  conventions belong to typescript-conventions and webapp-conventions -- this
  skill owns only company-specific rules, and on any conflict the company
  rule wins.
session-memory: true
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

<!-- BEGIN dev-agent-skills session-memory protocol (managed by setup.sh -- do not edit this block manually; edit SESSION-MEMORY-PROTOCOL.md instead) -->
This skill opted in to session-memory (session-memory: true). Whenever you reach a step
marked 'Session-reusable:' below, read and follow the session-memory protocol at:
../config/SESSION-MEMORY-PROTOCOL.md
<!-- END dev-agent-skills session-memory protocol -->

# Coding Standards (dispatcher)

This skill is a **dispatcher**, not a reference bundle. It always applies the
Universal rules below directly, then decides which domain-specific
coding-standards-* skill(s) -- if any -- to invoke for the rest, based on
**both** what the task needs and what the project actually has. It never
invents a standard for a layer the project doesn't have, and it never skips a
standard the project does have just because the task didn't name it
explicitly.

**Most critical rule: never invent a company standard.** If a topic isn't
covered by the Universal rules below or a dispatched domain skill, say so --
do not fabricate a plausible-sounding standard that was never written.

## Step 1 -- Apply the Universal rules (always, no dispatch needed)

These apply to every piece of application code, in every project, regardless
of domain. Keep them in mind for the rest of this task.

- **TypeScript `strict: true`.** `type` aliases are the default; `interface`
  is not used in application code.
- **Named exports only**, as `const` arrow functions. No hand-written barrel
  files -- import from the concrete file.
- **Validate at the boundary, trust inside.** Every untrusted input passes
  through a schema validator (e.g. Zod) at the entry point.
- **Discriminated unions for result types** (`{ ok: true; data } | { ok:
  false; data }`); consumers branch on `ok`, not try/catch.
- **No non-null assertions (`!`)** -- lint-banned. `async`/`await`
  exclusively, no `.then()` chains.
- **Precision types for precision data**: money and precision-sensitive
  quantities use a decimal library, never raw floating-point.
- **Centralize every string that appears twice**: URLs, query keys, modal
  IDs, test IDs, error codes live in typed constant objects.
- **Guard clauses first**: authorization and precondition checks return
  early; the happy path continues unindented.
- **`console` is restricted** to `console.error` / `console.info` with a
  `[context]:` prefix.
- **Naming**: `camelCase` functions/variables, `UPPER_SNAKE_CASE` module
  constants, `PascalCase` types/enums, `kebab-case` folders and files with a
  role suffix, `*.spec.ts` tests.
- **Version control**: conventional commit prefixes (`feat:`, `fix:`,
  `chore:`), typed branch names (`feat/kebab-description`).

## Step 2 -- Detect which domains this project actually has

**Session-reusable:** if you've already run this exact detection earlier in
this conversation, and nothing since then would plausibly change it (no new
dependency installed, no schema file added/removed), state that explicitly
and reuse the earlier result instead of re-running the checks below — see
`SESSION-MEMORY-PROTOCOL.md`. This is about *within* one session only; there
is still nothing here worth persisting *across* sessions via a cache file —
each of these checks is a handful of milliseconds, so a brand new session
just re-runs them fresh once, same as before.

Read `references/manifest.json` for the authoritative, current list of
domains and their `project_signals` -- do not hardcode the list here, the
manifest is the source of truth and may have grown since this was written.

For each domain in the manifest, check its `project_signals` against the
current project:

```bash
# Example shape -- adapt the greps to what manifest.json actually lists,
# don't hardcode this exact command set if the manifest has changed:
test -f package.json && cat package.json
find . -maxdepth 3 -iname "schema.zmodel" -o -iname "schema.prisma" -o -iname "playwright.config.*" 2>/dev/null
find . -maxdepth 3 -type d \( -iname "components" -o -iname "migrations" -o -iname "e2e" \) 2>/dev/null
```

A domain is **present** if at least one of its `project_signals` is found.
Note the result as a short internal list (present / absent per domain) --
this is scratch reasoning for this session, not a file to write anywhere.

## Step 3 -- Match the task against domains, grounded in the actual graph

By the time this skill runs, Rule 1 has already ensured a current knowledge
graph exists for this project -- use it rather than guessing from the task's
wording alone. Matching purely on phrasing misses domains a task implies
without naming (e.g. "add an endpoint for user preferences" reads as backend
only, even on a project with a database, because the words "migration" or
"schema" never appear).

**3a. Query the graph for what this task actually touches:**

```bash
graphify query "<a question grounded in what's actually being asked, same
as Rule 1's own phrasing -- e.g. 'files and functions relevant to adding an
endpoint for user preferences'>"
```

**3b. Classify what comes back.** For each file/function the query returns,
check its path against each present domain's `path_patterns` in the manifest
(e.g. a result under `src/routes/api/` -> backend; a result touching
`schema.prisma` or a Drizzle/Prisma query call -> database). This turns
"does this task touch the database" into a concrete, checkable fact instead
of a guess from task wording -- it's what closes the "add an endpoint for
user preferences never flags database" gap: the graph query surfaces the
actual persistence call or schema reference if one exists, whether or not
the task said "migration."

**3c. Fall back to task_signals wording only if the graph query returns
nothing usable** (empty project, brand-new feature with no existing code to
find, or `graphify` itself reports it can't proceed per Rule 1's own
fallback) -- match on meaning against `task_signals`, same as before.

**A domain that's evidence-backed (by 3a/3b or 3c) but not present in the
project is a red flag, not an automatic dispatch** -- e.g. graph evidence or
task wording points at TanStack Query but no `@tanstack/*-query` dependency
exists. Don't silently apply a standard for a library the project doesn't
use. Surface it: "This project doesn't appear to have TanStack Query
installed -- should I add it, or is there a different data-fetching approach
already in use here?"

**A domain match that structurally depends on another domain that's absent
is a deeper mismatch, not just a missing-library flag** -- check each
matched domain's `depends_on` in the manifest. If `tanstack-query` matches
but `frontend` isn't present at all (no UI framework anywhere in the
project, not just the query library missing), say so specifically: "This
project has no frontend framework at all, so there's no client to attach a
TanStack Query client to -- is this meant to add a frontend first, or did
you mean something else?" -- more useful than a generic "library not
installed" question because it names the actual structural gap.

## Step 4 -- Decide and dispatch

- **Zero candidates matched:** apply Universal rules only. If the task is
  clearly application code (not explicitly excluded per the frontmatter),
  add one line noting no domain-specific standard covers this task type yet
  -- never invent one.
- **One or more candidates, all unambiguous:** invoke each matched domain's
  skill via the skill-loading tool, by name, in the same turn if the tool
  allows sequential calls. Pass along, as part of what you tell each
  dispatched skill, the task description plus which domains you determined
  are present in this project -- so it doesn't need to re-derive project
  context you already have (same pattern `investigate-issue` uses when
  delegating to `plan-feature`: supply what's already known, don't make the
  dispatched skill re-investigate from scratch).
- **Genuinely ambiguous which of two+ present, candidate domains applies:**
  ask exactly one closed question grounded in what the graph query in Step 3
  actually returned -- never a generic "which areas does this touch?" and
  never a domain-name-only question if you have real file/function evidence
  to name instead. Same pattern as `CLARIFICATION-PROTOCOL.md`'s own "I see
  two places that reference X -- is it the one in `<file>`, or the other
  one?" -- concrete beats abstract. Example: instead of "want backend or
  tanstack-query standards, or both?", prefer "the graph shows this touching
  both `syncUserPreferences()` in `src/routes/api/preferences.ts` and the
  `usePreferencesQuery` hook in `src/hooks/` -- want both standards applied,
  or just one?" If the graph query in 3a returned nothing usable and you're
  genuinely working from task wording alone, the plain domain-name version
  is the fallback, not the default.
- **Never** dispatch every present domain "to be safe" when the task clearly
  only touches one. Over-dispatching wastes context and isn't more correct --
  it's a guess with extra steps.

## Step 5 -- Write the code

Apply the Universal rules plus whatever each dispatched skill returned.
Where a company standard here conflicts with generic guidance -- including
`typescript-conventions` or `webapp-conventions` -- **the company standard
wins.** (Known conflict, resolved: this company uses `type` aliases, not
`interface`.)

## If something goes wrong

Before improvising a fix, check `references/edge-cases.md` -- this may
already be a documented, solved problem. If it's genuinely new once you're
done, follow the self-improvement protocol and add it there.

## Examples

**Single domain, project has it:** "Refactor this component to use Svelte 5
runes." Project has `react`... wait, no `svelte` dependency -- surface that
mismatch rather than guessing which framework convention applies.

**Multi-domain, both present:** "Add an invoices endpoint and its migration."
Backend and database domains both present and both matched -- dispatch both.

**Domain absent from project:** "Add e2e tests for checkout." No
`@playwright/test` dependency and no `playwright.config.*` found -- flag it:
"No Playwright setup detected in this project -- want me to set it up first,
or is there a different test runner already in use here?"

**No domain matches at all:** "Add internationalization support." None of
the manifest's task_signals match -- apply Universal rules only, note the
gap.

## References

- `references/manifest.json` -- the domain -> skill routing table. Read this,
  not this file, when checking what domains exist.
- `references/edge-cases.md` -- accumulated real-world edge cases; check it
  when something unexpected happens during use.
