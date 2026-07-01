---
name: eslint-rule-author
description: >
  Use when authoring or modifying rules in a custom ESLint plugin — adding a new
  rule, fixing a false positive in an existing one, writing RuleTester tests,
  wiring a rule into the plugin index or a project's flat config, or deciding
  whether a recurring code-review correction should become a lint rule instead
  of written guidance. Covers the typescript-eslint rule anatomy, the
  RuleTester-under-Vitest/Jest test pattern, and how to keep rules precise
  enough to avoid false-positive fatigue. Prefer over generic ESLint docs when
  you want a concrete, copy-pasteable rule + test scaffold.
---

<!-- BEGIN dev-agent-skills clarification protocol (managed by setup.sh -- do not edit this block manually; edit CLARIFICATION-PROTOCOL.md instead) -->
Before doing anything else in this skill, read and follow the clarification protocol at:
../CLARIFICATION-PROTOCOL.md
<!-- END dev-agent-skills clarification protocol -->

<!-- BEGIN dev-agent-skills self-improvement protocol (managed by setup.sh -- do not edit this block manually; edit SELF-IMPROVEMENT-PROTOCOL.md instead) -->
While using this skill, and especially when you finish, read and follow the self-improvement protocol at:
../SELF-IMPROVEMENT-PROTOCOL.md
(Append real edge cases to this skill's own references/edge-cases.md — create it if missing. See the protocol file for what qualifies.)
<!-- END dev-agent-skills self-improvement protocol -->

# ESLint rule author

How to add or modify a rule in a custom ESLint plugin, with a testing and
wiring pattern that holds up over time. Ready-to-copy scaffolds live in
[`assets/`](./assets); a more advanced worked example is in
[`references/real-world-example.md`](./references/real-world-example.md).

## Lint rule or written guidance?

A recurring correction belongs in a **lint rule** when:

- It targets a specific, named pattern.
- The same correction applies every time, regardless of surrounding context.
- An AST traversal can detect it **without** semantic/type understanding.

If it depends on judgment, design intent, or "it depends on the architecture
around it," it belongs in **written guidance** (a doc, a review checklist, a
skill) — not a lint rule. It's fine to have both for one topic: **lint catches
the obvious cases, the guide explains the why.**

## Package layout

A custom plugin — standalone, or a package inside a monorepo — typically looks
like:

```
your-eslint-plugin/                 # or packages/eslint-plugin/ in a monorepo
├── package.json                    # e.g. @yourscope/eslint-plugin (often private, fixed version)
├── src/
│   ├── index.ts                    # exports the plugin: { rules: { 'rule-name': rule, … } }
│   └── rules/
│       ├── ruleTester.ts           # test-runner ↔ RuleTester bridge — import from here, see Tests
│       ├── <ruleName>.ts           # one file per rule
│       └── <ruleName>.spec.ts      # tests co-located with the rule
└── tsconfig.json
```

If you compile to `dist/` (esbuild/`tsc`), **rebuild before linting the
consuming project** so it picks up the changed rule.

## Anatomy of a rule

Use `ESLintUtils.RuleCreator.withoutDocs` from `@typescript-eslint/utils`. Keep
`type MessageIds` local to each rule file — don't share it across rules. File
names are camelCase (`noFocusedTests.ts`); the exported key in `index.ts` is
kebab-case (`'no-focused-tests'`).

Canonical example — flag focused tests (`describe.only` / `it.only` /
`test.only`) left in a suite, which silently skip the rest of the file in CI:

```ts
// src/rules/noFocusedTests.ts
import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';

type MessageIds = 'focusedTest';

const FOCUSABLE = new Set(['describe', 'it', 'test']);

export const rule = ESLintUtils.RuleCreator.withoutDocs<[], MessageIds>({
  defaultOptions: [],
  meta: {
    type: 'problem',
    docs: { description: 'Disallow focused tests (.only) from being committed.' },
    messages: {
      focusedTest:
        '`{{ name }}.only` left in the suite — remove it before committing, or the rest of the file is skipped in CI.',
    },
    schema: [],
    // fixable: 'code',  // only if the fix is safe and deterministic
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (
          node.object.type === AST_NODE_TYPES.Identifier &&
          FOCUSABLE.has(node.object.name) &&
          node.property.type === AST_NODE_TYPES.Identifier &&
          node.property.name === 'only'
        ) {
          context.report({ node, messageId: 'focusedTest', data: { name: node.object.name } });
        }
      },
    };
  },
});
```

(A published plugin already covers this exact case — see *Don't* below. It's
used here purely because the AST shape is the clearest possible teaching
example. Use [astexplorer.net](https://astexplorer.net) with the
`@typescript-eslint/parser` to find the node shapes for your own pattern.)

Start from [`assets/rule.template.ts`](./assets/rule.template.ts). For a more
involved traversal (inspecting a call's arguments and callback), see the
[real-world example](./references/real-world-example.md).

## Tests

Never ship a rule without tests — even a "trivial" rule needs the AST shape
pinned down so future changes don't silently break it.

`@typescript-eslint/rule-tester`'s `RuleTester` expects Mocha-style globals
(`afterAll` / `describe` / `it`). Vitest and Jest provide compatible ones but
don't register them on `RuleTester` automatically. Wire them **once** in a
shared `ruleTester.ts` and import `RuleTester` from there — never directly from
`@typescript-eslint/rule-tester`. The bridge is in
[`assets/ruleTester.ts`](./assets/ruleTester.ts).

```ts
// src/rules/noFocusedTests.spec.ts
import tsParser from '@typescript-eslint/parser';
import { rule } from './noFocusedTests';
import { RuleTester } from './ruleTester';

const ruleTester = new RuleTester({ languageOptions: { parser: tsParser } });

ruleTester.run('no-focused-tests', rule, {
  valid: [`it('works', () => {});`, `describe('x', () => {});`],
  invalid: [
    { code: `it.only('focused', () => {});`, errors: [{ messageId: 'focusedTest' }] },
    { code: `describe.only('x', () => {});`, errors: [{ messageId: 'focusedTest' }] },
  ],
});
```

Run only this package's tests (adjust for your package manager / runner):

```bash
pnpm --filter @yourscope/eslint-plugin test   # or: npm test / yarn test in the package
```

Scaffold: [`assets/rule.spec.template.ts`](./assets/rule.spec.template.ts).

## Wiring a new rule

1. Add `src/rules/<ruleName>.ts` and `src/rules/<ruleName>.spec.ts`.
2. In `src/index.ts`, import the rule and add it to the `rules` map under its
   kebab-case key:
   ```ts
   import { rule as noFocusedTests } from './rules/noFocusedTests.js';
   // …
   rules: { 'no-focused-tests': noFocusedTests /* , … */ }
   ```
3. If your plugin exposes a `configs.recommended`, add the rule there. Otherwise
   wire it manually in the consuming project's flat config (`eslint.config.js`).
4. Update the plugin README with a one-line entry.
5. Rebuild if you compile to `dist/`, then run the rule against a real project
   to spot false positives.
6. If the plugin is private with a fixed version, no version bump is needed;
   published plugins follow their own semver/release process.

## False positives are a deal-breaker

A noisy rule trains everyone to ignore lint output, which destroys the value of
every other rule in the package. When in doubt:

- Start at severity `warn` in the consuming config until you've watched the rule
  against a week of real code.
- Add a `valid` test case for **every** false positive someone reports — even if
  it forces a rewrite of the rule.
- If the rule can't be made precise without type/semantic information beyond the
  AST, pull it from the package and turn it into written guidance instead.

## Don't

- **Don't duplicate an upstream rule.** Before writing one, check `eslint`,
  `@typescript-eslint`, and any framework plugin you already use
  (`eslint-plugin-svelte`, `eslint-plugin-react`, `eslint-plugin-jest`,
  `eslint-plugin-no-only-tests`, …). If it exists upstream, configure it in your
  flat config instead of reimplementing it.
- **Don't add a `--fix` autofix unless you've tested the fix carefully.** A
  broken autofix is worse than none — it silently corrupts code.
- **Don't ship a rule without tests.**
- **Don't construct `RuleTester` from `@typescript-eslint/rule-tester`
  directly** — import from your `ruleTester.ts` bridge so the test-runner globals
  are wired up.

## See also

- typescript-eslint custom-rule docs: https://typescript-eslint.io/developers/custom-rules/
- typescript-eslint rule list (to avoid duplication): https://typescript-eslint.io/rules/
- RuleTester docs: https://typescript-eslint.io/packages/rule-tester/
- AST explorer (use the `@typescript-eslint/parser`): https://astexplorer.net
