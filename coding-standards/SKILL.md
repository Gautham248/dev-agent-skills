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

Run these checks now (all cheap -- file reads and greps, not a graph build;
there is nothing here worth caching between sessions, just redo it every
time). Read `references/manifest.json` for the authoritative, current list of
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

## Step 3 -- Match the task against domains

Compare the request against each present domain's `task_signals` in the
manifest. A domain is a **candidate** if the task's content plausibly matches
its `task_signals` -- match on meaning, not literal keywords (e.g. "server
data" or "refetch when the window regains focus" matches the TanStack Query
domain's signals just as much as the literal product name would).

**A domain that's a task-signal match but not present in the project is a
red flag, not an automatic dispatch** -- e.g. the request mentions "add a
query hook" but no `@tanstack/*-query` dependency exists anywhere. Don't
silently apply a standard for a library the project doesn't use. Surface it:
"This project doesn't appear to have TanStack Query installed -- should I add
it, or is there a different data-fetching approach already in use here?" is a
single closed-enough question that resolves it.

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
  ask exactly one closed question naming the real candidates you found --
  never a generic "which areas does this touch?" Example: "This touches both
  the endpoint and the query layer -- want both `coding-standards-backend`
  and `coding-standards-tanstack-query` standards applied, or just one?"
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
