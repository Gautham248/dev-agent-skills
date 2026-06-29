# dev-agent-skills

A collection of agent skills for 10xMinds developers. Clone once, get all skills
in your AI IDE instantly.

## Skills

<!-- BEGIN dev-agent-skills skills table (managed by scripts/regen-readme.mjs -- do not edit this block by hand, edit the source SKILL.md instead and re-run setup.sh) -->
| Skill | What it does |
|---|---|
| [`eslint-rule-author`](./eslint-rule-author/) | Use when authoring or modifying rules in a custom ESLint plugin — adding a new rule, fixing a false positive… |
| [`first-principles-review`](./first-principles-review/) | Critical, first-principles PR review that enumerates and challenges every assumption the author made, traces… |
| [`fix-bug`](./fix-bug/) | Use when a developer reports a bug in a GitHub repository and wants an automated fix — phrases like "fix this… |
| [`plan-feature`](./plan-feature/) | Use when a developer wants to plan a new feature before building it — phrases like "plan this feature", "writ… |
| [`sync-prs`](./sync-prs/) | Use when the user asks to sync, check, refresh, or triage their own open GitHub pull requests — phrases like… |
| [`typescript-conventions`](./typescript-conventions/) | A TypeScript convention baseline for typing, validation, enum handling, imports, and naming — favoring types… |
| [`webapp-conventions`](./webapp-conventions/) | Portable conventions for building features in a SvelteKit + Tailwind web app — the layer above raw framework… |
<!-- END dev-agent-skills skills table -->

This table is regenerated automatically by `setup.sh` (and by
`install-skillset.sh`) from whatever skill folders actually exist at the
repo root — don't edit it by hand, it'll just get overwritten on the next
run. Edit the relevant `SKILL.md`'s frontmatter instead.

## Installing an external skillset

You're not limited to the 7 skills above. Any repo that follows the open
[Agent Skills format](https://github.com/anthropics/skills) (a folder per
skill, `SKILL.md` at its root — at any depth, including nested under a
`skills/` subdirectory) can be pulled in wholesale and become part of this
repo's superset:

```bash
bash install-skillset.sh <git-url> [--subdir <path>] [--prefix <name>] [--only a,b,c] [--dry-run]
```

For example, to pull in [obra/superpowers-skills](https://github.com/obra/superpowers-skills):

```bash
bash install-skillset.sh https://github.com/obra/superpowers-skills.git \
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
skillset, to avoid name collisions with skills you already have. See
`bash install-skillset.sh --help` for the rest of the options, and
[`SKILLSETS.md`](./SKILLSETS.md) (created on first use) for the provenance
log of what's been imported from where.

### Keeping installed skillsets current

`install-skillset.sh` is for bringing a new skillset in. To pull the
latest version of everything you've already installed:

```bash
bash update-skillsets.sh           # check + refresh every tracked skillset
bash update-skillsets.sh --dry-run # see what would change, touch nothing
bash update-skillsets.sh --source superpowers   # just one
```

It reads `.skillsets.json` (the record `install-skillset.sh` keeps of
every external source you've pulled from), re-clones each source, and
only rewrites a skill's files if its content actually changed — re-running
this with nothing new upstream is a no-op, not a no-op-shaped diff. By
default it only refreshes skills you already have; pass `--include-new`
if you also want to pick up anything added upstream since your last
install. `setup.sh` runs once at the end automatically if anything
changed.

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
