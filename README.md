# dev-agent-skills

A collection of agent skills for 10xMinds developers. Clone once, get all skills
in your AI IDE instantly.

## Skills

<!-- BEGIN dev-agent-skills skills table (managed by scripts/regen-readme.mjs -- do not edit this block by hand, edit the source SKILL.md instead and re-run setup.sh) -->
| Skill | What it does |
|---|---|
| [`coding-standards`](./coding-standards/) | Company coding standards for frontend, backend, and database work. Use whenever writing or modifying applicat… |
| [`coding-standards-backend`](./coding-standards-backend/) | Company backend conventions for API endpoints, middleware, and background jobs -- file-based endpoint structu… |
| [`coding-standards-database`](./coding-standards-database/) | Company database conventions -- schema-as-source-of-truth, model/field naming, column type rules (decimal mon… |
| [`coding-standards-e2e`](./coding-standards-e2e/) | Company conventions for writing Playwright end-to-end tests -- directory structure, centralized test-ID selec… |
| [`coding-standards-frontend`](./coding-standards-frontend/) | Company frontend conventions for components, client state, and styling -- the three-tier component structure… |
| [`coding-standards-project-organization`](./coding-standards-project-organization/) | Company conventions for where code lives and how the project is structured -- directory layout, file naming,… |
| [`coding-standards-tanstack-query`](./coding-standards-tanstack-query/) | Company conventions for client-side server-state with TanStack Query (or your framework's async-query library… |
| [`eslint-rule-author`](./eslint-rule-author/) | Use when authoring or modifying rules in a custom ESLint plugin — adding a new rule, fixing a false positive… |
| [`first-principles-review`](./first-principles-review/) | Critical, first-principles PR review that enumerates and challenges every assumption the author made, traces… |
| [`fix-bug`](./fix-bug/) | Use when a developer reports a bug in a GitHub repository and wants an automated fix — phrases like "fix this… |
| [`graphify`](./graphify/) | Use for any question about a codebase, its architecture, file relationships, or project content — especially… |
| [`investigate-issue`](./investigate-issue/) | Use when a developer points at an existing GitHub issue and wants it investigated and taken forward — phrases… |
| [`plan-feature`](./plan-feature/) | Use when a developer wants to plan a new feature before building it — phrases like "plan this feature", "writ… |
| [`skill-add`](./skill-add/) | Use when the user wants to add, import, or install a new external skill from a git repository — phrases like… |
| [`skill-factory`](./skill-factory/) | Interviews the requester through a structured clarification protocol, then designs, writes, and validates a n… |
| [`skill-update`](./skill-update/) | Use when the user wants to update, refresh, sync, or pull the latest version of one or all tracked external s… |
| [`sync-prs`](./sync-prs/) | Use when the user asks to sync, check, refresh, or triage their own open GitHub pull requests — phrases like… |
| [`typescript-conventions`](./typescript-conventions/) | A TypeScript convention baseline for typing, validation, enum handling, imports, and naming — favoring types… |
| [`webapp-conventions`](./webapp-conventions/) | Portable conventions for building features in a SvelteKit + Tailwind web app — the layer above raw framework… |
<!-- END dev-agent-skills skills table -->

This table is regenerated automatically by `setup.sh` (and by
`skill-add`'s installer) from whatever skill folders actually exist at the
repo root — don't edit it by hand, it'll just get overwritten on the next
run. Edit the relevant `SKILL.md`'s frontmatter instead.

## Installing an external skillset

You're not limited to the skills above. Use the `skill-add` skill to import
external skill repos that follow the open
[Agent Skills format](https://github.com/anthropics/skills) (a folder per
skill, `SKILL.md` at its root):

```
/skill-add https://github.com/obra/superpowers-skills.git \
  --subdir skills --prefix superpowers
```

This clones the source repo, flattens every skill it finds into its own
folder at this repo's root (handling collisions, rewriting cross-skill
references where it can resolve them, and flagging anything it can't),
regenerates the table above, and runs `setup.sh` so the new skills get
symlinked and get the clarification-protocol pointer injected — same as
any other skill here. Always review the diff (and the cross-reference
warnings it prints) before committing.

`--prefix` is strongly recommended for any large or general-purpose
skillset, to avoid name collisions with skills you already have.
See `.skillsets.json` (created on first use) for the provenance
log of what's been imported from where.

### Keeping installed skillsets current

The `skill-add` skill is for bringing a new skillset in. To pull the
latest version of everything you've already installed, use the
`skill-update` skill — it updates all tracked skillsets by default:

```
/skill-update               # check + refresh every tracked skillset
/skill-update --dry-run     # see what would change, touch nothing
/skill-update --source superpowers   # just one
```

It reads `.skillsets.json` (the record `skill-add` keeps of
every external source you've pulled from), re-clones each source, and
only rewrites a skill's files if its content actually changed — re-running
this with nothing new upstream is a no-op. By default it only refreshes
skills you already have; pass `--include-new` if you also want to pick
up anything added upstream since your last install. `setup.sh` runs once
at the end automatically if anything changed.

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
/fix-bug        /plan-feature     /first-principles-review
/sync-prs       /skill-add        /skill-update
/graphify       /typescript-conventions
/webapp-conventions               /eslint-rule-author
```

Or describe what you want naturally — the agent will load the right skill.

**First question?** The agent automatically checks for a knowledge graph
(`graphify-out/graph.json`), builds it if missing (auto-installing
`graphifyy` if needed), and uses it to ground every answer.

## Manual install (if setup.sh doesn't cover your IDE)

| Agent | Command |
|---|---|
| Claude Code | `mkdir -p ~/.claude/skills && ln -s ~/dev-agent-skills/* ~/.claude/skills/` |
| Hermes | Add `~/dev-agent-skills` to `external_dirs` in `~/.hermes/config.yaml` |
| Codex | `mkdir -p ~/.codex/skills && ln -s ~/dev-agent-skills/* ~/.codex/skills/` |
| Cursor / OpenCode | `mkdir -p .agents/skills && ln -s ~/dev-agent-skills/* .agents/skills/` |
| Gemini CLI | `mkdir -p ~/.config/gemini/skills && ln -s ~/dev-agent-skills/* ~/.config/gemini/skills/` |

## Adding a new skill

See [CONTRIBUTING.md](./docs/CONTRIBUTING.md).

## Keeping skills up to date

```bash
cd ~/dev-agent-skills
git pull
bash setup.sh
```
