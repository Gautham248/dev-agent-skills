// architecture-context/scripts/tests/architecture-context-lib.test.mjs
//
// Real git repos and real graph.json/analysis.json shapes throughout --
// no hand-mocked git output. A wrong "not stale" here is the exact failure
// mode this whole design exists to prevent, so the staleness-check tests
// in particular run against actual `git diff` output from a real repo,
// not simulated strings.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

import {
  normalizePath,
  getGraphMtimeIso,
  loadCache,
  checkCacheTier1,
  computeStaleSubsystems,
  getHeadSha,
  getChangedFilesSince,
  communitiesToSubsystemSeeds,
  validateArchitectureCache,
  mergeSubsystemUpdates,
  writeCache,
  selectSubsystemsForFiles,
  SCHEMA_VERSION,
} from "../architecture-context-lib.mjs";

// ---------------------------------------------------------------------------
// Test repo helper
// ---------------------------------------------------------------------------

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "architecture-context-test-"));
}

function git(dir, args) {
  return execFileSync("git", args, { cwd: dir, encoding: "utf8" });
}

function initRealRepo() {
  const dir = makeTmpDir();
  git(dir, ["init", "-q"]);
  git(dir, ["config", "user.email", "test@example.com"]);
  git(dir, ["config", "user.name", "Test"]);
  fs.mkdirSync(path.join(dir, "net"), { recursive: true });
  fs.mkdirSync(path.join(dir, "server", "rooms"), { recursive: true });
  fs.writeFileSync(path.join(dir, "net", "sync.ts"), "export function syncState() {}\n");
  fs.writeFileSync(path.join(dir, "server", "rooms", "GameRoom.ts"), "export class GameRoom {}\n");
  fs.writeFileSync(path.join(dir, "README.md"), "# game\n");
  git(dir, ["add", "."]);
  git(dir, ["commit", "-q", "-m", "initial"]);
  return dir;
}

// ---------------------------------------------------------------------------
// normalizePath
// ---------------------------------------------------------------------------

test("normalizePath strips leading ./ and normalizes separators", () => {
  assert.equal(normalizePath("./net/sync.ts"), "net/sync.ts");
  assert.equal(normalizePath("net\\sync.ts"), "net/sync.ts");
  assert.equal(normalizePath("/net/sync.ts"), "net/sync.ts");
  assert.equal(normalizePath("net/sync.ts"), "net/sync.ts");
  assert.equal(normalizePath(""), "");
  assert.equal(normalizePath(undefined), "");
});

// ---------------------------------------------------------------------------
// Tier 1 - getGraphMtimeIso / checkCacheTier1
// ---------------------------------------------------------------------------

test("getGraphMtimeIso returns null for a missing file", () => {
  const dir = makeTmpDir();
  assert.equal(getGraphMtimeIso(path.join(dir, "graphify-out", "graph.json")), null);
});

test("getGraphMtimeIso returns a real ISO timestamp for an existing file", () => {
  const dir = makeTmpDir();
  const graphPath = path.join(dir, "graph.json");
  fs.writeFileSync(graphPath, "{}");
  const mtime = getGraphMtimeIso(graphPath);
  assert.match(mtime, /^\d{4}-\d{2}-\d{2}T/);
});

test("checkCacheTier1 reports 'missing' when cache is null", () => {
  assert.equal(checkCacheTier1(null, "2026-01-01T00:00:00.000Z"), "missing");
});

test("checkCacheTier1 reports 'missing' when graph mtime is null (no graph)", () => {
  const cache = { generated_from_graph_mtime: "2026-01-01T00:00:00.000Z", subsystems: {} };
  assert.equal(checkCacheTier1(cache, null), "missing");
});

test("checkCacheTier1 reports 'fresh' when mtimes match exactly", () => {
  const mtime = "2026-01-01T00:00:00.000Z";
  const cache = { generated_from_graph_mtime: mtime, subsystems: { a: {} } };
  assert.equal(checkCacheTier1(cache, mtime), "fresh");
});

test("checkCacheTier1 reports 'check' when graph.json is newer than the cache", () => {
  const cache = { generated_from_graph_mtime: "2026-01-01T00:00:00.000Z", subsystems: { a: {} } };
  assert.equal(checkCacheTier1(cache, "2026-01-02T00:00:00.000Z"), "check");
});

test("loadCache returns null for missing/corrupt files, not a throw", () => {
  const dir = makeTmpDir();
  assert.equal(loadCache(path.join(dir, "nope.json")), null);
  const badPath = path.join(dir, "bad.json");
  fs.writeFileSync(badPath, "{not valid json");
  assert.equal(loadCache(badPath), null);
});

// ---------------------------------------------------------------------------
// Tier 2 - computeStaleSubsystems
// ---------------------------------------------------------------------------

test("computeStaleSubsystems marks a subsystem stale only if an anchor file changed", () => {
  const subsystems = {
    "state-sync": { anchor_files: ["net/sync.ts", "server/rooms/GameRoom.ts"] },
    matchmaking: { anchor_files: ["server/matchmaking.ts"] },
  };
  const { stale, fresh } = computeStaleSubsystems(subsystems, ["net/sync.ts", "README.md"]);
  assert.deepEqual(stale.sort(), ["state-sync"]);
  assert.deepEqual(fresh.sort(), ["matchmaking"]);
});

test("computeStaleSubsystems normalizes both sides before comparing", () => {
  const subsystems = { "state-sync": { anchor_files: ["./net/sync.ts"] } };
  const { stale } = computeStaleSubsystems(subsystems, ["net\\sync.ts"]);
  assert.deepEqual(stale, ["state-sync"]);
});

test("computeStaleSubsystems treats a README-only PR as touching nothing", () => {
  const subsystems = { "state-sync": { anchor_files: ["net/sync.ts"] } };
  const { stale, fresh } = computeStaleSubsystems(subsystems, ["README.md"]);
  assert.deepEqual(stale, []);
  assert.deepEqual(fresh, ["state-sync"]);
});

test("computeStaleSubsystems handles empty changed-files list (nothing stale)", () => {
  const subsystems = { a: { anchor_files: ["x.ts"] } };
  const { stale, fresh } = computeStaleSubsystems(subsystems, []);
  assert.deepEqual(stale, []);
  assert.deepEqual(fresh, ["a"]);
});

// ---------------------------------------------------------------------------
// Git helpers - real repo, not mocked
// ---------------------------------------------------------------------------

test("getHeadSha returns a real 40-char sha for a real repo", () => {
  const dir = initRealRepo();
  const sha = getHeadSha(dir);
  assert.match(sha, /^[0-9a-f]{40}$/);
});

test("getHeadSha returns null for a non-git directory", () => {
  const dir = makeTmpDir();
  assert.equal(getHeadSha(dir), null);
});

test("getChangedFilesSince returns null when sinceSha is falsy", () => {
  const dir = initRealRepo();
  assert.equal(getChangedFilesSince(dir, null), null);
  assert.equal(getChangedFilesSince(dir, ""), null);
});

test("getChangedFilesSince returns null for an unreachable sha (never falls back to 'no changes')", () => {
  const dir = initRealRepo();
  const bogusSha = "0000000000000000000000000000000000000000";
  assert.equal(getChangedFilesSince(dir, bogusSha), null);
});

test("getChangedFilesSince reports a real committed change since a real prior sha", () => {
  const dir = initRealRepo();
  const firstSha = getHeadSha(dir);

  fs.writeFileSync(path.join(dir, "net", "sync.ts"), "export function syncState() { /* changed */ }\n");
  git(dir, ["add", "."]);
  git(dir, ["commit", "-q", "-m", "touch sync"]);

  const changed = getChangedFilesSince(dir, firstSha);
  assert.ok(changed.includes("net/sync.ts"), `expected net/sync.ts in ${JSON.stringify(changed)}`);
  assert.ok(!changed.includes("README.md"));
});

test("getChangedFilesSince also picks up uncommitted working-tree changes", () => {
  const dir = initRealRepo();
  const firstSha = getHeadSha(dir);

  // No commit -- just an uncommitted edit.
  fs.writeFileSync(path.join(dir, "server", "rooms", "GameRoom.ts"), "export class GameRoom { x = 1; }\n");

  const changed = getChangedFilesSince(dir, firstSha);
  assert.ok(changed.includes("server/rooms/GameRoom.ts"));
});

test("getChangedFilesSince returns [] (not null) when sha is valid and nothing changed", () => {
  const dir = initRealRepo();
  const sha = getHeadSha(dir);
  const changed = getChangedFilesSince(dir, sha);
  assert.deepEqual(changed, []);
});

// ---------------------------------------------------------------------------
// communitiesToSubsystemSeeds
// ---------------------------------------------------------------------------

test("communitiesToSubsystemSeeds maps community node ids to ranked source files", () => {
  const graph = {
    nodes: [
      { id: "n1", source_file: "net/sync.ts" },
      { id: "n2", source_file: "net/sync.ts" },
      { id: "n3", source_file: "server/rooms/GameRoom.ts" },
      { id: "n4", source_file: "README.md" },
    ],
  };
  const analysis = {
    communities: {
      "0": ["n1", "n2", "n3"],
      "1": ["n4"],
    },
    cohesion: { "0": 0.8, "1": 0.1 },
  };
  const labels = { "0": "State Sync" };

  const seeds = communitiesToSubsystemSeeds(graph, analysis, labels);

  assert.equal(seeds.length, 2);
  const community0 = seeds.find((s) => s.community_id === "0");
  assert.equal(community0.suggested_label, "State Sync");
  assert.equal(community0.node_count, 3);
  assert.equal(community0.cohesion, 0.8);
  // net/sync.ts cited by 2 nodes, GameRoom.ts by 1 -- ranked first.
  assert.deepEqual(community0.candidate_anchor_files, ["net/sync.ts", "server/rooms/GameRoom.ts"]);

  // Larger community sorts first.
  assert.equal(seeds[0].community_id, "0");
});

test("communitiesToSubsystemSeeds caps anchor files at maxAnchors", () => {
  const graph = { nodes: Array.from({ length: 20 }, (_, i) => ({ id: `n${i}`, source_file: `f${i}.ts` })) };
  const analysis = { communities: { "0": graph.nodes.map((n) => n.id) }, cohesion: { "0": 1 } };
  const seeds = communitiesToSubsystemSeeds(graph, analysis, null, 5);
  assert.equal(seeds[0].candidate_anchor_files.length, 5);
  assert.equal(seeds[0].all_files_count, 20);
});

test("communitiesToSubsystemSeeds skips communities whose nodes have no resolvable source_file", () => {
  const graph = { nodes: [{ id: "n1" }] }; // no source_file
  const analysis = { communities: { "0": ["n1"] }, cohesion: {} };
  const seeds = communitiesToSubsystemSeeds(graph, analysis, null);
  assert.deepEqual(seeds, []);
});

test("communitiesToSubsystemSeeds handles missing labels gracefully", () => {
  const graph = { nodes: [{ id: "n1", source_file: "a.ts" }] };
  const analysis = { communities: { "0": ["n1"] }, cohesion: {} };
  const seeds = communitiesToSubsystemSeeds(graph, analysis, null);
  assert.equal(seeds[0].suggested_label, null);
});

// ---------------------------------------------------------------------------
// validateArchitectureCache
// ---------------------------------------------------------------------------

function validCache() {
  return {
    schema_version: SCHEMA_VERSION,
    generated_from_graph_mtime: "2026-01-01T00:00:00.000Z",
    generated_from_git_sha: "a".repeat(40),
    generated_at: "2026-01-01T00:00:00.000Z",
    subsystems: {
      "state-sync": {
        summary: "Server-authoritative sync.",
        anchor_files: ["net/sync.ts"],
        source_community_id: "0",
        last_verified: "2026-01-01T00:00:00.000Z",
        last_verified_git_sha: "a".repeat(40),
      },
    },
  };
}

test("validateArchitectureCache accepts a well-formed cache", () => {
  const { valid, errors } = validateArchitectureCache(validCache());
  assert.equal(valid, true, JSON.stringify(errors));
});

test("validateArchitectureCache accepts a null git sha (non-git repo)", () => {
  const cache = validCache();
  cache.generated_from_git_sha = null;
  const { valid } = validateArchitectureCache(cache);
  assert.equal(valid, true);
});

test("validateArchitectureCache rejects missing subsystems object", () => {
  const cache = validCache();
  delete cache.subsystems;
  const { valid, errors } = validateArchitectureCache(cache);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("subsystems")));
});

test("validateArchitectureCache rejects a subsystem with empty anchor_files", () => {
  const cache = validCache();
  cache.subsystems["state-sync"].anchor_files = [];
  const { valid, errors } = validateArchitectureCache(cache);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("anchor_files")));
});

test("validateArchitectureCache rejects a subsystem with empty summary", () => {
  const cache = validCache();
  cache.subsystems["state-sync"].summary = "   ";
  const { valid, errors } = validateArchitectureCache(cache);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("summary")));
});

test("validateArchitectureCache rejects wrong schema_version", () => {
  const cache = validCache();
  cache.schema_version = 99;
  const { valid, errors } = validateArchitectureCache(cache);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("schema_version")));
});

// ---------------------------------------------------------------------------
// mergeSubsystemUpdates
// ---------------------------------------------------------------------------

test("mergeSubsystemUpdates carries over untouched subsystems byte-for-byte", () => {
  const cache = validCache();
  cache.subsystems.matchmaking = {
    summary: "Lobby matching.",
    anchor_files: ["server/matchmaking.ts"],
    source_community_id: "1",
    last_verified: "2025-06-01T00:00:00.000Z",
    last_verified_git_sha: "b".repeat(40),
  };

  const result = mergeSubsystemUpdates({
    cache,
    updates: {
      "state-sync": {
        summary: "Updated summary.",
        anchor_files: ["net/sync.ts", "net/reconcile.ts"],
        source_community_id: "0",
      },
    },
    graphMtimeIso: "2026-02-01T00:00:00.000Z",
    gitSha: "c".repeat(40),
    nowIso: "2026-02-01T00:00:01.000Z",
  });

  // Regenerated subsystem updated.
  assert.equal(result.subsystems["state-sync"].summary, "Updated summary.");
  assert.deepEqual(result.subsystems["state-sync"].anchor_files, ["net/sync.ts", "net/reconcile.ts"]);
  assert.equal(result.subsystems["state-sync"].last_verified, "2026-02-01T00:00:01.000Z");

  // Untouched subsystem unchanged, including its OLD last_verified.
  assert.deepEqual(result.subsystems.matchmaking, cache.subsystems.matchmaking);

  // Top-level metadata bumped.
  assert.equal(result.generated_from_graph_mtime, "2026-02-01T00:00:00.000Z");
  assert.equal(result.generated_from_git_sha, "c".repeat(40));
});

test("mergeSubsystemUpdates works from an empty/missing cache (first generation)", () => {
  const result = mergeSubsystemUpdates({
    cache: null,
    updates: {
      "state-sync": { summary: "First pass.", anchor_files: ["net/sync.ts"], source_community_id: "0" },
    },
    graphMtimeIso: "2026-01-01T00:00:00.000Z",
    gitSha: null,
    nowIso: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(Object.keys(result.subsystems).length, 1);
  const { valid, errors } = validateArchitectureCache(result);
  assert.equal(valid, true, JSON.stringify(errors));
});

// ---------------------------------------------------------------------------
// writeCache
// ---------------------------------------------------------------------------

test("writeCache refuses to write an invalid cache", () => {
  const dir = makeTmpDir();
  assert.throws(() => writeCache(path.join(dir, "graphify-out", ".project-architecture.json"), { schema_version: 1 }));
});

test("writeCache writes valid JSON that round-trips through loadCache", () => {
  const dir = makeTmpDir();
  const cachePath = path.join(dir, "graphify-out", ".project-architecture.json");
  const cache = validCache();
  writeCache(cachePath, cache);
  const reloaded = loadCache(cachePath);
  assert.deepEqual(reloaded, cache);
});

test("writeCache is safe to call twice in a row (overwrite, not append)", () => {
  const dir = makeTmpDir();
  const cachePath = path.join(dir, "graphify-out", ".project-architecture.json");
  writeCache(cachePath, validCache());
  const second = validCache();
  second.generated_at = "2027-01-01T00:00:00.000Z";
  writeCache(cachePath, second);
  const reloaded = loadCache(cachePath);
  assert.equal(reloaded.generated_at, "2027-01-01T00:00:00.000Z");
});

// ---------------------------------------------------------------------------
// selectSubsystemsForFiles
// ---------------------------------------------------------------------------

test("selectSubsystemsForFiles returns only subsystems whose anchors intersect the target files", () => {
  const subsystems = {
    "state-sync": { anchor_files: ["net/sync.ts"] },
    matchmaking: { anchor_files: ["server/matchmaking.ts"] },
  };
  const result = selectSubsystemsForFiles(subsystems, ["net/sync.ts", "unrelated.ts"]);
  assert.deepEqual(Object.keys(result), ["state-sync"]);
});

test("selectSubsystemsForFiles returns an empty object when nothing matches", () => {
  const subsystems = { "state-sync": { anchor_files: ["net/sync.ts"] } };
  const result = selectSubsystemsForFiles(subsystems, ["totally/unrelated.ts"]);
  assert.deepEqual(result, {});
});
