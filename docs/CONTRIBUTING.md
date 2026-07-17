# Contributing a new skill

There are two ways a skill ends up in this repo: write one from scratch
(below), or pull in an existing one from another repo (see
"Installing an existing skillset" at the bottom). Either way, the result
is the same: a folder at the repo root containing a `SKILL.md`.

Adding a new skill from scratch is drag-and-drop. The only rule: every
skill folder must contain a `SKILL.md` at its root. Everything else is
optional.

> Looking for what changed recently, or why something behaves the way it does? See [`HISTORY.md`](./HISTORY.md). Building something that dispatches to several sub-skills rather than one self-contained workflow? See [`03-MANAGING-SKILLS.md`](./03-MANAGING-SKILLS.md)'s "Writing a master/dispatcher skill" section instead of this page — `coding-standards` is the worked example.

## The convention

```
your-skill-name/           ← kebab-case folder name
├── SKILL.md               ← required. the agent reads this.
├── README.md              ← recommended, not required. humans read this.
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

**Does one of your steps only gather information, and would it be wasteful to
re-run if it already ran earlier in the same conversation?** You may be able
to opt that step into session-memory rather than have it re-run every time —
see [`03-MANAGING-SKILLS.md`](./03-MANAGING-SKILLS.md)'s "Opting into
session-memory" section. Most skills don't need this; it's specifically for
read-only steps that plausibly repeat within one session and whose answer
can't be invalidated by anything else done in that same session. A knowledge
graph check is the canonical thing that does *not* qualify.

## Step 3 — Write README.md

Not strictly required (`validate_skill.py` warns, doesn't reject, if it's
missing), but every skill in this repo should still have one — it's the
first thing a human browsing the repo actually reads. Cover:

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

The actual rules live in one place: [`SELF-IMPROVEMENT-PROTOCOL.md`](../config/SELF-IMPROVEMENT-PROTOCOL.md).
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

## Session-memory (opt-in, not automatic — different from the above)

Unlike self-improvement, this one is **not** injected into every skill by
default — most skills don't need it. It's for the specific, narrower case of
a step that only gathers information, plausibly gets reached more than once
in one session, and whose answer can't be invalidated by anything else done
in that same session (see the note in Step 2 above). If none of your steps
fit that description, there's nothing to do here.

If one does: add `session-memory: true` to your frontmatter and mark the
specific step with `**Session-reusable:**`. Full mechanism in
[`SESSION-MEMORY-PROTOCOL.md`](../config/SESSION-MEMORY-PROTOCOL.md), full
authoring guidance in
[`03-MANAGING-SKILLS.md`](./03-MANAGING-SKILLS.md#opting-into-session-memory).

## Graph-memory (opt-in, narrower still — only fits a specific shape)

Also not injected by default. Narrower than session-memory in a different
way: it only fits a skill that genuinely queries the knowledge graph to
understand code, then later has a real, observable outcome to report on.
Two required ingredients, both needed — a point where you're about to rely
on graph query results, and a later point where you actually know whether
that reliance paid off. If your skill only has the first (queries the graph
but never reports a concrete outcome), this doesn't fit; don't force it in.

If your skill genuinely has both: add `graph-memory: true` to your
frontmatter and mark **both** points with `**Graph-memory:**` — one at the
query-reliance point, one at the outcome point. Both are required; a skill
with only one marked point is a half-finished opt-in the validator won't
fully catch (see `05-TROUBLESHOOTING.md`). Full mechanism in
[`GRAPH-MEMORY-PROTOCOL.md`](../config/GRAPH-MEMORY-PROTOCOL.md), full
authoring guidance in
[`03-MANAGING-SKILLS.md`](./03-MANAGING-SKILLS.md#opting-into-graph-memory).

## Installing an existing skillset

If the skill (or set of skills) you want already exists in another repo —
your own, a teammate's, or a public one like
[obra/superpowers-skills](https://github.com/obra/superpowers-skills) — you
don't need to recreate it by hand. Use the `skill-add` skill:

```
/skill-add <git-url> [--subdir <path>] [--prefix <name>] [--only a,b,c] [--dry-run]
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

`skill-add` vendors a skillset's files — it copies them in,
flattened, rather than tracking the source as a live reference. That's
deliberate (this repo's convention is one folder per skill, and a
submodule would need the same flattening logic plus real git complexity
for every teammate) but it means upstream fixes don't reach you on their
own. `.skillsets.json` is the record of exactly what was imported from
where, and the `skill-update` skill reads it:

```
/skill-update
```

This re-clones every tracked source, compares actual content (not just
the commit SHA — a new upstream commit that didn't touch the skills you
imported is correctly reported as "nothing to update"), and refreshes
only what changed. Run it on whatever cadence makes sense for you — there's
nothing automatic about it yet; see the open question about scheduled
local sync in the project's handoff notes if you want it to run itself.
