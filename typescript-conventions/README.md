# typescript-conventions

An Agent Skill that gives a coding agent a sane **TypeScript convention
baseline** — the kind a thoughtful team converges on — so generated and reviewed
code favors types that describe reality over casts that silence the compiler.

It covers validation at boundaries, `satisfies` vs casts, enum handling without
`as`, import hygiene (including the server-module-in-client-bundle trap), and
naming. A couple of sections are openly opinionated (`interface` over `type`,
constant casing) and are labeled so you can adopt or drop them.

## Who it's for

Anyone writing or reviewing TypeScript — application code, API clients,
framework component scripts, or tests that parse JSON. It assumes nothing beyond
TypeScript and references a schema validator (Zod) only as an example.

## What it is

A single `SKILL.md` of guidance — no script. Point your agent at it while it
writes or reviews `.ts`; it will reach for parse-don't-cast, inference over
redundant annotations, and boundary validation instead of `as`.

## A note on "conventions"

Conventions are project choices, not universal law. This skill marks the
broadly-agreed practices (validate external data, don't cast `res.json()`, prefer
inference) separately from the opinionated ones (`interface` over `type`,
camelCase constants). Treat the opinionated parts as defaults to confirm against
your own project's `eslint.config.*`, not as rules handed down from outside.

## Install

Follows the open [Agent Skills](https://agentskills.io) layout. Drop the
`typescript-conventions/` folder into your agent's skills directory.

**Portable (recommended for repos shared across agents):**

```bash
mkdir -p .agents/skills
cp -R typescript-conventions .agents/skills/
```

**Per-agent personal/project paths:**

| Agent | Personal | Project |
|---|---|---|
| Claude Code | `~/.claude/skills/typescript-conventions/` | `.claude/skills/typescript-conventions/` |
| Cursor | native global path | `.agents/skills/typescript-conventions/` or `.cursor/skills/typescript-conventions/` |
| OpenCode | `~/.config/opencode/skills/typescript-conventions/` | `.agents/skills/typescript-conventions/` or `.opencode/skills/typescript-conventions/` |
| Codex | `~/.codex/skills/typescript-conventions/` | `.agents/skills/typescript-conventions/` |
| Gemini CLI | installer-managed | `.agents/skills/typescript-conventions/` |

Discovery, metadata, and invocation UI differ between these agents; this skill
relies only on the cross-agent `name` + `description` frontmatter. Feature depth
is not identical across platforms.

> Built and verified against **Claude Code**. Other agents implementing the
> Agent Skills format should load it too, but are not independently tested here.

## Usage

> Review this API client — are we casting anywhere we should be parsing?

> Write the request handler following our TypeScript conventions.

## License

See the repository this skill ships in.
