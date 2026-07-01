---
name: webapp-conventions
description: >
  Portable conventions for building features in a SvelteKit + Tailwind web app —
  the layer above raw framework knowledge: reuse before adding, centralize
  routes/constants, validate at boundaries, load auth-gated data on the server,
  parent-owns-the-gap spacing, resolve conditional classes with tailwind-merge,
  scale tokens over arbitrary values, log IDs not PII, accessible-by-default
  components, and centralized test IDs. Use whenever building or modifying a
  feature, and especially when picking a Tailwind color/spacing class. For a
  fill-in scaffold to document YOUR app's specific helpers and paths, see
  references/conventions-template.md.
---

<!-- BEGIN dev-agent-skills clarification protocol (managed by setup.sh -- do not edit this block manually; edit CLARIFICATION-PROTOCOL.md instead) -->
Before doing anything else in this skill, read and follow the clarification protocol at:
../CLARIFICATION-PROTOCOL.md
<!-- END dev-agent-skills clarification protocol -->

<!-- BEGIN dev-agent-skills self-improvement protocol (managed by setup.sh -- do not edit this block manually; edit SELF-IMPROVEMENT-PROTOCOL.md instead) -->
While using this skill, and especially when you finish, read and follow the self-improvement protocol at:
../SELF-IMPROVEMENT-PROTOCOL.md
(Append real edge cases to this skill's own references/edge-cases.md — create it if missing. See the protocol file for what qualifies.)
<!-- END dev-agent-skills self-improvement protocol -->

# Web app conventions

The layer above the framework: the habits that make a SvelteKit + Tailwind
codebase stay legible and cheap to change. These are **portable principles** —
language- and framework-shaped but not tied to any one app's helper names. To
turn them into a concrete conventions doc for your own project (with your real
module names filled in), use
[`references/conventions-template.md`](./references/conventions-template.md).

## Reuse before adding

- Before introducing a new helper, regex, URL builder, type, constant, schema,
  debounce, or UI variant, search the nearby package for an existing one.
- **Extract, don't paste-and-trim.** When you need an existing flow somewhere
  new, pull the shared logic into one module and update *both* call sites in the
  same change. A "trimmed copy alongside the original" is two copies that drift
  on the next change. Replacing inline logic with a one-line call to the
  extracted helper is part of the work, not a follow-up.
- Keep route-specific code colocated with the route; promote to a shared location
  only when a second consumer actually needs it.
- Don't abstract when the similarity is incidental or the call sites belong to
  different domains. Two repetitions is fine; three is a smell.

## Centralize routes, params, and cross-cutting constants

Hand-rolled string literals are where drift hides. Route paths, query-param keys,
cache-invalidation keys, well-known event names, and external links each want a
**single source of truth**:

- App route paths come from one routes module, not inline templates like
  `` `/app/projects/${id}` ``.
- Producer and consumer of a query param reference the *same* key constant, so an
  IDE rename keeps both sides in sync.
- Cache-invalidation keys are constants, never inline strings — a mismatched
  string silently breaks invalidation.
- External / mailto / docs links live in one place so analytics, tests, and docs
  can find every reference.

A literal earns inline status only while it's truly local and one-shot; the
moment a second call site needs it, it belongs in the shared module.

## Validate at boundaries

- Validate request bodies and external data with a schema validator at the
  boundary; make schemas strict so unexpected keys are caught, not silently
  dropped.
- In API tests, **parse** the response against a schema rather than casting it —
  the contract drift a parse catches is the whole point of the test.

## Data loading and auth

- **Fetch auth-gated data on the server** (the framework's server `load` layer),
  never in a client mount hook — that breaks SSR and auth gating.
- Await server responses before updating the UI. **Skip optimistic updates**
  unless you have a concrete reason; they add a reconciliation path that is
  rarely worth it.
- Default to **offset pagination** (`skip`/`take`, `offset`/`limit`) unless a
  use case genuinely needs cursors.
- If you layer a client query cache (e.g. TanStack Query) over framework loads,
  define each query's key in one place and reference it everywhere — never
  hardcode key literals at call sites — and bridge framework-invalidation →
  cache-invalidation in one location, not per call site.

## Errors, messages, and logging

- Surface user-facing errors through the framework's typed error / redirect /
  form-fail mechanisms, not ad-hoc inline alert boxes.
- Route user messages through **one toast/notification helper** for
  error/success/warning/info — consistency beats bespoke inline sections.
- **Never `console.log`** — use a real logger (server logger on the server,
  client logger on the client). Enforce it with the `no-console` lint rule.
- **Log IDs, never PII.** User/document/org IDs are fine; names, emails, and any
  user-supplied content are not.

## Accessibility baseline

- Use semantic color tokens over hardcoded hex so light/dark mode and contrast
  are handled by the design system.
- Every interactive element needs an accessible label; icon-only buttons require
  `aria-label`. No exceptions.
- Keyboard navigation must work for anything interactive, with a logical tab
  order.

## Styling

- **Token names are conventions, not guarantees of their English meaning.** In a
  themed app a `primary` scale might be teal, not your brand color. Confirm the
  actual value in your theme config before using a token by name — a lint rule
  can't catch a wrong-but-existing token.
- **Prefer named scale classes over arbitrary values.** `p-4` over `p-[16px]`,
  `max-w-3xl` over `max-w-[768px]`, `text-sm` over `text-[14px]`. Reserve
  arbitrary syntax for genuinely off-scale values; extend the config for ones
  that recur.
- **Resolve conditional classes with a `cn()` helper** (clsx + `tailwind-merge`)
  rather than interpolating ternaries into the class string. `cn()` both stitches
  conditional arrays and resolves conflicting utilities (so a `selected`
  `bg-accent` correctly beats a `hover:bg-accent/50`). Static class strings
  without conditionals don't need it.
  ```svelte
  <!-- No: a ternary inside the class string can ship classes that defeat each other -->
  <div class="rounded-md py-1.5 {selected ? 'bg-accent' : 'hover:bg-accent/50'}">

  <!-- Yes: cn() resolves the collision -->
  <div class={cn('rounded-md py-1.5', selected ? 'bg-accent' : 'hover:bg-accent/50')}>
  ```
- **Don't theme a component by injecting a `class` string** where it exposes a
  typed `variant`. Use the variant; reserve `class` for layout-only utilities.
- **Globalize repeated utility CSS.** If the same custom class appears in two or
  more components, lift it to the global stylesheet instead of duplicating
  `<style>` blocks.
- **No `!important`.** It defeats `tailwind-merge` (so `cn()` can't resolve
  conflicts) and every future variant override, and is almost always a symptom of
  a fixable cause (source order, missing variant, wrong token). If you must win
  against an unchangeable third-party class, scope a `:where()` selector or a CSS
  layer instead, with a one-line comment.

## Spacing and layout

Inter-sibling spacing belongs on the **parent as `gap`**; inside a child, prefer
**symmetric padding**. Both keep layout legible and refactors cheap: one place to
change a gap, one number per axis, no compensating offsets stacked on each other.

- Don't reach for `mt-N` / `pt-N` / `mb-N` / `space-y-N` on a child whose only job
  is to space itself from siblings — that's what `gap` on the parent is for.
- No `first:pt-N` / `last:pb-N` edge-case offsets in a flex/grid layout; `gap`
  plus the parent's own padding handles the edges.
- Inside a child, prefer `p-2` over `pl-2 pr-2 pt-2 pb-2`, and `px-2 py-4` over
  `pl-1 pr-2 py-4`. If the math forces asymmetry you're usually fixing a symptom
  — move the spacing onto the responsible element instead.
- When translating a design (e.g. a Figma node), mirror its structure verbatim
  before adapting: a single padded, `gap`-ed wrapper around bare flex children
  needs the least padding arithmetic and reviews easiest.

## Test IDs

Reference test IDs from a typed registry on **both** sides — `data-testid` in the
component and the selector in the test — never string or template literals. A
typed registry keeps them rename-safe and greppable, and a lint rule can forbid
the raw-string form.

## Lint rule before written convention

Deterministic, AST-checkable patterns (banned globals, required helpers,
disallowed casts) belong in a **custom lint rule**, not a line in a conventions
doc. Reserve written guidance for the judgment calls. When you catch yourself
adding a "don't do X" line, ask first whether a lint rule can enforce it.
