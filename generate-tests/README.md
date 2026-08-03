# generate-tests

An Agent Skill that designs unit, integration, and other tests derived from
a function or workflow's actual contract, then checks every generated unit
test with a mutation gate before offering it — deliberately breaking the
implementation in small ways and confirming the test notices.

The problem it solves: a test written by reading an implementation and
asserting whatever it currently returns will pass forever, regardless of
whether the implementation is correct. This skill designs cases against the
contract first (types, callers, the originating bug report or feature
spec), runs them against the real implementation second, and only counts a
test as done once a mutation gate confirms it actually catches a broken
version of the code.

## Who it's for

Developers who want AI-generated tests that find real defects and get
harder to fool over time, not tests that quietly describe today's
behavior and break the moment that behavior is intentionally changed.

## What it does

1. Derives expected behavior from the function's signature, its real
   callers (via `graphify`), and — if available — the bug report or
   feature spec it originated from
2. Designs cases using boundary value analysis, equivalence partitioning,
   negative testing, error guessing, decision tables, and state transition
   testing as appropriate
3. Weights adversarial effort using `fix-bug`'s fix-attempt ledger —
   files with a real history of rejected fixes get more attention, and
   every confirmed fix becomes a permanent regression-test candidate
4. Runs every passing unit test through a mutation gate
   (`scripts/mutate-cli.mjs`): mutates the implementation in small,
   targeted ways and confirms the test suite notices; any survivor gets a
   new case written to kill it
5. Hands off file structure, naming, and framework conventions to whichever
   `coding-standards-*` skill matches the target repo's stack
6. Stages the full draft — cases, mutation results, any defects found with
   suggested resilience fixes — for review, and stops. Nothing is written
   to the real test directory without explicit confirmation.

## Prerequisites

- `graphify` — for call-graph and workflow-boundary queries
- `node` (v18+) — the bundled scripts are dependency-free Node ESM
- A working test command for the target file/repo, for the mutation gate
  to run against (Step 5 — without one, mutation gating is skipped and
  said so explicitly, never silently assumed)

## Install

**Portable (recommended):**

```bash
mkdir -p .agents/skills
cp -R generate-tests .agents/skills/
```

**Per-agent paths:**

| Agent | Personal | Project |
|---|---|---|
| Claude Code | `~/.claude/skills/generate-tests/` | `.claude/skills/generate-tests/` |
| Cursor | native global path | `.agents/skills/generate-tests/` |
| Hermes | `~/.hermes/skills/generate-tests/` | external_dirs in config.yaml |
| Codex | `~/.codex/skills/generate-tests/` | `.agents/skills/generate-tests/` |
| Gemini CLI | installer-managed | `.agents/skills/generate-tests/` |

Or run `bash setup.sh` from the repo root.

## Usage

> Write tests for the `isEligibleForDiscount` function in src/pricing.ts

> What would break the checkout flow — generate test cases for it

> Generate a regression test for the bug we just fixed

## Scripts

Run this skill's own test suite:

```bash
node --test generate-tests/scripts/tests/*.mjs
```

- `scripts/mutate-cli.mjs` — the mutation gate. See
  `references/mutation-gate.md` for what it mutates, what it never
  touches, and known limitations.
- `scripts/ledger-scan.mjs` — reads `fix-bug`'s fix-attempt ledger for
  defect clustering and regression-test candidates. See
  `references/ledger-integration.md`.
