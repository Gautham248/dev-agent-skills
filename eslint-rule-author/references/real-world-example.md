# Real-world example: a deeper AST traversal

The canonical example in `SKILL.md` (`no-focused-tests`) matches a single
`MemberExpression`. Real rules often need to walk into a call's **arguments** and
inspect a callback. This SvelteKit rule shows that shape: it disallows an `async`
callback passed to `onMount`, because data fetching in an `async onMount` is a
common mistake — it belongs in a SvelteKit `load` function instead.

It demonstrates three things the trivial example doesn't:

1. Matching a call by **callee identifier** (`onMount`).
2. Reaching into `node.arguments[0]` and narrowing it.
3. Handling **both** arrow and classic function expressions.

## The rule

```ts
// src/rules/noAsyncOnMount.ts
import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';

type MessageIds = 'noAsyncOnMount';

export const rule = ESLintUtils.RuleCreator.withoutDocs<[], MessageIds>({
  defaultOptions: [],
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow async callbacks in onMount; fetch data in a load function instead.',
    },
    messages: {
      noAsyncOnMount:
        'onMount callback is async. If this fetches data, move it to a load function.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === AST_NODE_TYPES.Identifier &&
          node.callee.name === 'onMount' &&
          node.arguments.length > 0
        ) {
          const callback = node.arguments[0];
          if (
            (callback.type === AST_NODE_TYPES.ArrowFunctionExpression ||
              callback.type === AST_NODE_TYPES.FunctionExpression) &&
            callback.async === true
          ) {
            context.report({ node, messageId: 'noAsyncOnMount' });
          }
        }
      },
    };
  },
});
```

## The test

```ts
// src/rules/noAsyncOnMount.spec.ts
import tsParser from '@typescript-eslint/parser';
import { rule } from './noAsyncOnMount';
import { RuleTester } from './ruleTester';

const ruleTester = new RuleTester({
  languageOptions: { parser: tsParser },
});

ruleTester.run('no-async-onmount', rule, {
  valid: [
    `onMount(() => { document.title = 'Hello'; });`,
    `onMount(() => { window.addEventListener('keydown', handler); });`,
  ],
  invalid: [
    {
      code: `onMount(async () => { const data = await fetch('/api/items'); });`,
      errors: [{ messageId: 'noAsyncOnMount' }],
    },
  ],
});
```

## Notes

- The rule is **syntactic only** — it flags any `async` callback named `onMount`,
  whether or not it actually fetches data. That's the right trade-off here: the
  pattern is almost always a mistake, and a false positive (an `async onMount`
  that legitimately awaits something non-data) is cheap to suppress. If you
  needed to know *what* the callback awaits, you'd need type information and the
  rule would belong in written guidance instead (see "False positives are a
  deal-breaker" in `SKILL.md`).
- Adapt the callee name (`onMount`) and message for your framework's lifecycle
  hook, or generalize the pattern to any function whose async-ness you want to
  forbid.
