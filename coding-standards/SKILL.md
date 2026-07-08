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
rules in this file apply to **all** application code; task-specific and
deep-dive standards live in `references/` and are loaded **only** when the
task matches a row in the routing table below.

**Most critical rule: never invent a company standard.** If a topic isn't
covered by the base rules or a reference file, say so — do not fabricate
plausible-sounding standards that were never written.

**Rules name categories, not tools.** Where a concrete tool appears (Svelte,
ZenStack, TanStack Query, pg-boss) it is the reference example — apply the
project's equivalent of that category (web framework, ORM/policy layer,
async-query library, job library). If the project genuinely lacks the layer
(no UI, no database, no jobs), skip that rule; don't force the dependency in.

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

Read the base-rule sections below (Universal, Frontend, Backend, Database) and
keep them in mind for the whole change. Only the sections relevant to the
files being touched need to be applied, but a task often spans more than one.

### Step 2: Check the routing table and load matching references

Compare the task against the routing table. **Read every reference file whose
task type appears in the request — all matches, not just the first.** A task
like "add an endpoint and a migration for it" matches two rows and needs both
files.

| Task involves… | Read first |
|---|---|
| Setting up or using TanStack Query (queries, mutations, caching, API wrapper) | `references/tanstack-query.md` |
| Writing or modifying end-to-end (Playwright) tests | `references/e2e-test-writing.md` |
| Any database work — schema/models, migrations, queries, access policies, transactions, seeds | `references/database-standards.md` |
| API endpoints, middleware, background jobs, validation, error handling | `references/project-structure.md` (§7, §10) |
| Components, stores, modals/drawers, styling, client state | `references/project-structure.md` (§6, §9) |
| New project setup, folder structure, where a file goes, naming a file | `references/project-structure.md` (§1–§3) |

If the task matches **no row**: proceed with the base rules only, and add a
one-line note to the user that no task-specific standard exists for this task
type yet (so the team knows to add one).

### Step 3: Write the code

Apply the loaded standards while making the change. Where a company standard
here conflicts with generic guidance — including the `typescript-conventions`
or `webapp-conventions` skills — **the company standard in this skill wins.**
(Known conflict, resolved: this company uses `type` aliases, not `interface`.)

## Base rules

Distilled from `references/project-structure.md` and
`references/database-standards.md` — those files hold the full rules with
examples; open them via the routing table when the task goes deeper than the
bullets below.

### Universal

- **TypeScript `strict: true`.** `type` aliases are the default; `interface`
  is not used in application code.
- **Named exports only**, as `const` arrow functions. Default exports are
  reserved for framework files that require them. No hand-written barrel
  files — import from the concrete file.
- **Validate at the boundary, trust inside.** Every untrusted input (request
  bodies, URL params, external API responses) passes through a schema
  validator (e.g. Zod) at the entry point; the static type is inferred from
  the schema — never write the same shape twice.
- **Discriminated unions for result types** (`{ ok: true; data } | { ok:
  false; data }`); consumers branch on `ok`, not try/catch. `satisfies` for
  typed configuration objects.
- **No non-null assertions (`!`)** — lint-banned. Use optional chaining and
  nullish coalescing. `async`/`await` exclusively, no `.then()` chains.
- **Precision types for precision data**: money and precision-sensitive
  quantities use a decimal library, never raw floating-point. One date
  library; dates are normalized to UTC before persistence.
- **Centralize every string that appears twice**: URLs, query keys, modal
  IDs, test IDs, error codes live in typed constant objects — never inline.
- **Guard clauses first**: authorization and precondition checks return early;
  the happy path continues unindented.
- **Keep business logic out of entry points.** Handlers/components
  orchestrate; services compute; views render.
- **`console` is restricted** to `console.error` / `console.info` with a
  `[context]:` prefix; `console.log` is lint-banned outside scripts.
- **Env vars**: `UPPER_SNAKE_CASE`, the framework's public prefix when
  client-exposed (e.g. `PUBLIC_`, `NEXT_PUBLIC_`, `VITE_`);
  `.env.example` committed; required vars fail fast with a descriptive throw
  at startup. Non-secret config is code (a constants object), not env.
- **Naming**: `camelCase` functions/variables, `UPPER_SNAKE_CASE` module
  constants, `PascalCase` types/enums, `kebab-case` folders and non-component
  files with a role suffix (`auto-rebalance.service.ts`), `*.spec.ts` tests.
- **Quarantine generated code** — never edit it; change the source and
  regenerate. **Make dangerous escape hatches look dangerous** (hostile names
  + `@deprecated` markers).
- **Version control**: conventional commit prefixes (`feat:`, `fix:`,
  `chore:`), typed branch names (`feat/kebab-description`), work flows
  through PRs into the integration branch.

### Frontend

- **Three component tiers**: `ui/` design-system primitives (generated,
  namespace-imported), `elements/` reusable app components, feature folders
  (`modals/`, `drawers/`) for flow-specific components. Hand-written
  components are `PascalCase` + the framework's component extension (e.g.
  `.svelte`, `.tsx`); new code uses the framework's current component style
  (e.g. Svelte 5 runes over legacy `export let`), never the legacy style.
- **Modals and drawers are data-driven**: one global store holds
  `{ activeModalID, props, size }`; open by ID constant, never inline strings.
- **Store factory pattern** for cross-cutting UI state — expose `subscribe`
  plus intention-revealing actions, not raw `set`. A `persistent` wrapper for
  state that must survive reloads. Component-local state stays local.
- **Styling is utility-first** (e.g. Tailwind) with a class-merge helper for
  conditional composition; no component-scoped CSS files.
- **All HTTP goes through the shared `api` wrapper** — raw `fetch` is banned
  in application code. Responses are the normalized `{ ok, status, data }`
  union; URLs come from the central `URLS` builders; mutation feedback via
  toasts at the call site.
- **Server state via the async-query library** (e.g. TanStack Query) with the
  shared query client and centralized query keys (see
  `references/tanstack-query.md`).
- **Interactive elements get `data-testid`** values from the central
  constants object shared with the E2E suite.

### Backend

- **File-based endpoints** exporting named HTTP-method handlers with the
  framework's handler type.
- **Access tiers are encoded structurally in the routing layer**, enforced by
  middleware — e.g. route groups `(public)`, `(secure)`, `(admin)`,
  `(premium)`, or your framework's router mounts/guards. Placing a file in a
  group *is* the authorization declaration; per-handler checks are the last
  line, not the mechanism.
- **Handler shape: validate → authorize → call service → shape response.**
  Request validation runs first via shared helpers. Success responses use the
  framework's JSON helper with the resource under a named key (e.g.
  `json({ resource })`); failures use its error helper with a status and
  message (e.g. `error(status, message)`) — error bodies always carry a
  `message` field.
- **Request-scoped dependencies (DB client, user) arrive via the request
  context** (e.g. `locals`), injected by middleware — handlers never
  construct their own.
- **Fat handlers are a smell**: multi-step business logic belongs in the
  service layer (`lib/server/services/`).
- **Cross-cutting concerns are a middleware sequence** (tracing → security
  headers → timing → auth → tier gating), each handler doing one thing; the
  standard security-header set is applied by one middleware with why-comments.
- **Background jobs are thin**: one file per job exporting a worker
  registration and a scheduler; queue name is a `JOB_NAME` constant; cron
  schedules pinned to UTC with a comment explaining the timing; singleton
  keys prevent double-firing. Job logic lives in a service.

### Database

- **One annotated schema file is the source of truth** (e.g. `schema.zmodel`)
  for models *and* access policies; all ORM artifacts are generated from it.
  Every model extends an abstract `Base` (collision-resistant string `id`
  such as cuid, `createdAt`, `updatedAt`).
- **Naming**: `PascalCase` singular models, `camelCase` fields, `<model>ID`
  foreign keys (uppercase `ID`), plural camelCase relation lists,
  `UPPER_SNAKE` enum values.
- **Column types**: money and precision-sensitive quantities use the exact
  decimal type, never float; timestamps are datetime columns in UTC; nullable
  means "legitimately absent", not "not yet migrated"; IDs are
  schema-generated, never made by application code.
- **Authorization lives in the schema as row-level policies** (via the policy
  layer, e.g. ZenStack). Application code uses the policy-enforced client
  factory bound to the current user (e.g. `getPrisma(user)`, injected via the
  request context) — the raw client is exported under a hostile deprecated
  name and is legitimate only in seeds, migrations, and system-level jobs.
- **Ownership filters are still written explicitly** in queries
  (`where: { userID: user.id }`) — the policy is the safety net, not the
  query. Reusable query shapes live in a `selectors.ts` module typed with
  `satisfies`. No repository pattern — services call the ORM directly.
- **Transactions sparingly**, only for genuine multi-step consistency; batch
  work prefers per-item try/catch with a totals report.
- **Migrations are committed**; schema changes flow edit → generate →
  migrate; seeds are standalone scripts and the one sanctioned home of the
  raw client.

## Edge cases and error handling

**If the task spans multiple domains (e.g. endpoint + migration):**
Load *all* matching reference files from the routing table, not just the
first, and apply each to the relevant part of the change.

**If the task type has no reference file yet:**
Apply the base rules and briefly tell the user that no task-specific standard
exists for this task type — never block on it, never guess one.

**If a rule names a layer or tool the project doesn't have:**
Skip it (it's conditional) or apply the project's equivalent tool — don't
introduce the dependency just to satisfy the rule.

**If a reference file is still a placeholder or a topic is uncovered:**
Say so explicitly and fall back to the base rules. Never invent standards
that were never written.

## If something goes wrong

Before improvising a fix, check `references/edge-cases.md` — this may already
be a documented, solved problem. If it's genuinely new once you're done,
follow the self-improvement protocol and add it there.

## Examples

**Example 1: task with a matching reference**
User says: "Add a page that lists products, fetched with TanStack Query."
Actions: apply Universal + Frontend base rules; routing table matches the
TanStack Query row → read `references/tanstack-query.md`; write the page
following both.
Result: page code conforming to base + TanStack Query standards.

**Example 2: multi-domain task**
User says: "Add an invoices endpoint and the migration for its table."
Actions: apply Universal + Backend + Database base rules; routing table
matches two rows → read `references/project-structure.md` (§7, §10) **and**
`references/database-standards.md`.
Result: endpoint and migration each following their standard.

**Example 3: no matching reference**
User says: "Add internationalization (i18n) support to the app."
Actions: apply base rules only; note to the user: "no task-specific standard
exists for i18n yet — consider adding one."
Result: change made under base rules, gap surfaced.

## References

- `references/project-structure.md` — the full project-structure and coding
  standards: directory layout, naming, code style, TypeScript, components,
  server/API, jobs, state management, error handling, env, testing, VCS.
- `references/database-standards.md` — the full database standards: schema
  organization, naming, column types, policies/authorization, query patterns,
  transactions, migrations, anti-patterns.
- `references/tanstack-query.md` — TanStack Query setup and usage standards.
- `references/e2e-test-writing.md` — end-to-end (Playwright) test-writing
  standards: structure, selectors, helpers, auth setup, data verification.
- `references/edge-cases.md` — accumulated real-world edge cases from using
  this skill; check it when something unexpected happens during use.
