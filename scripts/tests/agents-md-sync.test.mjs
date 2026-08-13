// scripts/tests/agents-md-sync.test.mjs
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
const SCRIPT = path.resolve(HERE, "..", "agents-md-sync.sh");

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agentsmd-"));
}

function run(repo, ...args) {
  const res = spawnSync("bash", [SCRIPT, ...args], { cwd: repo, encoding: "utf8" });
  return { status: res.status, stdout: res.stdout.trim(), stderr: res.stderr.trim() };
}

function status(repo) {
  return run(repo, "status").stdout;
}

// ---------------------------------------------------------------------------
describe("agents-md-sync.sh status / write", () => {
  test("empty dir reports NO_AGENTS", () => {
    const repo = tmpRepo();
    assert.equal(status(repo), "NO_AGENTS");
  });

  test("write creates AGENTS.md + sidecar and reports FRESH", () => {
    const repo = tmpRepo();
    const res = run(repo, "write");
    assert.equal(res.status, 0);
    assert.ok(fs.existsSync(path.join(repo, "AGENTS.md")));
    assert.ok(fs.existsSync(path.join(repo, ".agents-md.sha256")));
    assert.equal(status(repo), "AGENTS_OURS_FRESH");
  });

  test("write resolves the placeholders to real script paths, not __X__ tokens", () => {
    const repo = tmpRepo();
    run(repo, "write");
    const content = fs.readFileSync(path.join(repo, "AGENTS.md"), "utf8");
    assert.ok(!content.includes("__AGENTS_MD_SYNC_SCRIPT__"));
    assert.ok(!content.includes("__WORK_LOG_CLI_SCRIPT__"));
    assert.ok(content.includes("/scripts/agents-md-sync.sh"));
    assert.ok(content.includes("/scripts/work-log-cli.mjs"));
  });

  test("hand-editing a written file reports TAMPERED, then accept re-baselines to FRESH", () => {
    const repo = tmpRepo();
    run(repo, "write");
    fs.appendFileSync(path.join(repo, "AGENTS.md"), "\n# hand edit\n");
    assert.equal(status(repo), "AGENTS_TAMPERED");
    const res = run(repo, "accept");
    assert.equal(res.status, 0);
    assert.equal(status(repo), "AGENTS_OURS_FRESH");
  });

  test("a foreign AGENTS.md (no sidecar) reports FOREIGN and accept refuses", () => {
    const repo = tmpRepo();
    fs.writeFileSync(path.join(repo, "AGENTS.md"), "# foreign file\n");
    assert.equal(status(repo), "AGENTS_FOREIGN");
    const res = run(repo, "accept");
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /foreign/i);
    assert.equal(status(repo), "AGENTS_FOREIGN");
    assert.equal(fs.existsSync(path.join(repo, ".agents-md.sha256")), false);
  });
});
