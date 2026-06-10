---
name: typescript-conventions
description: >
  A TypeScript convention baseline for typing, validation, enum handling,
  imports, and naming — favoring types that describe reality over casts that
  silence the compiler. Use whenever writing or reviewing .ts files, framework
  component script blocks, API clients, tests that parse JSON, or any code that
  handles external / user-controlled data. Some sections are universally good
  practice; a few are opinionated project choices, labeled as such — adopt or
  adapt them.
---

# TypeScript conventions

Prefer types that describe reality over casts that silence the compiler. The
*Validation*, *Enum-like values*, and *Imports* sections are broadly applicable;
*`interface` over `type`* and the constant-casing rule under *Naming* are
opinionated choices — flagged inline so you can take them or leave them.

## Validation over assertion

- Don't use `any` or broad `as` casts for request bodies, API responses, URL
  params, persisted values, enums, or constants.
- For external data, parse or validate **at the boundary** with a schema
  validator (e.g. [Zod](https://zod.dev)) or your project's validation helper.
- For object literals, prefer `satisfies` when you want compiler checking without
  widening or forcing a cast.
- For local values whose type is obvious from the initializer, rely on inference
  instead of repeating the annotation.
- In API tests, **parse** `await res.json()` with a schema — don't cast it. A
  cast tells the compiler what you wish were true; a parse tells the test what is
  actually true, and the contract drift it catches is the point of the test.

```ts
// No — asserts a shape the test never verifies
const body = (await res.json()) as { id: string; title: string };

// Yes — verifies it
const body = z.object({ id: z.string(), title: z.string() }).parse(await res.json());
```

## `interface` over `type` for object shapes (opinionated)

A common, lint-enforceable convention
(`@typescript-eslint/consistent-type-definitions: 'error'`): use `interface` for
object shapes — props, options, payloads, anything with members — and reserve
`type` for what `interface` can't express:

- unions (`type Mode = 'a' | 'b'`)
- tuples (`type Options = [Foo?]`)
- mapped / conditional / utility types
- aliases of primitives or function signatures

A tuple type that wraps a single object shape (e.g. a config rule's `[Options?]`)
should still extract that shape into an `interface` and refer to it from the
tuple alias. When the rule must be broken for a real reason (e.g. a type that has
to be a `type` for structural compatibility), disable it on that **single line**
with a comment explaining why — don't disable it broadly.

## Enum-like values

Validate user-controlled, persisted, or URL-derived enum-like values against the
enum and choose a safe fallback for the out-of-range case — don't assert
membership with a cast.

Avoid ad-hoc patterns such as:

- `Object.values(Enum).includes(value as Enum)`
- `value as Enum`
- duplicating enum-membership checks across route handlers

Prefer a small helper that takes a raw value and an enum and returns either a
valid member or a chosen fallback, so the validation logic lives in one place.

## Imports

- **Use your path alias for shared directories.** If your toolchain defines one
  (e.g. SvelteKit's `$lib`, or a `tsconfig` `paths` entry), use it instead of
  deep relative paths (`../../lib/foo`). The alias survives moves and reads the
  same from any depth.
- **No comments between import statements** — no section dividers (`// types`,
  `// hooks`), no inline notes. If one import genuinely needs justification, put
  the comment on the line immediately above *that* import, and reach for it
  rarely.
- **Dynamic imports: pull `.default` out on the next line** rather than chaining
  off the `await`. Some lint configs (`unicorn/no-await-expression-member`)
  reject `(await import('./Foo')).default`. Use the two-line form:
  ```ts
  const mod = await import('./Foo');
  const Foo = mod.default;
  ```
- **Don't runtime-import server/node-targeted modules into client-bundle code.**
  `import type { Foo } from 'some-orm'` is erased at build time and is safe; a
  *runtime* `import { FooEnum } from 'some-orm'` can leak a bare, browser-
  unresolvable specifier into your client bundle and break hydration silently.
  When you need enum *values* on the client, re-declare them in a client-safe
  module (a mapped-type shim keyed off the original enum stays in lockstep, so a
  missing member fails TypeScript).

## Naming

- `camelCase` for variables, functions, and behavior/event names.
- Use `ID`, not `Id`, for identifier suffixes in names you own.
- Keep behavior/event-name constants stable; check for typos before adding a new
  one.
- Match existing capitalization for repeated user-facing labels.
- **Constant casing (opinionated):** some projects deliberately use `camelCase`
  even for module-level constants and `as const` lookup tables (`FAVORITE_ROW_MENU`
  → `favoriteRowMenu`) rather than `UPPER_SNAKE_CASE`. This is a non-universal
  choice — many codebases reserve `UPPER_SNAKE_CASE` for true constants. Pick one
  and apply it consistently; if you adopt the camelCase style, an ESLint
  `naming-convention` rule can enforce it.

## Lint rule before written guidance

If a recurring TypeScript correction is deterministic and AST-checkable, prefer
encoding it as a custom ESLint rule over restating it in prose. Written guidance
like this is for the judgment cases and the *why* — not for what a linter can
enforce mechanically.
