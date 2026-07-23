# plan-feature

An Agent Skill that turns "we should build X" into a structured, codebase-aware implementation plan — before anyone writes code.

Point your coding agent at this skill and say *"plan this feature"* or *"write a feature plan for X"*. It will:

- **Query the repository's knowledge graph** (via `graphify`) to understand the existing codebase — related functionality, the data layer, the API/routing layer, the UI layer — before proposing anything.
- **Produce a structured markdown plan** covering what to build, where it fits, what to change, and what to watch out for.
- **Verify every file path it names** against the real repository using a bundled script, before the plan is ever saved — a plan referencing a file that doesn't exist, or mislabeling an existing file as "to create," fails this check and gets fixed before saving, not after.
- **Save the plan** as a new GitHub issue (default), a comment on an existing issue, or a file committed to the repo — the mode is explicit, never guessed.

## What it is (and isn't)

This is a **skill** — a `SKILL.md` of step-by-step guidance plus a bundled `verify_plan_paths.py` script. It does **not** write code. Its entire output is a plan for a human (or another skill) to act on next.

Other skills can invoke this one directly rather than going through its own interview — see the "invoked by another skill" input contract in `SKILL.md` if you're calling it from a skill you're authoring. `investigate-issue` does exactly this for the feature-request branch of its own decision tree.

## Prerequisites

- `graphify` on `PATH`
- [`gh`](https://cli.github.com/), authenticated (`gh auth login`)
- `git`, and network access to GitHub
- `python3` for the bundled path-verification script

## Install

Follows the open [Agent Skills](https://agentskills.io) layout. Drop the
`plan-feature/` folder into your agent's skills directory.

**Portable (recommended for repos shared across agents):**

```bash
mkdir -p .agents/skills
cp -R plan-feature .agents/skills/
```

Within this repo specifically: run `bash setup.sh` from the repo root — it handles this automatically for every detected harness.

## Usage examples

```
Plan this feature: let users export their data as CSV.
```

```
Write a feature plan for adding rate limiting to the public API.
Save it as a comment on issue #58.
```

```
How should we implement real-time notifications? Create a spec for it.
```
