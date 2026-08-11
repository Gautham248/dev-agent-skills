#!/usr/bin/env node
// scripts/work-log-cli.mjs
//
//   new-session --prefix <p>
//   log     --repo-root <d> --session-id <id> --skill <name> --requester <who>
//           --summary <text> --status in-progress|done|blocked|handed-off
//           [--repo <org/repo>] [--links <a,b,c>] [--next-action <text>]
//   current --repo-root <d>
//   kickoff --repo-root <d> [--recent <n>]
//   init    --repo-root <d>
//
// The model supplies the summary/next-action text; this handles filenames,
// append-only writes, and rebuilding KICKOFF.md from the log.

import { newSessionId, appendEntry, readCurrent, generateKickoff, ensureInitialized, WorkLogError } from "./work-log-lib.mjs";
import { parseArgs } from "./arg-parse-lib.mjs";

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function requireRepoRoot(a) {
  if (!a["repo-root"]) die("--repo-root is required");
  return a["repo-root"];
}

function cmdNewSession(a) {
  console.log(newSessionId(a.prefix || "s"));
}

function cmdLog(a) {
  const repoRoot = requireRepoRoot(a);
  const entry = {
    sessionId: a["session-id"],
    skill: a.skill,
    requester: a.requester,
    summary: a.summary,
    status: a.status,
    repo: a.repo,
    nextAction: a["next-action"],
    links: a.links ? String(a.links).split(",").map((s) => s.trim()).filter(Boolean) : [],
  };
  try {
    const { file, timestamp } = appendEntry(repoRoot, entry);
    console.log(`✓ logged ${entry.sessionId} (${entry.status}) at ${timestamp}`);
    console.log(`  ${file}`);
  } catch (err) {
    if (err instanceof WorkLogError) die(err.message);
    throw err;
  }
}

function cmdCurrent(a) {
  const repoRoot = requireRepoRoot(a);
  const current = readCurrent(repoRoot);
  console.log(current || "(no work-log entries yet in this repo)");
}

function cmdKickoff(a) {
  const repoRoot = requireRepoRoot(a);
  const recentLimit = a.recent ? Number(a.recent) : 3;
  const { file } = generateKickoff(repoRoot, { recentLimit });
  console.log(`✓ wrote ${file}`);
}

function cmdInit(a) {
  const repoRoot = requireRepoRoot(a);
  const { alreadyInitialized, workLogDir, sessionCount } = ensureInitialized(repoRoot);
  if (alreadyInitialized) {
    console.log(`✓ already initialized — ${workLogDir} (${sessionCount} session(s) on record)`);
  } else {
    console.log(`✓ initialized ${workLogDir} — first session in this repo`);
  }
}

const [, , cmd, ...rest] = process.argv;
const a = parseArgs(rest);

switch (cmd) {
  case "new-session": cmdNewSession(a); break;
  case "log": cmdLog(a); break;
  case "current": cmdCurrent(a); break;
  case "kickoff": cmdKickoff(a); break;
  case "init": cmdInit(a); break;
  default:
    console.error("usage: work-log-cli.mjs <new-session|log|current|kickoff|init> [options]");
    process.exit(1);
}
