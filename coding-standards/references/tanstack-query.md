# TanStack Query Setup Guidelines

Generalized guidelines for wiring client-side data fetching with TanStack Query. These conventions are project-agnostic: the examples use the Svelte adapter (`@tanstack/svelte-query`), but the same structure applies to React, Vue, or Solid — swap `createQuery` for `useQuery` and `$query.data` for your adapter's reactive access. Section 9 covers adapting the setup for projects without a generated CRUD layer, and Section 10 for apps without token-based auth or a native shell.

---

## 1. Pick One Data-Loading Boundary

Decide where data loading happens and apply it everywhere. This setup loads **all data client-side through TanStack Query** — no server-side route loaders. The payoff: the exact same page code runs in every build target (SSR web build, statically-exported native/mobile shell, plain SPA), because no code path depends on a server being co-located with the client.

If your app is web-only and SSR loaders work for you, you can mix in server loading — but keep the rule explicit and documented, so contributors never wonder which layer owns a given fetch.

---

## 2. The QueryClient: One Module Singleton

Create the client once in its own module, not inside a component:

```ts
// src/lib/utils/queryClient.ts
import { QueryClient } from '@tanstack/svelte-query';
export const queryClient = new QueryClient({});
```

Provide it once at the app root:

```svelte
<script>
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { queryClient } from '$lib/utils/queryClient';
</script>

<QueryClientProvider client={queryClient}>
  {@render children?.()}
</QueryClientProvider>
```

**Why a module singleton instead of creating it inline in the root layout:** it can be imported from non-component code — event handlers, auth flows, service modules — to invalidate or clear caches imperatively. The canonical example: on logout, call `queryClient.clear()` so no cached data leaks across user sessions.

---

## 3. Two Data Layers

Split client data access into two layers and be consistent about which one a given need belongs to:

| Layer | What it's for | Transport |
|---|---|---|
| **Hand-written queries** (`createQuery`) | Bespoke endpoints: dashboards, aggregations, third-party integrations, anything with server-side computation | Custom REST endpoints under `/api/*` via a shared fetch wrapper |
| **Generated CRUD hooks** (`useFindMany*`, `useUpdate*`, …) | Plain model reads/writes | Auto-generated model endpoints (e.g. `/api/model/*`) with row-level access policies enforced server-side |

The generated layer (from ZenStack, or any schema-to-hooks generator) removes the need to hand-write an endpoint per model — the client queries models directly and the server enforces per-row authorization from the schema. Reserve hand-written endpoints for logic that doesn't map to model CRUD.

---

## 4. Hand-Written Queries

### Option factories for reusable queries

Every query used from more than one place gets a `get<Thing>QueryParams()` factory in a single central module, returning the full options object:

```ts
// src/lib/utils/queries.ts
export const getStatsQueryParams = () => ({
  queryKey: [C.queryKey.stats],
  queryFn: async () => {
    const response = await api.get(URLS.api.dashboard.stats);
    if (!response.ok) throw new Error(response.data?.message || 'Failed to fetch stats.');
    return response.data as StatsResponse;
  }
});
```

Consume it directly, or spread + override for call-site-specific options:

```ts
const statsQuery = createQuery(getStatsQueryParams());

const accountQuery = createQuery({
  ...getAccountDetailsQueryParams(),
  enabled: someCondition
});
```

This keeps the key and the fetcher defined in exactly one place, so fetching and invalidation can never use different keys.

### Inline queries for page-local data

When a query is specific to one page and never invalidated from elsewhere, define it inline in the page — no factory ceremony:

```ts
const entityListQuery = createQuery({
  queryKey: ['entities'],
  queryFn: async () => {
    const response = await api.get(URLS.api.entity.root);
    if (!response.ok) throw new Error(response.data?.message || 'Failed to fetch entities.');
    return response.data as { entities: Entity[] };
  }
});
```

### Route params go in the key

Detail pages include the route param in the query key so navigating between IDs refetches instead of showing stale data:

```ts
const query = createQuery({
  queryKey: ['entity', page.params.entityID],
  queryFn: async () => {
    if (!page.params.entityID) throw new Error('No entity ID provided');
    return (await api.get(URLS.api.entity.pick({ id: page.params.entityID }))).data;
  }
});
```

### Always go through one fetch wrapper

Every `queryFn` calls a shared `api` wrapper (`api.get/post/put/delete`) — never raw `fetch`. The wrapper centralizes:

- auth header injection (e.g. `Authorization: Bearer <token>` on native builds),
- base-URL resolution (absolute app URL when the client isn't served by the API host),
- consistent `{ ok, data }` response shape and error extraction.

Route paths come from a centralized `URLS` constants object — never hardcode endpoint strings in a `queryFn`.

---

## 5. Generated CRUD Hooks (If You Have a Generator)

The schema generates one typed hooks file per model (re-exported from a single index), giving `useFindMany<Model>`, `useFindUnique<Model>`, `useCreate<Model>`, `useUpdate<Model>`, `useDelete<Model>`, infinite variants, etc.

Query:

```svelte
<script>
  import { useFindManyEntity } from '$lib/hooks';
  const entities = useFindManyEntity({ where: { userID }, orderBy: { createdAt: 'desc' } });
</script>
{#if $entities.data}{/if}
```

Mutation:

```ts
import { useUpdateEntity } from '$lib/hooks';
const updateEntity = useUpdateEntity();
// later:
await $updateEntity.mutateAsync({ where: { id }, data: { ... } });
```

Generated hooks **auto-invalidate** their related queries on mutation through the shared QueryClient — no manual invalidation for same-model writes.

### The hooks context (required wiring)

Generated hooks resolve their `fetch` implementation and endpoint from a context set once at the app root:

```ts
import { setHooksContext } from '$lib/hooks';

const fetchWithAuth: typeof fetch = async (url, options = {}) => {
  const response = await fetch(url, { ...options, headers: { ...options?.headers, ...getHeaders() } });
  // central place for cross-cutting response handling (e.g. 403 → permission toast)
  return response;
};

setHooksContext({
  fetch: fetchWithAuth,                        // injects the auth header
  endpoint: `${getPublicSiteURL()}/api/model`  // absolute URL — safe for native/static builds
});
```

This context is the single seam where the generated layer meets your auth model: header injection, absolute endpoints, and global error handling (like an impersonation-read-only toast) all live here, not in call sites.

### Server side

Mount the generated handler behind your server's request pipeline, and hand it a **policy-enhanced** database client scoped to the authenticated user — that is what makes direct model access safe:

```ts
const zenstackHandler = SvelteKitHandler({ prefix: '/api/model', getPrisma: (e) => e.locals.db });
```

Wrap the handler so ORM error internals are scrubbed before reaching the client.

---

## 6. Query Keys

Three tiers, by how widely a key is shared:

1. **Shared keys** — any key used for invalidation from another file lives in one centralized constants object (`C.queryKey.stats`, `C.queryKey.accountDetails`, …). The same constant is used in the factory and in every `invalidateQueries` call, so they can't drift.
2. **Local keys** — inline page queries that are never invalidated externally use plain literals: `['entities']`, `['entity', id]`.
3. **Generated-hook keys** — when you must invalidate a generated hook's cache manually, derive the key with the generator's helper rather than guessing its internal format:

```ts
import { getQueryKey } from '$lib/hooks';
queryClient.invalidateQueries({ queryKey: getQueryKey('User', undefined, { infinite: false }) });
```

A coarse per-model constant (e.g. `['zenstack', 'User']`) is acceptable for broad invalidation.

---

## 7. Mutations & Invalidation

Two mutation styles coexist — pick by which layer owns the endpoint:

1. **Imperative call + manual invalidate** (custom endpoints). After a successful `api.post/put/delete`, invalidate every affected key, optionally forcing an immediate refetch for data visible on the current screen:

   ```ts
   await queryClient.invalidateQueries({ queryKey: [C.queryKey.accountDetails] });
   await $accountDetailsQuery.refetch(); // when the user is looking at it right now
   ```

2. **Generated mutation hooks** — call `mutateAsync` and rely on built-in invalidation. Add manual invalidation only for **cross-model side effects** the generator can't know about (e.g. updating model A changes an aggregate served by a custom endpoint).

The failure mode to guard against: a write succeeds but a stale list stays on screen. Every mutation call site should account for every query whose data it changed.

---

## 8. Loading / Error UX Helpers

Standardize the three query states with shared components so every page renders them identically:

```svelte
{#if $query.isPending}
  <LoadingSpinner />
{:else if $query.error}
  <RefetchQueryButton query={query} />
{:else}
  <!-- use $query.data -->
{/if}
```

- **`LoadingSpinner`** — the one pending state.
- **`RefetchQueryButton`** — the one error state; renders the message and a retry button that calls `query.refetch()`. No page hand-rolls its own error UI.
- **`withData`** — a small helper for driving side effects from a query subscription, firing only once data exists:

  ```ts
  query.subscribe(withData((data) => { /* runs only when data is defined */ }));
  ```

  Use it where a query feeds state or side effects outside the template (pollers, derived stores) instead of sprinkling `if (data !== undefined)` checks.

---

## 9. Projects Without a Generated CRUD Layer

If you don't have ZenStack (or similar), drop Section 5 and route everything through the hand-written layer:

- Every model operation gets a REST endpoint and either an option factory (reused) or an inline query (page-local).
- All invalidation is manual (Section 7, style 1) — this makes centralized shared keys (Section 6) even more important, since nothing auto-invalidates.
- Authorization moves fully into your endpoint handlers; there is no policy-enforced model endpoint.
- Everything else applies unchanged: the singleton QueryClient, the fetch wrapper, key tiers, and the standard loading/error components.

If you add a generator later, slot Section 5 in without restructuring: mount the model endpoint, set the hooks context at root, and migrate plain CRUD queries model-by-model — custom-endpoint queries stay as they are.

---

## 10. Simpler Environments (Web-Only, Cookie Auth)

The absolute-URL + injected-header machinery exists for clients that aren't served by the API host (native shells, static exports). If your app is a plain web app with cookie sessions:

- The fetch wrapper no longer needs to inject an `Authorization` header or resolve an absolute base URL — relative `/api/*` paths and `credentials: 'include'` (or same-origin defaults) suffice.
- The generated-hooks context can pass the default `fetch` and a relative endpoint: `setHooksContext({ fetch, endpoint: '/api/model' })`.
- Keep the wrapper anyway. Even when it's thin, it preserves the single seam for response-shape normalization and future cross-cutting concerns — retrofitting one into dozens of raw `fetch` call sites is much harder.

---

## 11. Conventions Summary

| Concern | Convention |
|---|---|
| Data-loading boundary | One explicit rule (here: all client-side via TanStack Query) |
| Reusable custom query | Option factory `get<Thing>QueryParams()` in one central module |
| One-off / param query | Inline `createQuery({ queryKey, queryFn })`, route param in the key |
| Model CRUD | Generated hooks (`useFindMany*`, `useUpdate*`, …) if available |
| HTTP transport | Always via one `api` fetch wrapper; endpoints from a `URLS` constants object |
| Keys | Central constants for shared keys; literals for local; generator helper for generated hooks |
| Provider | One `QueryClientProvider` at root with the module-singleton `queryClient` |
| Generated-hooks wiring | `setHooksContext({ fetch, endpoint })` once at root |
| Pending/error | Shared `LoadingSpinner` + `RefetchQueryButton` components everywhere |
| Invalidate after write | `invalidateQueries` with the shared key (+ `refetch()` for on-screen data) |
| Logout | `queryClient.clear()` so caches never cross user sessions |

---

## 12. Checklist for a New Data Need

1. Decide the layer: plain model CRUD → generated hook; anything bespoke → custom endpoint + `createQuery`.
2. For a custom endpoint: add the route to the `URLS` constants object; never inline the path string.
3. Reused from multiple places? Add a `get<Thing>QueryParams()` factory and a shared key constant. Page-local? Inline the query with a literal key, including any route param.
4. Make the `queryFn` go through the `api` wrapper and throw on `!response.ok` with the server's message.
5. Render the three states with the shared `LoadingSpinner` / error-retry components — no custom pending/error UI.
6. For every mutation, list the queries whose data it changes and invalidate each one (skip same-model invalidation only if a generated hook handles it).
7. If the data must drive side effects rather than a template, subscribe with the `withData`-style guard instead of ad-hoc undefined checks.
