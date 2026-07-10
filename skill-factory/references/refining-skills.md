# Refining an Existing Skill (Track B)

Full detail behind "Track B" in `SKILL.md`. Read this before touching any file that already exists.

## Why refining is a different job than creating

A working skill already encodes a spec — it's just implicit, spread across `SKILL.md` and whatever it has accumulated in `references/`. Re-running the full 13-slot interview from Phase 1 on a skill that already works in 90% of cases is slow, annoying to whoever's asking, and actively risky: re-asking about things that already have a correct answer invites a slightly different answer this time, drifting the skill for no reason. Track B exists to interview only the actual delta and leave everything else alone.

## Phase R0 — Read and fully understand the current skill, in detail

"Fully understand" is doing real work in that phase name — it means:

- Read `SKILL.md` end to end. Not the first paragraph, not just the frontmatter — every instruction, every example, every troubleshooting entry.
- Open every file that exists under `references/`, `scripts/`, `assets/` and actually read it, not just note that it exists. A stale or wrong reference file is exactly as likely to be the real problem as `SKILL.md` itself.
- If `references/edge-cases.md` exists, read every entry. This file is the skill's own field history — real failures someone already worked through. It's the single best source of context for what "refine" should actually target, and it directly informs whether a reported problem is new or a repeat of something already documented (in which case the real bug might be that the fix from that entry never made it into `SKILL.md` itself — worth checking).
- Run `scripts/validate_skill.py <path>` immediately, before interviewing anyone. This gives an objective, structural baseline (frontmatter issues, missing pieces, size warnings) independent of whatever the requester believes is wrong — sometimes the reported symptom and the actual structural issue are different things.
- Backfill the Skill Specification table (from Phase 1 of `SKILL.md`) by reading what's there. This is reconstruction work you do yourself, not a set of questions to ask the requester — they already answered these once, when the skill was first built.

## Phase R1 — Interview: what's changing, and why

Lead with a closed question about the *category* of change, since it shapes everything after:

- **Mistrigger** — loads too often, too rarely, or on the wrong things.
- **Wrong output** — it loads correctly but does the wrong thing, or does the right thing badly.
- **Missing capability** — a new case it should handle but doesn't yet.
- **Structural cleanup** — nothing's actually broken, just wants better organization, clearer references, or size trimmed.

Each category points at a different part of the spec, which narrows the rest of the interview fast.

**If the trigger is a specific past failure**, don't let it turn into a vague prose edit to `SKILL.md`. Get it to the same level of detail `SELF-IMPROVEMENT-PROTOCOL.md` requires for a proper edge-case entry:
- What happened, concretely — the actual input, the actual (wrong) output or behavior.
- What should have happened instead.

That pairing is what gets appended to `references/edge-cases.md` in Phase R3 — treat it with the same rigor as if the acting agent had hit it live and were writing the entry itself, just gathered through conversation instead of through direct experience.

**Scope check:** only interview slots that are actually changing. State plainly which slots you're treating as unchanged (reused from R0's backfill) so the requester can correct you if one of those assumptions is wrong too — don't silently assume everything else is fine just because it wasn't mentioned.

**If the described change implies a different category or pattern** (`references/design-patterns.md`) than the skill currently uses — e.g., what sounds like "just fix the description" turns out to need a completely different workflow shape — say so explicitly. A refine request can legitimately turn into "this needs restructuring, not tweaking." Don't force a pattern mismatch to fit inside a small edit just because that's what was originally asked for.

**Renaming is not a refinement.** If the request is actually "rename this skill," treat it as retiring the old one and creating a new one via Track A — a rename touches the folder name, the frontmatter `name`, every cross-reference to it elsewhere in the repo, and the README table regeneration. Track B's delta-based approach isn't built for that; don't try to make it fit.

## Phase R2 — Confirm the delta

Don't re-run the full `assets/spec-summary-template.md` sign-off from scratch. Present a shorter, diff-shaped summary instead:

```
Changing:
- <slot>: <old> → <new>
- <slot>: <old> → <new>

Staying exactly the same: everything else in the current skill.

New edge case(s) being recorded:
- <what happened> → <what should happen instead>
```

Same sign-off bar as Phase 2 (see `references/interview-protocol.md`'s "sign-off" section) — an explicit affirmative, not silence or a topic change, before touching any file.

## Phase R3 — Apply the changes

- Hold every edit to the same bar as a new skill: `references/frontmatter-spec.md` and `references/description-guide.md` apply exactly as strictly to a one-line description tweak as to a from-scratch write.
- **Never touch the managed blocks.** The clarification-protocol and self-improvement-protocol pointers injected right after frontmatter are `setup.sh`'s territory (`references/dev-agent-skills-integration.md`) — if your edit needs to land near them, work around them, and don't "clean them up" even if they look redundant with something you just wrote.
- **`references/edge-cases.md` is append-only, always.** If it doesn't exist yet (this skill predates the convention, or never hit a real edge case), create it now with a one-line header — don't wait for the next runtime failure to be the first entry. If it already has entries, every one of them stays exactly as written; add new entries after them, in the dated format from `SELF-IMPROVEMENT-PROTOCOL.md`, and never edit or remove a prior entry as part of a refine pass — that file is a historical record, not a draft.
- **Close the loop — this is the part that's easy to miss.** `SELF-IMPROVEMENT-PROTOCOL.md` (injected into every skill) already tells the acting agent to *write* to `edge-cases.md` after it works through something new. It does not tell the agent to *read* that file when something looks off *during* a run — so unless `SKILL.md` itself says so, a documented, already-solved gotcha can get silently re-discovered from scratch every time. Every skill's `SKILL.md` should contain a short section along these lines (verbatim wording can vary, the instruction can't be missing):

  ```markdown
  ## If something goes wrong

  Before improvising a fix, check `references/edge-cases.md` — this may
  already be a documented, solved problem. If it's genuinely new once
  you're done, follow the self-improvement protocol and add it there.
  ```

  If the skill being refined predates this convention, add it now regardless of whether that's the reason you were asked to refine the skill — it's cheap, it's always correct to have, and it directly closes the read/write asymmetry between the two protocols.

## Phase R4 — Validate and show the real diff

Re-run `scripts/validate_skill.py`. Then show the actual before/after diff of every file you changed — not a description of what changed. This matches Phase 5's discipline exactly, and matters more here, since a small refine that "just changes the description" can silently touch more than intended if you're not looking at the literal diff.

## Phase R5 — Testing and integration handoff

Same as Phases 6–7 (`references/testing-checklist.md`, `references/dev-agent-skills-integration.md`), with one addition: include at least one **regression** check — a trigger phrase or behavior that worked correctly before this change — alongside the tests for whatever's new. A refine that fixes the reported problem but silently breaks something that used to work is a net loss, and it's the one failure mode a testing plan built only around the new change would never catch.

## Track A vs. Track B, side by side

| | Track A — new skill | Track B — refine |
|---|---|---|
| Interview scope | All 13 slots | Only the slots that changed |
| Starting point | Blank | Existing `SKILL.md` + all bundled files, read in full |
| Sign-off format | Full `assets/spec-summary-template.md` | Short before/after delta |
| `edge-cases.md` | Scaffold if the skill will need one | Scaffold if missing; otherwise append-only, never rewritten |
| Validation | Once, before Phase 5 | Once at R0 (baseline), once at R4 (after) |
| Testing | New trigger/negative-trigger tests | New tests *plus* a regression check on prior behavior |
