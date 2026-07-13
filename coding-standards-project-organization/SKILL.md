---
name: coding-standards-project-organization
description: >
  Company conventions for where code lives and how the project is
  structured -- directory layout, file naming, universal code style and
  TypeScript conventions, general testing-standards overview, best
  practices, anti-patterns, and version-control workflow. Use when creating
  a new file, deciding where something belongs, scaffolding a new area of
  the project, or asking general "how do we structure X" questions not
  covered by a more specific coding-standards-* skill. Does NOT replace
  coding-standards-e2e for Playwright-specific test conventions, or the
  domain skills for component/endpoint/schema rules.
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

# Coding Standards -- Project Organization

Universal rules were already applied by the coding-standards dispatcher before this skill was invoked.

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

