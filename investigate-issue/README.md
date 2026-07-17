# investigate-issue

An Agent Skill that takes an existing GitHub issue and moves it forward — investigate first, then route to whichever next step actually fits, rather than assuming.

Point your coding agent at this skill and say *"investigate issue #42"* or *"pick up issue 17 and handle it"*. It will:

- **Read the issue** and check for a linked, open pull request and an assignee.
- **Branch based on what it finds**, not on how the request was phrased:
  - An open linked PR gets a full code review, delivered in chat only — no code changes.
  - An unclaimed bug gets fixed via the `fix-bug` skill, with the resulting PR referencing the original issue.
  - A feature request gets planned via `plan-feature`, invoked directly with the issue's content as input — not re-interviewed from scratch.
- **Never duplicates work** already claimed by someone else or already in flight in an open PR.

## What it is (and isn't)

This is a **skill** that primarily routes to two other skills in this repo (`fix-bug`, `plan-feature`) once it's determined which one actually applies. It does the investigation and decision-making itself; the actual fix or plan is produced by whichever skill it hands off to, using their normal process — this skill supplies their inputs directly rather than making them re-derive context already gathered here.

## Prerequisites

- [`gh`](https://cli.github.com/), authenticated (`gh auth login`)
- `git`, and network access to GitHub
- Whatever `fix-bug` and `plan-feature` themselves require, since this skill hands off to them

## Install

Follows the open [Agent Skills](https://agentskills.io) layout. Drop the
`investigate-issue/` folder into your agent's skills directory.

**Portable (recommended for repos shared across agents):**

```bash
mkdir -p .agents/skills
cp -R investigate-issue .agents/skills/
```

Within this repo specifically: run `bash setup.sh` from the repo root — it handles this automatically for every detected harness.

## Usage examples

```
Investigate issue #42 and handle it.
```

```
Look into this issue: https://github.com/org/repo/issues/17
```

```
Pick up issue 58 — is anyone already working on it?
```
