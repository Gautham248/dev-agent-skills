# webapp-conventions

An Agent Skill that teaches a coding agent the **layer above the framework** —
the habits that keep a SvelteKit + Tailwind web app legible and cheap to change,
which raw framework docs don't cover.

It ships in **two layers**:

1. **`SKILL.md` — portable principles.** Reuse before adding, centralize
   routes/constants, validate at boundaries, load auth-gated data on the server,
   parent-owns-the-gap spacing, resolve conditional classes with `tailwind-merge`,
   scale tokens over arbitrary values, log IDs not PII, accessible-by-default
   components, centralized test IDs, and "lint rule before written convention."
   No in-house names — these apply to any app on this stack.
2. **`references/conventions-template.md` — a fill-in scaffold.** The full
   section structure (forms, data loading, errors, auth, components, menus,
   styling, spacing, testing, banned patterns) with `<placeholders>` where your
   app's real helper and module names go. Copy it, fill it in, and you have a
   concrete conventions doc for your own codebase.

Use layer 1 to *write code well today*; use layer 2 to *author your team's own
conventions doc*.

## Who it's for

Teams and agents building features in a **SvelteKit + Tailwind** web app
(typically with an ORM and a schema validator). The principles are
framework-shaped; the template is explicitly meant to be adapted to your stack.

## What it is

Guidance only — no script. The principles in `SKILL.md` are self-contained; the
template is a starting point you edit, not something the agent executes.

```
webapp-conventions/
├── SKILL.md                            # portable principles (apply as-is)
└── references/
    └── conventions-template.md         # fill-in scaffold for your app's specifics
```

## Install

Follows the open [Agent Skills](https://agentskills.io) layout. Drop the
`webapp-conventions/` folder into your agent's skills directory.

**Portable (recommended for repos shared across agents):**

```bash
mkdir -p .agents/skills
cp -R webapp-conventions .agents/skills/
```

**Per-agent personal/project paths:**

| Agent | Personal | Project |
|---|---|---|
| Claude Code | `~/.claude/skills/webapp-conventions/` | `.claude/skills/webapp-conventions/` |
| Cursor | native global path | `.agents/skills/webapp-conventions/` or `.cursor/skills/webapp-conventions/` |
| OpenCode | `~/.config/opencode/skills/webapp-conventions/` | `.agents/skills/webapp-conventions/` or `.opencode/skills/webapp-conventions/` |
| Codex | `~/.codex/skills/webapp-conventions/` | `.agents/skills/webapp-conventions/` |
| Gemini CLI | installer-managed | `.agents/skills/webapp-conventions/` |

Discovery, metadata, and invocation UI differ between these agents; this skill
relies only on the cross-agent `name` + `description` frontmatter. Feature depth
is not identical across platforms.

> Built and verified against **Claude Code**. Other agents implementing the
> Agent Skills format should load it too, but are not independently tested here.

## Usage

> Build this feature following our web app conventions.

> I'm picking spacing/color classes for this component — what do our conventions
> say?

> Help me turn the conventions template into a real doc for our codebase.

## License

See the repository this skill ships in.
