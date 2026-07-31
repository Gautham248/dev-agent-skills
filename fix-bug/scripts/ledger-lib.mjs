// fix-bug/scripts/ledger-lib.mjs
//
// Deterministic scaffolding for the fix-attempt ledger. The problem this
// solves: fix-bug currently has no memory between attempts at the SAME bug.
// A rejected fix, a fix that "didn't work" per developer feedback, and a
// fix that was never even committed all vanish once the conversation moves
// on -- so a second pass at the same bug can re-derive and re-propose the
// exact hypothesis a human already said was wrong.
//
// This is deliberately NOT git-commit-based. fix-bug's own Step 10 gates
// committing behind explicit developer opt-in (default: do NOT commit), so
// most fix attempts -- rejected ones especially -- are never committed at
// all. A ledger keyed to commit history would be blind to the exact case
// it needs to cover. The ledger is written at file-edit time (Step 9),
// independent of whether a commit ever happens.
//
// Dependency-free (node: builtins only), matching review-pr/scripts and
// scripts/skill-lib.mjs -- `git clone && bash setup.sh` remains the whole
// install story.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const OUTCOMES = ["accepted", "rejected", "pending"];

// ---------------------------------------------------------------------------
// Issue identity
// ---------------------------------------------------------------------------

/**
 * The ledger has to be found again on a second pass at the same bug, using
 * only what's guaranteed to exist on attempt 1: the bug description text.
 * There is no PR number yet, often no commit, sometimes no git repo at all.
 *
 * Raw text is a bad file-safe key (arbitrary characters, arbitrary length)
 * and a bad matching key (a developer re-describing the same bug rarely
 * types it identically). Normalize first -- lowercase, collapse whitespace,
 * strip punctuation -- so trivial rephrasing ("Fix the playstore link!" vs
 * "fix playstore link") still resolves to the same issue, then hash that
 * for the filename.
 *
 * This is intentionally NOT semantic matching. A materially different bug
 * description that happens to share most words will not collide in
 * practice (the hash is over the full normalized string, not a fuzzy
 * simhash) -- and a near-miss is the safer failure direction: worst case,
 * two very similar reports get separate ledgers rather than one ledger
 * silently blocking a hypothesis that was never actually tried against
 * this specific bug.
 */
export function normalizeDescription(description) {
  return String(description || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function issueKey(description) {
  const normalized = normalizeDescription(description);
  const hash = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  return hash;
}

/**
 * Filenames must be safe regardless of what's in the description -- the
 * hash already guarantees that, but validated here too so a caller that
 * skips issueKey() and tries to pass a raw string through can't produce a
 * path-traversal-shaped filename.
 */
const SAFE_KEY_RE = /^[a-f0-9]{16}$/;
export function isSafeIssueKey(key) {
  return typeof key === "string" && SAFE_KEY_RE.test(key);
}

// ---------------------------------------------------------------------------
// Ledger read/write
// ---------------------------------------------------------------------------

export function ledgerPath(repoRoot, key) {
  return path.join(repoRoot, ".dev-agent", "fix-attempts", `${key}.json`);
}

export class LedgerError extends Error {}

/**
 * Loads the ledger for this issue, or returns an empty one if none exists
 * yet -- absence is the normal case for a bug's first attempt, not an
 * error condition.
 */
export function loadLedger(repoRoot, description, opts = {}) {
  const readFile = opts.readFile || ((p) => fs.readFileSync(p, "utf8"));
  const existsFn = opts.exists || ((p) => fs.existsSync(p));

  const key = issueKey(description);
  const file = ledgerPath(repoRoot, key);

  if (!existsFn(file)) {
    return { present: false, path: file, key, issue: description, attempts: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(readFile(file));
  } catch (err) {
    // A corrupt ledger must not silently look like "no prior attempts" --
    // that would let a rejected fix get re-proposed, which is precisely
    // the failure this file exists to prevent. Fail loud, not empty.
    throw new LedgerError(
      `Fix-attempt ledger at ${file} is not valid JSON (${err.message}). ` +
        `Fix or delete it before proceeding -- treating it as empty would risk ` +
        `re-proposing an already-rejected fix.`
    );
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.attempts)) {
    throw new LedgerError(`Fix-attempt ledger at ${file} is malformed: missing "attempts" array.`);
  }

  for (const a of parsed.attempts) {
    if (!a || typeof a !== "object" || !OUTCOMES.includes(a.outcome)) {
      throw new LedgerError(
        `Fix-attempt ledger at ${file} has a malformed attempt record ` +
          `(missing or invalid "outcome"). Fix or delete it before proceeding.`
      );
    }
  }

  return { present: true, path: file, key, issue: parsed.issue || description, attempts: parsed.attempts };
}

/**
 * Appends one attempt record. Append-only by convention -- earlier records
 * are never edited or removed, matching the same audit-trail principle
 * dev-agent's own ledger.db uses (one row per turn, no updates, no
 * deletes), for the same reason: a record that can be silently rewritten
 * after the fact is not evidence.
 *
 * A `pending` attempt's outcome becomes known later -- Step 10's commit, or
 * the developer reporting back that it didn't work. That correction is
 * itself a NEW append (`supersedes: n`), not an edit to record n. The
 * pending record stays exactly as it was written; the corrected outcome is
 * a separate, later entry that references it. `latestOutcomeFor()` below
 * resolves the chain so callers see the corrected state without the
 * underlying history ever being rewritten.
 */
export function appendAttempt(repoRoot, description, attempt, opts = {}) {
  const writeFile = opts.writeFile || ((p, c) => fs.writeFileSync(p, c));
  const mkdirFn = opts.mkdir || ((p) => fs.mkdirSync(p, { recursive: true }));

  const current = loadLedger(repoRoot, description, opts);
  const errors = validateAttempt(attempt);
  if (attempt && attempt.supersedes !== undefined && attempt.supersedes !== null) {
    const target = current.attempts.find((a) => a.n === attempt.supersedes);
    if (!target) {
      errors.push(`\`supersedes\` refers to attempt #${attempt.supersedes}, which does not exist yet`);
    } else {
      // Two genuinely different rules live here, and conflating them was a
      // real bug: (a) a target already superseded by an earlier record
      // must not be superseded again -- that's silent double-resolution,
      // always wrong; (b) an ACCEPTED target may legitimately be
      // superseded once, to reopen it when a committed fix later turns out
      // to be broken -- fix-bug's Step 13 relies on this. Only a target
      // that is itself a superseding record already in place (not merely
      // "not pending") blocks a further supersede.
      const alreadyResolvedBy = current.attempts.find((a) => a.supersedes === attempt.supersedes);
      if (alreadyResolvedBy) {
        errors.push(
          `\`supersedes\` targets attempt #${attempt.supersedes}, which was already resolved ` +
            `by attempt #${alreadyResolvedBy.n} (outcome "${alreadyResolvedBy.outcome}") -- ` +
            `an attempt can only be resolved once. To reopen this issue, supersede ` +
            `#${alreadyResolvedBy.n} instead -- the CURRENT live resolution, not the original.`
        );
      } else if (target.outcome === "pending" || attempt.outcome !== target.outcome) {
        // A pending target resolving to anything is fine. A non-pending
        // target (accepted/rejected) may be superseded ONLY by a
        // different outcome -- reopening "accepted" as "rejected" (or the
        // reverse) is the legitimate case; re-recording the SAME outcome
        // again with no new information is not a resolution, it's a
        // duplicate write.
      } else {
        errors.push(
          `\`supersedes\` targets attempt #${attempt.supersedes}, already "${target.outcome}" -- ` +
            `superseding with the SAME outcome again records nothing new`
        );
      }
    }
  }
  if (errors.length) {
    throw new LedgerError(`Cannot append attempt: ${errors.join("; ")}`);
  }

  const n = current.attempts.length + 1;
  const record = {
    n,
    timestamp: attempt.timestamp || new Date().toISOString(),
    hypothesis: attempt.hypothesis,
    diff_summary: attempt.diff_summary,
    files_changed: attempt.files_changed || [],
    commit_sha: attempt.commit_sha || null,
    outcome: attempt.outcome,
    human_feedback: attempt.human_feedback || null,
    supersedes: attempt.supersedes ?? null,
  };

  const updated = {
    issue: current.issue || description,
    key: current.key,
    attempts: [...current.attempts, record],
  };

  mkdirFn(path.dirname(current.path));
  writeFile(current.path, JSON.stringify(updated, null, 2) + "\n");

  return { ...current, present: true, attempts: updated.attempts, wrote: record };
}

function validateAttempt(a) {
  const errors = [];
  if (!a || typeof a !== "object") return ["attempt must be an object"];
  if (!a.hypothesis || typeof a.hypothesis !== "string" || a.hypothesis.trim().length < 5) {
    errors.push("`hypothesis` must describe what was tried, not just name a symptom");
  }
  if (!a.diff_summary || typeof a.diff_summary !== "string") {
    errors.push("`diff_summary` is required -- what actually changed, in one line");
  }
  if (!OUTCOMES.includes(a.outcome)) {
    errors.push(`\`outcome\` must be one of ${OUTCOMES.join(" | ")}`);
  }
  if (a.outcome === "rejected" && (!a.human_feedback || String(a.human_feedback).trim() === "")) {
    // This is the single field a diff can never contain -- the actual
    // reason a human rejected it. Without it, "rejected" carries no
    // information beyond "not accepted," and a future pass can't tell an
    // untested idea from a specifically-refuted one.
    errors.push(
      "a `rejected` attempt requires `human_feedback` -- record what the developer " +
        "actually said was wrong, not just that it didn't work"
    );
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Dead-end detection
// ---------------------------------------------------------------------------

/**
 * The actual mechanism that fixes the reported bug: before proposing a
 * fix, check whether this exact hypothesis was already rejected.
 *
 * Matching is deliberately loose (normalized substring, not exact string
 * equality) because a re-derived hypothesis is very unlikely to be typed
 * identically to how it was recorded the first time, and requiring exact
 * equality would silently defeat the whole check. Loose matching risks an
 * occasional false "this looks like a dead end" flag on a genuinely new
 * but similarly-worded idea -- which just prompts a second look, the safe
 * direction for a false positive here.
 */
/**
 * The actual mechanism that fixes the reported bug: before proposing a
 * fix, check whether this exact hypothesis was already rejected.
 *
 * Matching has two layers, both deliberately loose, because a re-derived
 * hypothesis is very unlikely to be typed identically to how it was
 * recorded the first time:
 *
 *   1. Normalized substring (either direction) -- catches near-identical
 *      rewording that preserves word order ("the URL in Footer.tsx was
 *      stale" vs "URL in Footer.tsx was stale").
 *   2. Word-set overlap -- catches reordering ("app ID constant in
 *      config/links.ts was wrong" vs "config/links.ts app ID was wrong"),
 *      which substring matching structurally cannot catch since the words
 *      appear in a different sequence. A high proportion of shared
 *      significant words (short/common words excluded) is treated as the
 *      same underlying hypothesis.
 *
 * Both directions risk an occasional false "known dead end" flag on a
 * genuinely new but similarly-worded idea -- the safe direction for a
 * false positive here, since it just prompts a second look rather than
 * silently re-proposing something already refuted.
 */
const STOPWORDS = new Set([
  "the", "a", "an", "in", "on", "at", "to", "of", "was", "is", "were",
  "are", "and", "or", "with", "for", "it", "this", "that", "be", "been",
]);

function significantWords(normalized) {
  return normalized.split(" ").filter((w) => w.length > 0 && !STOPWORDS.has(w));
}

function wordOverlapRatio(a, b) {
  const wa = new Set(significantWords(a));
  const wb = new Set(significantWords(b));
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  // Ratio relative to the SMALLER set -- a short candidate that is fully
  // contained in a longer prior hypothesis (or vice versa) should still
  // count as a strong match even though the raw intersection size differs
  // from either set's total size.
  return shared / Math.min(wa.size, wb.size);
}

const WORD_OVERLAP_THRESHOLD = 0.7;

/**
 * Resolves the supersedes chain into "effective" attempts -- a pending
 * record later superseded by a rejected/accepted one is treated as that
 * later outcome, not as still-pending, without ever rewriting the pending
 * record itself. An attempt that superseded nothing and was never
 * superseded passes through unchanged.
 */
export function resolveEffectiveAttempts(attempts) {
  const supersededBy = new Map(); // n -> the attempt that resolved it
  for (const a of attempts) {
    if (a.supersedes !== null && a.supersedes !== undefined) {
      supersededBy.set(a.supersedes, a);
    }
  }
  return attempts
    .filter((a) => !supersededBy.has(a.n)) // drop the now-superseded pending record
    .map((a) => a); // the resolving record itself already carries the real outcome
}

export function isKnownDeadEnd(ledger, candidateHypothesis) {
  const candidate = normalizeDescription(candidateHypothesis);
  if (candidate === "") return { match: false };

  const effective = resolveEffectiveAttempts(ledger.attempts);
  for (const attempt of effective) {
    if (attempt.outcome !== "rejected") continue;
    const prior = normalizeDescription(attempt.hypothesis);
    if (prior === "") continue;

    if (candidate.includes(prior) || prior.includes(candidate)) {
      return { match: true, attempt, via: "substring" };
    }
    if (wordOverlapRatio(candidate, prior) >= WORD_OVERLAP_THRESHOLD) {
      return { match: true, attempt, via: "word-overlap" };
    }
  }
  return { match: false };
}

/** Every attempt outcome so far, most recent last -- for a human-readable summary. */
export function summarizeLedger(ledger) {
  return ledger.attempts.map((a) => ({
    n: a.n,
    outcome: a.outcome,
    hypothesis: a.hypothesis,
    feedback: a.human_feedback,
  }));
}

export function hasAcceptedAttempt(ledger) {
  return resolveEffectiveAttempts(ledger.attempts).some((a) => a.outcome === "accepted");
}

export function rejectedHypotheses(ledger) {
  return resolveEffectiveAttempts(ledger.attempts).filter((a) => a.outcome === "rejected");
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function renderLedgerBrief(ledger) {
  if (!ledger.present || ledger.attempts.length === 0) {
    return "No prior attempts recorded for this issue.";
  }
  const supersededBy = new Map();
  for (const a of ledger.attempts) {
    if (a.supersedes !== null && a.supersedes !== undefined) supersededBy.set(a.supersedes, a.n);
  }
  const lines = [`${ledger.attempts.length} prior attempt(s) recorded for this issue:`, ""];
  for (const a of ledger.attempts) {
    const tag = { accepted: "✓ accepted", rejected: "✗ rejected", pending: "… pending" }[a.outcome];
    const resolvedNote = supersededBy.has(a.n) ? ` (resolved by #${supersededBy.get(a.n)})` : "";
    lines.push(`  #${a.n} [${tag}]${resolvedNote} ${a.hypothesis}`);
    if (a.diff_summary) lines.push(`      changed: ${a.diff_summary}`);
    if (a.human_feedback) lines.push(`      feedback: ${a.human_feedback}`);
    if (a.supersedes !== null && a.supersedes !== undefined) {
      lines.push(`      (resolves #${a.supersedes})`);
    }
  }
  return lines.join("\n");
}
