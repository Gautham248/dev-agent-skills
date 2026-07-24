---
name: coding-standards-frontend
description: >
  Company frontend conventions for components, client state, and styling --
  the three-tier component structure (ui/elements/feature folders),
  data-driven modals and drawers, the store-factory pattern, utility-first
  styling, the shared api HTTP wrapper (raw fetch is banned), and centralized
  data-testid conventions. Use when building or modifying a page, component,
  modal, drawer, or client-side store. Does NOT cover server-state
  fetching/caching -- see coding-standards-tanstack-query -- or e2e tests --
  see coding-standards-e2e.
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

# Coding Standards -- Frontend

Universal rules were already applied by the coding-standards dispatcher before this skill was invoked. Rules name categories, not tools
(e.g. Tailwind, Svelte) -- apply the project's equivalent.

## Base rules
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

## Deeper reference: directory placement and state management
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

