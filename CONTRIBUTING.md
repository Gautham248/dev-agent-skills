# Contributing a new skill

There are two ways a skill ends up in this repo: write one from scratch
(below), or pull in an existing one from another repo (see
"Installing an existing skillset" at the bottom). Either way, the result
is the same: a folder at the repo root containing a `SKILL.md`.

Adding a new skill from scratch is drag-and-drop. The only rule: every
skill folder must contain a `SKILL.md` at its root. Everything else is
optional.

## The convention

```
your-skill-name/           ← kebab-case folder name
├── SKILL.md               ← required. the agent reads this.
├── README.md              ← required. humans read this.
├── scripts/               ← optional. TypeScript helpers.
│   └── main.ts
├── assets/                ← optional. templates, scaffolds.
│   └── template.ts
└── references/            ← optional. deep-dive docs.
    └── guide.md
```

## Step 1 — Create the folder

```bash
cd ~/dev-agent-skills
mkdir your-skill-name
```

## Step 2 — Write SKILL.md

Every `SKILL.md` must start with this frontmatter:

```markdown
---
name: your-skill-name
description: >
  One paragraph. Start with "Use when..." and describe the trigger phrases
  that should activate this skill. Be specific enough that the agent loads
  this skill for the right requests and not for unrelated ones.
---
```

Then write the skill body. Structure it around **what the agent should do**,
not what the skill is. Use numbered steps for sequential workflows. Use
decision tables for conditional logic. Name real commands, real file paths,
real flags.

See [`fix-bug/SKILL.md`](./fix-bug/SKILL.md) and
[`sync-prs/SKILL.md`](./sync-prs/SKILL.md) as reference examples.

## Step 3 — Write README.md

The README is for humans. Cover:

- What the skill does (2–3 sentences)
- Who it's for
- Prerequisites
- Install instructions (copy the table from another README and update paths)
- Usage examples (3 natural language prompts)

## Step 4 — Commit and push

```bash
git add your-skill-name/
git commit -m "add: your-skill-name"
git push
```

## Step 5 — Everyone else picks it up

```bash
git pull
bash setup.sh
```

## Rules

- **One `SKILL.md` per folder.** The setup script scans for `SKILL.md` files.
  No registration file to update.
- **Folder name = skill name.** The folder name is what appears in slash commands.
  Use kebab-case.
- **Self-contained.** A skill must work without depending on another skill.
  Reference other skills in "See also" if relevant, but don't require them.
- **No hardcoded org names.** Skills must work for any developer on any repo.
  Use placeholders like `<owner>/<repo>` rather than specific repo names.
- **Scripts in TypeScript.** If your skill includes a helper script, write it
  in TypeScript (`.ts`) using `tsx` as the runner. Follow the pattern in
  [`sync-prs/scripts/sync.ts`](./sync-prs/scripts/sync.ts).

## Self-improvement (automatic, every skill, any harness)

Every skill in this repo gets a self-improvement pointer injected
automatically by `setup.sh` — right after the clarification-protocol
pointer, same mechanism, same idempotent managed-block pattern. You don't
need to do anything in your skill for this to apply; it's universal, not
opt-in.

The actual rules live in one place: [`SELF-IMPROVEMENT-PROTOCOL.md`](./SELF-IMPROVEMENT-PROTOCOL.md).
In short: when an agent using a skill hits a real edge case the skill's
instructions didn't cover, it appends a dated entry to that skill's own
`references/edge-cases.md` (creating the file if it doesn't exist yet) and
touches nothing else.

This used to be opt-in and described as "Hermes only" — it relied on
Hermes's built-in `skill_manage` tool and a hand-written `## Self-improvement`
footer at the bottom of a skill's `SKILL.md`. That footer pattern is
superseded by the injected pointer now (any harness with a plain
file-write capability can act on it, no special tool required) — if an
older skill still has that footer, `setup.sh` will flag it as redundant
rather than silently leaving two different versions of the same
instruction in the same file. It's harmless to leave, but worth removing
by hand once you've confirmed it doesn't say anything the injected
pointer doesn't already cover.

## Installing an existing skillset

If the skill (or set of skills) you want already exists in another repo —
your own, a teammate's, or a public one like
[obra/superpowers-skills](https://github.com/obra/superpowers-skills) — you
don't need to recreate it by hand. Use `install-skillset.sh`:

```bash
bash install-skillset.sh <git-url> [--subdir <path>] [--prefix <name>] [--only a,b,c] [--dry-run]
```

This finds every `SKILL.md` in the source repo (at any depth — it doesn't
need to match this repo's flat one-folder-per-skill layout, it gets
flattened into that shape automatically), copies each skill in under its
own folder here, rewrites cross-skill references it can confidently
resolve, records what came from where in `.skillsets.json` /
`SKILLSETS.md`, regenerates the README table, and runs `setup.sh`.

A few things worth knowing before you reach for it:

- **Always run with `--dry-run` first** on a skillset you haven't looked at
  before, so you can see exactly what folder names it would create before
  anything touches disk.
- **Use `--prefix`** for anything that isn't a small, hand-picked set of
  skills you've already read — it's the difference between
  `requesting-code-review` silently colliding with something you already
  have, and `superpowers-requesting-code-review` living alongside it
  safely.
- **Read the cross-reference warnings it prints.** The rewriter resolves
  what it can (a source skill referring to another skill in the same
  import gets pointed at the new flattened name), but anything it can't
  confidently resolve — a reference to a skill you excluded with `--only`,
  a placeholder/example path in someone's documentation, a reference to
  something that genuinely doesn't exist in the source repo — gets flagged
  instead of silently left broken or silently dropped. A handful of
  leftover warnings pointing at obvious documentation placeholders is
  normal; anything that looks like a real, broken reference to a skill you
  did import is worth a quick manual fix.
- **Re-running an install for the same source repo updates in place**
  (tracked via `.skillsets.json`) rather than refusing on a "this already
  exists" collision — that's how you pick up upstream changes later.
- Whatever you import is still subject to the same rule as everything
  else in this repo: it should be self-contained and work without
  depending on a skill that isn't here. If the cross-reference warnings
  point at something missing, either import it too (drop `--only`, or add
  the missing name to it) or accept that skill will be incomplete here.

## Keeping an installed skillset current

`install-skillset.sh` vendors a skillset's files — it copies them in,
flattened, rather than tracking the source as a live reference. That's
deliberate (this repo's convention is one folder per skill, and a
submodule would need the same flattening logic plus real git complexity
for every teammate) but it means upstream fixes don't reach you on their
own. `.skillsets.json` is the record of exactly what was imported from
where, and `update-skillsets.sh` is what reads it:

```bash
bash update-skillsets.sh
```

This re-clones every tracked source, compares actual content (not just
the commit SHA — a new upstream commit that didn't touch the skills you
imported is correctly reported as "nothing to update"), and refreshes
only what changed. Run it on whatever cadence makes sense for you — there's
nothing automatic about it yet; see the open question about scheduled
local sync in the project's handoff notes if you want it to run itself.
