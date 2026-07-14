# Managing Skills

This guide covers three ways skills get into the repo — writing one from scratch, importing an external skillset, and keeping imported skillsets current — and what to do after each one.

---

## Part 1: Writing a skill from scratch

A skill is a folder at the repo root containing a `SKILL.md`. Everything else is optional. The setup script discovers skills by scanning for `SKILL.md` files — there's no registration step.

### Folder structure

```
your-skill-name/           ← kebab-case. this becomes the slash-command name.
├── SKILL.md               ← required. the agent reads this.
├── README.md              ← recommended, not required (see note below). humans read this.
├── references/            ← optional. deep-dive docs the agent can be directed to.
│   ├── edge-cases.md      ← append-only log of real edge cases (auto-managed)
│   └── guide.md           ← anything else the skill might need
├── assets/                ← optional. templates, scaffolds.
│   └── template.ts
└── scripts/               ← optional. TypeScript helpers run by the skill.
    └── main.ts
```

### Writing SKILL.md

`SKILL.md` must start with YAML frontmatter. This is not optional — `setup.sh` locates the injection point for the governance protocols by finding the second `---` in the file, and the protocols will not be injected without it.

```markdown
---
name: your-skill-name
description: >
  Use when [specific trigger phrases that should activate this skill]. 
  Describe precisely what kind of request this skill handles, including
  the exact natural language patterns a developer would use. Be specific
  enough that the agent loads this skill for the right requests and not
  for superficially similar but actually different ones.
---

# Your Skill Name

[The actual skill instructions go here — numbered steps, decision tables,
real commands, real file paths, real flags. Write for what the agent
should DO, not for what the skill IS.]
```

**The `description` field drives auto-selection.** For OpenCode, Claude Code, and Codex, the agent reads the `description` field of every available skill and selects the best match for the current request. A description that starts with "Use when..." and names real trigger phrases performs significantly better than one that describes the skill abstractly ("This skill helps with..."). Compare:

Bad:
```yaml
description: >
  A comprehensive skill for handling code quality issues in TypeScript projects.
```

Good:
```yaml
description: >
  Use when you need to fix a bug, resolve an error, or correct unexpected behavior
  in a TypeScript codebase. Trigger phrases: "fix the bug," "this is broken,"
  "getting an error," "not working as expected." Produces a targeted fix and
  opens a PR. For large multi-file refactors, use plan-feature instead.
```

**Write for what the agent should do, not what the skill is.** Use numbered steps for sequential workflows. Use decision tables for conditional logic. Name real commands, real file paths, real flags. Do not write in the abstract — "query the graph to understand the codebase" is worse than "run `graphify query "which components read from <the relevant file>"` to find the affected components."

**Keep skills self-contained.** A skill must not depend on another skill being loaded. You can mention other skills in "See also" sections, but never structure the workflow to require them. If two skills genuinely compose (e.g. `fix-bug` sometimes hands off to `first-principles-review`), document that as an optional follow-up, not a required dependency.

**Do not hardcode org names or repo paths.** Skills must work for any developer on any repo. Use `<owner>/<repo>`, `<your-org>`, and similar placeholders where real values would vary.

### What setup.sh adds automatically

After you create a new skill and run `bash setup.sh`, two managed blocks are inserted immediately after the frontmatter's closing `---`, unconditionally, in every skill:

```
<!-- BEGIN dev-agent-skills clarification protocol ... -->
Before doing anything else in this skill, read and follow the clarification protocol at:
../config/CLARIFICATION-PROTOCOL.md
<!-- END dev-agent-skills clarification protocol -->

<!-- BEGIN dev-agent-skills self-improvement protocol ... -->
While using this skill, and especially when you finish, read and follow the self-improvement protocol at:
../config/SELF-IMPROVEMENT-PROTOCOL.md
(Append real edge cases to this skill's own references/edge-cases.md...)
<!-- END dev-agent-skills self-improvement protocol -->
```

A third block is added *conditionally* — only if your skill's frontmatter sets `session-memory: true`:

```
<!-- BEGIN dev-agent-skills session-memory protocol ... -->
This skill opted in to session-memory (session-memory: true). Whenever you reach a step
marked 'Session-reusable:' below, read and follow the session-memory protocol at:
../config/SESSION-MEMORY-PROTOCOL.md
<!-- END dev-agent-skills session-memory protocol -->
```

See "Opting into session-memory" below for whether your skill should set that flag.

**Do not edit any of these blocks manually.** They are regenerated on every `setup.sh` run, so any manual edits will be overwritten. If you need to modify what a protocol says, edit `CLARIFICATION-PROTOCOL.md`, `SELF-IMPROVEMENT-PROTOCOL.md`, or `SESSION-MEMORY-PROTOCOL.md` in the `config/` directory — those changes will propagate to every skill (or every opted-in skill, for session-memory) on the next `setup.sh` run.

Your skill's own instructions go below these blocks, unchanged.

### Opting into session-memory

Most skills don't need this — it's for the specific case where a skill has a step that's pure fact-gathering, plausibly gets reached more than once within one session, and whose answer essentially can't be invalidated by anything else done in that same session. `coding-standards`' project-domain detection and `sync-prs`' "identify the running user" step are the two current examples. A knowledge-graph check is the canonical *non*-example — it fails the third condition, since most skills that use one exist to change the code that graph describes.

If your skill has a step like this:

1. Add `session-memory: true` to your skill's frontmatter.
2. Mark the specific step (not the whole skill) with a `**Session-reusable:**` lead-in at the start of its instructions, briefly stating what would invalidate reuse for this specific check — see `coding-standards/SKILL.md`'s Step 2 or `sync-prs/SKILL.md`'s Step 1 for real examples of the wording.
3. Run `bash setup.sh` — this injects the third protocol block into your skill automatically.

The flag and the marker only mean something together — `validate_skill.py` will warn you if you set the flag without marking any step, or mark a step without setting the flag (see [`06-REFERENCE.md`](./06-REFERENCE.md) for the full validator check list).

Full mechanism details, including exactly what "reuse" means and how it must be communicated in the agent's output, live in `config/SESSION-MEMORY-PROTOCOL.md`.

### TypeScript helper scripts

If your skill needs to run code (e.g. `sync-prs` has a sync helper), put it in `scripts/` as TypeScript using `tsx` as the runner:

```bash
npx tsx your-skill-name/scripts/main.ts
```

Reference this exact invocation in your `SKILL.md` instructions so the agent knows the correct command. Do not use Python or shell scripts — TypeScript is the established convention for consistency.

### Writing README.md

The `README.md` is for humans browsing the repo, not for the agent — recommended for every skill, but no longer strictly enforced (`validate_skill.py` warns if it's missing rather than rejecting the skill; this changed after the check turned out to contradict this very guide, which has always asked for one). Cover:

- What the skill does (2–3 sentences, outcome-focused)
- Who it's for (which developers, which situations)
- Prerequisites (any tools that need to be installed, any setup)
- Usage examples (3–5 natural language prompts that should trigger this skill)

### The full creation flow

```bash
# 1. Create the folder
cd ~/10xMinds/AI-Dev-Agent/dev-agent-skills
mkdir your-skill-name

# 2. Write the files
# (create SKILL.md and README.md as described above)

# 3. Run setup.sh to inject protocols and symlink
bash setup.sh

# 4. Verify the injection happened
grep -c "BEGIN dev-agent-skills clarification protocol" your-skill-name/SKILL.md
# should print 1

# 4b. Or run the full validator, which checks this and more
python3 skill-factory/scripts/validate_skill.py your-skill-name

# 5. Commit and push
git add your-skill-name/
git commit -m "add: your-skill-name"
git push

# 6. Teammates pick it up
# git pull && bash setup.sh (on each teammate's machine)
```

---

## Part 1b: Writing a master/dispatcher skill

Most skills are self-contained — one `SKILL.md`, applied directly. `coding-standards` is a different shape: it's a **dispatcher** that investigates the current project and hands off to whichever of several domain-specific sub-skills actually apply, instead of containing the standards itself. This section covers when and how to build one, using `coding-standards` as the worked example throughout.

### When this pattern fits

Reach for a dispatcher when a single conceptual skill would otherwise need an internal routing table over multiple large, mostly-unrelated bodies of instructions — the sign that a plain skill is straining under this is a `SKILL.md` (or its reference files) trying to cover several genuinely separate concerns (frontend conventions, backend conventions, database conventions, ...) where a task rarely needs all of them at once, and where whether a given concern even applies depends on the specific project, not just the task.

If your skill is one coherent workflow, even a long one, it almost certainly doesn't need this — write a plain skill per the section above instead.

### The pieces

```
your-dispatcher/
├── SKILL.md                     ← the dispatcher: investigates, matches, hands off
└── references/
    ├── manifest.json            ← domain → skill + detection signals, dispatcher-only
    └── edge-cases.md

your-dispatcher-<domain-a>/      ← real, independent skills, not reference files
your-dispatcher-<domain-b>/
```

**The manifest** (`references/manifest.json`) is the single source of truth for what domains exist, which skill handles each, and how to detect whether a project has that domain and whether a task touches it. Real example, one entry from `coding-standards/references/manifest.json`:

```json
{
  "domain": "database",
  "skill": "coding-standards-database",
  "task_signals": ["a schema change, migration, or database query", "..."],
  "project_signals": ["a schema.zmodel, schema.prisma, or migrations/ file", "..."],
  "path_patterns": ["schema.prisma", "schema.zmodel", "migrations/", "prisma/"],
  "depends_on": []
}
```

- `task_signals` — what kind of request implies this domain, in plain language, for matching against task wording as a fallback.
- `project_signals` — cheap, checkable evidence this domain actually exists in the current project (a dependency, a file, a directory).
- `path_patterns` — used to classify files returned by a knowledge-graph query into a domain, so matching can be grounded in what the task actually touches rather than guessed from wording alone.
- `depends_on` — other domains this one structurally requires (e.g. a client-side query library needs a frontend to exist at all) — lets the dispatcher surface a specific architectural mismatch instead of a generic "not installed" question.

**Critically: no sub-skill references the manifest.** Only the dispatcher's own `SKILL.md` is told it exists. This is what makes it function as dispatcher-only without needing any harness-level permission configuration — a sub-skill genuinely can't discover a file nothing tells it exists.

### The dispatcher's own logic, in order

1. Apply anything that's universal across all domains directly and unconditionally — no dispatch decision needed for these.
2. Investigate the project against each domain's `project_signals` — cheap checks, not a graph build; nothing here is worth caching between sessions unless the specific step has also been marked `Session-reusable:` (see "Opting into session-memory" above — `coding-standards` does this for exactly this step).
3. Match the task against domains — prefer grounding this in an actual knowledge-graph query classified via `path_patterns` over matching on task wording alone; fall back to wording only when the graph has nothing to return.
4. A domain that's matched but not present in the project is a signal to ask, not to silently apply or silently skip — same for a domain whose `depends_on` isn't satisfied.
5. Dispatch to each matched, present, unambiguous domain's skill via the skill-loading tool, by name — passing along what's already been established (which domains are present, what the task is) so the dispatched skill doesn't have to re-investigate from scratch.
6. If genuinely ambiguous between two or more present candidates, ask exactly one closed question grounded in specific evidence — never a generic "which areas does this touch?"

Full worked reasoning behind each of these decisions — including what was tried and rejected (a persistent per-project cache, most notably) — is in [`HISTORY.md`](./HISTORY.md).

The `skill-add` skill pulls an external skill repository into this one as a managed, tracked import. The key principle: **the team lead reviews and installs once; teammates just pull and run setup.sh.** This is why import goes through the central repo rather than everyone installing individually.

### Before importing anything

1. **Read the source skillset.** Browse its SKILL.md files on GitHub first. Do the instructions make sense for your workflow? Are there naming conflicts with skills you already have?

2. **Decide whether to prefix.** If the source repo has generic skill names (`debugging`, `planning`, `review`) that could collide with your existing skills or with skills from other sources, use `--prefix`. If it's a small, specific, hand-picked set you've verified has no conflicts, prefix is optional but still recommended.

3. **Check for a `--subdir` requirement.** Some skill repos nest their skills under a subdirectory (e.g. `obra/superpowers-skills` has skills under `skills/`). Passing `--subdir skills` tells the installer to search that subdirectory rather than the whole repo root.

### The import command

```
/skill-add <git-url> [options]
```

**Options:**

| Flag | What it does |
|---|---|
| `--subdir <path>` | Search this subdirectory for skills, not the repo root |
| `--prefix <name>` | Prefix every imported skill folder with `<name>-` |
| `--only <a,b,c>` | Import only these specific skill folders (comma-separated, no spaces) |
| `--ref <branch/tag>` | Clone this ref instead of the default branch |
| `--dry-run` | Show what would be imported without touching anything |
| `--skip-setup` | Don't run setup.sh automatically at the end |

### Step-by-step import flow

**Step 1 — Dry run first, always:**

```
/skill-add https://github.com/obra/superpowers-skills.git \
  --subdir skills --prefix superpowers --dry-run
```

Read the output carefully:
- How many skills were found?
- What are the final folder names? Do any collide with skills you already have?
- Are any skills listed as "skipped"? If so, why?

**Step 2 — Real import with `--skip-setup`:**

```
/skill-add https://github.com/obra/superpowers-skills.git \
  --subdir skills --prefix superpowers --skip-setup
```

Using `--skip-setup` lets you review the diff before setup.sh runs its injection and symlinking. Look at what was imported:

```bash
git diff --stat         # what changed
git status              # what's new and untracked
```

**Step 3 — Read the cross-reference warnings:**

The installer will print warnings for any cross-skill references it couldn't fully resolve:

```
⚠️  3 unresolved cross-reference(s) found in imported content:
  superpowers-writing-plans/SKILL.md: skills/collaboration/executing-plans
  superpowers-gardening-skills-wiki/SKILL.md: skills/debugging/root-cause-tracing
```

For each warning:
- If the referenced path looks like a real skill that was part of this import (e.g. you used `--only` and excluded it), either re-import without `--only` or manually update the reference.
- If it looks like a documentation placeholder (e.g. `/path/to/skills/x/y`), it's harmless — leave it.
- If it's a skill from a completely different source, decide whether to import that source too.

**Step 4 — Run setup.sh:**

```bash
bash setup.sh
```

This injects the governance protocols into all newly-imported skills and symlinks them into your harnesses. Check the output for any skills that were skipped (usually because they're missing YAML frontmatter — check the specific skill's `SKILL.md` and add frontmatter if needed).

**Step 5 — Verify the import:**

Spot-check a few imported skills:

```bash
# Confirm both protocols were injected
grep -c "BEGIN dev-agent-skills clarification protocol" superpowers-systematic-debugging/SKILL.md
grep -c "BEGIN dev-agent-skills self-improvement protocol" superpowers-systematic-debugging/SKILL.md

# Confirm the skill appears in your harness
ls ~/.claude/skills/ | grep superpowers | head -5
```

**Step 6 — Commit:**

```bash
git add -A
git commit -m "install: skillset from https://github.com/obra/superpowers-skills.git (prefix: superpowers)"
git push
```

The commit includes the imported skill folders, the updated `.skillsets.json`, the new/updated `SKILLSETS.md`, and the updated `README.md` skills table. Teammates get everything with `git pull && bash setup.sh`.

### Importing only specific skills

If you only want a few skills from a large repo:

```
/skill-add https://github.com/obra/superpowers-skills.git \
  --subdir skills --prefix superpowers \
  --only systematic-debugging,root-cause-tracing,verification-before-completion \
  --dry-run
```

Note: `--only` filters by the skill's folder name in the source repo, not by the final prefixed name.

### What happens when skills from the same source collide

If you try to import a skill that already exists at the repo root and wasn't imported by this installer (i.e. it's a hand-authored skill), the installer skips it with a clear reason:

```
Skipped: debugging (collaboration/debugging) — "debugging" already exists at the repo root and isn't tracked as something this script imported — use --prefix to avoid the collision.
```

Use `--prefix` to give the imported skill a distinct name, or choose `--only` to exclude the conflicting one.

---

## Part 3: Updating installed skillsets

External skillsets evolve — bugs get fixed, new instructions are added, edge cases get documented. The `skill-update` skill re-pulls the latest version of every skillset tracked in `.skillsets.json` without requiring you to remember any of the original install arguments — those are already recorded in the manifest.

### The update command

By default, it updates all tracked skillsets. Use flags only when you want to narrow the scope:

```
/skill-update               # update everything (default)
/skill-update --source superpowers  # just one
```

**Options:**

| Flag | What it does |
|---|---|
| `--source <substring>` | Only update skillsets whose source URL contains this substring |
| `--include-new` | Also import skills added upstream since your last install |
| `--dry-run` | Show what would change without touching anything |
| `--skip-setup` | Don't run setup.sh even if something changed |

### The update flow

**Check what would change first:**

```
/skill-update --dry-run
```

Output examples:

```
✓ https://github.com/obra/superpowers-skills.git:skills — already at the latest pulled commit (cdcd624ad3), nothing to check further.
```
(No upstream changes since your last install.)

```
→ https://github.com/obra/superpowers-skills.git:skills — new commit available (cdcd624ad → a1b2c3d4)
```
(Upstream has new commits — update will re-import and compare content.)

**Run the actual update:**

```
/skill-update
```

The update is content-diffed, not just commit-diffed. A new upstream commit that didn't change any skill content you have imported will report "content identical, nothing to update" and won't modify any files. Only real content changes trigger file writes. `setup.sh` runs automatically at the end only if at least one skill actually changed.

**If you only want to update one skillset:**

```
/skill-update --source superpowers
```

**To pick up new skills added upstream since your last install:**

```
/skill-update --include-new
```

By default the update only refreshes skills that were previously imported. `--include-new` also imports any new skills added to the source repo since your last install. Use this deliberately, not on autopilot — new skills from an external source may need the same review you'd give any new import.

**Commit the result:**

```bash
git diff --stat         # review what changed
git add -A
git commit -m "update: refresh tracked skillsets"
git push
```

### How often to update

There's no fixed cadence — run it when you think upstream may have improved. For actively-developed external skillsets, monthly is reasonable. For stable ones, quarterly or as-needed.

---

## Part 4: The `.skillsets.json` manifest

`.skillsets.json` is the machine-readable record of every external skillset imported into this repo. You generally don't need to edit it by hand — the `skill-add` and `skill-update` skills' scripts manage it — but understanding its structure helps when something goes wrong.

```json
{
  "skillsets": [
    {
      "source_repo": "https://github.com/obra/superpowers-skills.git",
      "ref": null,
      "commit": "cdcd624ad3fd8026deb692e565351854569798dd",
      "subdir": "skills",
      "prefix": "superpowers",
      "imported_skills": [
        {
          "final_name": "superpowers-brainstorming",
          "source_path": "collaboration/brainstorming"
        }
      ],
      "installed_at": "2026-06-25T10:49:00.000Z"
    }
  ]
}
```

Fields that matter:
- `commit` — the SHA of the upstream repo at the time of import. The `skill-update` skill's script compares against this to detect upstream changes.
- `imported_skills[].final_name` — the folder name as it exists at the repo root. Used by the `skill-update` script to know which skills to refresh (by default, only these — not new ones added upstream).
- `prefix` and `subdir` — passed back to the installer verbatim on update, so you don't have to remember them.

**Do not edit `commit` by hand** to force a re-check. If you want to force an update even when the commit SHA matches, pass `--include-new` or temporarily use `--source` with `--dry-run` to see what's upstream.

---

## Part 5: `SKILLSETS.md` — the human-readable provenance log

Every time the `skill-add` skill's script runs, it appends a new entry to `SKILLSETS.md`:

```markdown
## https://github.com/obra/superpowers-skills.git:skills
- Installed: 2026-06-25T10:49:00.000Z
- Commit: `cdcd624ad3fd8026deb692e565351854569798dd`
- Prefix: `superpowers-`
- Imported (31): `superpowers-brainstorming`, `superpowers-systematic-debugging`, ...
```

On update, a new entry is appended with the updated commit SHA and the current date. This gives you a full history of when each skillset was imported and what version it was at each point, without having to dig through git log.

---

## Quick reference

| Task | Command |
|---|---|
| Initial setup | `bash setup.sh` |
| Pick up new skills from teammates | `git pull && bash setup.sh` |
| Create a new skill | Create folder + `SKILL.md`, then `bash setup.sh` |
| Import a new external skillset | `/skill-add <url> [--prefix <name>] [--subdir <path>]` |
| Preview an import before running it | Same command with `--dry-run` |
| Update all tracked external skillsets | `/skill-update` (default: updates everything) |
| Update just one tracked skillset | `/skill-update --source <substring>` |
| Preview an update before running it | `/skill-update --dry-run` |
