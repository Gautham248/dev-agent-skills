# dev-agent-skills

A collection of agent skills for 10xMinds developers. Clone once, get all skills
in your AI IDE instantly.

## Skills

| Skill | What it does |
|---|---|
| [`fix-bug`](./fix-bug/) | Finds the relevant file via knowledge graph, fixes a bug, opens a PR |
| [`plan-feature`](./plan-feature/) | Produces a codebase-aware implementation plan for a new feature |
| [`first-principles-review`](./first-principles-review/) | Critical PR review that questions the premise, not just the style |
| [`sync-prs`](./sync-prs/) | Keeps your open PRs current: merges base, triages CI, surfaces review threads |
| [`typescript-conventions`](./typescript-conventions/) | TypeScript baseline: parse don't cast, validate at boundaries, inference over annotation |
| [`webapp-conventions`](./webapp-conventions/) | SvelteKit + Tailwind conventions: spacing, styling, data loading, auth, testing |
| [`eslint-rule-author`](./eslint-rule-author/) | Authors and tests custom ESLint rules with the typescript-eslint stack |

## Install

### Step 1 — Clone the repo

```bash
git clone https://github.com/YOUR-ORG/dev-agent-skills.git ~/dev-agent-skills
```

### Step 2 — Wire into your IDE

```bash
cd ~/dev-agent-skills && bash setup.sh
```

The setup script detects which AI IDEs you have installed and links the skills
directory automatically. Run it again after pulling new skills.

### Step 3 — Use a skill

In your AI IDE, from inside any repo:

```
/fix-bug
/plan-feature
/first-principles-review
/sync-prs
/typescript-conventions
/webapp-conventions
/eslint-rule-author
```

Or describe what you want naturally — the agent will load the right skill.

## Manual install (if setup.sh doesn't cover your IDE)

| Agent | Command |
|---|---|
| Claude Code | `mkdir -p ~/.claude/skills && ln -s ~/dev-agent-skills/* ~/.claude/skills/` |
| Hermes | Add `~/dev-agent-skills` to `external_dirs` in `~/.hermes/config.yaml` |
| Codex | `mkdir -p ~/.codex/skills && ln -s ~/dev-agent-skills/* ~/.codex/skills/` |
| Cursor / OpenCode | `mkdir -p .agents/skills && ln -s ~/dev-agent-skills/* .agents/skills/` |
| Gemini CLI | `mkdir -p ~/.config/gemini/skills && ln -s ~/dev-agent-skills/* ~/.config/gemini/skills/` |

## Adding a new skill

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Keeping skills up to date

```bash
cd ~/dev-agent-skills
git pull
bash setup.sh
```
