// plan-feature/scripts/deviation-log-lib.mjs
//
// The problem this solves: plan-feature's Step 8 already handles "the
// developer asks for changes to the plan" mechanically (rewrite the plan,
// re-verify paths, re-present) but keeps no record of WHY a plan changed --
// so a month later, when the shipped code and the original plan disagree,
// there is nothing to point to except the current version of the plan file.
// The reasoning that produced the disagreement is gone.
//
// This is scoped deliberately narrow: PLAN-level deviation (the agreed plan
// changed), not execution-level deviation (fix-bug's own ledger already
// covers "this specific fix hypothesis was tried and rejected"). Don't
// conflate the two -- a plan revision and a rejected fix attempt are
// different kinds of record with different consumers.
//
// Append-only, one file per plan (keyed the same way as the plan itself),
// stored in the target repo under .dev-agent/, same convention as the
// ledger and work-log.
//
// Dependency-free (node: builtins only), matching ledger-lib.mjs.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export class DeviationError extends Error {}

export function deviationDir(repoRoot) {
  return path.join(repoRoot, ".dev-agent", "deviations");
}

/**
 * Same normalize-then-hash approach as ledger-lib.mjs's issueKey() -- a
 * plan re-described with slightly different wording should still resolve
 * to the same deviation file, and the hash is safe as a filename
 * regardless of what's in the plan title.
 */
export function normalizePlanTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function planKey(planTitle) {
  const normalized = normalizePlanTitle(planTitle);
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

export function deviationPath(repoRoot, planTitle) {
  return path.join(deviationDir(repoRoot), `${planKey(planTitle)}.md`);
}

// ---------------------------------------------------------------------------

export function recordDeviation(repoRoot, { planTitle, planned, actual, reason, links = [] }) {
  if (!planTitle || !String(planTitle).trim()) throw new DeviationError("planTitle is required");
  if (!planned || !String(planned).trim()) throw new DeviationError("planned is required");
  if (!actual || !String(actual).trim()) throw new DeviationError("actual is required");
  if (!reason || !String(reason).trim()) throw new DeviationError("reason is required");

  const dir = deviationDir(repoRoot);
  fs.mkdirSync(dir, { recursive: true });
  const file = deviationPath(repoRoot, planTitle);
  const ts = new Date().toISOString();
  const exists = fs.existsSync(file);

  const block = [
    exists ? "" : `# Deviation log — ${planTitle}\n`,
    `## ${ts}`,
    "",
    `**Planned:** ${planned}`,
    `**Actual:** ${actual}`,
    `**Reason:** ${reason}`,
    links.length ? `**Links:** ${links.join(", ")}` : null,
    "",
  ]
    .filter((l) => l !== null)
    .join("\n");

  fs.appendFileSync(file, block);
  return { file, key: planKey(planTitle), timestamp: ts };
}

export function readDeviations(repoRoot, planTitle) {
  const file = deviationPath(repoRoot, planTitle);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf8");
}

export function hasDeviations(repoRoot, planTitle) {
  return fs.existsSync(deviationPath(repoRoot, planTitle));
}
