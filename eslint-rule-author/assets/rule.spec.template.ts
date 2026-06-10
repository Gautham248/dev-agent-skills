// Copy to src/rules/<ruleName>.spec.ts, co-located with the rule.
import tsParser from '@typescript-eslint/parser';
import { rule } from './myRule'; // ← your rule file
import { RuleTester } from './ruleTester'; // ← the wired bridge, NOT @typescript-eslint/rule-tester

const ruleTester = new RuleTester({
  languageOptions: { parser: tsParser },
});

ruleTester.run('my-rule', rule, {
  valid: [
    // Code strings that must NOT report. Add one for every false positive
    // anyone reports against the rule.
    `// passing example`,
  ],
  invalid: [
    {
      code: `// code that MUST report`,
      errors: [{ messageId: 'myMessageId' }],
      // output: `// expected source after --fix`, // include ONLY if the rule is fixable
    },
  ],
});
