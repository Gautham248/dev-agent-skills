// Test-runner ↔ RuleTester bridge.
//
// @typescript-eslint/rule-tester's RuleTester expects Mocha-style globals
// (afterAll / describe / it). Vitest and Jest provide compatible globals but do
// NOT register them on RuleTester automatically. Wire them here once, then
// import RuleTester from THIS module in every *.spec.ts — never straight from
// '@typescript-eslint/rule-tester', or your tests won't be grouped/torn down
// correctly.
//
// This file uses Vitest. For Jest, swap the import for Jest's globals
// (they are available as ambient globals, so you can drop the import and assign
// `RuleTester.afterAll = afterAll`, etc.).
import { afterAll, describe, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

export { RuleTester };
