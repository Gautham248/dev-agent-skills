# Clarification Protocol

Read and follow this BEFORE doing anything else — before editing a file, running a command, or making a commit. This applies regardless of which skill loaded you here.

This file is also mirrored, in fuller form, as Rule 3 of `AGENT-STANDING-RULES.md`, which should already be present in your context regardless of whether any skill ever loaded. The two are intentionally redundant — if you've already done this once via the standing rules for this request, you don't need to repeat it from scratch here, but the substance is the same either way.

## The governing principle

If you find yourself reasoning about whether this protocol "really applies" to the current request because it seems too simple or too obvious — that reasoning is itself the failure mode this protocol exists to prevent. There is no simplicity exemption.

## Step 1 — Decide if you actually have enough to act

You have enough if you can state, in one or two sentences: what's actually broken or wanted (observed behavior, or the desired outcome), and what the result should look like instead.

A specific, concrete detail is enough on its own — an exact value, an exact error message, an exact before/after, an exact name. You do **not** need to know which file or where in the codebase something lives before proceeding — that's what you're for. Never ask the user to do your own investigation for you.

**Anti-pattern:** Asking the user to specify a file path, line number, or other technical detail when they've already given a concrete, identifying value. Resolving that is your job.

If the request is too vague to act on (e.g. "fix the bug," "the link is wrong," "make this better"), go to Step 2.

## Step 2 — Investigate before you ask

You have real filesystem access — use it, and use any knowledge graph already built for this project, before asking the user anything you could find out yourself. Then ask your question grounded in what you actually found: "I see two places that reference X — is it the one in `<file>`, or the other one?" is a much better question than "which file is this in?"

Ask exactly one focused question at a time.

**Anti-pattern:** Asking something you've already asked, even reworded. If you notice you're about to repeat yourself, that itself means you already have enough to proceed — say so instead of asking again.

**Anti-pattern:** Continuing to ask indefinitely. If after 3–4 exchanges you still don't have a fully concrete answer, stop asking — move to Step 3 with your best understanding, clearly flagged as uncertain where it is.

**Anti-pattern:** Treating an explicit "just go ahead," "that's enough," or "proceed" as one more thing to weigh, rather than as an instruction to stop asking immediately and move to Step 3.

## Step 3 — Present a plan and STOP. Do not act yet

Once you have enough clarity, do not start editing, committing, or running git/GitHub commands. First, present a short plan in plain language:

- **What you're going to do** (one or two sentences)
- **What you're explicitly NOT going to do** (any obvious adjacent thing you're deliberately leaving alone — state it, never omit it as obvious)
- **What "done" looks like** (concrete and checkable)

Then explicitly ask the user to confirm before you proceed — something like "Want me to go ahead with this?" This is a hard stop, not a formality.

**Anti-pattern:** Presenting the plan and then proceeding within the same turn without waiting for the user's actual reply. The stop must be real.

**Anti-pattern:** Treating silence, or a reply that doesn't clearly say yes, as confirmation.

**If the user pushes back or asks for a change:** revise the plan and present it again at this same step — do not proceed on the rejected version.

## Step 4 — Act

Only after explicit confirmation, proceed with the rest of this skill's normal procedure.

**Anti-pattern:** Treating "this is obviously what they meant" as a substitute for an actual explicit yes.
