# fix-bug

An Agent Skill that receives a bug description, finds the relevant file using
the repository's knowledge graph, applies a minimal targeted fix, and opens a
pull request for review.

The agent does the investigation and the edit. The developer reviews and merges.

## Who it's for

Developers who want to automate the mechanical parts of a bug fix — finding the
right file and making a targeted change — without giving up control over what
gets merged.

## What it does

1. Clones or pulls the target repository locally
2. Builds a Graphify knowledge graph of the codebase
3. Queries the graph in natural language to find the relevant file
4. Reads the file and applies the minimal fix
5. Creates a branch, commits, pushes, and opens a PR
6. Tags the specified reviewer

## Prerequisites

- `graphify` — `pip install graphifyy`
- `gh` CLI authenticated — `gh auth login`
- `git` with access to the repository
- `GEMINI_API_KEY` (free at aistudio.google.com) — only needed if the repo
  contains docs, images, or non-code files that graphify needs to analyze

## Install

**Portable (recommended):**

```bash
mkdir -p .agents/skills
cp -R fix-bug .agents/skills/
```

**Per-agent paths:**

| Agent | Personal | Project |
|---|---|---|
| Claude Code | `~/.claude/skills/fix-bug/` | `.claude/skills/fix-bug/` |
| Cursor | native global path | `.agents/skills/fix-bug/` |
| Hermes | `~/.hermes/skills/fix-bug/` | external_dirs in config.yaml |
| Codex | `~/.codex/skills/fix-bug/` | `.agents/skills/fix-bug/` |
| Gemini CLI | installer-managed | `.agents/skills/fix-bug/` |

Or run `bash setup.sh` from the repo root.

## Usage

> Fix the bug where the Supabase URL is wrong in owner/repo

> The homepage link is broken in our website repo — open a PR to fix it

> There's a wrong API endpoint in acme-org/backend — fix it and assign @john
