---
name: skill-update
description: >
  Use when the user wants to update, refresh, sync, or pull the latest version
  of one or all tracked external skills — phrases like "update my skills",
  "sync skillsets", "pull the latest version of the superpowers skillset", "refresh my
  external skills", or "check for skillset updates". Reads .skillsets.json to
  find every tracked external import, re-clones each source at the latest
  commit, compares content, and refreshes any that changed. Never adds skills
  that weren't imported before unless --include-new is passed. Use skill-add
  to install a brand-new skillset instead.
---

<!-- BEGIN dev-agent-skills clarification protocol (managed by setup.sh -- do not edit this block manually; edit CLARIFICATION-PROTOCOL.md instead) -->
Before doing anything else in this skill, read and follow the clarification protocol at:
../config/CLARIFICATION-PROTOCOL.md
<!-- END dev-agent-skills clarification protocol -->

<!-- BEGIN dev-agent-skills self-improvement protocol (managed by setup.sh -- do not edit this block manually; edit SELF-IMPROVEMENT-PROTOCOL.md instead) -->
While using this skill, and especially when you finish, read and follow the self-improvement protocol at:
../config/SELF-IMPROVEMENT-PROTOCOL.md
(Append real edge cases to this skill's own references/edge-cases.md — create it if missing. See the protocol file for what qualifies.)
<!-- END dev-agent-skills self-improvement protocol -->

# Skill update

Updates one or all tracked external skillsets from their source repos. Reads
`.skillsets.json` — the manifest written by `skill-add` — and re-syncs every
entry against its upstream. Skills with unchanged content are left alone; skills
with new commits that actually change content are refreshed in place, and
`setup.sh` runs once at the end if anything changed.

## Required

- `git` — to re-clone each tracked source
- `node` — to run the update and install scripts

No other dependencies.

## Prerequisites

The script reads `.skillsets.json`. If the file is missing or empty, there is
nothing to update. Tell the user: "No tracked skillsets found. Use skill-add
to install one first."

## Step 1 — Determine scope

Default: update everything. Do not ask the user what to update — just run with
no flags and update all tracked skillsets. The user asked for an update; that
means update everything.

Only use the flags below when the user explicitly names them in their request:

| The user explicitly asks for | What to pass |
|---|---|
| Update a specific skillset | `--source <substring>` — matches against the source repo URL (e.g. `--source superpowers`) |
| Also pick up new upstream skills | `--include-new` (default: only refresh what's already here) |
| Preview without writing | `--dry-run` |
| Skip `setup.sh` at the end | `--skip-setup` |

If the user already specified which skillset or what flags in their request,
use them.

## Step 2 — Run the update script

From the dev-agent-skills repo root:

```bash
bash skill-update/scripts/update-skillsets.sh [flags...]
```

The script will, for each tracked skillset:

1. Shallow-clone the source repo at its latest commit (or pinned ref).
2. Compare the new commit to the last installed commit.
3. If same commit and `--include-new` not set, report "already up to date".
4. If different commit (or `--include-new` forces re-check), re-run the
   install skill with the original parameters (`--subdir`, `--prefix`, `--only`
   list) reconstructed from `.skillsets.json`.
5. Compare content hashes — skills whose content is identical after re-import
   are reported "unchanged"; only actually-changed skills show as "updated".
6. Run `bash setup.sh` once at the end if anything changed (unless
   `--skip-setup`).

## Step 3 — Report back

The script prints its own summary. Relay it to the user:

```
Checking N tracked skillset(s) for upstream changes...

✓ <label> — already at the latest pulled commit (<sha>), nothing to check further.
→ <label> — new commit available (<old-sha> -> <new-sha>)

────────────────────────────────────────────────────────────
Update summary:
  =  <label> — already up to date
  ↑  <label> — updated, N skill(s) actually changed: <names>
  =  <label> — new commit pulled, but content identical to what's already here

Review the diff, then commit:
  git add -A && git commit -m "update: refresh tracked skillsets"
```

If `--dry-run` was used, make it clear nothing was written and show what
*would* update.

If a source repo failed to clone or the install step errored for a particular
skillset, report the failure but continue with the remaining skillsets.

## What the agent must NEVER do

- Run `git clone` or `git pull` manually — the script handles cloning.
- Run `setup.sh` separately when `--skip-setup` was not passed — the script
  already does it.
- Hand-edit `.skillsets.json` — the install script (called by the update script)
  manages it.
- Commit or push automatically — the user does that after review.
- Pass `--include-new` unless the user explicitly asked for it (default is
  "only refresh what's already here").
- Use this skill to install a brand-new skillset — refer the user to
  `skill-add` instead.

## Failure modes

| Condition | Behaviour |
|---|---|
| `.skillsets.json` missing or empty | Report and stop. Suggest `skill-add` first. |
| `.skillsets.json` exists but isn't valid JSON | Report the error and stop — tell the user to fix or remove it by hand. |
| `node` or `git` not installed | Report and stop. Tell the user what's missing. |
| `--source` matches nothing | Print the list of tracked sources and stop. |
| Source repo fails to clone | Report the error for that skillset and continue to the next one. |
| Install step fails for one skillset | Report the error for that skillset and continue to the next one. |
| Nothing changed after re-import | The script reports "content identical" — no setup.sh re-run needed. |
