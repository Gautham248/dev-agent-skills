# Domain handoff

This skill decides *what* needs testing and *why*. It does not decide file
layout, naming conventions, fixtures, selectors, or framework idioms for
the target repo's stack -- that's already owned by the `coding-standards-*`
family, and duplicating it here would guarantee the two drift apart.

## How to find which domain skill applies

Reuse the exact detection `coding-standards/SKILL.md` Step 2 already runs,
rather than re-implementing it:

1. Read `graphify-out/.graphify_stack.json` in the target repo if it
   exists (the primary path -- `graphify` writes this as part of a graph
   build).
2. Match its `dependencies` and `notable_files`/`notable_dirs` against
   `coding-standards/references/manifest.json`'s `dependency_patterns` and
   `path_patterns` for each domain.
3. If `.graphify_stack.json` doesn't exist yet, fall back to a direct
   `package.json` inspection the same way `coding-standards` does when its
   primary path is unavailable.

Do not hardcode a domain list here -- `manifest.json` is the single source
of truth for which `coding-standards-*` skills exist and how to detect
them, and it grows over time (see that file's own version history for
examples of domains added after a real project surfaced a gap).

## What gets handed off vs. what stays here

| Decision | Owner |
|---|---|
| Which inputs need boundary/negative/error-guessing cases | `generate-tests` (this skill) |
| Which workflow needs an integration test and why | `generate-tests` (this skill) |
| Whether a generated test actually verifies anything (mutation gate) | `generate-tests` (this skill) |
| Directory structure, file naming, `*.spec.ts` vs `*.test.ts` | the matched `coding-standards-*` skill |
| Playwright fixtures, test-ID selectors, page-object patterns | `coding-standards-e2e` |
| Which test framework/runner to invoke | whatever's already used in the target repo (check `package.json`) |

## No domain skill applies

If detection finds no matching `coding-standards-*` skill (a repo outside
this org's usual stack, or a stack not yet in `manifest.json`), don't
invent a structure. Check the target repo's existing `*.test.*` or
`*.spec.*` files for whatever convention is already in use and match it;
if there's truly nothing to match, say so explicitly in the Step 8 draft
rather than presenting an invented structure as if it were a known
convention.
