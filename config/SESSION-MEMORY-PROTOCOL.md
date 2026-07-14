# Session-Memory Protocol

Read and follow this whenever you reach a step in a skill's instructions
marked **Session-reusable:**. This applies regardless of which harness loaded
you here. Unlike `CLARIFICATION-PROTOCOL.md` and `SELF-IMPROVEMENT-PROTOCOL.md`,
this pointer is only injected into skills that opted in
(`session-memory: true` in frontmatter) — if you don't see this pointer in
the skill you're using, it doesn't apply here, and no step in that skill
should be treated as reusable on the basis of this document alone.

## The governing principle

Some investigation steps only gather information and don't change anything —
and once you've established the answer earlier in this same conversation,
re-running the exact same check again is pure waste, not extra safety.
Other steps look similar on the surface but genuinely can go stale mid-session
(a knowledge graph, most obviously — the whole point of most skills is to
change the code that graph describes). This protocol exists to let a skill
author mark the first kind explicitly, so you can skip redundant work on it,
**without** ever licensing you to apply the same reasoning to a step nobody
marked.

Reuse must be visible, never silent. If you skip a step because you're
reusing an earlier finding, say so in your output — a sentence, not a
justification. Someone reading the transcript afterward should be able to
see the shortcut was taken, not have to infer it from a missing tool call.
This is the same evidence-over-self-report standard this project already
holds itself to everywhere else.

## Step 1 — Only steps explicitly marked qualify

Look for the literal lead-in **Session-reusable:** at the start of a step's
instructions. If a step doesn't carry that marker, this protocol has nothing
to say about it — treat it exactly as its own instructions describe, every
time, no shortcuts. Do not extend "this seems similar to a step I know is
reusable elsewhere" reasoning to an unmarked step. If you find yourself doing
that, that reasoning is itself the failure mode — stop and just run the step.

## Step 2 — The test, every time you reach a marked step

Ask yourself two things, in order:

1. **Have I already established this exact fact earlier in this same
   conversation?** Not "something similar," not "probably the same" — the
   same fact, from a check you can actually point to earlier in this
   session.
2. **Has anything since then plausibly changed the answer?** A new
   dependency installed, a file the check reads having been edited, a
   different project or directory now in scope, or genuinely any doubt at
   all about whether the earlier answer still holds.

Both have to check out. If either is uncertain, run the step fresh — a
redundant check costs a little time; a wrong assumption compounds into
everything built on top of it.

**Anti-pattern:** Treating "I probably already know this" as good enough
without being able to point to the specific earlier check. If you can't
locate the moment you established it, you haven't established it.

**Anti-pattern:** Reusing a finding across a genuinely new context (a
different project directory, a different repository) just because the same
skill ran recently. This protocol is about not repeating yourself within one
continuous piece of work on the same thing, not about assuming facts
transfer across unrelated ones.

## Step 3 — If you reuse, say so out loud

State it plainly, in one sentence, as part of your normal output — not
buried, not a footnote. For example: *"Already confirmed earlier this
session that this project uses react + prisma — skipping re-detection."*
Then continue with the rest of the step's instructions using that reused
fact, exactly as if you'd just checked it.

**Anti-pattern:** Skipping the step and moving on without mentioning it at
all. Silent reuse is indistinguishable from silently skipping something that
should have been checked, and both are equally hard to catch after the fact.

## Step 4 — When genuinely uncertain, just run the step

There is no penalty for re-running a marked step you could have skipped —
it's exactly as if the marker weren't there. There is a real cost to
reusing something that turned out to be wrong. When in doubt, check.
