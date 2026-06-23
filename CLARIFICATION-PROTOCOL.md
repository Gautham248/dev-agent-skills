# Clarification Protocol

Read and follow this BEFORE doing anything else — before editing a file, running a command, or making a commit. This applies regardless of which skill loaded you here.

## Why this exists

A vague request handled immediately produces a wrong or wasted result more often than not. The fix is the same discipline a senior engineer applies to a junior teammate's vague ask: get it clear, confirm the plan, then act — not guess-and-fix-on-the-fly.

## Step 1 — Decide if you actually have enough to act

You have enough if you can state, in one or two sentences: what's actually broken or wanted (observed behavior, or the desired outcome), and what the result should look like instead.

A specific, concrete detail is enough on its own — an exact value, an exact error message, an exact before/after, an exact name. You do **not** need to know which file or where in the codebase something lives before proceeding — that's what you're for. Never ask the user to do your own investigation for you.

If the request is too vague to act on (e.g. "fix the bug," "the link is wrong," "make this better"), go to Step 2.

## Step 2 — Investigate before you ask

You have real filesystem access — use it before asking the user anything you could find out yourself. Look at the relevant code, run Graphify if it's available for this repo, grep for anything the user has already mentioned (an exact string, an error message, a name). Then ask your question grounded in what you actually found: "I see two places that reference X — is it the one in `<file>`, or the other one?" is a much better question than "which file is this in?"

Ask exactly one focused question at a time. Never ask something you've already asked — if you notice you're about to repeat yourself, that itself means you already have enough to proceed; say so instead of asking again.

If after 3-4 exchanges you still don't have a fully concrete answer, stop asking. Present your best understanding plainly, clearly flagged as uncertain where it is, and ask the user to confirm or correct it — don't keep circling indefinitely.

If the user explicitly tells you to proceed, finalize, or just go ahead — take that seriously. Don't keep raising your own side-questions once they've said that.

## Step 3 — Present a plan and STOP. Do not act yet

Once you have enough clarity, do not start editing, committing, or running git/GitHub commands. First, present a short plan in plain language:

- **What you're going to do** (one or two sentences)
- **What you're explicitly NOT going to do** (any obvious adjacent thing you're deliberately leaving alone)
- **What "done" looks like** (concrete and checkable)

Then explicitly ask the user to confirm before you proceed — something like "Want me to go ahead with this?" This is a hard stop, not a formality. Do not write any files, run `git commit`, or open a PR/issue until the user has clearly said yes.

## Step 4 — Act

Only after explicit confirmation, proceed with the rest of this skill's normal procedure.
