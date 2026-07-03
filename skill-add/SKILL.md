---
name: skill-add
description: >
  Use when the user wants to add, import, or install a new external skill from
  a git repository — phrases like "add skill", "install a skill from <url>",
  "import this skillset", or "pull in <git-repo> as a skill". Clones the remote
  git repo, flattens its skills into the dev-agent-skills repo root (one folder
  per skill), rewrites cross-skill references, records provenance in
  .skillsets.json, and runs setup.sh to symlink and inject protocols. Never
  updates skills that are already tracked — use skill-update for that.
---

<!-- BEGIN dev-agent-skills clarification protocol (managed by setup.sh -- do not edit this block manually; edit CLARIFICATION-PROTOCOL.md instead) -->
Before doing anything else in this skill, read and follow the clarification protocol at:
../CLARIFICATION-PROTOCOL.md
<!-- END dev-agent-skills clarification protocol -->

<!-- BEGIN dev-agent-skills self-improvement protocol (managed by setup.sh -- do not edit this block manually; edit SELF-IMPROVEMENT-PROTOCOL.md instead) -->
While using this skill, and especially when you finish, read and follow the self-improvement protocol at:
../SELF-IMPROVEMENT-PROTOCOL.md
(Append real edge cases to this skill's own references/edge-cases.md — create it if missing. See the protocol file for what qualifies.)
<!-- END dev-agent-skills self-improvement protocol -->

# Skill add

Adds a new external skill (or skillset) from a remote git repository into the
local dev-agent-skills repo. All the work — cloning, flattening, cross-reference
rewriting, provenance recording, and setup — is handled by a single script.

## Required

- `git` — to clone the source repo
- `node` — for skill discovery, cross-reference rewriting, and manifest updates

No other dependencies. The script shells out to `setup.sh` at the end (unless
`--skip-setup` is passed).

## Step 1 — Gather the git URL

Ask the user for the git repository URL of the skill(s) to add. The URL must
be a valid git remote (HTTPS or SSH). A single example:

```
https://github.com/obra/superpowers-skills.git
```

If the user already gave a URL in their request, use it. Do not ask again.

## Step 2 — Ask about optional flags (one question)

The script accepts several optional flags. Ask exactly one question to check
whether any of these apply. Skip this step entirely if the user already
specified flags in their request.

The flags:

| Flag | What it does |
|---|---|
| `--subdir <path>` | Skills live under a subdirectory of the source repo (e.g. `skills` for `obra/superpowers-skills`). Default: search the whole repo. |
| `--prefix <name>` | Prefix every imported skill's folder name with `<name>-` (e.g. `--prefix superpowers` gives `superpowers-brainstorming/`). Strongly recommended for large or general-purpose skillsets. |
| `--only <a,b,c>` | Only import specific skills (comma-separated, by folder name in the source repo). Default: import everything found. |
| `--ref <branch/tag>` | Clone a specific ref instead of the default branch. |
| `--dry-run` | Show what would be imported/skipped without touching the filesystem. |
| `--skip-setup` | Don't run `setup.sh` afterwards — review the diff first. |

Combine them freely:

```bash
bash skill-add/scripts/install-skillset.sh \
  https://github.com/obra/superpowers-skills.git \
  --subdir skills --prefix superpowers
```

## Step 3 — Run the installer

From the dev-agent-skills repo root, run the install script. Always pass the
git URL as the first positional argument. If the user specified any flags
in Step 2, append them.

```bash
bash skill-add/scripts/install-skillset.sh <git-url> [flags...]
```

The script will:

1. Shallow-clone the source repo to a temp directory.
2. Find every `SKILL.md` under it (at any depth).
3. Flatten each skill into its own folder at the repo root.
4. Detect name collisions against existing skills and tracked imports.
5. Rewrite cross-skill references it can resolve.
6. Write/update `.skillsets.json` and `SKILLSETS.md`.
7. Regenerate the README skills table.
8. Run `bash setup.sh` (unless `--skip-setup`).

## Step 4 — Report back

After the script finishes, report what happened using the script's own output:

```
✓ Imported N skill(s) from <url> @ <short-commit>

  new      <skill-name>/  (from <source-path>)
  updated  <skill-name>/  (from <source-path>)

Review .skillsets.json / SKILLSETS.md, check git diff, then commit:
  git add -A && git commit -m "install: skillset from <url>"
```

If `--dry-run` was used, make it clear nothing was written and show what
*would* be imported.

If the script reported skipped skills, surface the reasons so the user can
decide whether to adjust flags.

## What the agent must NEVER do

- Run `git clone` or `git pull` manually — the script handles cloning.
- Run `setup.sh` separately when `--skip-setup` was not passed — the script
  already does it.
- Touch `.skillsets.json` or `SKILLSETS.md` by hand — the script manages them.
- Hand-edit cross-skill references — the script does the rewriting.
- Commit or push automatically — the user does that after review.
- Modify the source repo's contents in the temp clone.
- Override the user's flag choices or add flags the user didn't ask for.
- Use this skill to update already-tracked skills — refer the user to
  `skill-update` instead.

## Failure modes

| Condition | Behaviour |
|---|---|
| `node` or `git` not installed | Report and stop. Tell the user what's missing. |
| Invalid or unreachable git URL | The clone step will fail — report the error and stop. |
| No `SKILL.md` files found in the source repo | Report and stop. Suggest `--subdir` if the skills might be nested. |
| Requested `--subdir` doesn't exist in the clone | Report and stop. |
| Name collision with an existing hand-authored skill | The script skips the skill and reports the reason. Show the user the skip message and suggest `--prefix`. |
| Nothing to import (all candidates skipped) | Report the skip reasons and stop. |
