# Step 4c mechanics — the mandatory completeness gate

Full detail for SKILL.md's Step 4c. SKILL.md keeps the command sequence and
the trace bar; this file has the reasoning behind why the gate exists and
how each category works.

## Why this exists

`first-principles-review`'s own "Pillar 2: Trace, don't read" methodology
already instructs exactly this kind of work — git-grep every caller, trace
every write path, visit code the diff doesn't touch. That methodology is
correct and does not need replacing. What it lacks is enforcement: on a
large diff, in a single fresh reasoning pass, there is nothing that
requires the trace to actually complete for the highest-stakes categories
before the review is called done.

Two real, confirmed misses motivated this gate directly:

- A function computed a player's score, announced it to clients, and
  never wrote it back to the persisted total — found only by manually
  tracing every `totalScore +=` site in the file and noticing one code
  path had none.
- An identity-tracking data structure was removed, correctly noted as
  unused, and the review concluded "dead code" — without checking
  whether the *responsibility* (verifying who's reconnecting) moved
  elsewhere or simply vanished. It had moved elsewhere, to a strictly
  weaker mechanism (a client-supplied value compared with no server-side
  secret backing it at all).

A third category, resource cleanup, is the same shape of bug in any
timer/socket-heavy codebase: a handle created (`setTimeout`, `.on(...)`)
without a traceable cleanup (`clearTimeout`, `.off(...)`) on every exit
path a function can take, not just the one shown in the diff hunk.

A fourth, confirmed in a real review: a `findFirst` (or `findUnique`)
check immediately followed by a `create` on the same model, guarding it as
if the check made the create safe. Read sequentially, this looks like
ordinary "look it up, create it if missing" logic and passes a normal
review pass cleanly -- the bug only exists under concurrent execution,
where two requests can both pass the `findFirst` (neither sees the other's
row, because neither has written yet) before either reaches `create`. On a
model with a unique constraint on the looked-up field, the second `create`
then throws a constraint violation the caller usually isn't prepared for;
without the constraint, it silently inserts a duplicate row instead. This
is not a hypothetical -- it was the actual root cause of two of the misses
that motivated adding this category (a tag-resolution helper and a
"get-or-create today's occurrence" helper, both racing on their own
`findFirst` before their own `create`).

## What the trigger regexes do and don't do

`findCompletenessCandidates` (review-lib.mjs) scans every added line
against four keyword/pattern regexes. This is deliberately coarse pattern
matching, not real static analysis — it decides **where a trace is
mandatory**, never **whether something is actually a bug**. That
determination requires reading the real function body and its callers,
which is your job in the trace step below, using the exact tools
Pillar 2 already describes (`git grep`, `graphify affected`, `graphify
query`).

Over-triggering (a candidate that turns out fine) costs one extra trace.
Under-triggering is the exact failure mode this gate exists to close. The
regexes lean broad on purpose — do not narrow them to reduce noise without
understanding what that trades away.

This gate runs on **every** review, not just ones that cross Step 2b's
broad-PR threshold. A state-mutation or identity bug can exist in a 3-file
PR as easily as a 68-file one. A PR that matches nothing produces three
empty candidate lists and the gate is a genuine no-op — the cost only
shows up when there's something to trace.

## The four categories

**State-mutation completeness.** Keyword regex:
`/\b(score|balance|points?|credits?|totalScore|amount)\b/i`. For each
candidate, identify the enclosing function (the diff gives you the
line; read the actual checked-out file to find its boundaries — the
regex cannot reliably determine function boundaries from diff text
alone). Then: does **every** code path through that function that
computes this value also persist it (`+=`, `.save(`, `.update(`,
`.set(` on the real field), or does at least one path compute-and-drop
it? Trace every caller too, the same as Pillar 2's "trace one caller of
every changed function" — a value can be computed correctly in the
function shown in the diff and still get dropped by a caller that never
reads the return value.

**Identity/authorization backing.** Keyword regex:
`/\b(clientId|sessionId|userId|adminId|isAdmin|token)\b/i`. For each
candidate, trace: is there a server-issued, unguessable value anywhere
in the codebase backing this check (`git grep -i 'session\|token\|secret\|
randomUUID\|crypto\.'` across the relevant files)? If the candidate line
is itself a removal or a "this looks unused" observation from a lens,
this category is **mandatory**, not optional — explicitly check where the
responsibility went before agreeing it's dead code. "The specific variable
is unused" and "the security property it provided is gone" are different
claims; only trace confirms which one is true.

**Resource cleanup.** Creation regex:
`/\b(setTimeout|setInterval)\s*\(|\.on\(|addEventListener\(|\.subscribe\(/`.
Cleanup regex: `/clearTimeout\(|clearInterval\(|\.off\(|removeEventListener\(
|\.unsubscribe\(/`. For each creation candidate, trace every exit path of
the enclosing function or component lifecycle (normal completion, early
return, error throw, disconnect/unmount) and confirm a matching cleanup
call exists on each one — not just the happy path the diff hunk shows.

**Race-prone read-then-write.** Trigger regex:
`/\b\w+\.(findFirst|findUnique|findOne)\s*\(/`. This flags only the READ
half — the WRITE half (a same-model `create`/`insert`) and the presence or
absence of an atomic guard are what the trace determines, not the regex.
For each candidate: find the enclosing function, and check whether it (or
a caller it delegates to) follows the read with a `create`/`insert` call
against the *same model*. If it does, check whether that pair is wrapped
in a transaction or, better, replaced with the ORM's atomic `upsert`
primitive (Prisma: `upsert`; most ORMs have an equivalent). If there's no
atomic guard, this is a real concurrency bug — under simultaneous
requests, both can pass the read before either commits the write. Also
check the schema for a unique constraint on the field being matched: with
one, the second write throws (a 500 the caller likely doesn't handle);
without one, it silently inserts a duplicate row, which is a data-integrity
bug, not just a reliability one, and should be flagged at higher severity.
A `findFirst`/`findUnique` with no subsequent same-model write is a normal
read and not a finding — this regex is intentionally broad, same
philosophy as the other three.

## Using architecture-context's subsystem tags

If Step 2b ran, `expandCandidatesWithSubsystems` widens the state-mutation
and identity candidate lists using the returned subsystems' `summary`
text, not just line-level keyword matches. A subsystem summary mentioning
scoring or state-sync turns on state-mutation tracing for every file in
`anchor_files`, even ones whose specific diff lines don't literally
contain a keyword — this is architecture-context's subsystem model
actively directing what gets traced, not passive framing text a lens may
or may not read closely. Subsystem-derived candidates have no specific
line (`line: null`); the whole subsystem's anchor files are in scope.

## What happens with a confirmed gap vs. a confirmed clean trace

A confirmed gap becomes a normal finding through the exact same pipeline
as any lens finding — `lens: "completeness-gate"`, real `file`/`line`/
`evidence` from the diff, a rationale describing the specific missing
write or missing cleanup, and an honest confidence. It passes Step 5's
existing `validateFinding` unchanged, same as a Step 1b compiler finding.

A confirmed-clean trace produces **no finding** — absence of a bug isn't a
finding — but must still be counted. Track
`{ stateMutation: n, identity: n, resourceCleanup: n, raceReadThenWrite: n }`
(candidates
examined, per category) for Step 9's summary, so a clean gate run is
provable ("N candidates traced, 0 gaps") rather than indistinguishable
from a gate that silently didn't run at all.
