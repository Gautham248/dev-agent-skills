---
name: skill-factory
description: Interviews the requester through a structured clarification protocol, then designs, writes, and validates a new Agent Skill (SKILL.md plus scripts/references/assets) for the dev-agent-skills repo — or refines an existing one. Use when someone asks to "create a skill", "build a skill for X", "add a new skill to dev-agent-skills", "turn this workflow into a skill", "make this repeatable", or "scaffold a SKILL.md". Also use to refine, review, validate, or fix an existing skill's frontmatter, triggering, structure, or edge-case handling ("refine this skill", "why doesn't my skill trigger", "check this skill", "improve this skill's description", "add edge cases to this skill"). Do not use for ordinary bug fixes or feature work that isn't about authoring a skill itself — route those to fix-bug or plan-feature instead.
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

# Skill Factory

A skill that builds other skills. Its entire value is refusing to guess: it turns a vague or poorly-worded request into a fully specified, unambiguous Agent Skill by running a structured interview first, and only writes files once the requester has explicitly signed off on a spec summary.

Treat every request this skill receives — no matter how the person phrases it — as an under-specified brief that must be completed before a single file is written. A rushed skill that half-matches what someone meant is worse than no skill: it will mistrigger or misbehave in production, and it is the exact failure mode this skill exists to prevent.

## Core rule: interview before you write

**Never draft a SKILL.md, never create a folder, never run the scaffolder until every required slot in the Skill Specification (see below) has a concrete, requester-confirmed value.** If you catch yourself about to write "the skill should probably handle X" — stop, and ask instead of assuming. This applies even under time pressure, even if the requester says "just make something reasonable," and even if you're confident you know what they mean. A confident guess that turns out wrong costs more than one extra question.

The one exception: if the current conversation already contains the workflow being captured (someone did the work in chat and now says "turn this into a skill"), mine that transcript for every slot you can fill, then only ask about genuine gaps. Never re-ask something already answered earlier in the conversation.

## Communicating with a weak or vague brief

This skill must work even when the requester struggles to articulate what they want. That is the default case to design for, not the edge case. Full protocol: `references/interview-protocol.md`. The load-bearing rules:

1. **One open question at a time.** A wall of questions gets a wall of vague answers. If several small facts are needed and the space of likely answers is small, offer a short numbered/lettered list instead of an open question — picking a number is easier than composing a sentence.
2. **Never accept a vague answer as final.** Answers like "make it good," "you decide," "whatever's best," or anything under about four words for a substantive slot are not answers — they're a signal to propose a concrete default yourself, phrase it as a yes/no ("So when someone says 'the signup button is broken,' the skill should find the file, fix it, and open a PR — is that right, or did you want it to just describe the fix?"), and wait for confirmation.
3. **Anchor abstractions in a concrete example immediately.** Don't ask "what's the trigger condition?" — ask "what's something you'd actually type to kick this off?" and offer a guess based on context to react to.
4. **Recap every few answers.** After roughly three slots are filled, restate the emerging picture in one or two plain sentences and ask "does that still sound right?" before continuing. Catching a misunderstanding at slot four is cheap; catching it after the file is written is not.
5. **Confirmations are explicit, not assumed.** A topic change, silence, or an "ok" that doesn't address the substance of what was asked is not a yes. If in doubt, restate what you think was agreed and ask once more.

## Workflow

### Phase 0 — Classify the request
Is this: (a) a brand-new skill, (b) a refinement of an existing skill (fix a mistrigger, add a capability, tighten the description, fold in a real failure as a documented edge case, restructure), or (c) a validation-only check ("does this skill look right")? For (a), continue with Phase 1 below. For (b), stop here and switch to **Track B — Refining an Existing Skill** (further down this file) — do not run the Phase 1 interview from scratch; Track B is built specifically to interview only the delta. For (c), just run `scripts/validate_skill.py` and check against `references/anti-patterns-troubleshooting.md`, report findings, and stop — no interview, no file changes.

### Phase 1 — Run the interview
Work through the Skill Specification slots below using the communication rules above and the full question bank in `references/interview-protocol.md`. Pull in `references/design-patterns.md` when discussing the workflow shape (sequential steps, multi-tool coordination, iterative refinement, context-aware branching, or embedded domain rules) — matching the request to one of these patterns early makes the remaining questions much more concrete.

**The Skill Specification (every field required before Phase 2):**

| Slot | What you need |
|---|---|
| `skill_name` | kebab-case, unique within `dev-agent-skills`, no `claude`/`anthropic` prefix |
| `one_line_purpose` | One plain sentence: what does this skill let someone accomplish |
| `category` | document-creation \| workflow-automation \| mcp-enhancement \| hybrid |
| `trigger_phrases_positive` | ≥3 concrete example messages that should load this skill |
| `trigger_phrases_negative` | ≥2 concrete example messages that should NOT load it |
| `workflow_steps` | Ordered, concrete steps, including decision points/branches |
| `tools_required` | Built-in only, specific MCP tools, bundled scripts, or dev-agent internals (Hermes, Graphify, GitHub App) |
| `inputs_and_outputs` | What comes in, what goes out, and in what format |
| `edge_cases_and_errors` | ≥2 realistic failure modes and the desired behavior for each |
| `success_criteria` | ≥1 quantitative signal and ≥1 qualitative signal of correct behavior |
| `test_cases` | Whether verification tests make sense for this skill, and 2–3 sample prompts if so |
| `dependencies` | Runtime/package/network requirements for any bundled scripts |
| `bundled_resources` | Which of `scripts/`, `references/`, `assets/` this skill actually needs, and why |

If a use case is dragging in two unrelated trigger conditions that would make the description vague or cause over-triggering, say so and propose splitting into two skills — don't force one skill to cover both. See "Ambiguous scope" in `references/anti-patterns-troubleshooting.md`.

### Phase 2 — Confirm the spec
Fill `assets/spec-summary-template.md` with everything gathered and show it to the requester verbatim, as a single block, before writing anything. Require an explicit affirmative ("yes," "looks right," "go ahead," a specific correction accepted and re-confirmed) before moving on. This is the single most important checkpoint in this whole skill — it is where a misunderstanding gets caught for the cost of one message instead of a rewrite.

### Phase 3 — Draft the files
Copy `assets/skill-template.md` as the starting point and fill it in using the confirmed spec. Frontmatter rules are non-negotiable — see `references/frontmatter-spec.md` for the full spec and `references/description-guide.md` for how to write a description that actually triggers reliably (this is the single highest-leverage sentence in the whole skill; treat it accordingly). Move anything beyond core instructions into `references/`; anything the output will literally use (templates, boilerplate) into `assets/`; anything deterministic/checkable-by-code into `scripts/`. Keep `SKILL.md` itself well under 500 lines — if the draft is creeping past that, that's a signal to push more into `references/` and leave a clear pointer, not to write more compactly.

Do **not** hand-author a self-improvement or clarification-protocol block into the new skill. In this repo those managed blocks are injected automatically by `setup.sh` (via `strip_managed_block`) after the skill is created — see `references/dev-agent-skills-integration.md` before finishing this phase, it contains a real gotcha about `SkillsSync` that will silently break things if skipped.

### Phase 4 — Validate
Run `python3 scripts/validate_skill.py <path-to-new-skill>`. Fix anything it flags. This checks structural rules a description review won't catch (frontmatter shape, forbidden characters, naming, size, an accidental README.md, and name collisions against the known dev-agent-skills roster).

### Phase 5 — Show the real files, not a summary
Show the requester the actual generated `SKILL.md` content (and any non-trivial reference/script files), not a description of what you made. Ask if it matches what was agreed in Phase 2. Iterate here rather than after it's already committed.

### Phase 6 — Testing plan
Using `references/testing-checklist.md`, give the requester: 2–3 prompts that should trigger the skill, 1–2 that should not, and — if `test_cases` was yes in the spec — a small functional test (input → expected result) they can run. Don't run automated evals yourself; hand over the checklist and let them decide how rigorously to test.

### Phase 7 — Integration handoff
Point to `references/dev-agent-skills-integration.md` for the exact next steps: where the folder goes, running `setup.sh` before commit (not after), verifying the resulting diff instead of trusting a summary, and — if this skill should be reachable from the `dev-agent` job pipeline rather than only invoked manually — a reminder that Hermes only reliably picks up a skill when it's explicitly named, so it likely also needs a `JOB_TYPE_SKILL` entry in `dev-agent`, not just a good description.

## Track B — Refining an Existing Skill

A refinement is not a from-scratch interview. Most of a working skill's spec is already correct; the job is to find the delta, confirm it, and change only that — while still holding every change to the same frontmatter/description/structural bar as a new skill. Full detail for every phase below: `references/refining-skills.md`.

### Phase R0 — Read and fully understand the current skill
Locate the skill folder (ask if ambiguous). Read `SKILL.md` in full — frontmatter and every instruction, not a skim. Read every file that exists under `references/`, `scripts/`, `assets/`, including `references/edge-cases.md` if present — that file is the skill's own accumulated field experience and directly shapes what refining it should address. Run `scripts/validate_skill.py <path>` now, before talking to anyone, to get an objective structural baseline independent of what the requester thinks is wrong. Then mentally backfill the Skill Specification table from Phase 1 by reading the existing skill — this is reconstruction, not a question to ask.

### Phase R1 — Interview: what's changing, and why
Find out what actually prompted this — a closed question first: "did this trigger wrong, produce a wrong result, or is this about adding something it doesn't do yet?" Use the same interview technique as Phase 1 (`references/interview-protocol.md`): one question at a time, propose-and-confirm for vague answers, recap every few exchanges. Only interview the slots that are actually changing — reuse the rest from Phase R0's backfill without re-asking. If the requester is describing a specific past failure, treat it explicitly as edge-case material (see Phase R3) rather than folding it into a vague prose rewrite — get enough detail to state what happened and what should happen instead, concretely.

### Phase R2 — Confirm the delta
Present a before/after summary — "changing: X, Y. Staying exactly the same: everything else" — not a full spec from scratch. Same sign-off bar as Phase 2: an explicit affirmative before touching any file.

### Phase R3 — Apply the changes
Edit only what changed, holding every edit to `references/frontmatter-spec.md` and `references/description-guide.md` exactly as strictly as Phase 3 does. Do not touch the managed clarification/self-improvement blocks near the top of the file — that's `setup.sh`'s territory (`references/dev-agent-skills-integration.md`). Ensure `references/edge-cases.md` exists — scaffold it now if this skill predates that convention — and append any edge cases surfaced in R1 in the dated format `SELF-IMPROVEMENT-PROTOCOL.md` specifies, never rewriting or removing an existing entry. Ensure `SKILL.md`'s body explicitly tells the acting agent to consult `references/edge-cases.md` when something unexpected happens *during* use, not only append to it afterward — add this line if the skill predates it (see "Closing the loop" in `references/refining-skills.md`).

### Phase R4 — Validate and show the real diff
Re-run `scripts/validate_skill.py`. Show the actual before/after diff of every changed file, not a description of the changes — same discipline as Phase 5.

### Phase R5 — Testing and integration handoff
Same as Phases 6–7, plus one addition specific to refining: include a regression check — confirm a trigger phrase or behavior that worked *before* this change still works the same way now, not just that the new behavior works.

## Quick reference index

- Full interview question bank & weak-communicator handling → `references/interview-protocol.md`
- Full detail for refining an existing skill (Track B) → `references/refining-skills.md`
- Complete YAML frontmatter spec, allowed/forbidden fields → `references/frontmatter-spec.md`
- How to write a description that triggers correctly → `references/description-guide.md`
- The five workflow-shape patterns to choose from → `references/design-patterns.md`
- Every known way a skill silently fails, and the fix → `references/anti-patterns-troubleshooting.md`
- Before/during/after testing checklist → `references/testing-checklist.md`
- dev-agent-skills-specific rules (setup.sh, SkillsSync, naming roster) → `references/dev-agent-skills-integration.md`
- Fill-in-the-blank starting point for any new skill → `assets/skill-template.md`
- Sign-off template for Phase 2 → `assets/spec-summary-template.md`
- Structural validator → `scripts/validate_skill.py`
- Folder scaffolder → `scripts/scaffold_skill.py`
