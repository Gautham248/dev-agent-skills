#!/usr/bin/env node
// scripts/circuit-breaker-cli.mjs
//
//   check  --repo-root <d> --session-id <id> --job-type <type> --input <text>
//          [--turn-limit N] [--token-limit N]
//   record --repo-root <d> --session-id <id> --input <text>
//          [--token-delta N] [--pass-fail true|false] [--breach-reason <text>]
//   show   --repo-root <d> --session-id <id>
//
// check exits 0 if the next turn is allowed, 1 (via CircuitBreakerError) if
// it would trip the breaker. Call check BEFORE the risky action; call
// record AFTER, with the real outcome.

import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadBreakerLedger,
  recordTurn,
  checkBreaker,
  turnCount,
  accumulatedTokens,
  defaultBudgetFor,
  CircuitBreakerError,
  LedgerError,
} from "./circuit-breaker.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

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
  const root = a["repo-root"];
  if (!root) die("--repo-root is required");
  return root;
}
function requireSessionId(a) {
  const id = a["session-id"];
  if (!id) die("--session-id is required");
  return id;
}

// ---------------------------------------------------------------------------
function cmdCheck(a) {
  const repoRoot = requireRepoRoot(a);
  const sessionId = requireSessionId(a);
  const input = a.input || "";

  const defaults = defaultBudgetFor(a["job-type"] || "generic");
  const budget = {
    turn_limit: a["turn-limit"] ? Number(a["turn-limit"]) : defaults.turn_limit,
    token_limit: a["token-limit"] ? Number(a["token-limit"]) : defaults.token_limit,
  };

  let ledger;
  try {
    ledger = loadBreakerLedger(repoRoot, sessionId);
  } catch (e) {
    if (e instanceof LedgerError) die(e.message);
    throw e;
  }

  const currentTurn = turnCount(ledger);
  const currentTokens = accumulatedTokens(ledger);

  console.log(`Session "${sessionId}": ${currentTurn} turn(s) so far, ${currentTokens} token(s) accumulated.`);
  console.log(`Budget: turn_limit=${budget.turn_limit} token_limit=${budget.token_limit}`);
  console.log("");

  try {
    const result = checkBreaker({ turnCount: currentTurn, accumulatedTokens: currentTokens, budget, sessionId });
    console.log(`✓ Turn ${result.nextTurn} is allowed. ${result.remainingTurns} turn(s) and ~${result.remainingTokens} token(s) remain in budget.`);
  } catch (e) {
    if (e instanceof CircuitBreakerError) {
      console.error(`✗ ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
function cmdRecord(a) {
  const repoRoot = requireRepoRoot(a);
  const sessionId = requireSessionId(a);
  const input = a.input;
  if (!input) die("--input is required");

  const turn = {
    input,
    tokenDelta: a["token-delta"] ? Number(a["token-delta"]) : 0,
    passFail: a["pass-fail"] !== "false",
    breachReason: a["breach-reason"] || null,
  };

  let result;
  try {
    result = recordTurn(repoRoot, sessionId, turn);
  } catch (e) {
    if (e instanceof LedgerError) die(e.message);
    throw e;
  }

  console.log(`✓ Recorded turn ${result.wrote.turn} for session "${sessionId}" (input_hash=${result.wrote.input_hash}, tokens=${result.wrote.token_delta}, pass=${result.wrote.pass_fail === 1})`);
}

// ---------------------------------------------------------------------------
function cmdShow(a) {
  const repoRoot = requireRepoRoot(a);
  const sessionId = requireSessionId(a);

  let ledger;
  try {
    ledger = loadBreakerLedger(repoRoot, sessionId);
  } catch (e) {
    if (e instanceof LedgerError) die(e.message);
    throw e;
  }

  console.log(`Ledger: ${ledger.path}`);
  console.log(`Turns: ${turnCount(ledger)}   Accumulated tokens: ${accumulatedTokens(ledger)}`);
  console.log("");
  for (const t of ledger.turns) {
    console.log(`  #${t.turn} [${t.pass_fail ? "pass" : "fail"}] hash=${t.input_hash} tokens=${t.token_delta}${t.breach_reason ? ` breach=${t.breach_reason}` : ""}`);
  }
}

// ---------------------------------------------------------------------------
const a = args(process.argv.slice(2));
const cmd = a._[0];
if (cmd === "check") cmdCheck(a);
else if (cmd === "record") cmdRecord(a);
else if (cmd === "show") cmdShow(a);
else {
  console.log(`circuit-breaker CLI

  check  --repo-root <d> --session-id <id> [--job-type <type>] --input <text>
         [--turn-limit N] [--token-limit N]
  record --repo-root <d> --session-id <id> --input <text>
         [--token-delta N] [--pass-fail true|false] [--breach-reason <text>]
  show   --repo-root <d> --session-id <id>
`);
  process.exit(cmd ? 1 : 0);
}
