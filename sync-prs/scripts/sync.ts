#!/usr/bin/env tsx
// See ../SKILL.md. Sync your own open PRs for a GitHub repo: merge each PR's
// base branch into conflicting heads in isolated git worktrees, triage CI,
// surface unresolved review threads, and auto-fix lint/format when safe.
//
// Repo, worktree location, the lint:fix command, and the visual-check skip
// pattern are all configurable — see resolveConfig() and the README.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

interface CliOptions {
  dryRun: boolean;
  explicitPrs: Set<number>;
  repo?: string;
  worktreesDir?: string;
}

function parseCliOptions(): CliOptions {
  const explicitPrs = new Set<number>();
  let dryRun = false;
  let repo: string | undefined;
  let worktreesDir: string | undefined;
  const argv = process.argv.slice(2);

  const addPrNumbers = (raw: string): void => {
    for (const part of raw.split(",")) {
      const num = Number(part.trim());
      if (!Number.isInteger(num) || num <= 0) {
        console.error(`Invalid PR number: ${part}`);
        process.exit(1);
      }
      explicitPrs.add(num);
    }
  };

  const requireValue = (flag: string, value: string | undefined): string => {
    if (!value) {
      console.error(`${flag} requires a value`);
      process.exit(1);
    }
    return value;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--pr") {
      addPrNumbers(requireValue("--pr", argv[++i]));
    } else if (arg.startsWith("--pr=")) {
      addPrNumbers(arg.slice("--pr=".length));
    } else if (arg === "--repo") {
      repo = requireValue("--repo", argv[++i]);
    } else if (arg.startsWith("--repo=")) {
      repo = arg.slice("--repo=".length);
    } else if (arg === "--worktrees-dir") {
      worktreesDir = requireValue("--worktrees-dir", argv[++i]);
    } else if (arg.startsWith("--worktrees-dir=")) {
      worktreesDir = arg.slice("--worktrees-dir=".length);
    }
  }

  return { dryRun, explicitPrs, repo, worktreesDir };
}

const CLI = parseCliOptions();
const DRY_RUN = CLI.dryRun;

// --- Configuration -------------------------------------------------------
// Repo: --repo owner/name > SYNC_PRS_REPO > `gh repo view` of the cwd's repo.
// Everything else has a portable default and an env override.

function detectRepoRoot(): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
    }).trim();
  } catch {
    console.error("Not inside a git repository. Run this from your repo's working tree.");
    process.exit(1);
  }
}

function detectRepo(): string {
  if (CLI.repo) return CLI.repo;
  if (process.env.SYNC_PRS_REPO) return process.env.SYNC_PRS_REPO;
  try {
    const json = execFileSync("gh", ["repo", "view", "--json", "nameWithOwner"], {
      encoding: "utf8",
    });
    const { nameWithOwner } = JSON.parse(json) as { nameWithOwner: string };
    if (nameWithOwner) return nameWithOwner;
  } catch {
    // fall through to the error below
  }
  console.error(
    "Could not determine the GitHub repo. Pass --repo owner/name, set SYNC_PRS_REPO, " +
      "or run inside a git repo whose default remote points at GitHub (with `gh` authenticated).",
  );
  process.exit(1);
}

const REPO_ROOT = detectRepoRoot();
const REPO = detectRepo();
const [REPO_OWNER, REPO_NAME] = REPO.split("/");
if (!REPO_OWNER || !REPO_NAME) {
  console.error(`--repo must be "owner/name", got: ${REPO}`);
  process.exit(1);
}

const WORKTREES_ROOT =
  CLI.worktreesDir ??
  process.env.SYNC_PRS_WORKTREES_DIR ??
  path.join(REPO_ROOT, ".worktrees");

// The auto-fix command run for ESLint/Prettier failures. Override for your
// project's script or package manager, e.g. "npm run lint:fix".
const LINTFIX_CMD = process.env.SYNC_PRS_LINTFIX_CMD ?? "pnpm run lint:fix";

// Checks matching this pattern are reported but never auto-touched — they are
// reviewed in their own UI (visual-regression services).
const VISUAL_SKIP_RE = new RegExp(
  process.env.SYNC_PRS_SKIP_CHECK_PATTERN ?? "argos|visual-test|percy|chromatic",
  "i",
);

const MAX_AGE_MONTHS = Number(process.env.SYNC_PRS_MAX_AGE_MONTHS ?? 2);

type Mergeable = "MERGEABLE" | "CONFLICTING" | "UNKNOWN";

interface PullRequest {
  number: number;
  title: string;
  headRefName: string;
  baseRefName: string;
  isDraft: boolean;
  mergeable: Mergeable;
  mergeStateStatus: string;
  createdAt: string;
}

interface StatusCheck {
  name?: string | null;
  status?: string | null;
  conclusion?: string | null;
  detailsUrl?: string | null;
}

type SyncStatus =
  | { kind: "clean" }
  | { kind: "would_sync" }
  | { kind: "synced"; lockfileRegenerated?: boolean }
  | { kind: "manual"; files: string[] }
  | { kind: "error"; reason: string }
  | { kind: "skipped"; reason: string };

const LOCKFILE_BASENAMES = new Set(["pnpm-lock.yaml", "package-lock.json", "yarn.lock"]);

type CiStatus =
  | { kind: "green" }
  | { kind: "in_progress" }
  | { kind: "auto_fixed"; categories: string[] }
  | { kind: "mixed"; autoFixed: string[]; failures: Investigation[] }
  | { kind: "investigate"; failures: Investigation[] }
  | { kind: "skipped" };

interface Investigation {
  checkName: string;
  runUrl: string;
  logExcerpt: string;
  proposedFix: string;
}

type ReviewStatus =
  | { kind: "none" }
  | { kind: "pending"; items: ReviewItem[] }
  | { kind: "skipped" };

interface ReviewItem {
  kind: "thread" | "changes_requested";
  author: string;
  path?: string;
  line?: number | null;
  body: string;
}

interface PrResult {
  pr: PullRequest;
  sync: SyncStatus;
  ci: CiStatus;
  reviews: ReviewStatus;
}

function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; allowFail?: boolean; env?: NodeJS.ProcessEnv } = {},
): string {
  if (DRY_RUN && isMutatingGit(cmd, args)) {
    console.error(`[dry-run] ${cmd} ${args.join(" ")}`);
    return "";
  }
  try {
    return execFileSync(cmd, args, {
      cwd: opts.cwd,
      encoding: "utf8",
      env: { ...process.env, HUSKY: "0", ...opts.env },
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err: unknown) {
    if (opts.allowFail) {
      const e = err as { stdout?: Buffer; stderr?: Buffer; status?: number };
      return (e.stdout?.toString() ?? e.stderr?.toString() ?? "").trim();
    }
    throw err;
  }
}

function isMutatingGit(cmd: string, args: string[]): boolean {
  if (cmd !== "git") return false;
  if (args[0] === "worktree" && args[1] === "list") return false;
  if (args[0] === "status" || args[0] === "diff" || args[0] === "rev-parse") return false;
  return true;
}

function gh(args: string[]): string {
  return run("gh", args);
}

function git(cwd: string, args: string[], allowFail = false): string {
  return run("git", args, { cwd, allowFail });
}

function shortBranchName(headRefName: string): string {
  const slash = headRefName.indexOf("/");
  return slash === -1 ? headRefName : headRefName.slice(slash + 1);
}

function findWorktreePath(headRefName: string): string | undefined {
  const porcelain = git(REPO_ROOT, ["worktree", "list", "--porcelain"]);
  const target = `branch refs/heads/${headRefName}`;
  let current = "";
  for (const line of porcelain.split("\n")) {
    if (line.startsWith("worktree ")) {
      current = line.slice("worktree ".length);
    } else if (line === target) {
      return current;
    }
  }
  return undefined;
}

function removeOrphanWorktreeDir(wtPath: string): void {
  console.error(`Removing orphan worktree dir: ${wtPath}`);
  rmSync(wtPath, { recursive: true, force: true });
}

function addWorktree(wtPath: string, headRefName: string): void {
  if (existsSync(wtPath)) {
    try {
      git(REPO_ROOT, ["worktree", "add", "--force", wtPath, headRefName]);
    } catch {
      removeOrphanWorktreeDir(wtPath);
      git(REPO_ROOT, ["worktree", "add", wtPath, headRefName]);
    }
  } else {
    git(REPO_ROOT, ["worktree", "add", wtPath, headRefName]);
  }
}

function ensureWorktree(headRefName: string): string {
  const existing = findWorktreePath(headRefName);
  if (existing) return existing;

  const wtPath = path.join(WORKTREES_ROOT, shortBranchName(headRefName));
  if (DRY_RUN) {
    console.error(`[dry-run] would ensure worktree at ${wtPath} for ${headRefName}`);
    return wtPath;
  }

  addWorktree(wtPath, headRefName);

  const registered = findWorktreePath(headRefName);
  if (!registered) {
    throw new Error(`worktree setup failed for ${headRefName}`);
  }
  return registered;
}

function unmergedFiles(worktree: string): string[] {
  return git(worktree, ["diff", "--name-only", "--diff-filter=U"], true)
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
}

function isLockfilePath(file: string): boolean {
  return LOCKFILE_BASENAMES.has(path.basename(file));
}

function isLockfileOnlyConflicts(files: string[]): boolean {
  return files.length > 0 && files.every(isLockfilePath);
}

function runPnpmLockfileRegen(worktree: string): boolean {
  const attempts: string[][] = [["install", "--lockfile-only"], ["install"]];
  for (const args of attempts) {
    const result = spawnSync("pnpm", args, {
      cwd: worktree,
      encoding: "utf8",
      env: { ...process.env, HUSKY: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.status === 0) return true;
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    console.error(`pnpm ${args.join(" ")} failed after lockfile conflict:\n${output}`);
  }
  return false;
}

function resolveLockfileConflicts(worktree: string, files: string[]): boolean {
  for (const file of files) {
    git(worktree, ["rm", "-f", "--", file], true);
  }

  if (!runPnpmLockfileRegen(worktree)) {
    return false;
  }

  git(worktree, ["add", "-u"]);
  const commit = spawnSync("git", ["commit", "--no-edit"], {
    cwd: worktree,
    encoding: "utf8",
    env: { ...process.env, HUSKY: "0" },
  });
  if (commit.status !== 0) {
    console.error(
      `merge commit failed after lockfile regen:\n${commit.stderr || commit.stdout}`,
    );
    return false;
  }
  return true;
}

function resolveMergeable(pr: PullRequest): Mergeable {
  if (pr.mergeable !== "UNKNOWN") return pr.mergeable;
  if (DRY_RUN) return pr.mergeable;
  spawnSync("sleep", ["3"], { stdio: "ignore" });
  const refreshed = JSON.parse(
    gh(["pr", "view", String(pr.number), "--repo", REPO, "--json", "mergeable"]),
  ) as { mergeable: Mergeable };
  return refreshed.mergeable;
}

function syncPullRequest(pr: PullRequest): SyncStatus {
  const mergeable = resolveMergeable(pr);
  if (mergeable === "MERGEABLE") return { kind: "clean" };
  if (mergeable === "UNKNOWN") {
    return { kind: "error", reason: "mergeable still UNKNOWN after re-query" };
  }

  if (DRY_RUN) {
    console.error(
      `[dry-run] #${pr.number} CONFLICTING — would merge origin/${pr.baseRefName} into ${pr.headRefName}`,
    );
    return { kind: "would_sync" };
  }

  let worktree: string;
  try {
    worktree = ensureWorktree(pr.headRefName);
  } catch (err) {
    return { kind: "error", reason: String(err) };
  }

  if (git(worktree, ["status", "--porcelain"], true)) {
    return { kind: "error", reason: `worktree dirty (${worktree})` };
  }

  try {
    git(worktree, ["fetch", "origin", pr.headRefName, pr.baseRefName]);
  } catch {
    return { kind: "error", reason: "fetch failed" };
  }

  const pull = spawnSync(
    "git",
    ["pull", "--ff-only", "origin", pr.headRefName],
    { cwd: worktree, encoding: "utf8", env: { ...process.env, HUSKY: "0" } },
  );
  if (pull.status !== 0) {
    return {
      kind: "error",
      reason: "local diverged from remote — needs manual reconciliation",
    };
  }

  const merge = spawnSync(
    "git",
    ["merge", `origin/${pr.baseRefName}`, "--no-edit"],
    { cwd: worktree, encoding: "utf8", env: { ...process.env, HUSKY: "0" } },
  );
  if (merge.status !== 0) {
    const files = unmergedFiles(worktree);
    if (isLockfileOnlyConflicts(files)) {
      console.error(`#${pr.number} lockfile-only conflict — regenerating via pnpm install`);
      if (resolveLockfileConflicts(worktree, files)) {
        const push = pushBranch(worktree, pr.headRefName);
        if (!push.ok) {
          return { kind: "error", reason: push.reason };
        }
        return { kind: "synced", lockfileRegenerated: true };
      }
      git(worktree, ["merge", "--abort"], true);
      return {
        kind: "error",
        reason: `lockfile auto-resolve failed (${files.join(", ")})`,
      };
    }
    git(worktree, ["merge", "--abort"], true);
    return { kind: "manual", files };
  }

  const push = pushBranch(worktree, pr.headRefName);
  if (!push.ok) {
    return { kind: "error", reason: push.reason };
  }
  return { kind: "synced" };
}

function pushBranch(worktree: string, headRefName: string): { ok: true } | { ok: false; reason: string } {
  const attempt = (label: string) => {
    const push = spawnSync("git", ["push", "origin", headRefName], {
      cwd: worktree,
      encoding: "utf8",
      env: { ...process.env, HUSKY: "0" },
    });
    if (push.status === 0) return true;
    console.error(`${label} push failed: ${push.stderr || push.stdout}`);
    return false;
  };

  if (DRY_RUN) {
    console.error(`[dry-run] git push origin ${headRefName}`);
    return { ok: true };
  }

  if (attempt("first")) return { ok: true };

  git(worktree, ["fetch", "origin", headRefName]);
  const pull = spawnSync(
    "git",
    ["pull", "--ff-only", "origin", headRefName],
    { cwd: worktree, encoding: "utf8", env: { ...process.env, HUSKY: "0" } },
  );
  if (pull.status !== 0 || !attempt("retry")) {
    return { ok: false, reason: "push rejected after fetch + ff" };
  }
  return { ok: true };
}

function isVisualCheck(name: string): boolean {
  return VISUAL_SKIP_RE.test(name);
}

function runIdFromDetailsUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.match(/\/actions\/runs\/(\d+)/)?.[1] ?? null;
}

function categorizeFailure(checkName: string, log: string): {
  category: string;
  autoFix: "eslint" | "prettier" | null;
  proposedFix: string;
} {
  const lower = log.toLowerCase();
  const nameLower = checkName.toLowerCase();

  if (lower.includes("eslint:") || nameLower.includes("eslint") || nameLower === "lint") {
    return {
      category: "ESLint",
      autoFix: "eslint",
      proposedFix: `Run \`${LINTFIX_CMD}\` in the PR worktree and commit.`,
    };
  }
  if (lower.includes("code style issues") || nameLower.includes("prettier")) {
    return {
      category: "Prettier",
      autoFix: "prettier",
      proposedFix: `Run \`${LINTFIX_CMD}\` in the PR worktree and commit.`,
    };
  }
  if (lower.includes("snapshot `") || lower.includes("obsolete snapshot")) {
    return {
      category: "Vitest snapshot",
      autoFix: null,
      proposedFix:
        "Inspect the failing spec; update snapshots only if the visual/behavior change is intentional (`vitest -u <spec>`).",
    };
  }
  if (/\berror TS\d+\b/.test(log) || nameLower.includes("typescript") || nameLower.includes("tsc")) {
    return {
      category: "TypeScript",
      autoFix: null,
      proposedFix: "Fix the reported TS errors locally; do not auto-patch from CI logs alone.",
    };
  }
  if (nameLower.includes("playwright") || nameLower.includes("e2e") || lower.includes("expect(")) {
    return {
      category: "E2E test",
      autoFix: null,
      proposedFix:
        "Download the playwright-report artifact (`gh run download <run-id> -n playwright-report-…`), read test-results/*/error-context.md, fix selector/behavior in the PR worktree.",
    };
  }
  if (nameLower.includes("vitest") || lower.includes("assertionerror")) {
    return {
      category: "Unit test",
      autoFix: null,
      proposedFix: "Run the failing unit spec locally and fix the regression.",
    };
  }
  if (lower.includes("build") || nameLower === "build" || lower.includes(" err! ")) {
    return {
      category: "Build / install",
      autoFix: null,
      proposedFix: "Reproduce the build/install failure in the worktree and fix the root config or dependency issue.",
    };
  }
  return {
    category: "Other",
    autoFix: null,
    proposedFix: "Inspect the failed step log and address the reported error.",
  };
}

function lastLines(text: string, n: number): string {
  const lines = text.trimEnd().split("\n");
  return lines.slice(-n).join("\n");
}

function worktreeHasDiff(worktree: string): boolean {
  const diff = spawnSync("git", ["diff", "--quiet"], {
    cwd: worktree,
    encoding: "utf8",
    env: { ...process.env, HUSKY: "0" },
  });
  return diff.status !== 0;
}

function runAutoFixCommand(worktree: string, kind: "eslint" | "prettier"): boolean {
  const [cmd, ...cmdArgs] = LINTFIX_CMD.split(/\s+/).filter(Boolean);
  const result = spawnSync(cmd, cmdArgs, {
    cwd: worktree,
    encoding: "utf8",
    env: { ...process.env, HUSKY: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0) {
    console.error(`${kind} auto-fix (\`${LINTFIX_CMD}\`) failed:\n${output}`);
    return false;
  }
  if (/no projects matched/i.test(output)) {
    console.error(`${kind} auto-fix matched no workspace package:\n${output}`);
    return false;
  }
  return true;
}

function commitAutoFix(worktree: string, pr: PullRequest, category: string): boolean {
  if (DRY_RUN) {
    console.error(`[dry-run] commit auto-fix ${category} for #${pr.number}`);
    return true;
  }
  git(worktree, ["add", "-u"]);
  const subject = `fix: auto-fix ${category} from CI (#${pr.number})`;
  const commit = spawnSync("git", ["commit", "-m", subject], {
    cwd: worktree,
    encoding: "utf8",
    env: { ...process.env, HUSKY: "0" },
  });
  if (commit.status !== 0) {
    console.error(
      `commit failed for #${pr.number} (${category}) — a commit hook may be blocking it:\n${commit.stderr || commit.stdout}`,
    );
    git(worktree, ["reset", "--hard", "HEAD"], true);
    return false;
  }
  const push = pushBranch(worktree, pr.headRefName);
  return push.ok;
}

function triageCi(pr: PullRequest, sync: SyncStatus): CiStatus {
  if (sync.kind === "manual" || sync.kind === "error") {
    return { kind: "skipped" };
  }

  const payload = JSON.parse(
    gh(["pr", "view", String(pr.number), "--repo", REPO, "--json", "statusCheckRollup"]),
  ) as { statusCheckRollup: StatusCheck[] | null };
  const checks = payload.statusCheckRollup ?? [];

  const inProgress = checks.some(
    (c) =>
      !isVisualCheck(c.name ?? "") &&
      (c.status === "IN_PROGRESS" || c.status === "QUEUED" || c.status === "PENDING") &&
      !c.conclusion,
  );
  if (inProgress) return { kind: "in_progress" };

  const failed = checks.filter(
    (c) =>
      !isVisualCheck(c.name ?? "") &&
      (c.conclusion === "FAILURE" ||
        c.conclusion === "CANCELLED" ||
        c.conclusion === "TIMED_OUT"),
  );
  if (failed.length === 0) return { kind: "green" };

  let worktree: string | undefined;
  const ensureWt = () => {
    if (!worktree) worktree = ensureWorktree(pr.headRefName);
    return worktree;
  };

  const autoFixed: string[] = [];
  const investigations: Investigation[] = [];

  for (const check of failed) {
    const checkName = check.name ?? "unknown check";
    const runId = runIdFromDetailsUrl(check.detailsUrl);
    let log = "";
    let runUrl = check.detailsUrl ?? "(no run URL)";

    if (runId) {
      try {
        log = gh(["run", "view", runId, "--log-failed", "--repo", REPO]);
        runUrl = JSON.parse(gh(["run", "view", runId, "--repo", REPO, "--json", "url"])).url;
      } catch {
        // keep detailsUrl; log may stay empty
      }
    }

    const { category, autoFix, proposedFix } = categorizeFailure(checkName, log);

    if (autoFix && DRY_RUN) {
      console.error(`[dry-run] #${pr.number} would try auto-fix ${category} for ${checkName}`);
    } else if (autoFix) {
      try {
        const wt = ensureWt();
        if (runAutoFixCommand(wt, autoFix)) {
          if (!worktreeHasDiff(wt)) {
            investigations.push({
              checkName,
              runUrl,
              logExcerpt: log ? lastLines(log, 10) : "(auto-fix produced no file changes)",
              proposedFix: `${proposedFix} Auto-fix ran but produced no diff — fix manually or re-run CI.`,
            });
            continue;
          }
          if (commitAutoFix(wt, pr, category)) {
            autoFixed.push(category);
            continue;
          }
        }
      } catch (err) {
        console.error(`auto-fix setup failed for #${pr.number}: ${err}`);
      }
    }

    investigations.push({
      checkName,
      runUrl,
      logExcerpt: log ? lastLines(log, 10) : "(failed to fetch log)",
      proposedFix,
    });
  }

  if (investigations.length === 0 && autoFixed.length > 0) {
    return { kind: "auto_fixed", categories: autoFixed };
  }
  if (autoFixed.length > 0) {
    return { kind: "mixed", autoFixed, failures: investigations };
  }
  return { kind: "investigate", failures: investigations };
}

const REVIEW_THREADS_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100) {
          nodes {
            isResolved
            isOutdated
            comments(first: 1) {
              nodes {
                author { login }
                body
                path
                line
              }
            }
          }
        }
        reviews(last: 20, states: [CHANGES_REQUESTED]) {
          nodes {
            author { login }
            state
            body
          }
        }
      }
    }
  }
`;

function trimReviewBody(body: string, max = 200): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1)}…`;
}

function triageReviews(pr: PullRequest, me: string): ReviewStatus {
  try {
    const raw = gh([
      "api",
      "graphql",
      "-f",
      `query=${REVIEW_THREADS_QUERY}`,
      "-f",
      `owner=${REPO_OWNER}`,
      "-f",
      `repo=${REPO_NAME}`,
      "-F",
      `number=${pr.number}`,
    ]);
    const data = JSON.parse(raw) as {
      data?: {
        repository?: {
          pullRequest?: {
            reviewThreads?: {
              nodes?: Array<{
                isResolved: boolean;
                isOutdated: boolean;
                comments: {
                  nodes?: Array<{
                    author?: { login?: string };
                    body?: string;
                    path?: string;
                    line?: number | null;
                  }>;
                };
              }>;
            };
            reviews?: {
              nodes?: Array<{
                author?: { login?: string };
                state?: string;
                body?: string;
              }>;
            };
          };
        };
      };
    };

    const pull = data.data?.repository?.pullRequest;
    if (!pull) return { kind: "skipped" };

    const items: ReviewItem[] = [];

    for (const thread of pull.reviewThreads?.nodes ?? []) {
      if (thread.isResolved || thread.isOutdated) continue;
      const comment = thread.comments.nodes?.[0];
      if (!comment?.body) continue;
      const author = comment.author?.login ?? "unknown";
      if (author === me) continue;
      items.push({
        kind: "thread",
        author,
        path: comment.path,
        line: comment.line ?? null,
        body: trimReviewBody(comment.body),
      });
    }

    for (const review of pull.reviews?.nodes ?? []) {
      if (review.state !== "CHANGES_REQUESTED") continue;
      const author = review.author?.login ?? "unknown";
      if (author === me) continue;
      const body = review.body?.trim();
      if (!body) continue;
      items.push({
        kind: "changes_requested",
        author,
        body: trimReviewBody(body),
      });
    }

    if (items.length === 0) return { kind: "none" };
    return { kind: "pending", items };
  } catch (err) {
    console.error(`review fetch failed for #${pr.number}: ${err}`);
    return { kind: "skipped" };
  }
}

function formatSync(sync: SyncStatus): string {
  switch (sync.kind) {
    case "clean":
      return "✅ already clean";
    case "would_sync":
      return "🔍 dry-run: would sync";
    case "synced":
      return sync.lockfileRegenerated ? "🔄 synced (lockfile regenerated)" : "🔄 synced";
    case "manual":
      return `⚠️ manual: ${sync.files.length} files — ${sync.files.join(", ")}`;
    case "error":
      return `❌ error: ${sync.reason}`;
    case "skipped":
      return `⏭️ skipped: ${sync.reason}`;
  }
}

function formatCi(ci: CiStatus): string {
  switch (ci.kind) {
    case "green":
      return "✅ green";
    case "in_progress":
      return "⏳ CI in progress";
    case "auto_fixed":
      return `🔧 auto-fixed ${ci.categories.join(", ")}, pushed`;
    case "mixed":
      return `🔧 auto-fixed ${ci.autoFixed.join(", ")}, pushed; ⚠️ ${ci.failures.length} failures need investigation`;
    case "investigate":
      return `⚠️ ${ci.failures.length} failures need investigation`;
    case "skipped":
      return "(skipped)";
  }
}

function formatReviews(reviews: ReviewStatus): string {
  switch (reviews.kind) {
    case "none":
      return "✅ none";
    case "pending":
      return `💬 ${reviews.items.length} unresolved`;
    case "skipped":
      return "(skipped)";
  }
}

function printReport(results: PrResult[]): void {
  console.log("\n| PR | Title | Sync | CI | Reviews |");
  console.log("|---|---|---|---|---|");
  for (const { pr, sync, ci, reviews } of results) {
    const title = pr.title.replace(/\|/g, "\\|");
    console.log(
      `| #${pr.number} | ${title} | ${formatSync(sync)} | ${formatCi(ci)} | ${formatReviews(reviews)} |`,
    );
  }

  for (const { pr, ci } of results) {
    if (ci.kind !== "investigate" && ci.kind !== "mixed") continue;
    const failures = ci.failures;
    for (const failure of failures) {
      console.log(`\n#${pr.number} / ${failure.checkName}:`);
      console.log(`  ${failure.runUrl}`);
      console.log(failure.logExcerpt.split("\n").map((l) => `  ${l}`).join("\n"));
      console.log(`  Proposed fix: ${failure.proposedFix}`);
    }
  }

  for (const { pr, reviews } of results) {
    if (reviews.kind !== "pending") continue;
    for (const item of reviews.items) {
      if (item.kind === "thread") {
        const loc = item.path ? `${item.path}:${item.line ?? "?"}` : "(general)";
        console.log(`\n#${pr.number} / review @${item.author} on ${loc}:`);
      } else {
        console.log(`\n#${pr.number} / CHANGES_REQUESTED @${item.author}:`);
      }
      console.log(`  ${item.body}`);
      console.log(`  Action: implement in PR worktree, push, then re-run checks.`);
    }
  }
}

function recencyCutoff(): Date {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - MAX_AGE_MONTHS);
  return cutoff;
}

function isWithinRecency(pr: PullRequest, cutoff: Date): boolean {
  return new Date(pr.createdAt) >= cutoff;
}

function partitionByRecency(
  prs: PullRequest[],
  explicitPrs: Set<number>,
): { active: PullRequest[]; ageSkipped: PullRequest[] } {
  const cutoff = recencyCutoff();
  const openNumbers = new Set(prs.map((pr) => pr.number));

  for (const num of explicitPrs) {
    if (!openNumbers.has(num)) {
      console.error(`Warning: --pr ${num} is not in your open PR list — ignoring`);
    }
  }

  const active: PullRequest[] = [];
  const ageSkipped: PullRequest[] = [];
  for (const pr of prs) {
    if (explicitPrs.has(pr.number) || isWithinRecency(pr, cutoff)) {
      active.push(pr);
    } else {
      ageSkipped.push(pr);
    }
  }
  return { active, ageSkipped };
}

function listPullRequests(): PullRequest[] {
  const json = gh([
    "pr",
    "list",
    "--repo",
    REPO,
    "--author",
    "@me",
    "--state",
    "open",
    "--json",
    "number,title,headRefName,baseRefName,isDraft,mergeable,mergeStateStatus,createdAt",
  ]);
  return JSON.parse(json) as PullRequest[];
}

function main(): void {
  let me: string;
  try {
    me = gh(["api", "user", "--jq", ".login"]);
  } catch {
    console.error("`gh auth login` first.");
    process.exit(1);
  }

  const allPrs = listPullRequests();
  if (allPrs.length === 0) {
    console.log(`No open PRs by @${me} in ${REPO}.`);
    return;
  }

  const { active: prs, ageSkipped } = partitionByRecency(allPrs, CLI.explicitPrs);
  const skipReason = `older than ${MAX_AGE_MONTHS} months (pass --pr <number> to include)`;

  if (DRY_RUN) {
    console.error("[dry-run] no git writes or pushes will be performed\n");
  }

  const results: PrResult[] = [];
  for (const pr of ageSkipped) {
    console.error(`Skipping #${pr.number} (opened ${pr.createdAt.slice(0, 10)}) — ${skipReason}`);
    results.push({
      pr,
      sync: { kind: "skipped", reason: skipReason },
      ci: { kind: "skipped" },
      reviews: { kind: "skipped" },
    });
  }

  for (const pr of prs) {
    console.error(`Processing #${pr.number} ${pr.headRefName}…`);
    try {
      const sync = syncPullRequest(pr);
      const ci = triageCi(pr, sync);
      const reviews = triageReviews(pr, me);
      results.push({ pr, sync, ci, reviews });
    } catch (err) {
      console.error(`#${pr.number} failed: ${err}`);
      results.push({
        pr,
        sync: { kind: "error", reason: String(err) },
        ci: { kind: "skipped" },
        reviews: { kind: "skipped" },
      });
    }
  }

  printReport(results);
}

main();
