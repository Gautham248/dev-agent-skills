#!/usr/bin/env node
// plan-feature/scripts/deviation-log-cli.mjs
//
//   record --repo-root <d> --plan-title <t> --planned <text> --actual <text>
//          --reason <text> [--links <a,b,c>]
//   show   --repo-root <d> --plan-title <t>

import { recordDeviation, readDeviations, DeviationError } from "./deviation-log-lib.mjs";
import { parseArgs } from "../../scripts/arg-parse-lib.mjs";

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function requireRepoRoot(a) {
  if (!a["repo-root"]) die("--repo-root is required");
  return a["repo-root"];
}
function requirePlanTitle(a) {
  if (!a["plan-title"]) die("--plan-title is required");
  return a["plan-title"];
}

function cmdRecord(a) {
  const repoRoot = requireRepoRoot(a);
  const planTitle = requirePlanTitle(a);
  try {
    const { file, timestamp } = recordDeviation(repoRoot, {
      planTitle,
      planned: a.planned,
      actual: a.actual,
      reason: a.reason,
      links: a.links ? String(a.links).split(",").map((s) => s.trim()).filter(Boolean) : [],
    });
    console.log(`✓ deviation recorded at ${timestamp}`);
    console.log(`  ${file}`);
  } catch (err) {
    if (err instanceof DeviationError) die(err.message);
    throw err;
  }
}

function cmdShow(a) {
  const repoRoot = requireRepoRoot(a);
  const planTitle = requirePlanTitle(a);
  const content = readDeviations(repoRoot, planTitle);
  console.log(content || "(no deviations recorded for this plan)");
}

const [, , cmd, ...rest] = process.argv;
const a = parseArgs(rest);

switch (cmd) {
  case "record": cmdRecord(a); break;
  case "show": cmdShow(a); break;
  default:
    console.error("usage: deviation-log-cli.mjs <record|show> [options]");
    process.exit(1);
}
