# Edge Cases — typescript-conventions

Accumulated real-world edge cases encountered while using this skill specifically.
Consult this file when something unexpected happens; append new entries per the
self-improvement protocol (dated, never rewriting or removing existing entries).

## 2026-09-01 — An `any`/`as` cast hides a field that doesn't exist on the model

What happened: A review passed `const u = session.user as any;` and reads of
`u.phoneNumber`, `u.role`, and `u.organizationId`. The cast read as a harmless
typing shortcut, but it was masking real bugs: the schema field is `phone` (not
`phoneNumber`), and `role`/`organizationId` don't exist on the model at all — so
all three reads were always `undefined` and coerced to `null`. The skill says
"don't use `any` or broad `as` casts for persisted values," but it had no rule
for the specific case where the cast is the *only* thing keeping a nonexistent or
misnamed field from failing to compile.

What I did: Treat an `as any` / `: any` on a model value (a DB row, a session
user, an API response) as a trigger to verify that every property read off it
actually exists on the underlying model — and is spelled to match it — before
accepting the cast. A cast silences the compiler; it is not evidence the field
exists. Fix the field name or drop the phantom field, and type the value honestly
instead of widening it.

## 2026-09-01 — A cast with a `||` fallback masks a missing enum check

What happened: `type: (data.type as any) || "other"` (and the same shape for a
`reminderRule` enum column) passed review because the `|| "other"` fallback
looks like validation — it reads as "narrow to a valid value, else default". In
reality the cast to `any` is what lets the raw string reach the Prisma enum
column; the fallback only fires on `undefined`/`null`, not on an out-of-range
string like `"banana"`, which flows straight to the DB. The skill's
"Enum-like values" section forbids `value as Enum`, but this concrete idiom is a
cast to `any` (not to the enum) with a fallback that disguises it, so the
existing rule didn't fire.

What I did: Treat `(x as any) || fallback` (and `x ? (x as any) : fallback`) on
an enum/JSON column as a flag, not as validation. Narrow the raw value against
the enum with a type predicate (`value is T`) and return a safe default for the
out-of-range case, centralized in one helper, rather than casting to `any`.
