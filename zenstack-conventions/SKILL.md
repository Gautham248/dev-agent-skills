---
name: zenstack-conventions
description: >
  ZenStack conventions grounded in the official 2.x documentation
  (zenstack.dev/docs/2.x), fetched and read directly while writing this
  skill — ZModel language basics, the enhanced Prisma Client's secure-by-
  default behavior, access-policy evaluation order, the post-create-check
  privilege-escalation pitfall, auth()/current-user semantics, relation
  and collection-predicate syntax, post-update checks, field-level
  policies, the check() DRY helper, data validation, and error handling
  (P2004/meta.reason). Deliberately targets ZenStack 2.x (built on top of
  Prisma, `schema.zmodel` generating `prisma/schema.prisma`) — v3.x is a
  from-scratch rewrite with Prisma removed at runtime and does not share
  this guidance; check which version a project is on before applying this.
  Use whenever writing or reviewing a `.zmodel` file, an `enhance()` call,
  or any code path that depends on ZenStack's access-policy enforcement.
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

# ZenStack conventions

ZenStack's headline feature — access policies declared in the schema — is
also its sharpest edge: the rules read like plain boolean logic, but
several of them evaluate at a different point in time than the reading
eye assumes (a "create" rule checks the row *after* it exists, an
"update" rule checks the row *before* the update unless `future()` says
otherwise). Most of the real bugs in ZenStack schemas come from that
mismatch, not from typos in the expression syntax. This skill is organized
around making that mismatch visible.

**Version note**: this skill targets **ZenStack 2.x**, which extends
Prisma — `schema.zmodel` compiles to `prisma/schema.prisma`, and Prisma
remains the runtime engine (`enhance()` wraps a real `PrismaClient`). If a
project's `prisma/schema.prisma` is hand-written rather than generated (or
`prisma/` doesn't exist at all alongside `schema.zmodel`), it may be on
**3.x**, a from-scratch rewrite that drops Prisma as a runtime dependency
in favor of Kysely — a different runtime architecture this skill doesn't
cover. Check the `zenstack`/`@zenstackhq/*` package major version before
applying anything here.

## ZModel language basics

- ZModel is a **superset of Prisma Schema Language** — every valid Prisma
  schema is valid ZModel. The `zenstack` CLI compiles it to a real
  `prisma/schema.prisma`, which is then fed to the ordinary `prisma` CLI.
  `datasource`/`generator` blocks pass through unchanged.
- **`import "file"`** splits a schema across multiple files (no
  extension in the import string); the CLI merges them before compiling.
  A large multi-model schema split into per-domain files is normal, not a
  sign something's misconfigured.
- **`abstract model Base { ... } ` + `extends`** shares fields (and
  attributes, including access policies) across models — a common pattern
  for `id`/`createdAt`/`updatedAt` plus a baseline policy every model
  should inherit. Check that a model extending a base isn't silently
  duplicating a policy the base already grants.
- **Custom attributes are model-level (`@@name`) or field-level
  (`@name`)** — this is the same `@@` vs `@` convention Prisma itself
  uses, not a ZenStack-specific quirk. `@@allow`/`@@deny` are model-level;
  `@allow`/`@deny` are field-level and are a genuinely different mechanism
  (see Field-level policies below), not just a narrower spelling of the
  same thing.
- **Plugins** (`plugin name { provider = "..." }`) are how nearly every
  ZenStack feature — including the CRUD API and frontend hook generation —
  is actually implemented. A schema with no `plugin` blocks still gets the
  core ORM enhancement; CRUD API generation, tRPC routers, OpenAPI specs,
  and query hooks are all opt-in via a plugin declaration, not automatic.
- `///` triple-slash comments are documentation — they surface as IDE hover
  tooltips and pass through into the generated Prisma schema. Plain `//`
  and `/* */` don't.

## Secure by default — what `enhance()` actually changes

```ts
import { PrismaClient } from '@prisma/client';
import { enhance } from '@zenstackhq/runtime';

const prisma = new PrismaClient();
const db = enhance(prisma, { user: getSessionUser() });
```

- **With an enhanced client, every CRUD operation is denied unless a
  policy explicitly opens it up** — a brand-new model with zero `@@allow`
  rules isn't "unrestricted by accident," it's **completely inaccessible**
  through the enhanced client (reads silently return empty, writes throw).
  If a query against an enhanced client returns nothing where the raw
  Prisma client would return rows, missing/incomplete policies are the
  first thing to check, not a query bug.
- **Creating an enhanced client is cheap** — no new DB connection, safe to
  create one per request. Don't treat it as something to cache/singleton
  for performance reasons; that would also risk pinning the wrong user's
  identity across requests.
- **Raw SQL (`$queryRaw`, `$executeRaw`) is not enhanced at all** — no
  policy enforcement, no `@omit`, no validation. Code that falls back to
  raw SQL "just for this one query" on a model with sensitive fields or
  policies has silently opted out of every protection ZenStack provides
  for that query, not just skipped an optimization.
- **No sequential-operations transactions** — `prisma.$transaction([op1,
  op2])` (the array form) isn't supported on an enhanced client; use the
  interactive form (`prisma.$transaction(async (tx) => { ... })`) or fall
  back to the raw client for that specific transaction.
- Both the original and an enhanced client can coexist in the same
  codebase deliberately — an admin/background-job code path using the raw
  client for unrestricted access, alongside user-facing code paths using
  the enhanced one. That split should be intentional and reviewable, not
  something that crept in because enhance() was inconvenient somewhere.

## Access policy evaluation — order and what each operation covers

- **Evaluation order, always**: any matching `@@deny` → denied. Else any
  matching `@@allow` → allowed. Else → denied. **Declaration order in the
  schema doesn't matter** — don't read policies top-to-bottom expecting
  first-match-wins semantics.
- The four operations map onto real Prisma Client methods more broadly
  than their names suggest: **create** covers `create`, `createMany`,
  `upsert`, and nested `create`/`createMany`/`connectOrCreate`. **read**
  covers every read method (`findMany`, `findFirst`, `count`, `aggregate`,
  `groupBy`, ...) *and* gates whether a `create`/`update`/`delete`'s
  returned value can be read back. **update** covers `update`,
  `updateMany`, `upsert`, and nested `update`/`set`/`connect`/
  `connectOrCreate`/`disconnect`. **delete** covers `delete`,
  `deleteMany`, and nested `delete`.
- **Reads and bulk writes fail by filtering, not by throwing** —
  `findMany` returns fewer rows, `updateMany`/`deleteMany` touch fewer
  rows, with no error raised for the excluded ones. **Single-row writes
  fail by throwing** (`P2004`, see Error handling below). Don't write
  error-handling code that expects a rejected `create` to look like a
  filtered `findMany` or vice versa — they behave differently on purpose.
- **A write can imply a read, and can fail on it after the write already
  landed.** `create`'s returned value is subject to the "read" policy —
  if it's not readable to the caller, the call throws even though the row
  was persisted. Don't assume a caught error from a `create` call means
  nothing happened; check whether the row exists before retrying the same
  create.
- **A non-nullable to-one relation that isn't readable filters out the
  *parent* record, not just the relation field.** `db.post.findMany({
  include: { author: true } })` drops a `Post` entirely if its `author`
  isn't readable to the caller — it does not return the post with
  `author: null`, because the field is non-optional in the generated
  TypeScript type. If a nested-include query is returning fewer parent
  rows than expected, check the *related* model's read policy, not the
  parent's.
- **Relation manipulation checks the side whose foreign key actually
  changes**, not both sides symmetrically. Connecting a `Post` to a `User`
  via `user.update({ data: { posts: { connect: { id } } } })` updates
  `Post.authorId`, so `Post`'s "update" policy is what's checked — `User`'s
  policies are irrelevant to this call. The one exception is Prisma's
  *implicit* many-to-many relation (no explicit join model with foreign
  keys) — because there's no single side holding the foreign key, both
  sides' "update" policies apply.

## The "create" rule is a post-create check — the sharpest edge here

A `@@allow('create', ...)` condition is evaluated **after** the row exists
(inside a transaction that rolls back if the check fails), not before. The
practical effect: **a condition that only checks the state a new row would
have in can be satisfied by the very row being created**, which is a real
privilege-escalation pattern, not a theoretical one. Given:

```zmodel
model SpaceUser {
    space  Space
    user   User
    role   String   // "ADMIN" or "MEMBER"

    // WRONG: lets a user add THEMSELVES as ADMIN to any space --
    // after the row is created, it satisfies its own condition
    @@allow('create', space.members?[user == auth() && role == 'ADMIN'])
}
```

Any authenticated user can call this create with `user: auth(), role:
'ADMIN'` — there was no existing ADMIN membership before the call, but the
row *being created* makes the condition true once it exists, and
post-create evaluation checks exactly that state. The fix is splitting the
self-referential case out explicitly:

```zmodel
// space owner can add anyone (including themselves)
@@allow('create', space.owner == auth())

// space admin can add anyone EXCEPT themselves
@@allow('create', auth() != user && space.members?[user == auth() && role == 'ADMIN'])
```

**When reviewing any `@@allow('create', ...)` rule that references the
model's own to-be-created fields inside a relation-based condition** (not
just plain literal field comparisons), ask explicitly: does this condition
become trivially true once the row being created is folded into the
relation it's checking? If yes, that's the bug pattern above.

## `auth()` and the current user

- By default, the model literally named `User` is the auth model; a
  differently-named model needs `@@auth` to take that role. If there's no
  database-backed user table at all (an external auth provider like Clerk,
  Supabase Auth, or a service like Better Auth used purely for
  authentication), define a `type` (not a `model`) to give `auth()` a
  shape without a backing table.
- **ZenStack never fetches fields for `auth()` on its own.** Whatever
  fields a policy references via `auth()` — including relation traversals
  like `auth().role.permissions` — must be present on the object passed
  into `enhance(prisma, { user })`. A policy referencing `auth().role`
  while `enhance()` is only ever called with `{ user: { id } }` is a
  latent bug: the field reads as `undefined` and the policy silently
  evaluates in whatever way `undefined` happens to compare, not "fetch it
  for me." When reviewing a schema change that adds an `auth().<field>`
  reference, check the corresponding `enhance()` call site actually
  supplies that field (fetched with the raw client beforehand, if needed).
- `auth() == null` is the anonymous-user check (no `user` passed to
  `enhance()`); `auth() != null` gates "must be logged in."
- `auth() == someRelationField` compares by the auth model's id field —
  equivalent to `auth().id == someRelationField.id` — not a deep object
  comparison.
- `@default(auth().id)` on a foreign-key field removes the need to
  explicitly `connect` that relation on every create call, and pairs
  naturally with a `@@allow('create', owner == auth())`-style policy: the
  default fills in the right value, the policy stops anyone from
  overriding it to someone else's id.

## Relations and collection predicates

- To-one relations: reference the field directly, chain with `.` for deep
  traversal (`list.space.members`) — no depth limit.
- To-many relations use **collection predicate expressions**, not a
  general query language:
  ```text
  relation?[condition]   // ANY member satisfies condition
  relation![condition]   // ALL members satisfy condition
  relation^[condition]   // NONE satisfy condition
  ```
  The expression must start with an actual to-many *relation* field — it
  doesn't work on a plain scalar array (`String[]`); reach for a helper
  function for those instead.

## Post-update checks (`future()`)

- An `@@allow('update', ...)`/`@@deny('update', ...)` condition checks the
  **pre-update** state by default. `future()` gives access to the
  **post-update** state (`future().revision > revision` to require a
  revision counter only increase, for instance).
- **Mixing a `future()` clause with a non-`future()` clause in the same
  model promotes the *entire* set of that model's update rules to
  post-update evaluation** — ZenStack detects any `future()` usage on a
  model and postpones all of its update-rule evaluation accordingly. This
  isn't per-rule; it's model-wide once any rule needs it.
- `future()` is **not available in field-level policies** (`@allow`/
  `@deny`) — a field-level "don't let this field be changed" rule has to
  be expressed as a model-level post-update `@@deny`, or via a plain
  `@deny('update', true)` on the field if the field should simply never be
  updatable.

## Field-level policies — the opposite default from model-level

- Field-level (`@allow`/`@deny`, single `@`) policies only support `read`,
  `update`, and `all` — not `create`/`delete`, which aren't meaningful
  per-field.
- **Field-level access is allow-by-default** — a field with no `@allow`/
  `@deny` attribute is accessible as long as the model itself is
  accessible. This is the *opposite* default from model-level policy
  (deny-by-default). Don't assume "no field-level policy" means "locked
  down" — it means "governed only by the model-level policy."
- A denied "read" silently drops the field from the result; a denied
  "update" throws. Same asymmetry as model-level read-vs-write behavior,
  at the field granularity.
- **To read or update a field at all, the model-level policy must also
  pass first** — a field-level `@allow` doesn't bypass a model-level
  `@@deny` unless it's explicitly marked as an override with a third
  argument: `@allow('update', auth().role == 'EDITOR', true)`. Without
  that `true`, a field-level allow is additional narrowing on top of the
  model-level policy, not an escape hatch from it.

## Keeping policies DRY: `check()`

When a child model's access is really "can you access the parent," delegate
instead of re-deriving the same relation-traversal condition:

```zmodel
model Todo {
    list List @relation(...)
    // full access if the parent List is readable -- not a
    // separately-maintained copy of List's own policy logic
    @@allow('all', check(list, 'read'))
}
```

If `List`'s policy changes later, `Todo` follows automatically. Treat a
child model whose policy expression closely mirrors its parent's as a
`check()` candidate during review, not as acceptable duplication.

## Data validation — a distinct mechanism from access policy

- `@email`, `@url`, `@length(min:, max:)`, `@regex('...')`, `@gt`/`@lt`,
  and friends are **field-level validation** attributes; `@@validate(expr,
  "message")` is model-level, for rules spanning multiple fields.
- Validation is evaluated **entirely on the application side** (unlike
  access policies, which are mostly injected into the SQL as `where`
  clauses) and **only applies to `create`/`update`**, never `read`/
  `delete`, and **only to plain fields, never relations**.
- A `@regex` pattern is a plain string, so escape sequences need double
  escaping (`\\d`, `\\w`), not the single escaping you'd use in a real
  regex literal.
- Validation failures use a distinct error reason
  (`DATA_VALIDATION_VIOLATION`) from access-policy failures — see below —
  so don't write catch logic that treats every `P2004` as an authorization
  problem.

## Error handling

Policy and validation failures both surface as a real
`PrismaClientKnownRequestError` with **code `P2004`**, distinguished by
`error.meta.reason`:

- `ACCESS_POLICY_VIOLATION` — the operation itself was rejected by policy.
- `RESULT_NOT_READABLE` — the operation succeeded, but the result couldn't
  be read back (the "write implies a read" case above).
- `DATA_VALIDATION_VIOLATION` — a `@@validate`/validation-attribute
  failure; `error.meta.zodErrors` carries the underlying Zod error detail.

Everything else (a genuine Prisma error unrelated to ZenStack) passes
through unchanged, since the enhanced client is a transparent proxy — the
normal Prisma error-handling reference applies for anything that isn't
`P2004` with one of these three reasons.

## When conventions here conflict with other skills

`coding-standards-database` states the general principle that
authorization belongs in the schema, illustrated with ZenStack syntax as
one example among possible tools — this skill is the deeper, ZenStack-
specific layer underneath that principle, not a competing source of truth.
If a project's auth model integrates with Better Auth or another external
identity provider, see `better-auth-conventions` for that side of the
integration; this skill covers only how `auth()` and the `type`-vs-`model`
choice work on the ZenStack side of that boundary.

## If something goes wrong

Before improvising a fix or contradicting something stated here, check
`references/edge-cases.md` — this may already be a documented, resolved
question. If it's genuinely new once you're done, follow the
self-improvement protocol above and add it there.
