# eslint-rule-author

An Agent Skill that helps a coding agent (or you) **author and test custom
ESLint rules** the right way — with a reusable rule anatomy, a test pattern that
actually works under modern runners, and the judgment to know when a rule
*shouldn't* exist.

Point your agent at this skill and ask it to "add a lint rule for X" or "this
keeps coming up in review — should it be a lint rule?". It will:

- Decide **lint rule vs. written guidance** using a clear, AST-detectability test.
- Scaffold a `@typescript-eslint/utils` rule from a template.
- Wire the `@typescript-eslint/rule-tester` ↔ Vitest/Jest bridge that trips up
  almost everyone the first time.
- Write `valid`/`invalid` tests, wire the rule into the plugin, and push you to
  treat false positives as a release blocker.

## Who it's for

Anyone maintaining a **custom ESLint plugin** — standalone or as a package in a
monorepo — written in TypeScript with `@typescript-eslint/utils`. The testing
guidance assumes [`@typescript-eslint/rule-tester`](https://typescript-eslint.io/packages/rule-tester/)
run under Vitest or Jest.

## What it is

A `SKILL.md` plus bundled scaffolds — no runtime script, nothing to execute. It
encodes a way of working:

```
eslint-rule-author/
├── SKILL.md                       # the guidance the agent follows
├── assets/
│   ├── rule.template.ts           # copy → src/rules/<ruleName>.ts
│   ├── rule.spec.template.ts      # copy → src/rules/<ruleName>.spec.ts
│   └── ruleTester.ts              # the RuleTester ↔ test-runner bridge
└── references/
    └── real-world-example.md      # a deeper AST traversal, fully worked
```

## Prerequisites (in the plugin you're editing)

- A TypeScript ESLint plugin package using
  [`@typescript-eslint/utils`](https://typescript-eslint.io/packages/utils/)
  (`ESLintUtils.RuleCreator`)
- [`@typescript-eslint/parser`](https://typescript-eslint.io/packages/parser/)
- [`@typescript-eslint/rule-tester`](https://typescript-eslint.io/packages/rule-tester/)
- A test runner — **Vitest** (the bundled bridge targets it) or **Jest** (see the
  note in `assets/ruleTester.ts`)

The skill itself ships no dependencies; the snippets compile against the
packages above when dropped into such a project.

## Install

This skill follows the open [Agent Skills](https://agentskills.io) layout
(`SKILL.md` + `assets/` + `references/`), so any agent that loads skills can use
it. Drop the `eslint-rule-author/` folder into your agent's skills directory.

**Portable (recommended for repos shared across agents):**

```bash
mkdir -p .agents/skills
cp -R eslint-rule-author .agents/skills/
```

**Per-agent personal/project paths:**

| Agent | Personal | Project |
|---|---|---|
| Claude Code | `~/.claude/skills/eslint-rule-author/` | `.claude/skills/eslint-rule-author/` |
| Cursor | native global path | `.agents/skills/eslint-rule-author/` or `.cursor/skills/eslint-rule-author/` |
| OpenCode | `~/.config/opencode/skills/eslint-rule-author/` | `.agents/skills/eslint-rule-author/` or `.opencode/skills/eslint-rule-author/` |
| Codex | `~/.codex/skills/eslint-rule-author/` | `.agents/skills/eslint-rule-author/` |
| Gemini CLI | installer-managed | `.agents/skills/eslint-rule-author/` |

Discovery, metadata, and invocation UI differ between these agents; this skill
relies only on the cross-agent `name` + `description` frontmatter, so the
guidance loads the same way, but feature depth (auto-loading, slash invocation,
permissions) is not identical across platforms. Verify global-path behavior in
your agent's current version.

> Built and verified against **Claude Code**. Other agents implementing the
> Agent Skills format should load it too, but are not independently tested here.

## Usage

From inside the plugin (or the project that consumes it), ask your agent:

> Add an ESLint rule that flags focused tests (`.only`) left in the suite.

> We keep telling people in review not to do X — should that be a lint rule or
> just a doc?

> Fix the false positive in `no-async-onmount` and add a `valid` test for it.

The agent reads `SKILL.md`, copies the `assets/` templates into your plugin's
`src/rules/`, wires the rule into `index.ts`, and writes the tests.

## Adapting to your project

- **Package name / paths** — the skill uses `@yourscope/eslint-plugin` and
  `src/rules/` as placeholders; substitute your own.
- **Package manager / runner** — examples use `pnpm --filter … test`; use your
  equivalent (`npm test`, `yarn test`).
- **Jest instead of Vitest** — swap the globals import in `assets/ruleTester.ts`
  (Jest exposes `afterAll`/`describe`/`it` as ambient globals).

## License

See the repository this skill ships in.
