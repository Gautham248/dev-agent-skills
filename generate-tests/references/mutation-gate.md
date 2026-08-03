# The mutation gate

`scripts/mutate-cli.mjs` is what makes Step 5 of `SKILL.md` a mechanical
check instead of a instruction to "be thorough." This file covers what it
actually does, what it deliberately never touches, and where its known
blind spots are -- read this before running it against unfamiliar code, not
after something looks wrong.

## What it does

1. Scans the target file once, classifying every character as `code`,
   `string`, `template` (the literal portions of a backtick string), or
   `comment`. Only `code` regions are eligible for mutation.
2. Within `code` regions, applies small single-token mutations: relational
   flips (`<` <-> `<=`, etc.), equality flips (`===` <-> `!==`), logical
   flips (`&&` <-> `||`), boolean literal flips, increment/decrement flips,
   and integer literal shifts (+1 and -1 at the same site, since a boundary
   defect can go either direction).
3. For each mutant: writes it over the real file, runs the given test
   command, restores the original file (always, even if the command itself
   errors or the process is interrupted -- this is a `try/finally`, not a
   best-effort cleanup), and records whether the mutant survived (tests
   still passed -- bad) or was killed (tests failed -- good).
4. Reports a mutation score and, for every survivor, the exact line and
   change that slipped through.

## What it deliberately never touches

- **String and template literal contents.** A comparison operator inside a
  string like `"1 < 2 is always true"` is text, not code -- mutating it
  would test nothing and could corrupt a string's meaning without breaking
  anything a test could detect.
- **Comments.** Same reasoning -- `// if (a < b) return true;` is
  documentation, not logic.
- **`${...}` interpolations are the one exception inside a template
  literal** -- `` `result: ${a < b}` `` has a real comparison inside the
  interpolation, and it gets the same mutation coverage as anywhere else.
  Nested templates inside interpolations (`` `${`inner ${a<b}`}` ``) are
  tracked with a proper stack, not a single shared counter -- the first
  version of this scanner used one shared brace-depth variable and a
  nested interpolation would silently corrupt the enclosing one's depth
  tracking on the way back out. Caught by testing, not by inspection.

## Known limitations (read before trusting a 100% score on unfamiliar code)

- **No real parser.** This is a careful text scanner, not an AST-based
  tool -- dependency-free by design, matching every other script in this
  repo. It cannot understand statement structure, only "is this character
  inside a string/comment/template."
- **JSX and TypeScript generics use the same characters as comparisons.**
  `<Foo>`, `<div>`, `</Foo>`, `<Foo />`, and `Array<T>` all contain `<` or
  `>` that are not relational operators. The tool applies a conservative
  heuristic (skip if immediately adjacent to an identifier with no space,
  or if the shape looks like a tag), which means it **under-mutates**
  JSX/generic-heavy files rather than risk producing a nonsensical mutant.
  A file that's mostly JSX markup may report very few relational-flip
  candidates -- that's the tool declining to guess, not a sign the file has
  no comparisons worth testing. If a file's real logic is buried inside
  JSX conditionals, review it manually rather than trusting the mutation
  score alone.
- **Tightly-written comparisons without surrounding spaces
  (`a<b` rather than `a < b`) are treated the same as a generic and
  skipped**, for the same reason -- distinguishing `Array<T>` from `a<b`
  reliably needs a real parser. Formatted code (prettier, eslint) rarely
  has this problem in practice, since standard formatting puts spaces
  around binary operators.
- **A syntax-breaking mutant still gets run.** If a mutation happens to
  produce invalid syntax the target language can't parse, the test command
  will simply fail to run at all, which counts as "killed" for a reason
  that has nothing to do with test quality. This is a known inflation risk
  on the mutation score; it doesn't happen with the current operator set in
  practice (every operator swaps one valid token for another same-shape
  valid token), but it's worth knowing if a future operator is added.

## The environment leak this tool guards against

If the target repo's test command is itself `node --test ...`, and
`mutate-cli.mjs` is ever invoked from a process that is itself running
under `node --test` (this skill's own test suite does exactly that), the
child process inherits `NODE_TEST_CONTEXT` from the parent's environment by
default. A `node --test` child that sees that variable set stops behaving
like a standalone CLI run -- it silently defers to IPC-based coordination
with the assumed parent test runner instead of exiting non-zero on a real
failure. The practical effect: every mutant looks "survived" regardless of
whether the target repo's tests actually caught it -- a silent, misleading
false-negative on the whole mutation score, not just missing data.

`mutate-cli.mjs` strips every `NODE_TEST_*` variable from the child
environment before running the test command, specifically to prevent this.
This was found through testing (a `node --test`-based e2e test of the tool
itself, run under `node --test`, is exactly the scenario that triggers it)
-- see `scripts/tests/mutate-cli.test.mjs`'s "nested `node --test`
environment leakage" test, which is a permanent regression check for this.
If a future test command wraps or is wrapped by some other coordination
mechanism with its own leak-prone environment variables, the same failure
shape (mutants that should be killed reporting as survived, with no error)
is the signal to look for.

## Budgets

`--max-mutants` defaults to 8, matching the circuit-breaker budget proposed
for this skill (`AGENT-STANDING-RULES.md` / `scripts/circuit-breaker.md`
conventions elsewhere in this repo -- this tool doesn't call the shared
circuit-breaker primitive directly, since a hard cap on mutant count is a
simpler and sufficient bound for a single-file gate, but the number is
chosen to match). Increase it for a file with a genuinely large input
space; each mutant run costs one full execution of the target repo's test
command, so cost scales linearly with this number.
