// Copy to src/rules/<ruleName>.ts (camelCase file name).
// The exported key you register in index.ts is kebab-case, e.g. 'my-rule'.
import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';

// One message id per distinct report. Keep this type local to the file.
type MessageIds = 'myMessageId';

export const rule = ESLintUtils.RuleCreator.withoutDocs<[], MessageIds>({
  defaultOptions: [],
  meta: {
    // 'problem' = likely bug | 'suggestion' = could be better | 'layout' = formatting
    type: 'suggestion',
    docs: {
      description: 'TODO: one sentence — what this disallows and why it matters.',
    },
    messages: {
      // Shown at the report site. Use {{ placeholders }} filled from report `data`.
      myMessageId: 'TODO: explain what is wrong and what to do instead.',
    },
    schema: [], // JSON Schema for rule options; [] = no options
    // fixable: 'code', // uncomment ONLY if the autofix is safe and deterministic
  },
  create(context) {
    // Return a visitor keyed by AST node type. Find the right node and shape at
    // https://astexplorer.net (parser: @typescript-eslint/parser).
    return {
      CallExpression(node) {
        // Narrow with AST_NODE_TYPES guards before touching properties, e.g.:
        if (node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === 'TODO') {
          context.report({ node, messageId: 'myMessageId' });
        }
      },
    };
  },
});
