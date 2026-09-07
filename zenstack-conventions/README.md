# zenstack-conventions

An Agent Skill that gives a coding agent a sane baseline for working with
**ZenStack** — grounded in the official 2.x documentation
(`zenstack.dev/docs/2.x`), fetched and read directly while writing this
skill, not recalled from training data alone.

It covers ZModel language basics, the enhanced Prisma Client's
secure-by-default behavior (and its sharp edges — raw SQL bypassing every
protection, no sequential transactions), access-policy evaluation order,
and — the centerpiece — the **post-create-check privilege-escalation
pattern**: a `@@allow('create', ...)` condition is evaluated *after* the
row exists, so a condition that only checks relation state can be
satisfied by the very row being created. It also covers `auth()`/current-
user semantics (including the "ZenStack never auto-fetches fields for
`auth()`" gotcha), relation/collection-predicate syntax, post-update
checks (`future()`), field-level policies' allow-by-default (the *opposite*
default from model-level), the `check()` DRY helper, data validation, and
`P2004`/`meta.reason` error handling.

## Version note

This skill targets **ZenStack 2.x** specifically — built on top of Prisma,
where `schema.zmodel` compiles to a real `prisma/schema.prisma` and Prisma
remains the runtime engine. **ZenStack 3.x is a from-scratch rewrite** that
removes Prisma as a runtime dependency (replaced with Kysely) and doesn't
share this guidance. Check which major version a project is on — a
hand-written `prisma/schema.prisma`, or no `prisma/` directory at all
alongside `schema.zmodel`, is a signal it may be on 3.x — before applying
anything here.

## Who it's for

Anyone writing or reviewing a `.zmodel` schema, an `enhance()` call, or any
application code whose correctness depends on ZenStack's access-policy
enforcement actually doing what it looks like it does.

## What it is

A single `SKILL.md` of guidance — no script.

## Install

Follows the open [Agent Skills](https://agentskills.io) layout. Drop the
`zenstack-conventions/` folder into your agent's skills directory, same as
any other skill in this repo — see the root `README.md` for per-agent
paths.

## Usage

> Review this schema change — does this new `@@allow('create', ...)` rule have the post-create-check problem?

> Does this policy reference `auth().role` — is that field actually being fetched before `enhance()` is called?

> Should this be a `@@validate` rule or an access policy?

## License

See the repository this skill ships in.
