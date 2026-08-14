# Step 1b mechanics — running the project's own type checker

Full detail for SKILL.md's Step 1b. SKILL.md keeps the command sequence;
this file has the reasoning behind each piece.

## Why this step exists

A lens reads the diff; it does not compile it. A real type error is ground
truth no lens-based reasoning replaces, and it's cheap to get here — Step 1
already produced a real checkout with real code on disk.

## Command detection

`detectTypecheckCommand` checks, in order: `package.json`'s `check` script
(SvelteKit convention — usually wraps `svelte-check`), then `typecheck`,
then `type-check`, then falls back to bare `tsc --noEmit` only if a
`tsconfig.json` exists and no script matched. Returns `null` if neither is
available.

If it prints `null`, skip Step 1b entirely — there's nothing to run, and
note that plainly rather than silently claiming a clean type-check.

**Monorepo:** run detection from each affected package's root, not just the
repo root, if `package.json` files differ per package. A single repo-root
check can silently miss a package with its own separate typecheck script.

## Installing dependencies

```bash
[ -d node_modules ] || timeout 120 npm install
```

If install fails (no network, private registry), skip Step 1b and say why
in the final report, rather than blocking the whole review over tooling
unavailability that has nothing to do with the PR's own content.

## Parsing diagnostics

Two parsers exist because the two tools' output formats are unrelated:

- `parseTscDiagnostics(rawOutput)` — single-line format:
  `path/to/file.ts(12,5): error TS2345: message text`
- `parseSvelteCheckDiagnostics(rawOutput, cwd)` — multi-line format: a
  `path:line:col` header, an `Error: message (ts)` line, then source
  context until the next header or the summary footer. `cwd` strips the
  absolute path prefix svelte-check always emits down to a repo-relative
  path, matching the diff's own path convention.

Both were verified against real captured output from actual `tsc
--noEmit` and `svelte-check` runs during development, not a guessed
format — see `scripts/tests/fixtures/*.txt` and the corresponding tests
in `scripts/tests/review-lib.test.mjs`.

## Classifying against the diff

`classifyDiagnosticsAgainstDiff` splits by whether the diagnostic's line
is one the diff actually **added** (`anchorIndex` entry with
`kind === "added"`), not merely whether the file appears in the diff at
all. A diagnostic on a context line in a changed file — one the diff
merely passed through without touching — is still `preExisting`, even
though the file itself is part of the diff. Warnings are excluded from
both buckets entirely; this step is about compile *errors*.

## Introduced vs. pre-existing

**`introduced` diagnostics become normal findings** — always `severity:
"blocker"`, always `confidence: 1` (a compile error is not an inference to
weigh, it's ground truth), `lens: "compiler"`. Evidence is the anchor's own
`content` field (`anchorIndex.get(file, line, "RIGHT").content`), never
re-read from disk — the diff stays the single source of truth for
evidence everywhere else in this skill, and this shouldn't be an
exception. Add these to the same findings array Step 4's lenses populate;
`compilerDiagnosticToFinding`'s output passes Step 5's `validateFinding`
unchanged, with no new validation path needed.

**`preExisting` diagnostics are never turned into findings** — there is no
diff line to anchor a comment to, even when the diff's own changes are
what exposed the error. They go to Step 9's `--pre-existing-compile-errors`
flag instead: a full list, every time, in their own summary section.
Informational only — this is not the PR's fault to fix, and posting it as
if it were would misattribute existing technical debt to whoever opened
this PR.
