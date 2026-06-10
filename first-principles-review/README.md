# first-principles-review

An Agent Skill for the review that conventions checklists can't do: it questions
whether a pull request is the **right change at all**, before anyone argues about
naming.

Most automated and checklist reviews answer *"is this written correctly?"* This
one answers *"should this exist, is the diagnosis right, and what breaks
elsewhere?"* — by enumerating every assumption the author made, tracing real
code paths to try to break each one, and walking a priority-ordered set of
questions (framing → minimal change → broken invariants → test rigor → rollback
→ alternatives → lock-in).

## Who it's for

Engineers and coding agents reviewing pull requests in any language or stack. It
is framework-agnostic — the examples reference generic concepts (ORM joins,
row-level policies, data-loading hooks, caches) rather than a specific
framework. Pair it with whatever conventions/style review you already run.

## What it is

A single `SKILL.md` of review methodology — no script, nothing to run. Point your
agent at it with a diff or PR and ask for a critical review; it produces a
bucketed (Blocker / Should / Nit) findings list with quoted lines and concrete
alternatives.

## Install

Follows the open [Agent Skills](https://agentskills.io) layout. Drop the
`first-principles-review/` folder into your agent's skills directory.

**Portable (recommended for repos shared across agents):**

```bash
mkdir -p .agents/skills
cp -R first-principles-review .agents/skills/
```

**Per-agent personal/project paths:**

| Agent | Personal | Project |
|---|---|---|
| Claude Code | `~/.claude/skills/first-principles-review/` | `.claude/skills/first-principles-review/` |
| Cursor | native global path | `.agents/skills/first-principles-review/` or `.cursor/skills/first-principles-review/` |
| OpenCode | `~/.config/opencode/skills/first-principles-review/` | `.agents/skills/first-principles-review/` or `.opencode/skills/first-principles-review/` |
| Codex | `~/.codex/skills/first-principles-review/` | `.agents/skills/first-principles-review/` |
| Gemini CLI | installer-managed | `.agents/skills/first-principles-review/` |

Discovery, metadata, and invocation UI differ between these agents; this skill
relies only on the cross-agent `name` + `description` frontmatter, so the
guidance loads the same way, but feature depth is not identical across platforms.

> Built and verified against **Claude Code**. Other agents implementing the
> Agent Skills format should load it too, but are not independently tested here.

## Usage

> Give this PR a first-principles review — tear it apart.

> What would the toughest reviewer say about this diff? Question the diagnosis,
> not just the style.

> This PR passed CI and the convention check. What are we missing?

## License

See the repository this skill ships in.
