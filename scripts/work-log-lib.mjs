// scripts/work-log-lib.mjs
//
// The problem this solves: the fix-attempt ledger (fix-bug/scripts/ledger-lib.mjs)
// deliberately stores input_hash, never raw text -- correct for an audit trail
// where PII must never land, but it means there is no human-readable record of
// what an agent session actually did. A teammate opening the target repo has
// no file to read to find out what happened, and a cold session has nothing to
// resume from except re-deriving context from scratch.
//
// This is NOT a chat transcript. It is a structured, human-written summary --
// what was requested, what happened, what's next -- the same distinction
// Genesis draws between "should" and "must": a session log entry is written
// by the agent as a deliberate summary step, not captured automatically from
// raw conversation text.
//
// Storage lives in the TARGET repo (repoRoot), same convention as the ledger
// (.dev-agent/<thing>/), so it travels with the project and is visible to
// anyone who clones it -- not tucked away in the skills repo or a database
// only the dev-agent service can query.
//
// Dependency-free (node: builtins only), matching fix-bug/scripts/ledger-lib.mjs.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export class WorkLogError extends Error {}

const VALID_STATUSES = ["in-progress", "done", "blocked", "handed-off"];
const REQUIRED_FIELDS = ["sessionId", "skill", "requester", "summary", "status"];

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export function workLogDir(repoRoot) {
  return path.join(repoRoot, ".dev-agent", "work-log");
}

export function sessionLogPath(repoRoot, sessionId) {
  if (!isSafeSessionId(sessionId)) {
    throw new WorkLogError(`unsafe sessionId: ${sessionId}`);
  }
  return path.join(workLogDir(repoRoot), `${sessionId}.md`);
}

export function currentPath(repoRoot) {
  return path.join(workLogDir(repoRoot), "CURRENT.md");
}

export function kickoffPath(repoRoot) {
  return path.join(repoRoot, ".dev-agent", "KICKOFF.md");
}

const SAFE_SESSION_RE = /^[a-zA-Z0-9._-]{1,120}$/;
export function isSafeSessionId(id) {
  return typeof id === "string" && SAFE_SESSION_RE.test(id);
}

/**
 * Session ids are generated, not developer-supplied free text -- same
 * reasoning as issueKey() in the ledger: never let arbitrary input become a
 * filename. Sortable prefix (UTC timestamp) means `ls` on the directory is
 * already in chronological order without reading file contents.
 */
export function newSessionId(prefix = "s") {
  const ts = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  const rand = crypto.randomBytes(3).toString("hex");
  return `${prefix}-${ts}-${rand}`;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

function validateEntry(entry) {
  for (const field of REQUIRED_FIELDS) {
    if (!entry[field] || !String(entry[field]).trim()) {
      throw new WorkLogError(`entry.${field} is required and cannot be blank`);
    }
  }
  if (!VALID_STATUSES.includes(entry.status)) {
    throw new WorkLogError(
      `entry.status must be one of ${VALID_STATUSES.join(", ")}, got "${entry.status}"`
    );
  }
  if (!isSafeSessionId(entry.sessionId)) {
    throw new WorkLogError(`entry.sessionId is not filename-safe: ${entry.sessionId}`);
  }
}

function renderEntryMarkdown(entry) {
  const lines = [];
  lines.push(`## ${entry.timestamp} — ${entry.skill} (${entry.status})`);
  lines.push("");
  lines.push(`**Requested by:** ${entry.requester}`);
  if (entry.repo) lines.push(`**Repo:** ${entry.repo}`);
  if (entry.links && entry.links.length) lines.push(`**Links:** ${entry.links.join(", ")}`);
  lines.push("");
  lines.push(entry.summary.trim());
  if (entry.nextAction) {
    lines.push("");
    lines.push(`**Next action:** ${entry.nextAction}`);
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * Appends one entry to this session's own file (append-only within a
 * session, same as the ledger) AND refreshes CURRENT.md, which always holds
 * only the latest state. Two different documents for two different
 * questions: "what happened over time in this session" (session file) vs
 * "what's true right now" (CURRENT.md).
 */
export function appendEntry(repoRoot, rawEntry) {
  const entry = { ...rawEntry, timestamp: rawEntry.timestamp || new Date().toISOString() };
  validateEntry(entry);

  const dir = workLogDir(repoRoot);
  fs.mkdirSync(dir, { recursive: true });

  const file = sessionLogPath(repoRoot, entry.sessionId);
  const block = renderEntryMarkdown(entry);
  const exists = fs.existsSync(file);
  fs.appendFileSync(file, (exists ? "\n" : `# Session ${entry.sessionId}\n\n`) + block);

  writeCurrent(repoRoot, entry);

  return { file, timestamp: entry.timestamp };
}

export function writeCurrent(repoRoot, entry) {
  const dir = workLogDir(repoRoot);
  fs.mkdirSync(dir, { recursive: true });
  const lines = [];
  lines.push("# Current state");
  lines.push("");
  lines.push(`_Last updated: ${entry.timestamp} by ${entry.skill} (session ${entry.sessionId})_`);
  lines.push("");
  lines.push(`**Status:** ${entry.status}`);
  lines.push("");
  lines.push(entry.summary.trim());
  if (entry.nextAction) {
    lines.push("");
    lines.push("## Next action");
    lines.push("");
    lines.push(entry.nextAction);
  }
  lines.push("");
  fs.writeFileSync(currentPath(repoRoot), lines.join("\n"));
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export function readCurrent(repoRoot) {
  const p = currentPath(repoRoot);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf8");
}

/**
 * CURRENT.md's own content starts with its own "# Current state" header
 * (it's a standalone file meant to be readable on its own). generateKickoff()
 * embeds that same content under its own "## Current state" heading -- strip
 * the redundant leading header here so the result isn't a header immediately
 * followed by a near-duplicate header. Caught by actually reading the
 * generated KICKOFF.md, not by inspection.
 */
function stripLeadingHeader(md) {
  return md.replace(/^#\s+Current state\s*\n+/, "").trim();
}

export function listSessions(repoRoot, { limit = 5 } = {}) {
  const dir = workLogDir(repoRoot);
  if (!fs.existsSync(dir)) return [];
  const entries = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "CURRENT.md")
    .map((f) => ({ file: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);
  return entries.map((e) => ({
    sessionId: e.file.replace(/\.md$/, ""),
    content: fs.readFileSync(path.join(dir, e.file), "utf8"),
  }));
}

/**
 * KICKOFF.md is generated, not hand-maintained -- it is always a rebuild
 * from CURRENT.md + the N most recent session files, so it can never drift
 * out of sync with the underlying log the way a manually-updated status doc
 * would. Overwritten every call, same idempotent philosophy as setup.sh's
 * managed blocks.
 */
export function generateKickoff(repoRoot, { recentLimit = 3 } = {}) {
  const current = readCurrent(repoRoot);
  const recent = listSessions(repoRoot, { limit: recentLimit });

  const lines = [];
  lines.push("# KICKOFF — resume this project");
  lines.push("");
  lines.push("Paste this whole file to a fresh agent session to resume with no re-explaining.");
  lines.push("Generated from .dev-agent/work-log/ — do not hand-edit, it will be overwritten.");
  lines.push("");
  lines.push("## Current state");
  lines.push("");
  lines.push(current ? stripLeadingHeader(current) : "_No work-log entries yet in this repo — nothing to resume._");
  lines.push("");
  if (recent.length) {
    lines.push("## Recent sessions (most recent first)");
    lines.push("");
    for (const s of recent) {
      lines.push(`### ${s.sessionId}`);
      lines.push("");
      lines.push(s.content.trim());
      lines.push("");
    }
  }

  const content = lines.join("\n");
  fs.mkdirSync(path.dirname(kickoffPath(repoRoot)), { recursive: true });
  fs.writeFileSync(kickoffPath(repoRoot), content);
  return { file: kickoffPath(repoRoot), content };
}

export { VALID_STATUSES };
