// architecture-context/scripts/architecture-context-lib.mjs
//
// Deterministic scaffolding for the architecture-context cache
// (graphify-out/.project-architecture.json). Everything in this file is a
// pure function or a thin, isolated shell-out (git) -- the actual
// subsystem *reasoning* (turning a community's file list into a name and a
// summary) is done by the host agent inline in SKILL.md, not here, because
// that step needs an LLM and this file deliberately does not call one.
//
// Dependency-free (node: builtins only), matching fix-bug/scripts and
// review-pr/scripts -- `git clone && bash setup.sh` remains the whole
// install story.
//
// Three-tier staleness check this file implements (see SKILL.md Step 2-4
// for the full flow):
//   Tier 1 - isCacheFresh():          cache mtime vs graph.json mtime
//   Tier 2 - computeStaleSubsystems(): anchor_files vs changed files
//   Tier 3 - mergeSubsystemUpdates():  write back only what was regenerated
//
// Tier 1 answers "did the structural graph change at all". Tier 2 answers
// "did *this subsystem's* files change". A wrong "not stale" at either tier
// silently ships an outdated architectural summary to every consumer of
// this skill, so both are covered by real-git-repo tests, not fixtures.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Path normalization
// ---------------------------------------------------------------------------

/**
 * Anchor files, git diff output, and graph node source_file values can
 * disagree on a leading "./" or on backslash-vs-forward-slash separators.
 * Normalize once, consistently, before any comparison -- an unnormalized
 * mismatch here is exactly the kind of silent false-"fresh" this cache
 * design cannot afford.
 */
export function normalizePath(p) {
  return String(p || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
}

// ---------------------------------------------------------------------------
// Tier 1 - cache existence + freshness vs. graph.json
// ---------------------------------------------------------------------------

/**
 * Reads graph.json's mtime as an ISO string. Returns null if it doesn't
 * exist -- callers must treat that as "no graph, cannot proceed", not as
 * "cache is fresh by default".
 */
export function getGraphMtimeIso(graphJsonPath) {
  try {
    const stat = fs.statSync(graphJsonPath);
    return stat.mtime.toISOString();
  } catch {
    return null;
  }
}

export function loadCache(cachePath) {
  try {
    const raw = fs.readFileSync(cachePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Tier 1 check. `cache` is the parsed .project-architecture.json (or null
 * if missing/unreadable). `currentGraphMtimeIso` is getGraphMtimeIso()'s
 * current result.
 *
 * Returns one of:
 *   "missing"  - no usable cache, full first-run generation needed
 *   "fresh"    - graph.json has not changed since the cache was written;
 *                every subsystem entry can be trusted as-is, no further
 *                checks needed -- this is the free exit.
 *   "check"    - graph.json changed since the cache was written; caller
 *                must proceed to tier 2 (computeStaleSubsystems) rather
 *                than assume every subsystem is stale.
 */
export function checkCacheTier1(cache, currentGraphMtimeIso) {
  if (!cache || typeof cache !== "object") return "missing";
  if (!currentGraphMtimeIso) return "missing";
  if (!cache.generated_from_graph_mtime) return "missing";
  if (!cache.subsystems || typeof cache.subsystems !== "object") return "missing";
  return cache.generated_from_graph_mtime === currentGraphMtimeIso ? "fresh" : "check";
}

// ---------------------------------------------------------------------------
// Tier 2 - anchor-file staleness per subsystem
// ---------------------------------------------------------------------------

/**
 * Given the cache's subsystems dict and a list of changed files (already
 * expanded with `graphify affected --files` by the caller in SKILL.md, so
 * this includes both directly-touched files and files affected through the
 * call graph), return which subsystem ids need tier-3 re-derivation and
 * which can be kept as-is.
 *
 * Deliberately file-level, not line-level: a subsystem's anchor file being
 * touched at all marks it stale, even if the actual edit turns out to be
 * unrelated (e.g. a comment fix). This is the documented, accepted
 * over-trigger-rather-than-under-trigger tradeoff -- see SKILL.md's
 * "Known limitation" note. Do not try to make this smarter with line-level
 * or semantic diffing.
 */
export function computeStaleSubsystems(subsystems, changedFiles) {
  const changed = new Set((changedFiles || []).map(normalizePath));
  const stale = [];
  const fresh = [];

  for (const [id, entry] of Object.entries(subsystems || {})) {
    const anchors = (entry && entry.anchor_files) || [];
    const touched = anchors.some((f) => changed.has(normalizePath(f)));
    (touched ? stale : fresh).push(id);
  }

  return { stale, fresh };
}

// ---------------------------------------------------------------------------
// Git helpers (thin shell-outs, not pure -- tested against a real repo)
// ---------------------------------------------------------------------------

/**
 * Current HEAD sha, or null if not a git repo / no commits yet. Stored in
 * the cache at generation time so a later run can compute exactly which
 * files changed since, without needing an externally-supplied diff.
 */
export function getHeadSha(repoDir) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoDir,
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Files changed between `sinceSha` and the working tree (staged + unstaged
 * + committed since sinceSha), deduplicated. Returns null (not []) if
 * sinceSha is missing, unreachable (shallow clone, rebase, gc'd), or this
 * isn't a git repo at all -- callers MUST treat null as "cannot compute
 * changed files" and fall back to full regeneration, never treat it as "no
 * files changed".
 */
export function getChangedFilesSince(repoDir, sinceSha) {
  if (!sinceSha) return null;
  try {
    const committed = execFileSync(
      "git",
      ["diff", "--name-only", `${sinceSha}..HEAD`],
      { cwd: repoDir, encoding: "utf8" }
    );
    const working = execFileSync("git", ["diff", "--name-only", "HEAD"], {
      cwd: repoDir,
      encoding: "utf8",
    });
    const staged = execFileSync("git", ["diff", "--name-only", "--cached"], {
      cwd: repoDir,
      encoding: "utf8",
    });
    const all = new Set(
      [committed, working, staged]
        .join("\n")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map(normalizePath)
    );
    return [...all];
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Community -> subsystem seed extraction (structural, deterministic)
// ---------------------------------------------------------------------------

/**
 * Turns graphify's existing community-detection output into per-community
 * candidate anchor-file lists, WITHOUT doing any reasoning about what the
 * community means -- that part (naming it, summarizing it) is an LLM step
 * the host agent does inline in SKILL.md, using this function's output as
 * its input.
 *
 * `graph` is the parsed graph.json ({nodes: [{id, source_file, ...}], ...}).
 * `analysis` is the parsed .graphify_analysis.json
 * ({communities: {communityId: [nodeId, ...]}, cohesion: {...}, ...}).
 * `labels` is the parsed .graphify_labels.json ({communityId: "label"}),
 * or null if Step 5 (labeling) hasn't run yet for this graph.
 *
 * anchor_files per community are capped at `maxAnchors` (default 8) and
 * ranked by how many in-community nodes cite the file, so the most
 * central files lead -- a large community's full file list would make the
 * cache both expensive to reason over and noisy to consume.
 */
export function communitiesToSubsystemSeeds(graph, analysis, labels, maxAnchors = 8) {
  const nodeById = new Map();
  for (const n of (graph && graph.nodes) || []) {
    if (n && n.id) nodeById.set(n.id, n);
  }

  const communities = (analysis && analysis.communities) || {};
  const cohesion = (analysis && analysis.cohesion) || {};
  const seeds = [];

  for (const [communityId, nodeIds] of Object.entries(communities)) {
    const fileCounts = new Map();
    for (const nodeId of nodeIds || []) {
      const node = nodeById.get(nodeId);
      const file = node && node.source_file;
      if (!file) continue;
      const norm = normalizePath(file);
      fileCounts.set(norm, (fileCounts.get(norm) || 0) + 1);
    }

    const rankedFiles = [...fileCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([file]) => file);

    if (rankedFiles.length === 0) continue;

    seeds.push({
      community_id: String(communityId),
      suggested_label: (labels && labels[communityId]) || null,
      node_count: (nodeIds || []).length,
      cohesion: cohesion[communityId] ?? null,
      candidate_anchor_files: rankedFiles.slice(0, maxAnchors),
      all_files_count: rankedFiles.length,
    });
  }

  // Larger, more cohesive communities are more likely to be a real
  // architectural subsystem rather than incidental clustering -- surface
  // those first so a session that has to stop partway (e.g. hits a token
  // budget) still got the most meaningful subsystems generated.
  seeds.sort((a, b) => b.node_count - a.node_count);

  return seeds;
}

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

export function validateArchitectureCache(obj) {
  const errors = [];
  if (!obj || typeof obj !== "object") {
    return { valid: false, errors: ["root is not an object"] };
  }
  if (obj.schema_version !== SCHEMA_VERSION) {
    errors.push(`schema_version must be ${SCHEMA_VERSION}`);
  }
  if (typeof obj.generated_from_graph_mtime !== "string" || !obj.generated_from_graph_mtime) {
    errors.push("generated_from_graph_mtime must be a non-empty string");
  }
  if (obj.generated_from_git_sha !== null && typeof obj.generated_from_git_sha !== "string") {
    errors.push("generated_from_git_sha must be a string or null");
  }
  if (typeof obj.generated_at !== "string" || !obj.generated_at) {
    errors.push("generated_at must be a non-empty string");
  }
  if (!obj.subsystems || typeof obj.subsystems !== "object") {
    errors.push("subsystems must be an object");
    return { valid: errors.length === 0, errors };
  }

  for (const [id, entry] of Object.entries(obj.subsystems)) {
    const prefix = `subsystems.${id}`;
    if (!entry || typeof entry !== "object") {
      errors.push(`${prefix} is not an object`);
      continue;
    }
    if (typeof entry.summary !== "string" || entry.summary.trim().length === 0) {
      errors.push(`${prefix}.summary must be a non-empty string`);
    }
    if (!Array.isArray(entry.anchor_files) || entry.anchor_files.length === 0) {
      errors.push(`${prefix}.anchor_files must be a non-empty array`);
    } else if (!entry.anchor_files.every((f) => typeof f === "string" && f.trim())) {
      errors.push(`${prefix}.anchor_files must contain only non-empty strings`);
    }
    if (typeof entry.last_verified !== "string" || !entry.last_verified) {
      errors.push(`${prefix}.last_verified must be a non-empty string`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Tier 3 - merge regenerated subsystem entries back into the cache
// ---------------------------------------------------------------------------

/**
 * `updates` is a dict of {subsystemId: {summary, anchor_files,
 * source_community_id}} for ONLY the subsystems that were just
 * (re)generated -- untouched subsystems in `cache.subsystems` are carried
 * over byte-for-byte except that nothing about them changes at all,
 * matching the "targeted re-derivation, only for touched subsystems"
 * design in the handoff. Building a full replacement object every call
 * (rather than mutating `cache` in place) keeps this pure and testable.
 */
export function mergeSubsystemUpdates({
  cache,
  updates,
  graphMtimeIso,
  gitSha,
  nowIso,
}) {
  const prevSubsystems = (cache && cache.subsystems) || {};
  const nextSubsystems = { ...prevSubsystems };

  for (const [id, update] of Object.entries(updates || {})) {
    nextSubsystems[id] = {
      summary: update.summary,
      anchor_files: update.anchor_files,
      source_community_id: update.source_community_id ?? null,
      last_verified: nowIso,
      last_verified_git_sha: gitSha,
    };
  }

  return {
    schema_version: SCHEMA_VERSION,
    generated_from_graph_mtime: graphMtimeIso,
    generated_from_git_sha: gitSha,
    generated_at: nowIso,
    subsystems: nextSubsystems,
  };
}

export function writeCache(cachePath, cacheObj) {
  const { valid, errors } = validateArchitectureCache(cacheObj);
  if (!valid) {
    throw new Error(`refusing to write invalid architecture cache: ${errors.join("; ")}`);
  }
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  const tmpPath = `${cachePath}.tmp.${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(cacheObj, null, 2) + "\n", "utf8");
  fs.renameSync(tmpPath, cachePath);
}

// ---------------------------------------------------------------------------
// Consumer-facing lookup - "which subsystems touch these files"
// ---------------------------------------------------------------------------

/**
 * Given a set of target files (e.g. a PR's changed files), return the
 * subsystem entries whose anchor_files intersect them. Consuming skills
 * (review-pr, fix-bug, plan-feature, investigate-issue) call this to get
 * only the relevant slice of context, not the whole cache.
 */
export function selectSubsystemsForFiles(subsystems, targetFiles) {
  const targets = new Set((targetFiles || []).map(normalizePath));
  const matches = {};
  for (const [id, entry] of Object.entries(subsystems || {})) {
    const anchors = (entry && entry.anchor_files) || [];
    if (anchors.some((f) => targets.has(normalizePath(f)))) {
      matches[id] = entry;
    }
  }
  return matches;
}
