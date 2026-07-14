# Reference

Quick-reference tables and complete flag listings for all commands.

---

## Commands

### `bash setup.sh`

Run from the `dev-agent-skills` root after cloning, after `git pull`, after adding a new skill, or after moving the repo. Safe to run multiple times.

**What it does:**
1. Discovers every skill (folder at repo root that contains `SKILL.md`)
2. Injects clarification + self-improvement protocol pointers into every skill's `SKILL.md`, and the session-memory pointer into any skill that sets `session-memory: true`
3. Configures OpenCode's global `opencode.json` (if OpenCode is installed)
4. Regenerates the README skills table
5. Symlinks skills into detected harnesses

**No flags.** It detects everything automatically.

---

### `/skill-add <git-url> [flags]`

Imports an external skill repository into this one. Invoked via the `skill-add` skill.

| Flag | Argument | Default | Description |
|---|---|---|---|
| `--subdir` | `<path>` | (repo root) | Search this subdirectory for skills, not the whole repo |
| `--prefix` | `<name>` | (none) | Prefix all imported skill folders with `<name>-` |
| `--only` | `<a,b,c>` | (all) | Import only these skill folder names (comma-separated, no spaces) |
| `--ref` | `<branch/tag>` | (default branch) | Clone this git ref |
| `--dry-run` | — | off | Show what would happen without writing anything |
| `--skip-setup` | — | off | Don't run `setup.sh` automatically at the end |

**Requirements:** `git`, `node` (v18+)

**Examples:**
```
# Import all superpowers skills with prefix
/skill-add https://github.com/obra/superpowers-skills.git \
  --subdir skills --prefix superpowers

# Dry-run first to check names and collision
/skill-add https://github.com/obra/superpowers-skills.git \
  --subdir skills --prefix superpowers --dry-run

# Import only specific skills
/skill-add https://github.com/obra/superpowers-skills.git \
  --subdir skills --prefix superpowers \
  --only systematic-debugging,root-cause-tracing

# Import from a specific branch
/skill-add https://github.com/obra/superpowers-skills.git \
  --subdir skills --prefix superpowers --ref main

# Import and review diff before running setup.sh
/skill-add https://github.com/obra/superpowers-skills.git \
  --subdir skills --prefix superpowers --skip-setup
```

---

### `/skill-update [flags]`

Updates all tracked skillsets by default. Invoked via the `skill-update` skill. Re-pulls the latest version of every skillset tracked in `.skillsets.json`.

| Flag | Argument | Default | Description |
|---|---|---|---|
| `--source` | `<substring>` | (all) | Only update skillsets whose source URL contains this |
| `--include-new` | — | off | Also import skills added upstream since last install |
| `--dry-run` | — | off | Show what would change without touching anything |
| `--skip-setup` | — | off | Don't run `setup.sh` even if something changed |

**Requirements:** `git`, `node` (v18+)

**Examples:**
```
# Update all tracked skillsets (default)
/skill-update

# Dry-run to see what would change
/skill-update --dry-run

# Update only the superpowers skillset
/skill-update --source superpowers

# Update and pick up new upstream skills
/skill-update --include-new

# Update but review the diff before running setup.sh
/skill-update --skip-setup
```

---

### `node scripts/regen-readme.mjs [path]`

Regenerates the skills table in `README.md` from whatever skill folders exist at the repo root. Called automatically by `setup.sh` and the `skill-add` script — only run directly if you need to update the table without running the full setup.

```bash
node scripts/regen-readme.mjs                        # uses current directory
node scripts/regen-readme.mjs ~/path/to/repo         # explicit path
```

---

## File formats

### `SKILL.md` structure

```
┌─────────────────────────────────────────────────────────┐
│ ---                                                      │
│ name: skill-name                                         │
│ description: >                                           │
│   Use when... [trigger phrases]                          │
│ session-memory: true   ← optional, opt-in only            │
│ ---                                                      │
│                                                          │  ← YAML frontmatter (required)
│ <!-- BEGIN dev-agent-skills clarification protocol ... → │
│ Before doing anything else in this skill, read and       │
│ follow the clarification protocol at: /abs/path/...      │  ← Injected by setup.sh (all skills)
│ <!-- END dev-agent-skills clarification protocol -->      │
│                                                          │
│ <!-- BEGIN dev-agent-skills self-improvement protocol → │
│ While using this skill, and especially when you          │
│ finish, read and follow the self-improvement protocol... │  ← Injected by setup.sh (all skills)
│ <!-- END dev-agent-skills self-improvement protocol -->   │
│                                                          │
│ <!-- BEGIN dev-agent-skills session-memory protocol → │
│ This skill opted in to session-memory... read and        │  ← Injected by setup.sh, ONLY if
│ follow the session-memory protocol at: ...                │     session-memory: true is set
│ <!-- END dev-agent-skills session-memory protocol -->      │
│                                                          │
│ # Skill Title                                            │
│                                                          │
│ [Skill instructions — steps, decision tables, commands]  │  ← Written by skill author
│ **Session-reusable:** [marks a step eligible for reuse   │  ← Author-marked; only meaningful
│  within one session — only present in opted-in skills]   │     alongside session-memory: true
│                                                          │
│ ## Self-improvement                                      │
│ [Old Hermes-only footer — present in legacy skills,      │  ← Legacy (flagged by setup.sh,
│  flagged as redundant by setup.sh but left untouched]    │     harmless to leave)
└─────────────────────────────────────────────────────────┘
```

**Rules:**
- Frontmatter must be the first thing in the file, with `---` on its own line as both opener and closer
- `name` and `description` are required frontmatter fields
- `description` should start with "Use when..." and name specific trigger phrases
- Do not manually edit any of the three managed protocol blocks — they are regenerated by `setup.sh`. Clarification and self-improvement are injected into every skill unconditionally; session-memory is injected only into skills that set `session-memory: true`, and is removed automatically on a later run if that flag is removed
- A `**Session-reusable:**` marker only means anything in a skill that also has `session-memory: true` — see `config/SESSION-MEMORY-PROTOCOL.md`
- Everything after the managed blocks is the skill's own content and is never touched by any automation

---

### `.skillsets.json` schema

```json
{
  "skillsets": [
    {
      "source_repo": "https://github.com/<owner>/<repo>.git",
      "ref": null,                   // null = default branch; string = pinned ref
      "commit": "<full-sha>",        // SHA at time of last import
      "subdir": "skills",            // null if not specified
      "prefix": "superpowers",       // null if not specified
      "imported_skills": [
        {
          "final_name": "superpowers-brainstorming",   // folder name at repo root
          "source_path": "collaboration/brainstorming"  // path in source repo
        }
      ],
      "installed_at": "2026-06-25T10:49:00.000Z"
    }
  ]
}
```

Do not edit this file by hand. The `skill-add` and `skill-update` scripts manage it.

---

## Harness-specific notes

### OpenCode

- Skills are invoked via the tab-key skill picker, **not** as slash commands typed in chat
- `AGENT-STANDING-RULES.md` is loaded unconditionally via `instructions[]` in `opencode.json` — it applies to every session regardless of which project is open
- `permission.skill["*"] = "allow"` means skills can be loaded without per-skill permission prompts
- `permission.task = "ask"` is set if not already configured — this means spawning subagents/tasks prompts for confirmation rather than happening automatically
- The skills appear in OpenCode's skill picker at `~/.config/opencode/skills/`

### Hermes

- Skills must be **explicitly named** in the prompt — Hermes does not auto-select based on the request description
- Configured via `skills.external_dirs` in `~/.hermes/config.yaml` — the directory itself is added, not symlinks to individual skills
- `AGENT-STANDING-RULES.md` is not automatically loaded by Hermes (no equivalent of OpenCode's `instructions[]` mechanism has been confirmed working) — the SKILL.md injection layer (clarification + self-improvement protocol pointers) is the primary governance mechanism for Hermes
- The old `## Self-improvement` footer in `fix-bug/SKILL.md` was written for Hermes's built-in `skill_manage` tool — this is now superseded by the injected pointer

### Claude Code

- Uses slash commands: `/fix-bug`, `/plan-feature`, etc.
- Skills symlinked into `~/.claude/skills/`
- `AGENTS.md` in the project root (created automatically by Rule 0 the first time the agent runs in a project) provides the standing rules at project level

### Codex

- Skills symlinked into `~/.codex/skills/`
- Slash command invocation same as Claude Code

### Gemini CLI

- Skills symlinked into `~/.config/gemini/skills/`

---

## Governance rules quick reference

### Rule 0 — Create AGENTS.md
Check for `AGENTS.md` at the project root. If missing, create it by copying `AGENT-STANDING-RULES.md` verbatim. Never skip; never summarize.

### Rule 1 — Knowledge graph before everything
Run `test -f graphify-out/graph.json`. If exists, query it. If not, invoke the `graphify` skill by name. No exceptions for "simple" requests.

### Rule 2 — Load the matching skill
Load `fix-bug`, `plan-feature`, `sync-prs`, or similar via the skill-loading tool, by name. Before any exploration. Before any questions.

### Rule 3 — Clarify, then confirm, then act
Four steps in order:
1. Do you have enough? (If yes, skip to step 3)
2. Investigate with tools, ask exactly one focused question
3. Present plan: what you'll do + what you won't + what done looks like. Hard stop.
4. Act only after explicit yes.

### Rule 4 — Record real edge cases after finishing
Append a dated entry to `references/edge-cases.md` inside the skill folder if the skill's instructions didn't cover something you had to figure out. If uncertain whether it qualifies, don't write it. This rule is a wrap-up, not a gate.

---

## Verification quick reference

| What to check | Command |
|---|---|
| Protocols injected in a skill | `grep -c "BEGIN dev-agent-skills clarification protocol" fix-bug/SKILL.md` |
| Order is correct | `grep -n "BEGIN dev-agent-skills" fix-bug/SKILL.md` (clarification should have lower line number) |
| Symlinks exist | `ls -la ~/.claude/skills/fix-bug` |
| OpenCode config correct | `cat ~/.config/opencode/opencode.json \| grep -A2 instructions` |
| Hermes config correct | `grep -A5 external_dirs ~/.hermes/config.yaml` |
| What changed in a session | `git diff --stat` |
| TypeScript clean | `npx tsc --noEmit; echo "exit: $?"` |
| Edge cases logged correctly | `cat fix-bug/references/edge-cases.md` |
| Manifest state | `cat .skillsets.json \| python3 -c "import json,sys; [print(s['source_repo'], s['commit'][:10]) for s in json.load(sys.stdin)['skillsets']]"` |
