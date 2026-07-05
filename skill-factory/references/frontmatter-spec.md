# YAML Frontmatter Specification

The frontmatter is the only part of a skill that's always loaded — it's what Claude (or Hermes) sees before deciding whether to load the rest. Getting it wrong either breaks upload entirely or quietly kills triggering. Treat every rule here as non-negotiable, not a style preference.

## Minimal valid frontmatter

```yaml
---
name: your-skill-name
description: What it does. Use when the user asks to [specific phrases].
---
```

That's a complete, valid skill header. Everything else is optional.

## `name` — required

- kebab-case only: lowercase letters, digits, hyphens.
- No spaces, no capitals, no underscores.
- Cannot start or end with a hyphen; no consecutive hyphens.
- Maximum 64 characters.
- Must not begin with `claude` or `anthropic` — those prefixes are reserved.
- Should match the containing folder name exactly.

| Valid | Invalid | Why |
|---|---|---|
| `notion-project-setup` | `Notion Project Setup` | spaces, capitals |
| `fix-bug` | `fix_bug` | underscore |
| `payments-link-fixer` | `-payments-link-fixer` | leading hyphen |

## `description` — required

Must include **both** what the skill does and when to use it (trigger conditions). This single field is the entire first level of progressive disclosure — it's all Claude has to decide relevance before loading anything else, so vagueness here is the single most common reason a skill never triggers.

- Maximum 1024 characters.
- No angle brackets (`<` or `>`) anywhere — this is a hard security restriction because frontmatter lands in the system prompt; angle brackets could be mistaken for injected instructions.
- Include literal phrases a user might actually type, not just an abstract capability description.
- Mention relevant file types if the skill is triggered by file uploads.

See `references/description-guide.md` for the full write-up on crafting this well, with good/bad examples.

## `license` — optional

Only relevant for open-source distribution. Common values: `MIT`, `Apache-2.0`.

## `compatibility` — optional

1–500 characters. States environment requirements: a required system package, network access, a specific product surface. Example: `Requires network access to the target GitHub org and a Graphify binary on PATH.`

## `allowed-tools` — optional

Restricts which tools the skill may invoke, e.g. `Bash(python:*) Bash(npm:*) WebFetch`. Use when a skill should be scoped away from tools it has no legitimate reason to touch.

## `metadata` — optional

Free-form key/value block for anything else worth recording:

```yaml
metadata:
  author: 10xMinds
  version: 1.0.0
  category: workflow-automation
  tags: [bug-fix, github]
```

## Nothing else is allowed

Any key outside `name`, `description`, `license`, `compatibility`, `allowed-tools`, `metadata` should be treated as a mistake, not a creative extension — the parser only recognizes this set.

## File-level rules that aren't frontmatter but break things just as badly

- The file must be named exactly `SKILL.md` — case-sensitive, no `SKILL.MD`, `skill.md`, or similar.
- Exactly one `SKILL.md` per skill, at `<skill-folder>/SKILL.md`. Nested `SKILL.md` files inside `scripts/`, `references/`, or `assets/` will break upload even though Claude Code's raw filesystem loader tolerates them.
- Do not include a `README.md` inside the skill folder itself — all instructions belong in `SKILL.md` or `references/`. (A repo-level README for human visitors browsing `dev-agent-skills` on GitHub is a separate, legitimate thing — that's not what this rule is about.)

## Common breakage and the fix

| Symptom | Cause | Fix |
|---|---|---|
| "Could not find SKILL.md in uploaded folder" | File misnamed or mis-cased | Rename to exactly `SKILL.md`; verify with `ls -la` |
| "Invalid frontmatter" | Missing `---` delimiters, or unclosed quotes | Confirm both delimiters are present and any quoted string is properly closed |
| "Invalid skill name" | Spaces, capitals, or a reserved prefix in `name` | Rewrite in kebab-case, drop `claude`/`anthropic` prefix |
| Description silently truncated or rejected | Over 1024 characters, or contains `<`/`>` | Trim and remove angle brackets |
| "Invalid YAML in frontmatter" pointing at the description line | The description value starts with `[` or `{` — YAML reads that as the start of a flow sequence/mapping, not literal text, and chokes on whatever comes after | Don't start a frontmatter value with `[`, `{`, `*`, `&`, `?`, `\|`, `>`, or a quote character unless you mean the YAML special meaning. When drafting placeholder text, use plain words (`TRIGGER_PHRASE_ONE`) instead of bracketed placeholders (`[trigger phrase]`) in the description line specifically |
