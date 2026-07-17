# skill-factory

An Agent Skill that builds other skills — and refuses to guess while doing it.

Point your coding agent at this skill and say *"create a skill for X"* or *"turn this workflow into a skill"*. It will:

- **Interview before writing anything.** Every request is treated as an under-specified brief until every required field in the Skill Specification (name, trigger phrases, workflow steps, edge cases, success criteria, and more) has a concrete, requester-confirmed value. It will not draft a `SKILL.md` or create a folder on a guess, even a confident one, and even under time pressure.
- **Ask one thing at a time**, offer concrete defaults to react to rather than open-ended questions, and recap the emerging picture periodically so a misunderstanding gets caught at question four, not after the file is written.
- **Also refine existing skills** — fix a mistrigger, tighten a description, add a missed edge case, restructure a skill that's grown unwieldy — via a separate track that interviews only the delta, not from scratch.
- **Validate what it produces** against this repo's own `validate_skill.py` and a documented set of anti-patterns before calling anything done.

## What it is (and isn't)

This is a **meta-skill** — it doesn't do application work itself; it produces other skills for this repo. It will decline to draft anything until its interview is genuinely complete, which means a first request rarely produces a file in the same turn — that's intentional, not a stall.

Not for ordinary bug fixes or feature work that isn't about authoring a skill itself — those route to `fix-bug` or `plan-feature` instead.

## Prerequisites

- `python3`, for the bundled `validate_skill.py`
- Familiarity with this repo's skill conventions helps but isn't required — the interview is designed to work even with a vague starting brief

## Install

Follows the open [Agent Skills](https://agentskills.io) layout. Drop the
`skill-factory/` folder into your agent's skills directory.

**Portable (recommended for repos shared across agents):**

```bash
mkdir -p .agents/skills
cp -R skill-factory .agents/skills/
```

Within this repo specifically: run `bash setup.sh` from the repo root — it handles this automatically for every detected harness.

## Usage examples

```
Create a skill for scaffolding new API endpoints with our standard error handling.
```

```
Refine the sync-prs skill — it's not triggering when I say "check my open PRs."
```

```
Does the fix-bug skill look right? Just validate it, don't change anything.
```
