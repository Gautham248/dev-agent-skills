# The learning loop

## The only honest signal

A merged PR teaches nothing — merges happen for reasons unrelated to review
quality. The one reliable signal is **what the human cut from the draft
before it was posted**, which is why Step 7's confirmation gate is also the
learning capture point rather than a separate mechanism.

A cut finding means one of three things, and conflating them is how a review
agent degrades:

| The human cut it because… | Destination |
|---|---|
| The skill itself misbehaved (bad anchor, wrong lens, crashed) | `review-pr/references/edge-cases.md` |
| It is not a rule in *this repo* | that repo's `.dev-agent/review-conventions.md` |
| It is not a rule *anywhere* — the standard is wrong | a PR against the relevant standards skill |
| It was a one-off judgment call | nothing. Not every cut is a rule. |

## Why repo conventions live in the target repo

A rule like "in this repo the Supabase client is never instantiated per
component" is true of one codebase. Storing it in `dev-agent-skills` would
apply one project's convention to every project the agent reviews.

Storing it in the target repo at `.dev-agent/review-conventions.md` means it
is scoped naturally, versioned with the code it describes, and reviewed
through that repo's normal PR process — instead of requiring a round-trip PR
to the skills repo for every local preference.

This is deliberately **not** `references/edge-cases.md`. That file is for
skill mechanics failures, per the self-improvement protocol. Mixing project
conventions into it leaks one repo's rules into every review.

## Format

```markdown
## Promoted

### 2026-07-29 — Supabase client is a singleton
**Rule:** Never call `createClient()` outside
`src/integrations/supabase/client.ts`; import the exported `supabase`.
**Severity:** should
**Origin:** cut from review of #42 — "we already have a singleton"
**Confirmed by:** gautham248

## Candidates (not applied — 1 observation each)

### 2026-07-29 — Prefer `type` over `interface` in test files
**Observed:** cut from review of #44
**Observations:** 1
```

## Promotion is explicit, never automatic

A candidate is applied as a review rule only after the human confirms it, and
only once it has been observed more than once.

The failure mode this prevents is real and specific: one reviewer disputes
one finding at 2am, the agent records it as a rule, and from then on enforces
a single person's momentary preference on the whole team as if it were a
standard. Requiring corroboration plus explicit confirmation costs one
question and removes the entire class of problem.

The corollary: **a dispute is evidence about a rule, not proof of one.** The
agent proposes; the human decides. Same shape as everything else here — the
agent never merges, never approves, and never promotes.

## Asking well

Ask **once**, batched, only about cuts that look repeatable:

> Two of the cut findings look like they might be standing rules rather than
> one-offs:
> 1. `DocList.tsx:4` (per-component Supabase client) — is the singleton a
>    rule here, or was that fine in this case?
> 2. `app.css:3` (raw hex vs token) — rule, or not worth it for one value?
>
> Anything you say yes to gets staged as a candidate, not applied yet.

Do not ask about every cut. Most cuts mean "not worth a comment," which is
the skill being told to be more selective — that is Step 0's job, not a rule
to record.
