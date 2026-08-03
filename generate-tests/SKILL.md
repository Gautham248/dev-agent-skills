---
name: generate-tests
description: >
  Designs unit, integration, and other tests derived from a function or
  workflow's actual contract -- boundary values, equivalence classes,
  negative/error-guessing cases, decision tables -- instead of tests that
  merely describe whatever the code currently does. Every generated unit
  test is checked with a mutation gate before being offered: the
  implementation is deliberately broken in small ways and the test must
  catch it, or it gets rewritten. Use for "write tests for X", "generate
  test cases for this function", "what would break this", "test this more
  rigorously", or a testing strategy for a feature/workflow. Also offered
  as a follow-up from fix-bug (turn a fixed bug into a permanent regression
  test) and plan-feature (turn a plan's testing section into scaffolding).
  Do NOT use for fixing a bug (fix-bug), reviewing a PR (review-pr), or
  test-file structure/naming for a given stack (coding-standards-e2e,
  coding-standards-backend, etc. -- this skill decides what to test, those
  decide how the file should look).
graph-memory: true
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

<!-- BEGIN dev-agent-skills graph-memory protocol (managed by setup.sh -- do not edit this block manually; edit GRAPH-MEMORY-PROTOCOL.md instead) -->
This skill opted in to graph-memory (graph-memory: true). At each point marked
'Graph-memory:' below, read and follow the graph-memory protocol at:
../config/GRAPH-MEMORY-PROTOCOL.md
<!-- END dev-agent-skills graph-memory protocol -->

# Generate tests

This skill exists because a generated test that is written by reading an
implementation and asserting what it currently returns is not a test -- it
is a restatement, and it will pass forever regardless of whether the
implementation is correct. Two things distinguish an adversarial test suite
from a restated one, and both are non-negotiable:

1. **Expected behavior is derived from the function's contract, not from
   its current implementation.** Read the signature, the types, the calling
   code, and the originating bug report or feature spec before reading the
   implementation body. Only after cases are designed against that contract
   does the implementation get run against them.
2. **Every unit test that passes gets checked by a mutation gate** (Step 5)
   before it is offered to the developer. A test that still passes against
   a deliberately broken version of the function is not verifying that
   behavior -- it gets rewritten, not counted.

If a generated test fails against the real implementation, that is a
candidate defect. It is never silently fixed by loosening the assertion --
see Step 6.

## When this applies

- Triggers on: "write tests for `<function/file>`", "generate test cases
  for `<X>`", "what would break this function", "test this more
  rigorously", "design a testing strategy for `<feature>`"
- Offered (not silently run) as a follow-up step by `fix-bug` after a fix
  is applied, and by `plan-feature` once a feature plan is confirmed
- Does NOT apply to: fixing the bug itself (`fix-bug`), reviewing a PR
  (`review-pr`), deciding where test files live or how they're structured
  for a given stack (delegate to `coding-standards-e2e` /
  `coding-standards-backend` / `coding-standards-database` / etc. -- see
  Step 7)

## Step 0 -- Clarify scope before designing anything

The clarification protocol below governs how to ask, but this skill has a
few scope questions that are worth deciding early rather than discovering
mid-design:

- Is this for a single function, a file, or a workflow spanning several
  files? (Changes which of Steps 2/3 apply.)
- Is there a specific bug or feature this originated from, or is it general
  hardening of existing code? (Changes what "the contract" is derived from
  in Step 1 -- a bug report's expected behavior, a feature plan's
  acceptance criteria, or the calling code alone.)
- Should the mutation gate (Step 5) run against the target repo's real test
  command, or is this exploratory (no test runner wired up yet)? If there
  is no working test command yet, say so rather than guessing one --
  running the wrong command silently produces a meaningless mutation score.

Don't ask all of these up front if the request already answers them --
"write a regression test for the bug we just fixed" already answers the
second question via the fix-attempt ledger (Step 4).

## Step 1 -- Derive the contract, not the implementation

Before opening the function body, gather what it is *supposed* to do:

- **Signature and types** -- parameter types, return type, anything a type
  checker already enforces (don't write a test for something the compiler
  already guarantees).
- **Calling code** -- `graphify query "callers of <function>"` to see how
  it's actually used; real call sites reveal assumptions (e.g. "always
  called with a non-empty array") that the signature alone doesn't show.
- **Origin, if there is one** -- a bug report's expected-vs-actual
  description, or a feature plan's acceptance criteria. These state
  intended behavior independent of any particular implementation, which is
  exactly the reference point Step 2 needs.

Write down the contract in one or two sentences per input: what's valid,
what's invalid, and what should happen in each case. Only now read the
implementation -- to understand *how* it currently behaves, not to decide
*what it should* do.

## Step 2 -- Design cases against the contract

Apply the techniques below. Not every technique applies to every function --
match the technique to the shape of the input space, and say which ones you
skipped and why.

- **Equivalence partitioning** -- divide each input into valid/invalid
  classes; one representative case per class, not one per possible value.
- **Boundary value analysis** -- for every ordered input (ranges, lengths,
  counts), test the minimum, just-above-minimum, maximum, just-below-maximum,
  and just-outside-range. Default to Single Fault Assumption (one variable
  at its boundary, others nominal) unless the graph or the developer flags
  specific inputs as interacting, in which case escalate to combinations
  for just those inputs.
- **Negative testing** -- wrong types, empty/null/undefined, malformed
  structure, values outside any documented range. The goal is graceful,
  documented failure (a typed error, a validation rejection), not a crash
  -- and not silent wrong output either.
- **Error guessing** -- weighted by real history: pull `references/ledger-integration.md`'s
  defect-clustering signal (Step 4) before guessing generically. A file
  with three rejected fix attempts gets more adversarial attention than one
  with none.
- **Decision tables** -- for logic with several independent conditions
  feeding one outcome, enumerate condition combinations as rows rather than
  prose-describing them; catches combinations that reading the code
  top-to-bottom misses.
- **State transition tests** -- for anything with an internal state machine
  or lifecycle (draft -> submitted -> approved, session states, retry
  counters), test valid transitions, invalid transitions, and staying in
  the same state.

Full technique reference with worked examples: `references/techniques.md`.

## Step 3 -- Map the workflow for integration tests

For anything spanning more than one module, don't guess at the boundaries --
read them off the graph:

**Graph-memory:** query the actual call chain for the workflow in question
(`graphify query "call chain for <workflow>"` or `graphify affected --files
<the files involved>`), so the integration points tested are the real ones,
not an assumed structure. Pick an integration strategy based on what
already has coverage: top-down (stub the untested lower layer) if the
entry point is well-tested but downstream isn't; bottom-up (drive the
tested lower layer from a harness) if the reverse is true. See
`references/techniques.md` for the full strategy breakdown.

## Step 4 -- Pull defect history before finalizing case selection

```bash
node scripts/ledger-scan.mjs summary --repo-root <target-repo-root>
```

This reads `fix-bug`'s fix-attempt ledger directly (`.dev-agent/fix-attempts/*.json`
in the target repo) -- not by importing `fix-bug`'s code, by reading the
same JSON artifact `fix-bug` writes. Two outputs matter here:

- **Defect clustering** -- files with a history of rejected fix attempts
  get weighted adversarial attention (principle: a small number of modules
  tend to hold most of a project's defects).
- **Regression candidates** -- every *accepted* fix attempt is a confirmed
  bug with a known trigger. If this invocation originated from `fix-bug`
  (see the trigger conditions above), the single most valuable test to
  write is the exact case that was just fixed, encoded permanently -- this
  is also the direct answer to writing a genuinely new case each time
  rather than repeating the same generic boundary checks. See
  `references/ledger-integration.md`.

If the target repo has no ledger yet (new repo, or `fix-bug` hasn't run
here), this step reports that plainly and Step 2's techniques carry the
adversarial weight alone -- that's the normal case for a repo with no
fix-bug history, not a failure.

## Step 5 -- The mutation gate

For every unit test that passes against the real implementation, confirm it
actually tests something:

```bash
node scripts/mutate-cli.mjs run --file <target-file> \
  --test-cmd "<the target repo's real test command for this file>" \
  --max-mutants 8
```

This deliberately makes small, targeted changes to the implementation --
flip a boundary comparison, invert a condition, swap a boolean, shift an
integer literal by one -- and checks whether the test suite notices. Read
`references/mutation-gate.md` before running this the first time; it covers
what the tool can and can't safely mutate (it skips strings, comments, and
template literals, and conservatively skips anything that looks like a
JSX tag or a TypeScript generic rather than risk a false mutation).

- **Every mutant killed** -- the test suite is genuinely pinning down that
  behavior. Move on.
- **Any mutant survives** -- the tool prints the exact line and change that
  slipped through. Write a case that would fail against that specific
  mutant, add it, and re-run. A test suite is not "generated" until this
  is clean, or the survivors are explicitly accepted as out of scope and
  said so in the summary (Step 8) -- never silently dropped.

This step is the one piece of this skill that isn't just careful
instruction-following -- it's a mechanical check that catches the exact
failure mode this skill exists to prevent. Run it by default; it is not
optional even when time-pressured, because a fast tautological test suite
is worse than no test suite -- it creates false confidence.

## Step 6 -- A failing test is a candidate defect, not a test to fix

When a generated test (from Step 2, before the mutation gate) fails against
the *real* implementation:

- **Never loosen the assertion to make it pass.** That defeats the entire
  purpose of deriving expectations from the contract in Step 1.
- Report the failure with the exact input, expected output (per the
  contract), and actual output.
- Propose a concrete resilience fix, phrased the way this org's own
  standards already are -- validate at the boundary, guard clauses first,
  rather than a generic suggestion. If the target repo has `coding-standards`
  available, its Universal rules are the right vocabulary to use here.
- **Never apply the fix yourself.** Present it, the same way `fix-bug`
  gates any edit behind developer confirmation. This skill's job is to
  find and characterize the gap, not patch it -- patching is `fix-bug`'s
  job, and mixing the two would blur which skill is responsible for what
  landed in the codebase.

## Step 7 -- Hand off structure and style, don't reinvent it

This skill decides *what* to test. It does not decide file layout, naming,
fixtures, or framework idioms -- that's already owned:

- Read `graphify-out/.graphify_stack.json` (or run the same domain
  detection `coding-standards/SKILL.md` Step 2 uses) to find which
  `coding-standards-*` skills apply to the target repo.
- For e2e/integration tests in a repo with Playwright, follow
  `coding-standards-e2e`'s directory structure and conventions.
- For backend/database-adjacent unit tests, follow the relevant
  `coding-standards-backend` / `coding-standards-database` conventions.
- If no domain-specific skill applies, fall back to whatever test framework
  is already used in the target repo (check `package.json` / existing
  `*.test.*` files) rather than introducing a new one.

## Step 8 -- Stage the draft, then stop

Nothing gets written into the target repo's real test directory directly.
Write the drafted test file(s) to a scratch location under the target
repo -- `.dev-agent/draft-tests/<short-hash-of-target-file>/` -- and present:

- Every generated case, grouped by technique (BVA / EP / negative / error
  guessing / decision table / state transition), and which contract each
  one traces back to.
- The mutation gate result: mutants killed vs. survived, and for any
  accepted-as-out-of-scope survivor, why.
- Any candidate defects found in Step 6, each with its proposed resilience
  fix, clearly separated from the test cases themselves.
- Where the final files would go if approved (per Step 7's structure).

**Then stop and wait for explicit confirmation** before copying anything
into the real `tests/` tree -- the same PENDING-style staging `review-pr`
uses for review comments and `fix-bug` uses for its ledger's `pending`
records. Silence is not confirmation.

**Graph-memory:** once the developer reacts to the draft, record whether
Step 3's graph query actually surfaced the workflow boundaries that
mattered for this task, per `GRAPH-MEMORY-PROTOCOL.md`. Be honest about
`useful` / `dead_end` / `corrected` -- a query is only `useful` if it
changed which integration points got tested, not just because it ran.

## If something goes wrong

Check `references/edge-cases.md` before improvising -- it may already be a
documented, solved problem. If it's genuinely new, follow the
self-improvement protocol and add it there.

## References

- `references/techniques.md` -- full technique playbook (BVA, equivalence
  partitioning, error guessing, negative testing, decision tables, state
  transition testing, integration strategies) with worked examples.
- `references/mutation-gate.md` -- what `scripts/mutate-cli.mjs` mutates,
  what it deliberately never touches, and its known limitations.
- `references/ledger-integration.md` -- how `scripts/ledger-scan.mjs` reads
  `fix-bug`'s ledger for defect clustering and regression candidates.
- `references/domain-handoff.md` -- how Step 7's delegation to
  `coding-standards-*` actually works.
