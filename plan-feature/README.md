# plan-feature

An Agent Skill that produces a structured implementation plan for a new feature,
grounded in the actual codebase via Graphify knowledge graph queries.

The agent reads the repo, understands the existing architecture, and writes a
plan that names real files and real modules. No code is written.

## Who it's for

Developers who want a codebase-aware starting point before implementing a
feature — not a generic spec, but a plan that knows where things actually live.

## Prerequisites

- `graphify` — `pip install graphifyy`
- `gh` CLI authenticated — `gh auth login`
- `GEMINI_API_KEY` (free at aistudio.google.com)

## Install

**Portable (recommended):**

```bash
mkdir -p .agents/skills
cp -R plan-feature .agents/skills/
```

**Per-agent paths:**

| Agent | Personal | Project |
|---|---|---|
| Claude Code | `~/.claude/skills/plan-feature/` | `.claude/skills/plan-feature/` |
| Cursor | native global path | `.agents/skills/plan-feature/` |
| Hermes | `~/.hermes/skills/plan-feature/` | external_dirs in config.yaml |
| Codex | `~/.codex/skills/plan-feature/` | `.agents/skills/plan-feature/` |
| Gemini CLI | installer-managed | `.agents/skills/plan-feature/` |

Or run `bash setup.sh` from the repo root.

## Usage

> Plan the feature to add article tagging in owner/repo

> Write an implementation plan for adding OAuth login to acme-org/backend

> How should we implement search in our docs site?
