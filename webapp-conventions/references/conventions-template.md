# Web app conventions — fill-in template

`SKILL.md` states the portable *principles*. This file is a **scaffold** for
turning them into a concrete conventions doc for *your* app, with your real
module names filled in. Copy it, replace every `<placeholder>`, delete the
sections that don't apply, and keep it next to your code (or as your own
`webapp-conventions` skill).

The worked examples describe a typical **SvelteKit + Tailwind + an ORM** stack.
Adapt freely; the value is the *shape* of each decision, not the specific tools.

> Convention before you start: **lint rule before written convention.** Anything
> deterministic and AST-checkable below should become a custom lint rule; keep
> this doc for the judgment cases.

---

## Forms and validation

- Schema validator: `<your validator, e.g. Zod>`. Where do schemas live?
  `<e.g. a shared server-only schemas module, or next to the form for simple
  client shapes>`.
- Request-body validation helper: `<validateRequest(request, schema)>`. Plain-
  object validation helper: `<safeParse(object, schema)>`. Make schemas **strict**
  so extra keys throw rather than being silently dropped.
- Form submission default: decide between **API endpoint + client `fetch`** and
  **framework form actions**. Pick one as the default (a `POST` to a REST route
  is a common default); reserve form actions for flows that must work without JS,
  and always progressively enhance them.
- Success vs failure: on success return data directly; on validation failure use
  your framework's typed failure mechanism (`<fail(status, data)>`), not a thrown
  error.
- Loading states — pick the pattern per scope:
  - **Full-page / long async op** → a global loading helper that renders a
    full-screen spinner with a label (`<your global loading helper>`).
  - **Single button action** → spinner on the button; don't block the whole page.

## Data loading

- **Auth-gated data loads on the server** (`<server load layer>`), never in a
  client mount hook. A `<no-async-onmount>` lint rule can enforce this.
- Server load reads the user from `<locals.user / request context>`.
- Where do data fetchers live? Server: `<one module per domain,
  e.g. server/services/userService>`. Client: `<client API module or direct REST
  fetch>`.
- Pagination default: `<offset-based: skip/take or offset/limit>`. Document when
  cursors are allowed.
- Optimistic updates: `<default = no; await the server then update>`.
- Cache invalidation: framework dependency keys (`<depends()/invalidate()>`) come
  from a shared constants module, never inline strings.
- **Client query cache (if any, e.g. TanStack Query):**
  - Define every query in one module as `<Q.<name> = queryOptions({ queryKey,
    queryFn, staleTime })>` — one source of truth per query.
  - **Never hardcode key literals at call sites.** Reference `<Q.<name>.queryKey>`
    for every key-taking API (invalidate/cancel/setData/refetch/getData, and test
    setup). The query-definition module is the only place allowed to write the
    literal.
  - **Bridge framework-invalidation → cache-invalidation in one place**, not per
    call site (e.g. watch the layout data reference and invalidate the affected
    query when it changes).

## Reuse before adding

- Search the nearby package before introducing a new helper, regex, URL builder,
  type, constant, schema, debounce, or UI variant.
- Prefer existing shared constants, URL helpers, validation schemas, and
  component variants over local reimplementations.
- **Extract, don't paste-and-trim.** Pull shared logic into `<a shared util
  module>` and update both the original and the new call site in the same change.
- Colocate route-specific code with the route; promote to shared only when a
  second consumer needs it. Don't abstract incidental similarity.

### Constants and URLs

Name your single sources of truth and use them everywhere:

- App route paths: `<URLS.app.*>` — never inline `` `/app/...` `` templates.
- Query params: assemble via `<URLS.withParams({ [C.foo]: 'true' })>` (drops
  `undefined`); read via `<page.url.searchParams.get(C.foo)>`. Both sides
  reference the same key constant.
- Cache keys: `<C.<key>>`, never inline strings.
- External / mailto / docs links: `<URLS.external.*>` — centralized so analytics
  and tests find every reference.
- Cross-cutting string constants (sentinel ids, magic keys, event names,
  feature-flag keys): one constants module (`<C>`), referenced as `<C.<name>>`.
- Helpers for fully-qualified URLs, deep links, and route-parsing: `<fullURL(),
  …, parseXPath()>` — don't split on `/` by hand.

## Error handling

- Error boundaries at `<top-level + route-group level>`.
- In server load: throw `<error(status, message)>` for user-facing errors,
  `<redirect()>` for auth redirects.
- In form actions: return `<fail(status, data)>` for validation/business errors.
- Logging: `<server logger>` on the server, `<client logger>` on the client —
  **never `console.log`** (`no-console` lint rule).
- **PII in logs:** only IDs (user/document/org). Never names, emails, or
  user-supplied content.

## Database schema (if you use an ORM / schema-gen layer)

- Single source of truth for schema: `<schema file, e.g. a ZenStack zmodel or a
  Prisma schema>`. If a layer *generates* the ORM schema, edit the source, never
  the generated file.
- Migration flow: `<the command that regenerates the schema then creates the
  migration>`. Don't hand-author migrations as the starting point; let the tool
  generate, then edit only when necessary (data backfill, multi-step rename).
- After hand-editing a generated migration, re-run generation and verify the
  schema is unchanged AND the migration's end state still matches the source —
  drift fails the build.
- Row-level auth (`<@@allow/@@deny or equivalent>`) is enforced by `<the scoped
  client, e.g. locals.prisma>`. Bypassing it (`<dangerous unscoped client>`)
  requires explicit, commented justification.

## Authenticated state

- Where the user is set: `<hooks/middleware via your auth provider>`; lives on
  `<event.locals.user>` (type `<your user type>`).
- Exposed to the client as `<page.data.dbUser>`; prefer it for reads.
- Client session store: `<sessionStore with a fetchUser() refresh>`.
- Route protection: enforced at `<hooks level for the protected route group>`.
- Role/permission checks: `<tier helpers / derived stores on the client; an enum
  check on the server>`.

## Accessibility baseline

- Semantic color tokens (`<text-primary-*, bg-surface-*, …>`), not hardcoded hex.
- Accessible labels on all interactive elements; icon-only buttons need
  `aria-label`. No exceptions.
- Keyboard navigation works for anything interactive; logical tab order.
- Focus management: `<native focus, or your UI kit's modal utilities>`.

## Component structure

- Shared components: `<client/components dir>`. Route-local: colocated under the
  route.
- File naming: `<PascalCase, e.g. DiagramCard.svelte>`.
- Barrel files (`index.ts` re-exports): **avoid** by default — they obscure the
  dependency graph and slow type-checking. Document any intentional exceptions
  (e.g. a namespace barrel that *is* a component's public API surface).

## Menus / dropdowns (example of a "one wrapper" rule)

A common pattern: every dropdown/action menu goes through **one shared wrapper**
over a headless menu primitive (`<bits-ui / Radix / Ark / Melt>`), instead of
hand-rolling popovers per feature. Document:

- The wrapper's import surface and a two-tier API if you have one (compound
  primitives for bespoke markup; a config-driven `<Menu items={...}>` for the
  common label+icon+handler rows).
- Styling: pick a typed `variant`; **never** theme a row by injecting a `class`
  string. Layout-only classes are fine.
- Row handlers via **callback props** (`onSelect`), not DOM events, on menu rows.
- What the primitive gives you for free (keyboard nav, type-ahead, focus, body
  portal) so nobody reimplements it.
- The migration seam, if the wrapper exists to swap one UI kit for another later.

## Styling

- **Token names are conventions, not their English meaning.** Confirm the hex in
  `<theme config>` before using a token by name.
- Prefer named scale classes over arbitrary values (`p-4` not `p-[16px]`); extend
  the config for recurring values.
- Resolve conditional classes with `<cn() = clsx + tailwind-merge>`; don't inline
  ternaries in the class string.
- Globalize a utility class once it appears in two+ components.
- **No `!important`** — scope `:where()` / a CSS layer if you must beat an
  unchangeable third-party class, with a comment.

## Spacing and layout

- Inter-sibling spacing → `gap` on the parent, not `mt`/`pt`/`space-y` on
  children.
- No `first:`/`last:` edge-case offsets; `gap` + parent padding handles edges.
- Inside a child, prefer symmetric padding (`p-2`, `px-2 py-4`).
- Mirror a design's structure verbatim before adapting it.

## Testing

- API tests: **parse** responses with a schema, don't cast them.
- Test IDs: reference a typed registry (`<TID.<id>>`) on both `data-testid` and
  the selector — no string/template literals. Lint rules: `<no-string-testid,
  no-as-cast-on-await-json>`.

## Banned patterns (turn each into a lint rule)

List your app-specific bans with the **reason** and the **lint rule** that
enforces each — that's what keeps the list honest. Common entries:

| Banned | Reason | Rule |
|---|---|---|
| Direct `element.innerHTML =` | XSS | `<no-unsafe-innerhtml>` |
| Raw-string test IDs | must be centralized | `<no-string-testid>` |
| `as`-casting `await res.json()` in tests | verify, don't assert | `<no-as-cast-on-await-json>` |
| snake_case analytics event names | platform expects camelCase | `<no-snake-case-analytics-events>` |
| Inline conditional class strings | `tailwind-merge` can't resolve collisions | code review until a Svelte-aware rule exists |
| Raw strings for user-facing copy where i18n exists | localization | `<no-string-user-message>` |
| Data fetch in a client mount hook | breaks SSR + auth gating | `<no-async-onmount>` |
| Unscoped/`dangerous` DB client in new code | bypasses row-level auth | code review |

## See also (point at your own companion docs)

- `<language-level component conventions>`
- `<typescript conventions>`
- `<API contract conventions>`
- `<testing guide>`
- `<security / auth / privacy guide>`
