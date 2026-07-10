# Project Structure

This document extracts the architectural decisions, folder organization, and coding standards used in this codebase so they can be reused as a template for future projects. Every rule is derived from patterns actually present in the repository. Conventions that exist but are not consistently enforced are explicitly marked as such.

**How to apply this template:** the rules fall into two tiers.

- **Universal rules** — language, naming, typing, error-handling, and organization conventions that apply to any TypeScript project. Adopt these everywhere.
- **Conditional rules** — marked *(if applicable)* at the section or bullet level. They apply only when the project includes that layer (a UI, a database, background jobs, native builds, …). If a project lacks the layer, skip the section; do not force the dependency in.

**Rules are written by category, not by tool.** Every rule names the *kind* of tool it governs (web framework, ORM, async-query library, schema validator, …); concrete tool names appear only as examples. The reference stack the standards were extracted from:

| Category | Reference example |
|---|---|
| Web framework | SvelteKit (Svelte 5) |
| Language | TypeScript (`strict`) |
| ORM / schema toolkit | ZenStack |
| Row-level policy layer + hooks generator | ZenStack |
| Async server-state (query) library | TanStack Query |
| Schema validation library | Zod |
| Styling | Tailwind CSS + shadcn-style UI primitives |
| Background-job library | pg-boss |
| Native builds | Capacitor |
| E2E / unit test runners | Playwright / Vitest |
| Package manager | pnpm |

**Code snippets throughout use the reference stack.** Read them as illustrations of the rule; translate the idiom to your project's equivalent tool — the principle transfers even when the tool does not.

---

## 1. Directory Structure

The full reference layout, with generic role names; names in parentheses show the reference stack's concrete spelling. Directories marked *(if applicable)* exist only when the project has that concern:

```
.
├── src/
│   ├── lib/                    # All shared code, importable via a project alias (e.g. `$lib`, `@/`)
│   │   ├── server/             # Server-only code (framework-enforced boundary)   (if full-stack)
│   │   │   ├── db/             # ORM client construction + reusable selectors (e.g. prisma/)  (if database)
│   │   │   └── services/       # Business-logic service layer
│   │   ├── components/         # UI components                                    (if UI)
│   │   │   ├── ui/             # Design-system primitives (mostly generated)
│   │   │   ├── elements/       # App-level reusable components
│   │   │   ├── modals/         # Modal contents (opened via central modal store)
│   │   │   └── drawers/        # Drawer contents
│   │   ├── stores/             # Client state stores, one file per domain         (if UI)
│   │   ├── hooks/              # GENERATED data hooks — never hand-edit           (if codegen)
│   │   ├── validation/         # Validation schemas + request-validation helpers
│   │   ├── jobs/               # Background-job runtime + job definitions (e.g. pgboss/)  (if jobs)
│   │   ├── types/ + types.ts   # Shared type definitions
│   │   ├── utils/ + utils.ts   # Shared utilities
│   │   ├── config/             # Static configuration per integration
│   │   ├── constants.ts        # Centralized app constants
│   │   ├── enums.ts            # Shared enums and enum-like value maps
│   │   └── urls.ts             # Centralized URL/route builders
│   ├── routes/                 # File-based routing (pages + API endpoints)       (if web app)
│   ├── scripts/                # Standalone operational scripts
│   ├── hooks.server.ts         # Framework's server middleware entry (auth, CORS, tracing, …)  (if server)
│   └── hooks.client.ts         # Framework's client bootstrap entry               (if UI)
├── prisma/ + schema file       # Data-model source of truth + migrations (e.g. schema.zmodel)  (if database)
├── tests/                      # E2E tests (fixtures/, lib/, scenarios/)           (if E2E)
├── static/                     # Static assets served as-is (e.g. static/, public/)  (if web app)
└── android/ · ios/             # Native platform projects (e.g. via Capacitor)     (if native)
```

The exact directory names follow the framework's conventions (`routes/`, `hooks.server.ts` are the reference framework's); keep your framework's native names and map the *roles* above onto them.

### Organization rules (universal)

- **One shared-code root with an import alias.** All reusable code lives under a single aliased directory; nothing reusable hides inside route/feature folders.
- **Shared code is organized by kind, features by route/entry point.** The shared root groups code by kind (components, stores, services, types); feature-specific code lives with the feature's entry point.
- **Modules grow from file to folder.** A concern starts as a single file (`thing.service.ts`); when it accumulates related files, it becomes a folder of the same name. Do not pre-create folder hierarchies for single files.
- **Generated code is quarantined** in dedicated directories and never edited by hand.
- **Server/client boundary is structural, not conventional** *(if full-stack)*. Secret-touching code lives in a directory the framework refuses to bundle for the client (e.g. `lib/server/` in SvelteKit, `server/` in Next.js conventions). Do not rely on discipline alone.

## 2. File Organization

### Imports (universal)

- Imports are sorted **alphabetically by module specifier** in a single block (no grouping into "external / internal" sections).
- Use the shared-code alias for anything under the shared root; relative imports (`./`, `../`) only within the same folder subtree.
- Type-only imports use `import type { ... }` or inline `type` modifiers.

Example (reference stack):

```ts
import { getTimezoneFormattedDate } from '$lib/dayjs';
import { AnalysisMethod } from '$lib/enums';
import { validateRequest } from '$lib/validation/validator';
import { error, json, type RequestHandler } from '@sveltejs/kit';
import dayjs from 'dayjs';
import Decimal from 'decimal.js';
```

### File layout (universal)

Within a module: constants → module-level setup → helper functions → exported functions. Scripts end with a single `void main();` entry call.

### Exports (universal)

- **Named exports only** for TypeScript modules. Default exports are reserved for framework files that require them (e.g. UI components).
- Export functions as `const` arrow functions: `export const doThing = async (...) => { ... }`.
- **Barrel files are not used** for shared code — import from the concrete file. (The only `index.ts` barrels are generated ones.)

### Co-location

- Route pages, their layouts, and their API handlers co-locate under the route directory *(if web app)*.
- A background job is a thin scheduler/worker wrapper; its logic lives in a service *(if jobs)*.
- ⚠️ Test co-location is **not consistently enforced**: most unit tests live in a dedicated `unit-tests/` folder, but at least one test sits next to its subject. Pick one location per project and stick to it.

## 3. Naming Conventions

Universal rows apply to every project; rows for layers the project lacks are simply unused.

| Element | Convention | Example |
|---|---|---|
| Functions / variables | `camelCase` | `calculateMaxDrawdown` |
| Module-level constants | `UPPER_SNAKE_CASE` | `JOB_NAME`, `CSV_PATH` |
| Types / interfaces / enums | `PascalCase` | `TradeAccount`, `ModalSize` |
| Enum members | `UPPER_SNAKE_CASE` | `TOTAL_ROI` |
| Folders | `kebab-case` | `paper-trade-stats/` |
| Non-component files | `kebab-case.ts`, with a role suffix where one exists | `auto-rebalance.service.ts`, `order-status.job.ts` |
| Test files | `*.spec.ts` | `sharpeRatio.spec.ts` |
| Env variables | `UPPER_SNAKE_CASE`; public prefix when client-exposed | `PUBLIC_SITE_URL` |
| Component files (app-level) *(if UI)* | `PascalCase` + the framework's component extension | `LoadingSpinner.svelte`, `LoadingSpinner.tsx` |
| Component files (generated primitives) *(if UI)* | generator's own style — leave as-is | `badge.svelte` |
| API route paths *(if API)* | `kebab-case` | `/api/live-trade/[tradeSessionID]` |

Database model and field naming is covered in [`database-standards.md`](./database-standards.md).

Additional rules:

- Naming is **lint-enforced** (e.g. `@typescript-eslint/naming-convention`): variables and properties are `camelCase`/`UPPER_CASE`, type-likes are `PascalCase`. Files that must break the rule (e.g. third-party header names, enum value maps) disable it explicitly with a scoped lint-disable rather than weakening the global rule.
- When a re-exported external type (from the ORM or an SDK) collides with a local alias, suffix the original with `Origin`:

```ts
import type { User as UserOrigin } from '@prisma/client'; // or your ORM's client package
export type User = UserOrigin;
```

- ⚠️ Component file naming is **not consistently enforced**: app-level components are `PascalCase`, but some root-level form components use `kebab-case`. Prefer `PascalCase` for hand-written components.
- ⚠️ Type definition file naming is **not consistently enforced** (`chartTypes.ts` vs `plaid.types.ts`). Choose one suffix style per project.

## 4. Code Style (universal)

Formatting is delegated entirely to the formatter (2-space indent, single quotes, no trailing commas, 100-char lines). Style rules below are the ones a formatter cannot decide:

- **Arrow-function `const`s over `function` declarations** for module-level functions. `function` declarations appear only in store factories and generated code.
- **`async`/`await` exclusively** — no `.then()` chains in application code.
- **Early returns / guard clauses** for authorization and precondition checks (shown with the reference framework's handler type):

```ts
export const GET: RequestHandler = async ({ locals: { db, user } }) => {
  if (!user) {
    return error(401, 'Unauthorized');
  }
  // happy path continues unindented
};
```

- **Object parameters with inline destructuring** for functions with more than ~2 arguments; the parameter type is declared inline:

```ts
const addSubscriptionForUsers = async ({ planID, userIDs }: { planID: string; userIDs: string[] }) => { ... };
```

- **Optional chaining and nullish coalescing** are the default null-handling tools. Non-null assertions (`!`) are **banned by lint**.
- **Precision-sensitive values (money, quantities) use a decimal library** (e.g. decimal.js), never floating-point arithmetic.
- **Date handling goes through one date library** (e.g. dayjs) with explicit UTC handling; dates that cross a persistence boundary are normalized to UTC.
- **`console` is restricted by lint** to `console.error` and `console.info`; scripts and server bootstrap files are exempted via a scoped lint override. Log lines are prefixed with a bracketed tag: `console.info('[seed]: ...')`.
- `prefer-const` and `no-var` are enforced.

## 5. TypeScript Standards (universal)

- **`strict: true`** — non-negotiable.
- **`type` aliases are the default; `interface` is not used** in application code. Model composite shapes with type aliases, unions, and intersections.
- **Discriminated unions for result types**, so consumers must narrow before touching data:

```ts
type HTTPResponse<T, E> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; data: E };
```

- **Runtime validation with a schema validation library** (e.g. Zod) **at every untrusted boundary** (request bodies, URL params, external API responses). The static type is inferred from the schema — never write the same shape twice.
- **`satisfies` for typed configuration objects** so the literal type is preserved while the shape is checked (shown with an ORM-provided arg type):

```ts
export const userSelector = { include: { ... } } satisfies Prisma.UserDefaultArgs;
```

- **Generics for reusable helpers**, constrained where possible (e.g. `<T extends z.ZodRawShape>` with Zod).
- **Utility types over redeclaration**: `Pick<User, 'id'>`, `Pick<Response, 'ok' | 'status'>` derive narrow inputs from wide types.
- **Types derived from external packages (ORM, SDKs) are re-exported once** from a central types module; the rest of the app imports from there, never from the package directly.
- `any` is avoided; unknown payload shapes use `Record<string, unknown>` or `unknown` with narrowing. Unused variables must be prefixed `_`.

## 6. Component Standards *(if the project has a UI)*

Skip this section entirely for API-only, CLI, or library projects.

- **Three component tiers:**
  1. `ui/` — design-system primitives (button, card, table, …), mostly generated (e.g. shadcn-style); consumed via namespace imports.
  2. `elements/` — reusable app components (banners, spinners, stat cards).
  3. Feature folders (`modals/`, `drawers/`, …) — components tied to one flow.
- **Modals and drawers are data-driven**: a single global store holds `{ activeModalID, props, size }`; components open modals by ID via constants, never inline strings.
- **Store factory pattern** for UI state — expose `subscribe` plus intention-revealing actions, not raw `set`. Shown with the reference framework's stores; a Zustand/Pinia/atom-based factory follows the same shape:

```ts
function createModalStore() {
  const store = writable<ModalState>(defaultValue);
  return { subscribe: store.subscribe, open: (...) => {...}, close: () => {...} };
}
export const modalStore = createModalStore();
```

- **Styling is utility-first** (e.g. Tailwind) with a class-merge helper for conditional composition. No component-scoped CSS files.
- **Interactive elements get `data-testid` attributes from a central constants object** — E2E selectors never use raw strings. *(Applies only when E2E tests exist; harmless otherwise.)*
- ⚠️ **Old vs new framework component style is not consistently enforced** (in the reference stack: legacy Svelte `export let` vs Svelte 5 runes `$props()`; the equivalent applies to any framework mid-migration). New code uses the current style; migrate legacy components opportunistically.

## 7. Server / API Standards *(if the project exposes an HTTP API)*

- **API endpoints are file-based** and export named HTTP-method handlers with the framework's handler type.
- **Access tiers are encoded structurally in the routing layer**, not per-handler checks — in the reference framework, route groups `(public)`, `(secure)`, `(admin)`, `(premium)` with middleware inspecting the route ID; in other stacks, router mounts or module-level guards playing the same role. Placing a file in a group *is* the authorization declaration.
- **Cross-cutting concerns are a sequence of small middleware handlers** (tracing → CORS/security headers → timing → auth → tier gating), each doing one thing.
- **Request validation happens first, via shared helpers**, before any business logic (reference-framework handler shown; the shape is framework-agnostic):

```ts
export const POST: RequestHandler = async ({ locals: { db, user }, request }) => {
  const payload = await validateRequest(request, createThingSchema);
  if (!user) return error(401, 'Unauthorized');
  ...
  return json({ thing });
};
```

- **Responses**: success via the framework's JSON helper with the resource under a named key; failures via the framework's error helper with a status and message. Error bodies always carry a `message` field.
- **Request-scoped dependencies (DB client, user) arrive through the request context** (e.g. `locals`, `req.context`), injected by middleware — handlers never construct their own.
- **Business logic lives in the service layer**; route handlers orchestrate: validate → authorize → call service → shape response. Long multi-step logic in a handler is a smell.
- **Centralized URL builders** define every internal path and API URL as constants or typed factory functions (`api.thing.pick({ id })`). Neither client nor server hardcodes path strings.
- **A standard security-header set is applied to every response by one middleware handler** — clickjacking protection (CSP `frame-ancestors` + `X-Frame-Options` fallback), `X-Content-Type-Options: nosniff`, a restrictive `Referrer-Policy` and `Permissions-Policy`, and HSTS set only when the request was already HTTPS (so local dev isn't broken). Each header carries a why-comment.

### Background Jobs *(if the project has scheduled/queued work)*

- **One file per job** (`jobs/<name>.job.ts`), each exporting exactly two functions: a worker registration (`registerXWorker`) and a scheduler (`scheduleX`).
- **The queue name is a module-level constant** (`JOB_NAME`), used for the queue, the schedule, and singleton keys — never repeated as a literal.
- **Jobs are thin**: the worker body is a single call into a service function; all logic lives in the service layer.
- **Schedules are cron expressions pinned to UTC**, with a comment explaining the business reason for the timing (reference job library shown):

```ts
await pgBoss.schedule(JOB_NAME, '0 3 * * 2-6', {}, { tz: 'UTC', singletonKey: JOB_NAME });
// Tue–Sat at 03:00 UTC, after the previous trading day's prices are ingested.
```

- **Singleton keys prevent duplicate scheduling/execution**; a deploy-kickoff `send` with a time-boxed singleton (`singletonSeconds`) runs the job once on deployment without double-firing across instances. Use your job library's equivalent deduplication primitive.

## 8. Database Conventions *(if the project has a database)*

Database conventions are maintained separately in [`database-standards.md`](./database-standards.md) so they can be adopted independently by backend-only or data-service projects. Skip for stateless services and pure frontends.

## 9. State Management & Data Fetching *(if the project has a client-side UI)*

- **Server state**: an async-query library (e.g. TanStack Query) with a single shared query client. Two sources of queries:
  1. Generated model hooks *(if the schema toolchain provides them — e.g. ZenStack)*.
  2. Hand-written queries whose fetch functions use the shared API wrapper and central URL builders.
- **Query keys are centralized constants**, never inline strings; invalidation uses the same constants.
- **Reusable query definitions** live in a queries module so multiple components share one definition.
- **Client state**: the framework's reactive state primitive (stores, atoms, slices) for cross-cutting UI state (modal, drawer, user, notifications); a `persistent` store wrapper for state that must survive reloads. Component-local state stays in the component.
- **Loading / error states** are handled from query flags in templates (loading → spinner, error → retry component with the error message).
- **Mutation feedback via toasts** immediately at the call site.

### API Call Conventions

All HTTP calls from application code go through **one shared API wrapper module** — raw `fetch` in components, stores, or queries is not allowed. The wrapper's rules:

- **One `api` object with a typed function per HTTP verb**, built from two factories (with-body / without-body) so each verb isn't hand-written:

```ts
export const api = {
  get: fetchWrapperWithoutBody('GET'),
  delete: fetchWrapperWithoutBody('DELETE'),
  post: fetchWrapperWithBody('POST'),
  put: fetchWrapperWithBody('PUT'),
  patch: fetchWrapperWithBody('PATCH')
} as const;
```

- **Callers declare both payload types**: `api.get<SuccessShape, ErrorShape>(url)` — the error type defaults to the app's standard error shape, so most call sites only name the success type.
- **Every response is normalized to the discriminated union** `{ ok, status, data }`; callers branch on `response.ok` instead of try/catch. A `throwIfError(response)` helper converts to an exception (wrapping the full response in a custom error class) for contexts where throwing is more ergonomic (e.g. query functions).
- **Protocol quirks are absorbed once, inside the wrapper**, never at call sites: empty `204` bodies, error responses without JSON bodies, cross-cutting error codes that trigger a global toast. If a call site is special-casing a status code, that logic probably belongs in the wrapper.
- **Auth headers are attached in one place** (a module-level header store merged into every request), not passed by callers.
- **Content negotiation is defaulted, not repeated**: JSON `Content-Type` is set automatically when a body exists; `Accept` defaults to JSON unless overridden.
- **The fetch implementation is injectable** via an options parameter (`customFetch`), typed against a minimal `Fetch` interface — so the framework's request-scoped fetch or a test runner's fetch can be substituted without changing call sites.
- **URLs come from the central URL-builder module**, and the base URL comes from public env config with a logged localhost fallback — callers never concatenate path strings.

```ts
const response = await api.get<PaperTradeAnalysisPayload>(URLS.api.paperTrade.pick({ id }));
if (!response.ok) {
  toast.error(response.data.message ?? 'Failed to fetch analysis.');
  return;
}
// response.data is fully typed here
```

## 10. Error Handling (universal)

- **Guard clauses for expected failures** (unauthorized, not found) — handled early, before business logic, using the framework's error mechanism where one exists.
- **Normalized result objects instead of exceptions** at API boundaries: check `response.ok`, read a typed `message` from the body.
- **Custom error classes** where an exception must carry structure (`class APIHTTPError extends Error` wrapping the full response).
- **Per-item try/catch in batch loops** — one failed item logs and continues; the batch reports totals at the end.
- **Telemetry-aware error paths** *(if tracing is configured)*: spans record exceptions and set error status in catch blocks, then rethrow.
- **Logging discipline**: `console.error` for failures with the caught error object, `console.info` for lifecycle events, both with a `[context]:` prefix. `console.log` is lint-banned outside scripts.
- User-facing errors are short, actionable sentences; raw error internals are never shown to users.
- Retry is user-initiated — no automatic retry loops in application code.

## 11. Configuration & Environment Variables (universal)

- **Names are `UPPER_SNAKE_CASE`**, prefixed by domain (`STRIPE_*`, `POSTGRES_*`). Anything exposed to the client **must** carry the framework's public prefix (e.g. `PUBLIC_*` in SvelteKit, `NEXT_PUBLIC_*` in Next.js, `VITE_*` in Vite).
- **`.env.example` is committed** and kept current; real values live in per-environment files (`.env`, `.env.dev`, `.env.staging`, `.env.prod`) that are git-ignored.
- **Application code reads env through the framework's env module** where one exists; standalone scripts use `dotenv` + `process.env`.
- **Required variables fail fast** with a descriptive throw at startup:

```ts
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
}
```

- **Non-secret app configuration is code, not env**: a single constants object (`C`) holds IDs, keys, regexes, and mappings used across the app; per-integration config lives in `config/`.
- Feature toggles are explicit env flags compared to the string `'true'`.

## 12. Testing Standards

- **Unit tests**: pure calculation/logic functions are tested in `*.spec.ts` files with the unit test runner (e.g. Vitest) using `describe`/`it`/`expect`, with named scenarios and approximate matchers for floating-point assertions. Tests target exported functions — no mocking framework is in use.
- **E2E tests** *(if the project has a UI)* use the E2E runner (e.g. Playwright), live in `tests/`, organized as:
  - `fixtures/` — reusable auth/setup fixtures
  - `lib/` — shared helpers and test types
  - `scenarios/<feature>/<feature>.spec.ts` — user-journey specs
  - `global.setup.ts` — one-time setup
- E2E selectors use `data-testid` values from the central constants object.
- ⚠️ **Not consistently enforced**: unit tests are split between a `unit-tests/` folder and co-location; both `.spec.ts` and `.test.ts` suffixes exist. Standardize on one location and the `.spec.ts` suffix.
- **Coverage expectations are not established.** No coverage thresholds are configured.

## 13. Best Practices

Recurring practices observed throughout the codebase, stated as rules. All are universal unless marked:

1. **Push authorization into infrastructure** *(if applicable)*. Route groups gate pages; schema policies gate rows; middleware gates tiers. Handler-level checks are a last line, not the mechanism.
2. **Validate at the boundary, trust inside.** Every external input passes through a schema at the entry point; inner code receives already-typed data.
3. **Centralize every string that appears twice**: URLs, query keys, modal IDs, test IDs, error codes — all live in typed constant objects.
4. **Keep business logic out of entry points.** Handlers/components orchestrate; services compute; views render.
5. **Make dangerous things look dangerous.** Unsafe escape hatches get hostile names and `@deprecated` markers so misuse is self-evident in review.
6. **Quarantine generated code** in dedicated directories and regenerate rather than edit.
7. **Fail fast on misconfiguration** — throw on missing env vars at startup, not at first use.
8. **Precision types for precision data**: a decimal library for money, one date library with explicit UTC handling.
9. **Lint what matters, format the rest.** Naming, console usage, non-null assertions, and restricted imports are lint *errors*; whitespace opinions belong to the formatter. Pre-commit hooks run the staged-file linter (e.g. lint-staged) plus spell-check.
10. **Explain the "why" in comments**, not the "what" — comments annotate business reasons (cron timing rationale, workaround causes), not mechanics.

## 14. Anti-Patterns

Patterns that conflict with the conventions above and must be avoided. Layer-specific items apply only when the layer exists:

- ❌ **`console.log`** anywhere outside scripts; **non-null assertions (`!`)** anywhere.
- ❌ **Handling money or precise quantities with raw `number` arithmetic.**
- ❌ **Skipping boundary validation** or validating after business logic has started.
- ❌ **Hardcoding route paths, API URLs, query keys, modal IDs, or test selectors inline.** Use the central builders/constants.
- ❌ **Default exports in TypeScript modules** (framework-required files excepted).
- ❌ **Editing generated files** — change the source and regenerate.
- ❌ **Duplicating a shape inline** that already exists as a shared selector, schema, or query-params factory.
- ❌ *(if full-stack)* **Placing secret-touching code outside the server-only directory.**
- ❌ *(if API)* **Fat route handlers** that inline multi-step business logic instead of delegating to a service.
- ❌ *(if UI)* **Raw `fetch` calls in application code** — all HTTP goes through the shared API wrapper; status-code special-casing at call sites belongs in the wrapper.
- ❌ *(if UI)* **Writing new components in the legacy framework style** — new code uses the current style.

## 15. Version Control & Workflow

- **Conventional commit prefixes**: `feat:`, `fix:`, `chore:` — a short imperative summary after the prefix. The prefix reflects intent (user-facing feature / defect fix / maintenance), not file type.
- **Typed branch names**: `<type>/<kebab-description>` where type mirrors the commit prefixes (`feat/dynamic-ticker-fetch`, `fix/limiter-for-autorebalance`, `chore/optimize-queries`, `bug/next-rebalance-day`).
- **Work flows through pull requests** into an integration branch (`staging`), which is merged to the default branch for release — no direct commits to either.
- **Pre-commit hooks run the cheap checks** (lint with autofix + spell-check on staged files); CI is not the first line of defense.
- **A `.git-blame-ignore-revs` file** keeps bulk-formatting commits out of `git blame`.
