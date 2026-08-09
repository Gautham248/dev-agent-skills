#!/usr/bin/env node
// fix-bug/scripts/quiz-back-cli.mjs
//
//   open     --repo-root <d> --key <issueKey> --design <q> --edge-case <q>
//            --blast-radius <q> [--pr-link <url>]
//   answer   --repo-root <d> --key <issueKey> --design <a> --edge-case <a>
//            --blast-radius <a>
//   status   --repo-root <d> --key <issueKey>
//
// --key is the same issueKey the fix-attempt ledger already computed for
// this bug (fix-bug/scripts/ledger-cli.mjs), so the quiz and the ledger
// entry for the same fix are trivially cross-referenced by a caller that
// has both.

import { openQuiz, answerQuiz, loadQuiz, isClosable, QuizError } from "./quiz-back-lib.mjs";
import { parseArgs } from "../../scripts/arg-parse-lib.mjs";

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function requireRepoRoot(a) {
  if (!a["repo-root"]) die("--repo-root is required");
  return a["repo-root"];
}
function requireKey(a) {
  if (!a.key) die("--key is required");
  return a.key;
}

function cmdOpen(a) {
  const repoRoot = requireRepoRoot(a);
  const key = requireKey(a);
  try {
    openQuiz(repoRoot, key, {
      questions: { design: a.design, edgeCase: a["edge-case"], blastRadius: a["blast-radius"] },
      prLink: a["pr-link"],
    });
    console.log(`✓ quiz opened for ${key} — status: pending`);
  } catch (err) {
    if (err instanceof QuizError) die(err.message);
    throw err;
  }
}

function cmdAnswer(a) {
  const repoRoot = requireRepoRoot(a);
  const key = requireKey(a);
  try {
    answerQuiz(repoRoot, key, {
      design: a.design,
      edgeCase: a["edge-case"],
      blastRadius: a["blast-radius"],
    });
    console.log(`✓ quiz answered for ${key} — status: answered, closable: true`);
  } catch (err) {
    if (err instanceof QuizError) die(err.message);
    throw err;
  }
}

function cmdStatus(a) {
  const repoRoot = requireRepoRoot(a);
  const key = requireKey(a);
  const record = loadQuiz(repoRoot, key);
  if (!record) { console.log("no quiz found"); return; }
  console.log(`status: ${record.status}`);
  console.log(`closable: ${isClosable(repoRoot, key)}`);
  if (record.status === "answered") {
    for (const [id, q] of Object.entries(record.questions)) {
      console.log(`\n[${id}]`);
      console.log(`  Q: ${q}`);
      console.log(`  A: ${record.answers[id]}`);
    }
  }
}

const [, , cmd, ...rest] = process.argv;
const a = parseArgs(rest);

switch (cmd) {
  case "open": cmdOpen(a); break;
  case "answer": cmdAnswer(a); break;
  case "status": cmdStatus(a); break;
  default:
    console.error("usage: quiz-back-cli.mjs <open|answer|status> [options]");
    process.exit(1);
}
