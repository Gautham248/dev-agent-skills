#!/usr/bin/env node
// scripts/work-log-cli.mjs
//
//   new-session --prefix <p>
//   log     --repo-root <d> --session-id <id> --skill <name> --requester <who>
//           --summary <text> --status in-progress|done|blocked|handed-off
//           [--repo <org/repo>] [--links <a,b,c>] [--next-action <text>]
//   current --repo-root <d>
//   kickoff --repo-root <d> [--recent <n>]
//
// The model supplies the summary/next-action text; this handles filenames,
// append-only writes, and rebuilding KICKOFF.md from the log.

import { newSessionId, appendEntry, readCurrent, generateKickoff, WorkLogError } from "./work-log-lib.mjs";

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

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

const [, , cmd, ...rest] = process.argv;
const a = args(rest);

switch (cmd) {
  case "new-session": cmdNewSession(a); break;
  case "log": cmdLog(a); break;
  case "current": cmdCurrent(a); break;
  case "kickoff": cmdKickoff(a); break;
  default:
    console.error("usage: work-log-cli.mjs <new-session|log|current|kickoff> [options]");
    process.exit(1);
}
