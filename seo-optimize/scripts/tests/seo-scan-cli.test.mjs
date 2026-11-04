// seo-optimize/scripts/tests/seo-scan-cli.test.mjs
//
// Runs the real CLI as a child process (how the skill invokes it), checking
// output shapes and exit codes rather than library internals.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "seo-scan.mjs");

function run(args, cwd) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "seo-scan-cli-"));
  const w = (rel, c) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), c); };
  w("package.json", JSON.stringify({ name: "demo", dependencies: { next: "16.4.5", react: "19.3.1" } }));
  w("app/layout.tsx", "export const metadata = { title: 'Create Next App' };\nexport default function L({children}){return <html lang='en'><body>{children}</body></html>}");
  w("app/page.tsx", "export default function P(){return <h1>Hi</h1>}");
  w("out/index.html", '<html lang="en"><head><title>Hi</title><meta name="viewport" content="x"></head><body><div id="root"></div></body></html>');
  return dir;
}

test("detect prints stack, docs pointer and routes", () => {
  const dir = fixture();
  const r = run(["detect", dir]);
  assert.equal(r.code, 0, r.err);
  const j = JSON.parse(r.out);
  assert.equal(j.stack.framework, "nextjs");
  assert.equal(j.stack.docs.local, "node_modules/next/dist/docs");
  assert.deepEqual(j.routes.map((x) => x.route), ["/"]);
});

test("scan --format json includes a summary; --fail-on high exits 1", () => {
  const dir = fixture();
  const r = run(["scan", dir]);
  assert.equal(r.code, 0, r.err);
  const j = JSON.parse(r.out);
  assert.ok(j.summary.total > 0);
  assert.ok(j.findings.some((f) => f.id === "META-002"));
  assert.equal(run(["scan", dir, "--fail-on", "high"]).code, 1);
  assert.equal(run(["scan", dir, "--fail-on", "critical"]).code, 0);
});

test("scan --format md renders a table", () => {
  const r = run(["scan", fixture(), "--format", "md"]);
  assert.match(r.out, /^# seo-scan \(static\)/);
  assert.match(r.out, /\| high \| META-002 \|/);
});

test("html flags an empty shell with a readable label", () => {
  const dir = fixture();
  const r = run(["html", path.join(dir, "out")]);
  const j = JSON.parse(r.out);
  const shell = j.findings.find((f) => f.id === "HTML-SHELL");
  assert.ok(shell);
  assert.equal(shell.file, "index.html");
});

test("usage errors exit 2", () => {
  assert.equal(run(["nope"]).code, 2);
  assert.equal(run(["fetch"]).code, 2);
  assert.equal(run(["html", "/definitely/not/here"]).code, 2);
  assert.equal(run(["fetch", "--url", "https://example.com/"]).code, 2, "remote fetch needs --allow-remote");
});
