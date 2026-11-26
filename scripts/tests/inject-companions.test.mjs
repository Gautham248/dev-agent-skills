// scripts/tests/inject-companions.test.mjs
//
// Run: node --test scripts/tests/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(HERE, "..", "inject-companions.sh");
const BEGIN = "<!-- BEGIN dev-agent-skills companion skills";
const PROTOCOL_BLOCK = [
  "<!-- BEGIN dev-agent-skills clarification protocol (managed by setup.sh -- do not edit this block manually; edit CLARIFICATION-PROTOCOL.md instead) -->",
  "Before doing anything else in this skill, read and follow the clarification protocol at:",
  "../config/CLARIFICATION-PROTOCOL.md",
  "<!-- END dev-agent-skills clarification protocol -->",
].join("\n");

function skill(dir, name, { extraFrontmatter = "", body = "# Body\n\nText.\n", protocol = true } = {}) {
  fs.mkdirSync(path.join(dir, name), { recursive: true });
  const fm = `---\nname: ${name}\ndescription: test skill\n${extraFrontmatter}---\n`;
  const content = fm + (protocol ? `\n${PROTOCOL_BLOCK}\n\n` : "\n") + body;
  fs.writeFileSync(path.join(dir, name, "SKILL.md"), content);
}

function read(dir, name) {
  return fs.readFileSync(path.join(dir, name, "SKILL.md"), "utf8");
}

function run(dir) {
  const res = spawnSync("bash", [SCRIPT, dir], { encoding: "utf8" });
  return { status: res.status, out: res.stdout + res.stderr };
}

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "companions-"));
  skill(dir, "reviewer");
  skill(dir, "guide", { extraFrontmatter: "companion-of: reviewer\n" });
  return dir;
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

describe("inject-companions.sh", () => {
  test("first run injects exactly one block into the target, after the protocol block", () => {
    const dir = fixture();
    const res = run(dir);
    assert.equal(res.status, 0, res.out);
    const target = read(dir, "reviewer");
    assert.equal(count(target, BEGIN), 1);
    assert.ok(target.includes("`guide`"));
    assert.ok(target.indexOf("END dev-agent-skills clarification protocol") < target.indexOf(BEGIN));
    assert.ok(target.indexOf(BEGIN) < target.indexOf("# Body"));
    assert.equal(count(read(dir, "guide"), BEGIN), 0, "the companion itself gets no block");
  });

  test("second run leaves the file byte-identical", () => {
    const dir = fixture();
    run(dir);
    const first = read(dir, "reviewer");
    const res = run(dir);
    assert.equal(read(dir, "reviewer"), first);
    assert.match(res.out, /injected into 0 skill\(s\), refreshed 0/);
  });

  test("removing companion-of from the companion removes the block", () => {
    const dir = fixture();
    run(dir);
    skill(dir, "guide");
    const res = run(dir);
    assert.equal(count(read(dir, "reviewer"), BEGIN), 0);
    assert.match(res.out, /removed from 1/);
    assert.ok(read(dir, "reviewer").includes("# Body"));
  });

  test("two companions of one target produce one block listing both", () => {
    const dir = fixture();
    skill(dir, "notes-helper", { extraFrontmatter: "companion-of: reviewer\n" });
    run(dir);
    const target = read(dir, "reviewer");
    assert.equal(count(target, BEGIN), 1);
    assert.ok(target.includes("`guide`") && target.includes("`notes-helper`"));
  });

  test("a missing target warns and changes no file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "companions-"));
    skill(dir, "guide", { extraFrontmatter: "companion-of: does-not-exist\n" });
    const before = read(dir, "guide");
    const res = run(dir);
    assert.equal(res.status, 0);
    assert.match(res.out, /does-not-exist' is not a skill/);
    assert.equal(read(dir, "guide"), before);
  });

  test("a skill naming itself is rejected", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "companions-"));
    skill(dir, "loop", { extraFrontmatter: "companion-of: loop\n" });
    const res = run(dir);
    assert.match(res.out, /names itself/);
    assert.equal(count(read(dir, "loop"), BEGIN), 0);
  });

  test("block comes back after the target is re-imported from upstream", () => {
    const dir = fixture();
    run(dir);
    skill(dir, "reviewer"); // simulate skill-update restoring the upstream file
    assert.equal(count(read(dir, "reviewer"), BEGIN), 0);
    run(dir);
    assert.equal(count(read(dir, "reviewer"), BEGIN), 1);
  });

  test("target without other managed blocks gets the block right after frontmatter", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "companions-"));
    skill(dir, "reviewer", { protocol: false });
    skill(dir, "guide", { extraFrontmatter: "companion-of: reviewer\n" });
    run(dir);
    const target = read(dir, "reviewer");
    assert.ok(target.startsWith("---\nname: reviewer\ndescription: test skill\n---\n\n" + BEGIN));
  });

  test("companion-of only counts inside the frontmatter", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "companions-"));
    skill(dir, "reviewer");
    skill(dir, "guide", { body: "# Body\n\ncompanion-of: reviewer\n" });
    run(dir);
    assert.equal(count(read(dir, "reviewer"), BEGIN), 0);
  });
});
