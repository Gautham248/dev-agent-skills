---
name: skill-factory
description: Interviews the requester through a structured clarification protocol, then designs, writes, and validates a new Agent Skill (SKILL.md plus scripts/references/assets) for the dev-agent-skills repo. Use when someone asks to "create a skill", "build a skill for X", "add a new skill to dev-agent-skills", "turn this workflow into a skill", "make this repeatable", or "scaffold a SKILL.md". Also use to review, validate, or fix an existing skill's frontmatter, triggering, or structure ("why doesn't my skill trigger", "check this skill", "improve this skill's description"). Do not use for ordinary bug fixes or feature work that isn't about authoring a skill itself — route those to fix-bug or plan-feature instead.
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
Is this: (a) a brand-new skill, (b) a fix/review of an existing skill, or (c) a validation-only check ("does this skill look right")? For (b) and (c), skip straight to reading the existing `SKILL.md` and diagnosing it against `references/anti-patterns-troubleshooting.md` and `scripts/validate_skill.py` — the interview still applies, but only to the parts that are actually unclear or broken, not the whole skill from scratch.

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

## Quick reference index

- Full interview question bank & weak-communicator handling → `references/interview-protocol.md`
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
