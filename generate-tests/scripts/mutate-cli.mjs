#!/usr/bin/env node
// generate-tests/scripts/mutate-cli.mjs
//
//   plan --file <path> [--max-mutants N] [--json out.json]
//   run  --file <path> --test-cmd "<command>" [--max-mutants N]
//        [--cwd <dir>] [--json out.json]
//
// The problem this solves: a test suite written by reading an implementation
// and asserting what it currently does will pass against that
// implementation forever, regardless of whether it is actually checking
// anything. It is impossible to tell "this test verifies real behavior"
// apart from "this test is a tautology" by reading the test alone -- the
// only way to find out is to break the implementation on purpose, in a way
// that should be observable, and see if the test notices.
//
// That is what this script does. It is deliberately NOT a full AST-based
// mutation tool (no parser dependency -- dependency-free Node ESM only,
// matching every other script in this repo). It is a careful, region-aware
// text scanner: it walks the source once, classifies every character as
// code / string / template-literal / comment, and only ever mutates
// characters classified as code. Getting that region classification right
// is most of this file's complexity and almost all of its risk -- a mutation
// applied inside a string literal doesn't test anything, and a mutation that
// corrupts a template-literal's ${...} boundary can silently produce a file
// that no longer parses, which would make every mutant look "killed" for a
// reason that has nothing to do with test quality.
//
// Exit codes: 0 = ran successfully (check the report for mutation score).
//             1 = usage/setup error (bad args, file not found, etc).

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Region scanning
// ---------------------------------------------------------------------------

/**
 * Walks `source` once and returns an array of { start, end, type } spans
 * covering the whole string, where type is one of:
 *   "code"      -- eligible for mutation
 *   "string"    -- single/double-quoted string literal, never mutated
 *   "comment"   -- line or block comment, never mutated
 *   "template"  -- the literal (backtick) portions of a template string,
 *                  never mutated -- but a ${...} interpolation inside one
 *                  IS live code and gets its own "code" span, because
 *                  `${a < b}` is a real comparison that deserves the same
 *                  mutation coverage as anywhere else.
 *
 * This is a state machine, not a parser -- it does not build an AST and
 * does not understand statement structure. It only needs to answer one
 * question per character: "is this safe to flip a token inside?"
 */
export function scanRegions(source) {
  const spans = [];
  let i = 0;
  const n = source.length;
  let spanStart = 0;
  let spanType = "code";

  // Stack of frames for nested template/interpolation contexts, so
  // `${ `a${b}` }` (a template inside an interpolation inside a template)
  // unwinds correctly. Two frame shapes:
  //   { kind: "template" }              -- we're inside a `...` literal
  //   { kind: "interpolation", depth }  -- we're inside a ${...}; depth
  //                                        counts *unrelated* braces (object
  //                                        literals, blocks) opened inside
  //                                        that interpolation, so the brace
  //                                        that actually closes the
  //                                        interpolation is the one seen
  //                                        when depth is back at 0.
  // Each interpolation gets its OWN depth counter on its own stack frame --
  // deliberately not a single shared variable, which was the first version
  // of this function's bug: a nested template's interpolation would
  // clobber the enclosing interpolation's brace count on the way back out.
  const stack = [];

  // flush(end, newType): closes the in-progress span as whatever spanType
  // CURRENTLY is (not the type we're switching to -- swapping those two was
  // this function's second bug, and it silently mislabeled every single
  // region in the file, e.g. tagging the *code before* a string as type
  // "string" and the string itself as the following code's type).
  function flush(end, newType) {
    if (end > spanStart) spans.push({ start: spanStart, end, type: spanType });
    spanStart = end;
    spanType = newType;
  }

  while (i < n) {
    const c = source[i];
    const c2 = source[i + 1];

    if (spanType === "code") {
      if (c === "/" && c2 === "/") {
        flush(i, "comment");
        i += 2;
        while (i < n && source[i] !== "\n") i++;
        flush(i, "code");
        continue;
      }
      if (c === "/" && c2 === "*") {
        flush(i, "comment");
        i += 2;
        while (i < n && !(source[i] === "*" && source[i + 1] === "/")) i++;
        i = Math.min(i + 2, n);
        flush(i, "code");
        continue;
      }
      if (c === '"' || c === "'") {
        flush(i, "string");
        const quote = c;
        i++;
        while (i < n && source[i] !== quote) {
          if (source[i] === "\\") i++; // skip escaped char, including escaped backslash
          i++;
        }
        i = Math.min(i + 1, n); // consume closing quote if present
        flush(i, "code");
        continue;
      }
      if (c === "`") {
        flush(i, "template");
        stack.push({ kind: "template" });
        i++;
        continue;
      }
      if (stack.length && stack[stack.length - 1].kind === "interpolation") {
        const top = stack[stack.length - 1];
        if (c === "{") {
          top.depth++;
        } else if (c === "}") {
          if (top.depth > 0) {
            top.depth--;
          } else {
            // depth back to 0: this brace closes the interpolation itself,
            // resuming the template literal text that contains it.
            stack.pop();
            flush(i + 1, "template");
            i++;
            continue;
          }
        }
      }
      i++;
      continue;
    }

    if (spanType === "template") {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "`") {
        flush(i + 1, "code");
        stack.pop(); // this template's own frame
        i++;
        continue;
      }
      if (c === "$" && c2 === "{") {
        flush(i, "code");
        stack.push({ kind: "interpolation", depth: 0 });
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    // Unreachable for "string"/"comment" -- those are consumed eagerly above
    // in one pass each, spanType never rests in that state across loop ticks.
    i++;
  }

  flush(n, spanType);
  return spans;
}

/** True if `source[index]` (or a small window around it) falls inside a "code" span. */
function isCodeIndex(spans, index) {
  const span = spans.find((s) => index >= s.start && index < s.end);
  return !!span && span.type === "code";
}

// ---------------------------------------------------------------------------
// Mutation operators
// ---------------------------------------------------------------------------
//
// Each operator scans only within "code" spans and yields candidate mutants
// as { index, length, before, after, operator }. Longest-token operators
// (===, !==, <=, >=) are matched before their shorter substrings (=, <, >)
// so e.g. "<=" is never partially mutated into "<=" + a stray "=".

const OPERATORS = [
  {
    name: "equality-flip",
    pattern: /===|!==|==|!=/g,
    mutate(tok) {
      return { "===": "!==", "!==": "===", "==": "!=", "!=": "==" }[tok];
    },
  },
  {
    name: "relational-flip",
    pattern: /<=|>=|<|>/g,
    mutate(tok, source, index) {
      // Guard against JSX and TypeScript generics, which use the same
      // characters for something that is not a comparison at all:
      //   <Foo>, <div>, </Foo>, </div>, <T>, Array<T>, <Foo />  etc.
      // Heuristic, not a parser: skip if the character immediately before
      // "<" is an identifier character (generic: Array<T>, or a tight
      // comparison like x<y -- conservatively treated the same way, since
      // generics dominate the false-positive risk in this codebase style),
      // if this ">" is immediately preceded by "/" (self-closing tag end,
      // "/>"), or if this "<" is immediately followed by a letter or "/"
      // with no space (a tag start -- native elements are lowercase,
      // components are uppercase, both must be covered). Well-formatted
      // comparisons almost always have a space on at least one side of the
      // operator (`a < b`), so this only gives up mutation coverage on
      // deliberately unspaced comparisons, never on spaced ones.
      const before = source[index - 1] || "";
      const after = source[index + tok.length] || "";
      const firstChar = tok[0];
      const isAngle = firstChar === "<" || tok[tok.length - 1] === ">";
      if (isAngle) {
        if (/[A-Za-z0-9_$]/.test(before)) return null; // Array<T>, x<y
        if (before === "/") return null; // "/>" self-closing tag end
        if (/[A-Za-z/]/.test(after)) return null; // "<Foo", "<div", "</Foo" -- tag start, any case
      }
      return { "<=": "<", "<": "<=", ">=": ">", ">": ">=" }[tok];
    },
  },
  {
    name: "logical-flip",
    pattern: /&&|\|\|/g,
    mutate(tok) {
      return { "&&": "||", "||": "&&" }[tok];
    },
  },
  {
    name: "boolean-literal-flip",
    pattern: /\btrue\b|\bfalse\b/g,
    mutate(tok) {
      return tok === "true" ? "false" : "true";
    },
  },
  {
    name: "increment-decrement-flip",
    pattern: /\+\+|--/g,
    mutate(tok) {
      return tok === "++" ? "--" : "++";
    },
  },
  {
    name: "integer-literal-shift",
    // Standalone integers only -- not part of a longer number (1.5, 1e10),
    // not part of an identifier (x1), not a version-looking token.
    pattern: /(?<![\w.])\d+(?![\w.])/g,
    mutate(tok) {
      const v = parseInt(tok, 10);
      return String(v + 1); // a second mutant using v-1 is generated separately, see below
    },
  },
];

/**
 * Returns every candidate mutant for `source`, each with a stable id so a
 * report can reference "mutant #3" and mean the same thing across a plan
 * and a later run.
 */
export function findMutants(source) {
  const spans = scanRegions(source);
  const mutants = [];

  for (const op of OPERATORS) {
    op.pattern.lastIndex = 0;
    let m;
    while ((m = op.pattern.exec(source))) {
      const tok = m[0];
      const index = m.index;
      if (!isCodeIndex(spans, index)) continue;

      const after = op.mutate(tok, source, index);
      if (after === null || after === undefined || after === tok) continue;

      const line = source.slice(0, index).split("\n").length;
      mutants.push({ index, length: tok.length, before: tok, after, operator: op.name, line });

      // integer-literal-shift additionally offers a "-1" mutant at the same
      // site, since boundary defects go in both directions (off-by-one-high
      // and off-by-one-low are different bugs, and BVA cares about both).
      if (op.name === "integer-literal-shift") {
        const v = parseInt(tok, 10);
        const downAfter = String(v - 1);
        if (downAfter !== tok && v - 1 >= 0) {
          mutants.push({ index, length: tok.length, before: tok, after: downAfter, operator: op.name, line });
        }
      }
    }
  }

  // Stable order: by position in file, so --max-mutants truncation is
  // deterministic and a re-run against the same file produces the same plan.
  mutants.sort((a, b) => a.index - b.index || a.after.localeCompare(b.after));
  mutants.forEach((m, i) => (m.id = i + 1));
  return mutants;
}

function applyMutant(source, mutant) {
  return source.slice(0, mutant.index) + mutant.after + source.slice(mutant.index + mutant.length);
}

// ---------------------------------------------------------------------------
// Running mutants against a test command
// ---------------------------------------------------------------------------

/**
 * A clean child environment for the test command. Deliberately strips every
 * NODE_TEST_* variable rather than inheriting process.env as-is.
 *
 * Found by testing, not by inspection: `node --test` sets NODE_TEST_CONTEXT
 * in its own process environment. execSync's default env is `{...process.env}`,
 * so if mutate-cli.mjs is ever invoked (directly or via this test suite)
 * from inside another `node --test` run, that variable leaks into the
 * spawned test command. A `node --test` child that inherits
 * NODE_TEST_CONTEXT stops behaving like a standalone CLI run -- it assumes
 * it's a worker being orchestrated by a parent test runner and defers
 * reporting to that coordination channel instead of exiting non-zero on a
 * real failure. The observable symptom is silent and dangerous for this
 * tool specifically: a mutant that a target repo's real test suite DID
 * catch gets reported as "survived" anyway, because execSync saw exit code
 * 0 -- the mutation score becomes actively misleading rather than merely
 * incomplete. Stripping the variable makes every invocation of the test
 * command behave the same regardless of what process launched mutate-cli.mjs.
 */
function childEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("NODE_TEST")) delete env[key];
  }
  return env;
}

/**
 * Applies one mutant to `filePath`, runs `testCmd`, restores the original
 * content, and reports whether the mutant survived (tests still passed --
 * bad, means nothing caught this behavior change) or was killed (tests
 * failed -- good).
 *
 * The try/finally is load-bearing: if testCmd itself throws, hangs past a
 * timeout, or the process is killed mid-run, the original file must still
 * come back. A mutation tool that can leave a developer's real source file
 * mutated on disk after a crash is worse than not running at all.
 */
export function runMutant(filePath, mutant, testCmd, opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const timeoutMs = opts.timeoutMs || 30_000;
  const original = fs.readFileSync(filePath, "utf8");
  const mutated = applyMutant(original, mutant);

  try {
    fs.writeFileSync(filePath, mutated);
    try {
      execSync(testCmd, { cwd, stdio: "pipe", timeout: timeoutMs, env: opts.env || childEnv() });
      return { ...mutant, status: "survived" }; // exit 0 with the mutant in place -- nothing caught it
    } catch (err) {
      // Non-zero exit or timeout: something noticed. A timeout is treated
      // the same as a failure (killed), not as an error -- a mutant that
      // hangs the suite is still a mutant the suite reacted to.
      return { ...mutant, status: "killed", exitCode: err.status ?? null, signal: err.signal ?? null };
    }
  } finally {
    fs.writeFileSync(filePath, original);
  }
}

export function runMutants(filePath, mutants, testCmd, opts = {}) {
  const results = [];
  for (const mutant of mutants) {
    results.push(runMutant(filePath, mutant, testCmd, opts));
  }
  return results;
}

export function summarize(results) {
  const killed = results.filter((r) => r.status === "killed").length;
  const survived = results.filter((r) => r.status === "survived").length;
  const total = results.length;
  const score = total === 0 ? null : killed / total;
  return { total, killed, survived, score };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function writeJsonIfRequested(a, payload) {
  if (a.json && typeof a.json === "string") {
    fs.writeFileSync(a.json, JSON.stringify(payload, null, 2));
  }
}

function cmdPlan(a) {
  if (!a.file) die("--file is required");
  if (!fs.existsSync(a.file)) die(`file not found: ${a.file}`);
  const source = fs.readFileSync(a.file, "utf8");
  let mutants = findMutants(source);
  const max = a["max-mutants"] ? parseInt(a["max-mutants"], 10) : 8;
  const truncated = mutants.length > max;
  mutants = mutants.slice(0, max);

  console.log(`${mutants.length} mutant(s) planned for ${a.file}${truncated ? ` (truncated from more, --max-mutants ${max})` : ""}:`);
  for (const m of mutants) {
    console.log(`  #${m.id} line ${m.line} [${m.operator}] ${JSON.stringify(m.before)} -> ${JSON.stringify(m.after)}`);
  }
  writeJsonIfRequested(a, { file: a.file, mutants, truncated });
}

function cmdRun(a) {
  if (!a.file) die("--file is required");
  if (!a["test-cmd"]) die("--test-cmd is required");
  if (!fs.existsSync(a.file)) die(`file not found: ${a.file}`);

  const source = fs.readFileSync(a.file, "utf8");
  let mutants = findMutants(source);
  const max = a["max-mutants"] ? parseInt(a["max-mutants"], 10) : 8;
  mutants = mutants.slice(0, max);

  if (mutants.length === 0) {
    console.log("No mutable code found (file may be all declarations/types, or too short to mutate safely). Nothing to gate.");
    writeJsonIfRequested(a, { file: a.file, results: [], summary: { total: 0, killed: 0, survived: 0, score: null } });
    return;
  }

  const results = runMutants(a.file, mutants, a["test-cmd"], { cwd: a.cwd });
  const summary = summarize(results);

  console.log(`Mutation gate: ${a.file}`);
  console.log(`  ${summary.killed}/${summary.total} killed (score ${(summary.score * 100).toFixed(0)}%)`);
  const survived = results.filter((r) => r.status === "survived");
  if (survived.length) {
    console.log(`\n  Survived mutants (test suite did NOT notice these -- write a case for each):`);
    for (const m of survived) {
      console.log(`    #${m.id} line ${m.line} [${m.operator}] ${JSON.stringify(m.before)} -> ${JSON.stringify(m.after)}`);
    }
  }
  writeJsonIfRequested(a, { file: a.file, results, summary });

  // Non-zero exit when anything survived, so a wrapping skill step can
  // treat "mutation gate failed" as a real gate rather than parsing prose.
  if (summary.survived > 0) process.exitCode = 2;
}

function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const a = parseArgs(argv.slice(1));
  if (cmd === "plan") return cmdPlan(a);
  if (cmd === "run") return cmdRun(a);
  die(`unknown command ${JSON.stringify(cmd)} -- expected "plan" or "run"`);
}

// Only run the CLI when this file is the entry point -- importing it for
// its exported functions (as the test suite does) must not trigger a run.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
