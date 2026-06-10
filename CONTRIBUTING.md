# Contributing a new skill

Adding a new skill is drag-and-drop. The only rule: every skill folder must
contain a `SKILL.md` at its root. Everything else is optional.

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

## Self-improvement (Hermes only)

If your skill has a `references/edge-cases.md` file, Hermes will append to it
automatically when it encounters edge cases not covered by the skill. Include
this section at the bottom of your `SKILL.md` to enable it:

```markdown
## Self-improvement

When you encounter an edge case not covered by this skill, append it to
`references/edge-cases.md` under a new dated entry. Do not modify any other
section of this skill without explicit instruction.
```
