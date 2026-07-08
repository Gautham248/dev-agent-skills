---
name: coding-standards
description: >
  Company coding standards for frontend, backend, and database work. Use
  whenever writing or modifying application code — building a page or
  component, adding or changing an API endpoint, writing a database migration
  or query, writing e2e or other tests, fixing a bug, or refactoring — even if the user doesn't mention
  standards. Base rules apply always; task-specific standards (e.g. setting up
  TanStack Query) load from references/ only when the task matches. Do NOT use
  for explaining or reviewing code without changing it, docs/README edits, or
  CI/infra config changes. Generic TypeScript and web-framework conventions
  belong to typescript-conventions and webapp-conventions — this skill owns
  only company-specific rules, and on any conflict the company rule wins.
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

# Coding Standards

Ensures every code change follows the company's coding standards. The base
rules in this file apply to **all** application code; task-specific standards
live in `references/` and are loaded **only** when the task matches a row in
the routing table below.

**Most critical rule: never invent a company standard.** If a rule or
reference file below is still marked `PLACEHOLDER`, say so explicitly and fall
back to whatever base rules are filled in — do not fabricate plausible-sounding
standards that were never written.

## When this applies

- Triggers on: any request to write or modify frontend, backend, or database
  code or its tests — "add an endpoint", "build this page", "write a
  migration", "write e2e tests for this flow", "fix this bug", "refactor this
  component".
- Does NOT apply to: explaining code without changing it, documentation or
  README edits, CI/pipeline/infra configuration. Generic language-level
  conventions belong to `typescript-conventions` / `webapp-conventions`.

## Instructions

### Step 1: Apply the base rules

Read the three base-rule sections below (Frontend, Backend, Database) and keep
them in mind for the whole change. Only the sections relevant to the files
being touched need to be applied, but a task often spans more than one.

### Step 2: Check the routing table and load matching references

Compare the task against the routing table. **Read every reference file whose
task type appears in the request — all matches, not just the first.** A task
like "add an endpoint and a migration for it" matches two rows and needs both
files.

| Task involves… | Read first |
|---|---|
| Setting up or using TanStack Query (queries, mutations, caching) | `references/tanstack-query.md` |
| Creating or changing an API endpoint | `references/api-endpoints.md` |
| Database migrations (new tables, columns, indexes) | `references/db-migrations.md` |
| Forms and input validation | `references/forms-validation.md` |
| Authentication / authorization logic | `references/authentication.md` |
| Writing or modifying end-to-end (Playwright) tests | `references/e2e-test-writing.md` |

If the task matches **no row**: proceed with the base rules only, and add a
one-line note to the user that no task-specific standard exists for this task
type yet (so the team knows to add one).

### Step 3: Write the code

Apply the loaded standards while making the change. Where a company standard
here conflicts with generic guidance — including the `typescript-conventions`
or `webapp-conventions` skills — **the company standard in this skill wins.**

## Base rules

> **PLACEHOLDER — content pending.** The sections below are skeletons awaiting
> the company's actual standards. Until they are filled in, state that the
> base rules are not yet defined rather than inventing any.

### Frontend

<!-- Fill in: component structure, state management, styling approach,
     file/folder layout, naming, accessibility requirements, etc. -->

- (to be filled)

### Backend

<!-- Fill in: service/controller layering, error handling, logging, DTO and
     validation conventions, API response shapes, etc. -->

- (to be filled)

### Database

<!-- Fill in: naming conventions for tables/columns/indexes, migration
     discipline, query patterns, transaction rules, etc. -->

- (to be filled)

## Edge cases and error handling

**If the task spans multiple domains (e.g. endpoint + migration):**
Load *all* matching reference files from the routing table, not just the
first, and apply each to the relevant part of the change.

**If the task type has no reference file yet:**
Apply the base rules and briefly tell the user that no task-specific standard
exists for this task type — never block on it, never guess one.

**If a matched reference file is still a placeholder:**
Say so explicitly ("the TanStack Query standard hasn't been filled in yet")
and fall back to the base rules. Never invent standards that were never
written.

## If something goes wrong

Before improvising a fix, check `references/edge-cases.md` — this may already
be a documented, solved problem. If it's genuinely new once you're done,
follow the self-improvement protocol and add it there.

## Examples

**Example 1: task with a matching reference**
User says: "Add a page that lists products, fetched with TanStack Query."
Actions: apply Frontend base rules; routing table matches the TanStack Query
row → read `references/tanstack-query.md`; write the page following both.
Result: page code conforming to base + TanStack Query standards.

**Example 2: multi-domain task**
User says: "Add an invoices endpoint and the migration for its table."
Actions: apply Backend + Database base rules; routing table matches two rows →
read `references/api-endpoints.md` **and** `references/db-migrations.md`.
Result: endpoint and migration each following their standard.

**Example 3: no matching reference**
User says: "Set up a WebSocket connection for live notifications."
Actions: apply base rules only; note to the user: "no task-specific standard
exists for WebSockets yet — consider adding one."
Result: change made under base rules, gap surfaced.

## References

- `references/tanstack-query.md` — TanStack Query setup and usage standards.
- `references/e2e-test-writing.md` — end-to-end (Playwright) test-writing
  standards: structure, selectors, helpers, auth setup, data verification.
- `references/edge-cases.md` — accumulated real-world edge cases from using
  this skill; check it when something unexpected happens during use.
