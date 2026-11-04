// seo-optimize/scripts/tests/seo-docs-consistency.test.mjs
//
// Keeps the prose and the scanner from drifting apart: every rule the scanner
// can emit is documented in references/rule-catalog.md (and vice versa), and
// every `ref` a finding points to resolves to a real heading.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const lib = fs.readFileSync(path.join(SKILL, "scripts", "seo-scan-lib.mjs"), "utf8");

function anchorsOf(file) {
  const md = fs.readFileSync(path.join(SKILL, file), "utf8");
  return new Set([...md.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) =>
    m[1].trim().toLowerCase().replace(/[`*_]/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s/g, "-")));
}

test("rule catalog lists exactly the rule IDs the scanner emits", () => {
  const emitted = new Set([...lib.matchAll(/id:\s*"([A-Z0-9-]+)"/g)].map((m) => m[1]));
  const catalog = fs.readFileSync(path.join(SKILL, "references", "rule-catalog.md"), "utf8");
  const documented = new Set([...catalog.matchAll(/^\|\s*([A-Z][A-Z0-9]*-[A-Z0-9-]+)\s*\|/gm)].map((m) => m[1]));
  const missing = [...emitted].filter((x) => !documented.has(x));
  const stale = [...documented].filter((x) => !emitted.has(x));
  assert.deepEqual(missing, [], `undocumented rules: ${missing}`);
  assert.deepEqual(stale, [], `catalog rows for rules that no longer exist: ${stale}`);
});

test("every finding ref resolves to an existing reference heading", () => {
  const refs = new Set();
  for (const m of lib.matchAll(/references\/([a-z-]+\.md)#([a-z0-9-]+)/g)) refs.add(`${m[1]}#${m[2]}`);
  // `${ref}#anchor` uses inside a function whose const ref = "references/<file>.md"
  const blocks = lib.split(/\nfunction |\nexport function /);
  for (const b of blocks) {
    const base = b.match(/const ref = "references\/([a-z-]+\.md)"/);
    if (!base) continue;
    for (const m of b.matchAll(/`\$\{ref\}#([a-z0-9-]+)`/g)) refs.add(`${base[1]}#${m[1]}`);
  }
  assert.ok(refs.size > 20);
  for (const r of refs) {
    const [file, anchor] = r.split("#");
    assert.ok(fs.existsSync(path.join(SKILL, "references", file)), `missing file ${file}`);
    assert.ok(anchorsOf(`references/${file}`).has(anchor), `missing heading #${anchor} in ${file}`);
  }
});

test("SKILL.md points only at reference files that exist", () => {
  const skill = fs.readFileSync(path.join(SKILL, "SKILL.md"), "utf8");
  for (const m of skill.matchAll(/references\/([a-z-]+\.md)/g)) {
    assert.ok(fs.existsSync(path.join(SKILL, "references", m[1])), `SKILL.md mentions missing ${m[1]}`);
  }
  assert.match(skill, /edge-cases\.md/);
});
