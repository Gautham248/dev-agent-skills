# Workflow-Shape Patterns

Use this during Phase 1 to help place a request into `category` and to shape the `workflow_steps` slot. These are common shapes, not a rigid taxonomy — a real skill often blends two.

## Problem-first vs. tool-first framing

Two different ways a person arrives at needing a skill:

- **Problem-first**: "I need to get this bug fixed" — the requester describes an outcome and doesn't care which tools get used along the way. The skill should own the sequencing entirely.
- **Tool-first**: "I have this MCP/tool connected" — the requester already knows what capability exists and wants the skill to teach the *good* way to use it, not decide whether to use it at all.

Most skills lean toward one framing. Figuring out which one a request is helps decide how much the skill should be deciding versus how much the user already decided.

## Pattern 1 — Sequential workflow orchestration

**Use when:** a multi-step process needs to happen in a specific, non-negotiable order.

Shape: numbered steps, each naming the concrete action, its inputs (including outputs from earlier steps), and what "done" looks like for that step before moving to the next. Include rollback or cleanup guidance for steps that can partially fail.

**Fits:** onboarding flows, a fixed build/release sequence, "clone → build graph → query → fix → open PR."

## Pattern 2 — Multi-tool coordination

**Use when:** the workflow genuinely spans more than one external system and data has to move between them.

Shape: organize by phase, one phase per system, with an explicit statement of what data crosses from one phase into the next and where. Validate before moving to the next phase rather than discovering a problem three phases later.

**Fits:** design export → asset storage → task creation → notification; anything where a failure partway through leaves things in different systems in an inconsistent state.

## Pattern 3 — Iterative refinement

**Use when:** output quality genuinely improves by generating, checking, and re-generating rather than getting it right in one pass.

Shape: initial draft → explicit quality check (ideally a deterministic script, not just "look it over") → list of concrete issues found → targeted fixes → re-check → repeat until a stated threshold is met, with an explicit stop condition so this can't loop forever.

**Fits:** report generation, code review passes, anything with a checkable quality bar.

## Pattern 4 — Context-aware branching

**Use when:** the same outcome should be reached via different means depending on context.

Shape: a short decision tree stated as concrete conditions ("if file > 10MB, use X; if it's a collaborative doc, use Y"), then a single execution step that acts on whichever branch was chosen. State the decision criteria explicitly enough that two different runs on the same input would make the same choice.

**Fits:** storage location selection, choosing which downstream skill/tool applies, complexity classification (simple fix vs. escalate to an issue).

## Pattern 5 — Domain rules embedded in logic

**Use when:** the skill needs to encode real domain expertise or governance the model wouldn't otherwise apply consistently — compliance, authorization, style rules.

Shape: checks/rules stated before the action they gate ("before processing: verify X, Y, Z"), an explicit pass/fail branch, and an audit trail of what was checked and decided — not just the final action.

**Fits:** authorization checks against collaborator/commit history, compliance gates, anything where "did we check this correctly" matters as much as "did we do the thing."

## Choosing for a dev-agent-skills submission specifically

Given the existing repo's shape (safety layer, ledger, complexity classifier, GitHub-App-scoped authorization), most new skills submitted here will combine **Pattern 5** (authorization / complexity gating happens before any action) with either **Pattern 1** (a fixed fix→PR sequence) or **Pattern 4** (branch on complexity/file-type/target). Call this out explicitly in the spec summary so the requester can correct it early if the shape doesn't fit.
