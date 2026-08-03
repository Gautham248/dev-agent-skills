# Test design technique playbook

Reference for `SKILL.md` Steps 2 and 3. Each technique below states what it
catches, when to reach for it, and a worked example -- not a general essay
on software testing.

## Table of contents

- [Equivalence partitioning](#equivalence-partitioning)
- [Boundary value analysis](#boundary-value-analysis)
- [Negative testing](#negative-testing)
- [Error guessing](#error-guessing)
- [Decision table testing](#decision-table-testing)
- [State transition testing](#state-transition-testing)
- [Integration strategies](#integration-strategies)
- [The seven principles, applied mechanically](#the-seven-principles-applied-mechanically)

---

## Equivalence partitioning

Divide each input into classes where every value in a class should produce
the same kind of outcome, then test one representative value per class
instead of every possible value.

| Input type | Valid class | Invalid class(es) |
|---|---|---|
| Range | within the range | below, above |
| Specific value | the exact value | anything else |
| Set of values | in the set | not in the set |
| Boolean | the expected value | the unexpected value |

**Example:** a percentage field accepting 50-90.
- Invalid: `< 50`
- Valid: `50-90`
- Invalid: `> 90`

Three representative test cases, not forty-one. Combine with boundary value
analysis below -- partitioning alone can miss the exact edge where a
partition's assumption breaks.

## Boundary value analysis

For every ordered input, test the minimum, just-above-minimum, maximum,
just-below-maximum, and just-outside-range in both directions. This is
where off-by-one defects concentrate in practice.

**Example:** age field accepting 18-56.

| Invalid (min-1) | Valid (min, min+1, nominal, max-1, max) | Invalid (max+1) |
|---|---|---|
| 17 | 18, 19, 37, 55, 56 | 57 |

**Single Fault Assumption** (default): vary one input at its boundary while
holding every other input at a nominal value -- most defects come from a
single faulty condition at a time, and this keeps the case count at `4n + 1`
for `n` inputs instead of a combinatorial explosion.

**Escalate to Worst-Case BVA** (combinations of boundary values across
multiple inputs) only when the graph or the developer indicates those
inputs actually interact -- e.g. a date validator where day and month
boundaries are not independent (Feb 30 is invalid regardless of either
value's own boundary status).

## Negative testing

Deliberately feed the system invalid, malformed, or unexpected input and
verify it fails *gracefully* -- a typed error or a validation rejection,
not a crash, and not silent wrong output.

Standard categories to cover:
- Wrong type (string where a number is expected)
- Empty / null / undefined where a value is required
- Exceeding a documented length or size limit
- Malformed structure (missing required field, wrong shape)
- Values technically the right type but outside any sane range

The failure mode negative testing exists to catch: a function that *looks*
correct on valid input but corrupts state, throws an unhandled exception,
or silently returns wrong data on invalid input. All three are worse than
a clean rejection.

## Error guessing

Informal but not undirected -- in this skill, error guessing is anchored to
two concrete sources rather than free intuition:

1. **Defect history** (`references/ledger-integration.md`) -- files with a
   real history of rejected fix attempts get more adversarial attention.
2. **Complexity / blast radius** (via `graphify`) -- a function with many
   callers or high cyclomatic complexity is worth more adversarial effort
   than a straight-through helper with one caller.

Generic error-guessing categories, for when neither source above applies
(e.g. genuinely new code with no history): boundary-adjacent values, common
off-by-one patterns, recently-changed code, and anywhere the implementation
does something the contract doesn't explicitly describe (an implicit
assumption is exactly where a defect hides).

## Decision table testing

For logic driven by several independent conditions feeding one outcome,
enumerate every condition combination as a table row rather than describing
branches in prose -- this surfaces combinations a top-to-bottom code read
misses.

**Example:** a discount function with three independent boolean conditions.

| isMember | cartOver$50 | hasPromoCode | -> Discount |
|---|---|---|---|
| T | T | T | 20% |
| T | T | F | 15% |
| T | F | T | 10% |
| T | F | F | 5% |
| F | T | T | 10% |
| F | T | F | 0% |
| F | F | T | 5% |
| F | F | F | 0% |

Eight rows, eight test cases -- every combination the logic actually needs
to handle, not the two or three an author is likely to have manually
thought through.

## State transition testing

For anything with an internal state machine or lifecycle: test every valid
transition, every invalid transition attempt (and confirm it's rejected,
not silently allowed), and staying in the same state under a no-op action.

**Example:** an order with states `draft -> submitted -> approved | rejected`.
- Valid: `draft -> submitted`, `submitted -> approved`, `submitted -> rejected`
- Invalid, must be rejected: `draft -> approved` (skips submission),
  `approved -> submitted` (no going back), `rejected -> approved`
- No-op: re-submitting an already-`submitted` order

## Integration strategies

Pick the strategy based on which side of a workflow already has coverage,
not by default:

- **Top-down** -- test high-level modules first, using stubs for
  lower-level modules not yet integrated. Validates overall workflow and
  business logic early.
- **Bottom-up** -- test low-level modules first, using drivers to simulate
  the higher-level modules that call them. Good when core logic is the
  highest-risk part.
- **Big-bang** -- integrate and test everything at once. Only reasonable
  for small module counts; root-causing a failure gets hard fast as module
  count grows.
- **Mixed/sandwich** -- top-down and bottom-up in parallel, meeting in the
  middle. Best when both the entry points and the core logic are equally
  unproven.

Use `graphify query "call chain for <workflow>"` to find the real
integration points before picking a strategy -- the strategy should match
the actual dependency structure, not an assumed one.

## The seven principles, applied mechanically

These aren't background reading -- each one has a concrete consequence for
how this skill behaves:

- **Testing shows presence of defects, not their absence.** Never report
  "no defects found" -- report "the mutation gate found no surviving
  mutants for the cases generated" or similar, since that is what was
  actually verified.
- **Exhaustive testing is impossible.** Prioritize: boundary + negative +
  history-weighted error guessing covers the highest-yield cases per unit
  of effort, which is why Step 2 doesn't attempt every possible input.
- **Early testing.** This is why `generate-tests` is offered from `fix-bug`
  immediately after a fix, not left for someone to remember later.
- **Defect clustering.** Directly implemented by `ledger-scan.mjs`'s
  per-file rejected-attempt counts (`references/ledger-integration.md`).
- **Pesticide paradox.** Repeating the same generic boundary cases stops
  finding new defects -- this is why regression candidates from the ledger
  (real, specific, previously-unknown cases) are weighted over generic
  re-runs of the same technique checklist.
- **Testing is context-dependent.** This is why Step 7 hands structure and
  framework choice off to the target repo's actual `coding-standards-*`
  domain, rather than this skill assuming a fixed test stack.
- **Absence of errors fallacy.** A test suite with a perfect mutation score
  that doesn't actually check the contract from Step 1 (e.g. it tests an
  implementation detail nobody asked for) still isn't done -- Step 1's
  contract-first ordering exists specifically so mutation-score cleanliness
  can't substitute for testing the right thing.
