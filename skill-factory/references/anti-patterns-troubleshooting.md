# Anti-Patterns and Troubleshooting

Every entry here is a way a skill looks fine on read-through and then fails in practice. Check a draft against this list in Phase 3/4 before calling it done — most of these are invisible until someone actually tries to use the skill.

## Authoring anti-patterns

### 1. Vague description
**Symptom:** skill rarely or never loads automatically.
**Cause:** description states capability without a trigger condition, or is generic enough to match nothing in particular.
**Fix:** see `references/description-guide.md` — name literal phrases, not abstractions.

### 2. Instructions buried
**Symptom:** the skill loads, but Claude doesn't follow the important part of it.
**Cause:** critical instructions are somewhere in the middle of a long SKILL.md, with no visual weight.
**Fix:** put the critical instruction at the top, under a `## Critical` or `## Important` header; repeat it if genuinely load-bearing. Keep the body itself concise — bullet points and numbered steps over paragraphs; push detailed reference material into `references/` instead of inlining it.

### 3. Ambiguous language
**Symptom:** behavior is inconsistent between runs on similar inputs.
**Cause:** instructions like "make sure to validate things properly" — true statements that don't specify a check.
**Fix:** state the exact check. "CRITICAL: before calling X, verify: field is non-empty, at least one Y is assigned, date is not in the past" beats "validate things properly" because it's checkable, not just aspirational. For validations that really matter, prefer a bundled script over prose — code is deterministic, language instructions are open to interpretation.

### 4. Ambiguous scope (two skills wearing one description)
**Symptom:** description reads awkwardly no matter how it's worded, or the skill over-triggers on things that are only tangentially related.
**Cause:** the request actually covers two distinct trigger conditions that don't share a natural boundary.
**Fix:** split into two skills. Don't force a single description to cover both — that's usually what produces the vagueness in the first place.

### 5. Model "laziness" on tool calls
**Symptom:** skill loads, but the actual tool/MCP call gets skipped or half-done.
**Cause:** instructions describe the desired outcome without explicitly directing the tool invocation.
**Fix:** add explicit encouragement to actually do the thing — name the exact call, state that quality matters more than speed, state that validation steps aren't optional. This is more effective said directly in the instructions than left implicit. (This repo has already confirmed a stronger version of this problem: a harness may only reliably use a *named* skill at all, not just a named tool call within one — see `references/dev-agent-skills-integration.md`.)

## Structural / upload failures

| Symptom | Cause | Fix |
|---|---|---|
| Won't upload: "Could not find SKILL.md" | File misnamed/mis-cased | Rename exactly to `SKILL.md` |
| Won't upload: "Invalid frontmatter" | Missing `---` delimiters or unclosed quotes | Fix YAML delimiters/quoting |
| Won't upload: "Invalid skill name" | Spaces/capitals/underscores, or reserved prefix | Rewrite kebab-case, no `claude`/`anthropic` prefix |
| Skill never triggers | See "Vague description" above | Rewrite description with literal trigger phrases |
| Skill triggers on unrelated queries | Description too broad, no negative-trigger clause | Narrow "what it does," add explicit "do NOT use for X" |
| Loads, but instructions aren't followed | Buried critical instructions, or ambiguous language | See #2 and #3 above |

## MCP / external-tool connection issues

**Symptom:** skill loads, but the underlying tool call fails.
**Checklist to work through, in order:**
1. Confirm the connector/server is actually connected (not just referenced in the skill).
2. Confirm credentials are valid, not expired, and scoped correctly.
3. Test the tool independently of the skill — ask for the raw tool call directly. If that also fails, the problem is the connector, not the skill.
4. Confirm the tool name referenced in the skill matches exactly (tool names are case-sensitive) — check the source documentation, don't assume.

## Large-context / performance issues

**Symptom:** responses feel slower or lower-quality once a skill is active.
**Causes:** the skill's own content is too large, too many skills are enabled at once, or content that should be progressively disclosed is all being loaded inline instead.
**Fixes:**
- Keep `SKILL.md` itself well under the practical ceiling (roughly 500 lines / a few thousand words) — move detail to `references/` and link to it instead of inlining.
- If many skills are active simultaneously (a rough danger zone is 20–50+), consider whether some should be split into an opt-in "pack" rather than always-on.

## The pre-upload checklist

Run through this before considering any generated skill finished:

- [ ] Folder named in kebab-case, matches `name` in frontmatter
- [ ] `SKILL.md` exists with exact spelling, single file, at the folder root
- [ ] YAML frontmatter has both `---` delimiters
- [ ] `name`: kebab-case, no spaces/capitals, no reserved prefix
- [ ] `description`: states both what and when, includes literal trigger phrases, under 1024 chars, no `<`/`>`
- [ ] No XML angle brackets anywhere in the frontmatter
- [ ] Instructions are concrete and actionable, not aspirational
- [ ] Error handling / edge cases are addressed explicitly
- [ ] At least one concrete example is included
- [ ] Any references are clearly linked with guidance on when to open them
- [ ] No `README.md` inside the skill folder
- [ ] Passes `scripts/validate_skill.py` with no errors
