// generate-tests/scripts/tests/mutate-cli.test.mjs
//
// Run: node --test generate-tests/scripts/tests/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { scanRegions, findMutants, runMutant, runMutants, summarize } from "../mutate-cli.mjs";

function tmpFile(content, ext = ".mjs") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mutate-cli-"));
  const file = path.join(dir, `sample${ext}`);
  fs.writeFileSync(file, content);
  return file;
}

// ---------------------------------------------------------------------------
describe("scanRegions — region classification", () => {
  test("plain code is entirely 'code'", () => {
    const spans = scanRegions("const a = 1 + 2;");
    assert.ok(spans.every((s) => s.type === "code"));
  });

  test("a double-quoted string is classified as 'string', not 'code'", () => {
    const src = 'const url = "http://example.com";';
    const spans = scanRegions(src);
    const stringSpan = spans.find((s) => s.type === "string");
    assert.ok(stringSpan, "expected a string span");
    assert.equal(src.slice(stringSpan.start, stringSpan.end), '"http://example.com"');
  });

  test("a string containing '//' is not mistaken for a line comment", () => {
    const src = 'const url = "http://example.com"; const x = 1 < 2;';
    const spans = scanRegions(src);
    // The comparison after the string must still be live code.
    const codeText = spans.filter((s) => s.type === "code").map((s) => src.slice(s.start, s.end)).join("");
    assert.ok(codeText.includes("1 < 2"));
  });

  test("escaped quotes inside a string do not end it early", () => {
    const src = 'const s = "she said \\"hi\\" to him"; const y = 3 > 1;';
    const spans = scanRegions(src);
    const stringSpan = spans.find((s) => s.type === "string");
    assert.equal(src.slice(stringSpan.start, stringSpan.end), '"she said \\"hi\\" to him"');
  });

  test("line comment is classified as 'comment' and not mutated", () => {
    const src = "// if (a < b) return true;\nconst z = 5;";
    const spans = scanRegions(src);
    const commentSpan = spans.find((s) => s.type === "comment");
    assert.ok(commentSpan);
    assert.ok(src.slice(commentSpan.start, commentSpan.end).startsWith("//"));
  });

  test("block comment spanning multiple lines is fully classified as 'comment'", () => {
    const src = "/* a < b\n   c > d */\nconst z = 1;";
    const spans = scanRegions(src);
    const commentSpan = spans.find((s) => s.type === "comment");
    assert.equal(src.slice(commentSpan.start, commentSpan.end), "/* a < b\n   c > d */");
  });

  test("a comment containing a quote character does not open a string", () => {
    const src = "// don't mutate this: a < b\nconst ok = 1 < 2;";
    const spans = scanRegions(src);
    const codeText = spans.filter((s) => s.type === "code").map((s) => src.slice(s.start, s.end)).join("");
    assert.ok(codeText.includes("1 < 2"));
  });

  test("template literal body is 'template', not 'code'", () => {
    const src = "const s = `hello ${name}, a < b is not code here`;";
    const spans = scanRegions(src);
    const templateSpans = spans.filter((s) => s.type === "template");
    assert.ok(templateSpans.length >= 1);
    const literalText = templateSpans.map((s) => src.slice(s.start, s.end)).join("");
    assert.ok(literalText.includes("a < b is not code here"));
  });

  test("a ${...} interpolation inside a template literal IS live code", () => {
    const src = "const s = `result: ${a < b}`;";
    const spans = scanRegions(src);
    const codeInsideTemplate = spans.filter((s) => s.type === "code").map((s) => src.slice(s.start, s.end)).join("");
    assert.ok(codeInsideTemplate.includes("a < b"));
  });

  test("nested template literal inside an interpolation round-trips correctly", () => {
    const src = "const s = `outer ${`inner ${a < b}`} end`;";
    // Must not throw, and the innermost comparison must still be reachable as code.
    const spans = scanRegions(src);
    const codeText = spans.filter((s) => s.type === "code").map((s) => src.slice(s.start, s.end)).join("");
    assert.ok(codeText.includes("a < b"));
    // Full reconstruction must equal the original source (no characters dropped).
    const reconstructed = spans.map((s) => src.slice(s.start, s.end)).join("");
    assert.equal(reconstructed, src);
  });

  test("every span set reconstructs the original source exactly (no gaps, no overlaps)", () => {
    const samples = [
      'const a = "x\\"y" + `t${1<2}` + 1 > 2 /* c */ // d\n;',
      "function f(a, b) { return a >= b ? true : false; }",
      "",
      "   \n\n  ",
    ];
    for (const src of samples) {
      const spans = scanRegions(src);
      const reconstructed = spans.map((s) => src.slice(s.start, s.end)).join("");
      assert.equal(reconstructed, src, `mismatch for: ${JSON.stringify(src)}`);
    }
  });
});

// ---------------------------------------------------------------------------
describe("findMutants — operator safety", () => {
  test("relational operator inside a string is never mutated", () => {
    const src = 'const msg = "1 < 2 is always true";';
    const mutants = findMutants(src);
    assert.equal(mutants.length, 0);
  });

  test("relational operator inside a real comparison IS found", () => {
    const src = "function f(a, b) { return a < b; }";
    const mutants = findMutants(src);
    assert.ok(mutants.some((m) => m.operator === "relational-flip" && m.before === "<"));
  });

  test("JSX-like '<Foo>' is not treated as a relational operator", () => {
    const src = "const el = <Foo bar={1} />;";
    const mutants = findMutants(src);
    assert.ok(!mutants.some((m) => m.operator === "relational-flip"));
  });

  test("JSX closing tag '</Foo>' is not treated as a relational operator", () => {
    const src = "const el = <div>{x}</div>;";
    const mutants = findMutants(src);
    assert.ok(!mutants.some((m) => m.operator === "relational-flip"));
  });

  test("TypeScript generic 'Array<T>' is not treated as a relational operator", () => {
    const src = "const xs: Array<number> = [];";
    const mutants = findMutants(src);
    assert.ok(!mutants.some((m) => m.operator === "relational-flip"));
  });

  test("equality flip covers === and !==", () => {
    const src = "if (a === b) { x = 1; } if (c !== d) { y = 2; }";
    const mutants = findMutants(src);
    const eq = mutants.filter((m) => m.operator === "equality-flip");
    assert.ok(eq.some((m) => m.before === "===" && m.after === "!=="));
    assert.ok(eq.some((m) => m.before === "!==" && m.after === "==="));
  });

  test("boolean literal flip only matches whole words, not substrings", () => {
    const src = "const trueValue = true; const falsely = false;";
    const mutants = findMutants(src);
    const bools = mutants.filter((m) => m.operator === "boolean-literal-flip");
    // Exactly the standalone `true` and `false` tokens, not the identifiers
    // `trueValue` / `falsely` that merely contain those substrings.
    assert.equal(bools.length, 2);
    assert.ok(bools.some((m) => m.before === "true" && m.after === "false"));
    assert.ok(bools.some((m) => m.before === "false" && m.after === "true"));
  });

  test("integer literal shift produces both +1 and -1 mutants at a boundary", () => {
    const src = "function isAdult(age) { return age >= 18; }";
    const mutants = findMutants(src);
    const ints = mutants.filter((m) => m.operator === "integer-literal-shift" && m.before === "18");
    assert.ok(ints.some((m) => m.after === "19"));
    assert.ok(ints.some((m) => m.after === "17"));
  });

  test("integer literal shift does not fire on part of a decimal or a longer identifier", () => {
    const src = "const pi = 3.14; const id1 = 5;";
    const mutants = findMutants(src);
    const ints = mutants.filter((m) => m.operator === "integer-literal-shift");
    assert.ok(!ints.some((m) => m.before === "1")); // from "id1" -- must not fire, it's part of an identifier
    assert.ok(!ints.some((m) => m.before === "14")); // decimal fraction should not be mutated in isolation this way producing a bogus literal mid-number... (see below for the "3" case)
  });

  test("mutant ids are stable and ordered by position", () => {
    const src = "function f(a, b) { return a < b && a !== b; }";
    const mutants = findMutants(src);
    for (let i = 0; i < mutants.length; i++) assert.equal(mutants[i].id, i + 1);
    for (let i = 1; i < mutants.length; i++) assert.ok(mutants[i].index >= mutants[i - 1].index);
  });
});

// ---------------------------------------------------------------------------
describe("runMutant — restore guarantee", () => {
  test("original file content is restored after a mutant that passes tests", () => {
    const file = tmpFile("export function f(a, b) { return a < b; }\n");
    const original = fs.readFileSync(file, "utf8");
    const mutants = findMutants(original);
    runMutant(file, mutants[0], process.platform === "win32" ? "exit 0" : "true");
    assert.equal(fs.readFileSync(file, "utf8"), original);
  });

  test("original file content is restored after a mutant that fails tests", () => {
    const file = tmpFile("export function f(a, b) { return a < b; }\n");
    const original = fs.readFileSync(file, "utf8");
    const mutants = findMutants(original);
    runMutant(file, mutants[0], process.platform === "win32" ? "exit 1" : "false");
    assert.equal(fs.readFileSync(file, "utf8"), original);
  });

  test("original file content is restored even when the test command itself throws/errors unexpectedly", () => {
    const file = tmpFile("export function f(a, b) { return a < b; }\n");
    const original = fs.readFileSync(file, "utf8");
    const mutants = findMutants(original);
    // A command that doesn't exist -- execSync throws synchronously before any exit code exists.
    assert.doesNotThrow(() => runMutant(file, mutants[0], "this-command-does-not-exist-xyz"));
    assert.equal(fs.readFileSync(file, "utf8"), original);
  });

  test("a failing test command is reported as 'killed'", () => {
    const file = tmpFile("export function f(a, b) { return a < b; }\n");
    const mutants = findMutants(fs.readFileSync(file, "utf8"));
    const result = runMutant(file, mutants[0], process.platform === "win32" ? "exit 1" : "false");
    assert.equal(result.status, "killed");
  });

  test("a passing test command is reported as 'survived'", () => {
    const file = tmpFile("export function f(a, b) { return a < b; }\n");
    const mutants = findMutants(fs.readFileSync(file, "utf8"));
    const result = runMutant(file, mutants[0], process.platform === "win32" ? "exit 0" : "true");
    assert.equal(result.status, "survived");
  });

  test("an unresolvable test command is reported as 'killed' (fails safe, not silently skipped)", () => {
    const file = tmpFile("export function f(a, b) { return a < b; }\n");
    const mutants = findMutants(fs.readFileSync(file, "utf8"));
    const result = runMutant(file, mutants[0], "this-command-does-not-exist-xyz");
    assert.equal(result.status, "killed");
  });
});

// ---------------------------------------------------------------------------
describe("runMutant — nested `node --test` environment leakage", () => {
  // Regression test for a real bug found while building this tool: node's
  // own test runner sets NODE_TEST_CONTEXT in its process environment.
  // execSync inherits process.env by default, so running this exact test
  // suite (itself launched via `node --test`) against a target file whose
  // test-cmd is ALSO `node --test ...` leaked that variable into the child,
  // which silently stopped exiting non-zero on a real test failure -- every
  // mutant looked "survived" regardless of whether the child's tests
  // actually caught it. This must stay fixed.
  test("a nested `node --test` test-cmd still reports failure correctly even when this suite runs under `node --test`", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mutate-envleak-"));
    const srcFile = path.join(dir, "src.mjs");
    fs.writeFileSync(srcFile, "export const value = 1;\n");
    const testFile = path.join(dir, "always-fails.test.mjs");
    fs.writeFileSync(
      testFile,
      [
        'import { test } from "node:test";',
        'import assert from "node:assert/strict";',
        'test("always fails", () => { assert.equal(1, 2); });',
      ].join("\n")
    );
    const mutants = findMutants(fs.readFileSync(srcFile, "utf8"));
    // Doesn't matter whether there are real mutants here -- what's under
    // test is whether execSync correctly sees the child's non-zero exit.
    // Force at least one synthetic "mutant" so runMutant actually executes.
    const probe = mutants[0] || { index: 0, length: 0, before: "", after: "", operator: "probe", line: 1, id: 1 };
    const result = runMutant(srcFile, probe, `node --test ${JSON.stringify(testFile)}`);
    assert.equal(result.status, "killed", "a test file that ALWAYS fails must be seen as killing the mutant, regardless of the parent process's own NODE_TEST_CONTEXT");
  });
});

// ---------------------------------------------------------------------------
describe("summarize", () => {
  test("computes mutation score as killed / total", () => {
    const results = [{ status: "killed" }, { status: "killed" }, { status: "survived" }, { status: "killed" }];
    const s = summarize(results);
    assert.equal(s.total, 4);
    assert.equal(s.killed, 3);
    assert.equal(s.survived, 1);
    assert.equal(s.score, 0.75);
  });

  test("score is null (not NaN or 0) when there are no mutants at all", () => {
    const s = summarize([]);
    assert.equal(s.total, 0);
    assert.equal(s.score, null);
  });
});

// ---------------------------------------------------------------------------
describe("end-to-end: the actual point of this tool", () => {
  test("a test that genuinely checks boundary behavior kills the age>=18 mutants", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mutate-e2e-"));
    const srcFile = path.join(dir, "is-adult.mjs");
    fs.writeFileSync(
      srcFile,
      "export function isAdult(age) { return age >= 18; }\n"
    );
    const testFile = path.join(dir, "is-adult.real.test.mjs");
    fs.writeFileSync(
      testFile,
      [
        'import { test } from "node:test";',
        'import assert from "node:assert/strict";',
        `import { isAdult } from ${JSON.stringify(srcFile)};`,
        'test("boundary", () => {',
        "  assert.equal(isAdult(17), false);",
        "  assert.equal(isAdult(18), true);",
        "});",
      ].join("\n")
    );

    const mutants = findMutants(fs.readFileSync(srcFile, "utf8"));
    const boundaryMutants = mutants.filter((m) => m.operator === "integer-literal-shift" || m.operator === "relational-flip");
    const results = runMutants(srcFile, boundaryMutants, `node --test ${JSON.stringify(testFile)}`);
    const summary = summarize(results);

    // A real boundary test should kill essentially every boundary-shifting
    // mutant on this trivial function -- this is the tool proving its own
    // premise, not just unit-testing its internals in isolation.
    assert.equal(summary.survived, 0, `expected all boundary mutants killed, survivors: ${JSON.stringify(results.filter(r => r.status === "survived"))}`);
  });

  test("a tautological test (asserts whatever the code currently returns) lets mutants survive", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mutate-e2e-weak-"));
    const srcFile = path.join(dir, "is-adult.mjs");
    fs.writeFileSync(srcFile, "export function isAdult(age) { return age >= 18; }\n");
    const testFile = path.join(dir, "is-adult.weak.test.mjs");
    // The failure mode this whole skill exists to prevent: a "smoke test"
    // that only checks the function runs and returns a boolean, never
    // pinning down which boolean for which input.
    fs.writeFileSync(
      testFile,
      [
        'import { test } from "node:test";',
        'import assert from "node:assert/strict";',
        `import { isAdult } from ${JSON.stringify(srcFile)};`,
        'test("smoke", () => {',
        "  assert.equal(typeof isAdult(20), \"boolean\");",
        "});",
      ].join("\n")
    );

    const mutants = findMutants(fs.readFileSync(srcFile, "utf8"));
    const boundaryMutants = mutants.filter((m) => m.operator === "integer-literal-shift" || m.operator === "relational-flip");
    const results = runMutants(srcFile, boundaryMutants, `node --test ${JSON.stringify(testFile)}`);
    const summary = summarize(results);

    assert.ok(summary.survived > 0, "expected the tautological test to let at least one boundary mutant survive");
  });
});

// ---------------------------------------------------------------------------
describe("CLI", () => {
  const cliPath = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "mutate-cli.mjs");

  test("plan prints a mutant list and exits 0", () => {
    const file = tmpFile("export function f(a, b) { return a >= b; }\n");
    const out = execFileSync("node", [cliPath, "plan", "--file", file]).toString();
    assert.match(out, /mutant\(s\) planned/);
  });

  test("plan --json writes a machine-readable report", () => {
    const file = tmpFile("export function f(a, b) { return a >= b; }\n");
    const jsonOut = file + ".json";
    execFileSync("node", [cliPath, "plan", "--file", file, "--json", jsonOut]);
    const parsed = JSON.parse(fs.readFileSync(jsonOut, "utf8"));
    assert.ok(Array.isArray(parsed.mutants));
    assert.ok(parsed.mutants.length > 0);
  });

  test("run exits with code 2 when a mutant survives", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mutate-cli-run-"));
    const srcFile = path.join(dir, "src.mjs");
    fs.writeFileSync(srcFile, "export function f(a, b) { return a >= b; }\n");
    assert.throws(() => {
      execFileSync("node", [cliPath, "run", "--file", srcFile, "--test-cmd", "true"]);
    }, (err) => err.status === 2);
  });

  test("run exits 0 when every mutant is killed", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mutate-cli-run-ok-"));
    const srcFile = path.join(dir, "src.mjs");
    fs.writeFileSync(srcFile, "export function f(a, b) { return a >= b; }\n");
    const out = execFileSync("node", [cliPath, "run", "--file", srcFile, "--test-cmd", "false"]).toString();
    assert.match(out, /killed/);
  });

  test("plan errors out cleanly on a missing file", () => {
    assert.throws(() => {
      execFileSync("node", [cliPath, "plan", "--file", "/no/such/file.mjs"], { stdio: "pipe" });
    });
  });

  test("file is left byte-for-byte unchanged after a full CLI run", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mutate-cli-unchanged-"));
    const srcFile = path.join(dir, "src.mjs");
    const original = "export function f(a, b) { return a >= b && a !== 0; }\n";
    fs.writeFileSync(srcFile, original);
    try {
      execFileSync("node", [cliPath, "run", "--file", srcFile, "--test-cmd", "true"]);
    } catch {
      // exit code 2 (survivors) is expected here and throws -- that's fine, we only care about file state
    }
    assert.equal(fs.readFileSync(srcFile, "utf8"), original);
  });
});
