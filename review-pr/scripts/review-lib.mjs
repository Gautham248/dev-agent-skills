// review-pr/scripts/review-lib.mjs
//
// Deterministic scaffolding for the review-pr skill. Everything in here is
// mechanical and testable: unified-diff anchoring, lens-registry resolution,
// finding validation, dedup, suppression, and GitHub review payload
// construction. The *judgment* (what is actually wrong with the code) stays
// in SKILL.md where the model does it — this file only makes sure that
// judgment lands on a real line, in a valid payload, exactly once.
//
// Deliberately dependency-free (node: builtins only), matching
// scripts/skill-lib.mjs — `git clone && bash setup.sh` must remain the whole
// install story, with no npm install step anywhere in the path.

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Severity + confidence vocabulary
// ---------------------------------------------------------------------------
//
// Reuses first-principles-review's existing buckets verbatim. That skill
// explicitly rejects "Suggestion" as a dodge label, and explicitly says a
// conventions pass run alongside it must merge into ONE bucketed list. Both
// constraints are load-bearing here: review-pr runs several lenses and emits
// a single review, so it inherits that vocabulary rather than defining a
// competing Critical/High/Medium/Low scale.

export const SEVERITIES = ["blocker", "should", "nit"];
export const SEVERITY_RANK = { blocker: 0, should: 1, nit: 2 };

export const SIDES = ["LEFT", "RIGHT"];

/** Findings at or below this confidence are held back from the posted review. */
export const DEFAULT_MIN_CONFIDENCE = 0.6;

/**
 * Above this many findings, the review has stopped being selective and
 * started being a linter. L0 in the design notes: the skill optimizes for
 * findings worth a senior's attention, not for coverage.
 */
export const DEFAULT_MAX_FINDINGS = 15;

// ---------------------------------------------------------------------------
// Unified diff parsing
// ---------------------------------------------------------------------------

/**
 * A comment can only be anchored to a line GitHub considers "part of the
 * diff" — i.e. a line inside a hunk. Anchoring anywhere else fails the whole
 * review submission with a 422 and loses every other comment in the batch,
 * so anchors are computed from the diff itself rather than trusted from the
 * model's output.
 *
 * Returns: [{ path, oldPath, status, isBinary, anchors: Map<string, {...}> }]
 * where each anchor key is `${side}:${line}`.
 */
export function parseUnifiedDiff(diffText) {
  const files = [];
  if (typeof diffText !== "string" || diffText.length === 0) return files;

  const lines = diffText.split("\n");
  // `split` on a trailing newline leaves a final empty element. The hunk-body
  // branch below treats a bare "" as a whitespace-stripped context line (real
  // patches mangled by email do lose the leading space), so without dropping
  // this artifact every diff ending in a newline gains one phantom trailing
  // line — and every comment after it lands one line too low.
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  let current = null;
  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;

  const pushCurrent = () => {
    if (current) files.push(current);
  };

  const newFile = (aPath, bPath) => ({
    path: bPath,
    oldPath: aPath,
    status: "modified",
    isBinary: false,
    anchors: new Map(),
  });

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ── File header ────────────────────────────────────────────────────────
    if (line.startsWith("diff --git ")) {
      pushCurrent();
      const m = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      current = m ? newFile(m[1], m[2]) : newFile(null, null);
      inHunk = false;
      continue;
    }

    if (!current) continue;

    // `git diff` emits rename/copy metadata instead of repeating the paths in
    // the ---/+++ lines when the content is identical. Without this the new
    // path is right (from `diff --git`) but the status is silently wrong,
    // which matters because a pure rename has zero anchorable lines.
    if (line.startsWith("rename from ")) {
      current.oldPath = line.slice("rename from ".length);
      current.status = "renamed";
      continue;
    }
    if (line.startsWith("rename to ")) {
      current.path = line.slice("rename to ".length);
      current.status = "renamed";
      continue;
    }
    if (line.startsWith("new file mode")) {
      current.status = "added";
      current.oldPath = null;
      continue;
    }
    if (line.startsWith("deleted file mode")) {
      current.status = "deleted";
      continue;
    }
    if (line.startsWith("Binary files ") || line.startsWith("GIT binary patch")) {
      current.isBinary = true;
      continue;
    }

    if (line.startsWith("--- ")) {
      const p = line.slice(4).trim();
      if (p === "/dev/null") {
        current.status = "added";
        current.oldPath = null;
      } else if (p.startsWith("a/")) {
        current.oldPath = p.slice(2);
      }
      continue;
    }
    if (line.startsWith("+++ ")) {
      const p = line.slice(4).trim();
      if (p === "/dev/null") {
        current.status = "deleted";
      } else if (p.startsWith("b/")) {
        current.path = p.slice(2);
      }
      continue;
    }

    // ── Hunk header ────────────────────────────────────────────────────────
    const hunk = line.match(/^@@+ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[3]);
      inHunk = true;
      continue;
    }

    if (!inHunk) continue;

    // ── Hunk body ──────────────────────────────────────────────────────────
    //
    // "\ No newline at end of file" is metadata about the preceding line, not
    // a line of its own — counting it shifts every subsequent line number by
    // one and silently misplaces every later comment in the file.
    if (line.startsWith("\\")) continue;

    const marker = line[0];

    if (marker === "+") {
      current.anchors.set(`RIGHT:${newLine}`, {
        side: "RIGHT",
        line: newLine,
        kind: "added",
        content: line.slice(1),
      });
      newLine++;
    } else if (marker === "-") {
      current.anchors.set(`LEFT:${oldLine}`, {
        side: "LEFT",
        line: oldLine,
        kind: "removed",
        content: line.slice(1),
      });
      oldLine++;
    } else if (marker === " " || line === "") {
      // Context lines are anchorable on both sides. An empty string here is a
      // zero-width context line: some diff producers strip the trailing space.
      current.anchors.set(`RIGHT:${newLine}`, {
        side: "RIGHT",
        line: newLine,
        kind: "context",
        content: line.slice(1),
      });
      current.anchors.set(`LEFT:${oldLine}`, {
        side: "LEFT",
        line: oldLine,
        kind: "context",
        content: line.slice(1),
      });
      oldLine++;
      newLine++;
    } else {
      // Anything else means the hunk ended without a new file header
      // (trailing prose, `--` signature, etc.). Stop counting rather than
      // corrupting line numbers.
      inHunk = false;
    }
  }

  pushCurrent();
  return files;
}

/**
 * Flat lookup of every anchorable position across every file, plus the file
 * metadata needed to explain *why* a rejected anchor was rejected.
 */
export function buildAnchorIndex(files) {
  const byPath = new Map();
  for (const f of files) {
    byPath.set(f.path, f);
  }
  return {
    byPath,
    has(filePath, line, side = "RIGHT") {
      const f = byPath.get(filePath);
      if (!f) return false;
      return f.anchors.has(`${side}:${line}`);
    },
    get(filePath, line, side = "RIGHT") {
      const f = byPath.get(filePath);
      if (!f) return null;
      return f.anchors.get(`${side}:${line}`) || null;
    },
    /** Nearest anchorable line in the same file/side — used for diagnostics. */
    nearest(filePath, line, side = "RIGHT") {
      const f = byPath.get(filePath);
      if (!f) return null;
      let best = null;
      for (const a of f.anchors.values()) {
        if (a.side !== side) continue;
        const d = Math.abs(a.line - line);
        if (best === null || d < best.distance) best = { ...a, distance: d };
      }
      return best;
    },
  };
}

// ---------------------------------------------------------------------------
// Lens registry
// ---------------------------------------------------------------------------

/**
 * A lens is another skill in this repo whose standards review-pr reads and
 * applies as a review perspective. Adding a standard to the review is
 * therefore an edit to one JSON file, not an edit to this skill's prose —
 * which is the whole point: a new coding-standards-* skill added tomorrow
 * becomes a review lens by appending one entry.
 *
 * Skill names are validated rather than trusted. The registry is a file in a
 * repo that syncs automatically (SkillsSync, git fast-forward), so a name
 * like `../../etc/passwd` or an absolute path would otherwise become an
 * arbitrary-file-read primitive pointed at whatever the container can see.
 */
const SKILL_NAME_RE = /^[a-z0-9][a-z0-9._-]*$/;

export function isSafeSkillName(name) {
  if (typeof name !== "string" || name.length === 0 || name.length > 100) return false;
  if (!SKILL_NAME_RE.test(name)) return false;
  if (name.includes("..")) return false;
  return true;
}

export class LensRegistryError extends Error {}

/**
 * @param {string} rawJson  contents of references/lens-registry.json
 * @param {object} opts
 *   - skillsRoot: absolute path to the skills repo root
 *   - exists: (absPath) => boolean   (injectable for tests)
 *   - triggeredDomains: string[]     domains detected as present in the target
 *                                    repo, e.g. from coding-standards' own
 *                                    manifest detection. Lenses gated on a
 *                                    domain not present are skipped.
 */
export function loadLensRegistry(rawJson, opts = {}) {
  const {
    skillsRoot = ".",
    exists = (p) => fs.existsSync(p),
    triggeredDomains = null,
  } = opts;

  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    // Deliberately fatal. A malformed registry must NOT silently degrade to
    // "review with zero lenses" — that produces a confident-looking review
    // that quietly skipped every company standard, which is worse than no
    // review at all.
    throw new LensRegistryError(
      `lens-registry.json is not valid JSON (${err.message}). ` +
        `Refusing to review with an unknown lens set — fix the file first.`
    );
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.lenses)) {
    throw new LensRegistryError(
      `lens-registry.json must be an object with a "lenses" array.`
    );
  }

  const readFile = opts.readFile || ((p) => fs.readFileSync(p, "utf8"));

  // Expand `expand_from` entries into concrete lens entries first, so the
  // validation loop below treats derived and hand-written lenses identically.
  const flattened = [];
  const skipped = [];
  for (const entry of parsed.lenses) {
    if (entry && typeof entry === "object" && entry.expand_from) {
      const src = entry.expand_from;
      if (!isSafeSkillName(src)) {
        skipped.push({ skill: String(src), reason: "unsafe expand_from name" });
        continue;
      }
      const manifestPath = path.join(skillsRoot, src, "references", "manifest.json");
      if (!exists(manifestPath)) {
        skipped.push({ skill: src, reason: "expand_from manifest not found", expectedPath: manifestPath });
        continue;
      }
      try {
        const expanded = expandManifestLenses(readFile(manifestPath), {
          baseOrder: typeof entry.order === "number" ? entry.order : 100,
        });
        flattened.push(...expanded);
      } catch (err) {
        // A broken manifest downgrades that one expansion, but must not take
        // the whole review down — the hand-written lenses are still valid.
        skipped.push({ skill: src, reason: `expand_from failed: ${err.message}` });
      }
      continue;
    }
    flattened.push(entry);
  }

  const resolved = [];
  const seen = new Set();

  for (const entry of flattened) {
    if (!entry || typeof entry !== "object") {
      skipped.push({ skill: String(entry), reason: "malformed entry" });
      continue;
    }
    const name = entry.skill;

    if (!isSafeSkillName(name)) {
      skipped.push({ skill: String(name), reason: "unsafe or malformed skill name" });
      continue;
    }
    if (seen.has(name)) {
      // Duplicate entries are a merge artifact, not an instruction to apply
      // the same standard twice.
      skipped.push({ skill: name, reason: "duplicate entry" });
      continue;
    }
    seen.add(name);

    if (entry.enabled === false) {
      skipped.push({ skill: name, reason: "disabled in registry" });
      continue;
    }

    const skillPath = path.join(skillsRoot, name, "SKILL.md");
    if (!exists(skillPath)) {
      // Non-fatal, but never silent. A lens that vanished (renamed skill,
      // partial sync) means the review is weaker than the registry claims,
      // and the human needs to see that in the report.
      skipped.push({ skill: name, reason: "SKILL.md not found", expectedPath: skillPath });
      continue;
    }

    if (
      triggeredDomains &&
      Array.isArray(entry.requires_domain) &&
      entry.requires_domain.length > 0 &&
      !entry.requires_domain.some((d) => triggeredDomains.includes(d))
    ) {
      skipped.push({
        skill: name,
        reason: `requires domain [${entry.requires_domain.join(", ")}], none present in target repo`,
      });
      continue;
    }

    resolved.push({
      skill: name,
      path: skillPath,
      concern: entry.concern || name,
      applies_to: Array.isArray(entry.applies_to) ? entry.applies_to : [],
      requires_domain: Array.isArray(entry.requires_domain) ? entry.requires_domain : [],
      always: entry.always === true,
      order: typeof entry.order === "number" ? entry.order : 100,
    });
  }

  resolved.sort((a, b) => a.order - b.order || a.skill.localeCompare(b.skill));

  return { version: parsed.version ?? null, lenses: resolved, skipped };
}

/**
 * A registry entry of the form `{ "expand_from": "coding-standards" }` reads
 * that skill's own `references/manifest.json` and yields one lens per domain
 * it declares. This is the difference between the registry duplicating
 * coding-standards' routing table and merely pointing at it: when a
 * `coding-standards-*` sub-skill is added tomorrow, it is added to
 * manifest.json (as it already must be) and becomes a review lens with no
 * edit here at all.
 *
 * `path_patterns` become the lens's `applies_to`, and the domain name becomes
 * its `requires_domain` — so a domain the target repo doesn't have is skipped
 * for the same reason the dispatcher wouldn't dispatch to it.
 */
export function expandManifestLenses(manifestJson, { baseOrder = 100 } = {}) {
  let parsed;
  try {
    parsed = JSON.parse(manifestJson);
  } catch (err) {
    throw new LensRegistryError(`manifest is not valid JSON (${err.message})`);
  }
  if (!parsed || !Array.isArray(parsed.domains)) {
    throw new LensRegistryError(`manifest has no "domains" array`);
  }
  return parsed.domains.map((d, i) => ({
    skill: d.skill,
    concern: `${d.domain} standards`,
    applies_to: Array.isArray(d.path_patterns) ? d.path_patterns : [],
    requires_domain: [d.domain],
    // A domain with no path_patterns (e.g. project-organization) can't be
    // matched from changed paths alone, so it only runs when its domain is
    // independently known to be present.
    always: false,
    order: baseOrder + i,
  }));
}

// ---------------------------------------------------------------------------
// Repo-local review conventions
// ---------------------------------------------------------------------------

/**
 * Rules learned from a specific repo live in that repo at
 * `.dev-agent/review-conventions.md`, not in this skills repo — a rule like
 * "the Supabase client is a singleton here" is true of one codebase, and
 * storing it centrally would apply one project's convention to every project
 * the agent reviews.
 *
 * This is the read side of the learning loop. Without it the loop is
 * write-only: rules get promoted and then never influence a review.
 *
 * The critical property is the Promoted/Candidates split. A candidate has
 * been observed but not confirmed, and applying it would be exactly the
 * feedback-poisoning failure the promotion gate exists to prevent — one
 * reviewer's momentary preference silently becoming a standard enforced on
 * the whole team. `applicable` therefore contains promoted rules only, and a
 * test asserts candidates can never leak into it.
 */
export function parseRepoConventions(markdown) {
  const promoted = [];
  const candidates = [];
  if (typeof markdown !== "string" || markdown.trim() === "") {
    return { promoted, candidates, applicable: [] };
  }

  let bucket = null;
  let entry = null;

  const flush = () => {
    if (!entry) return;
    // A promoted entry without a Rule line is malformed — it says a rule
    // exists without saying what it is. Demote rather than guess.
    if (bucket === "promoted" && entry.rule) promoted.push(entry);
    else if (bucket === "promoted") candidates.push({ ...entry, malformed: "missing **Rule:**" });
    else if (bucket === "candidates") candidates.push(entry);
    entry = null;
  };

  for (const raw of markdown.split("\n")) {
    const line = raw.trim();

    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      flush();
      const label = h2[1].toLowerCase();
      if (label.startsWith("promoted")) bucket = "promoted";
      else if (label.startsWith("candidate")) bucket = "candidates";
      else bucket = null;
      continue;
    }

    const h3 = line.match(/^###\s+(?:(\d{4}-\d{2}-\d{2})\s+[—-]\s+)?(.+)$/);
    if (h3 && bucket) {
      flush();
      entry = { date: h3[1] || null, title: h3[2].trim(), severity: "should", observations: 1 };
      continue;
    }

    if (!entry) continue;

    const field = line.match(/^\*\*([A-Za-z ]+):\*\*\s*(.*)$/);
    if (!field) continue;
    const key = field[1].toLowerCase().trim();
    const value = field[2].trim();

    if (key === "rule") entry.rule = value;
    else if (key === "severity" && SEVERITIES.includes(value.toLowerCase())) {
      entry.severity = value.toLowerCase();
    } else if (key === "origin") entry.origin = value;
    else if (key === "confirmed by") entry.confirmedBy = value;
    else if (key === "observations") entry.observations = Number(value) || 1;
    else if (key === "observed") entry.observed = value;
    else if (key === "applies to") {
      entry.applies_to = value.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  flush();

  return { promoted, candidates, applicable: promoted };
}

/**
 * Load the target repo's conventions as an additional lens. Absence is the
 * normal case for a repo that has never been reviewed — it is not an error
 * and must not be reported as one.
 */
export function loadRepoConventions(repoRoot, opts = {}) {
  const readFile = opts.readFile || ((p) => fs.readFileSync(p, "utf8"));
  const existsFn = opts.exists || ((p) => fs.existsSync(p));
  const conventionsPath = path.join(repoRoot, ".dev-agent", "review-conventions.md");

  if (!existsFn(conventionsPath)) {
    return { present: false, path: conventionsPath, promoted: [], candidates: [], applicable: [] };
  }
  try {
    const parsed = parseRepoConventions(readFile(conventionsPath));
    return { present: true, path: conventionsPath, ...parsed };
  } catch (err) {
    // Never fatal. A broken conventions file weakens the review; it must not
    // block reviewing the PR entirely.
    return {
      present: true,
      path: conventionsPath,
      error: err.message,
      promoted: [],
      candidates: [],
      applicable: [],
    };
  }
}

/**
 * Which lenses actually apply to this PR's changed files. A lens with no
 * `applies_to` globs is unconditional; one with globs runs only if at least
 * one changed path matches. `always: true` overrides path gating entirely.
 */
export function selectLensesForFiles(lenses, changedPaths) {
  const selected = [];
  const notApplicable = [];
  for (const lens of lenses) {
    if (lens.always || lens.applies_to.length === 0) {
      selected.push({ ...lens, matchedPaths: changedPaths });
      continue;
    }
    const matched = changedPaths.filter((p) =>
      lens.applies_to.some((pattern) => matchesGlob(p, pattern))
    );
    if (matched.length > 0) selected.push({ ...lens, matchedPaths: matched });
    else notApplicable.push({ skill: lens.skill, reason: "no changed file matches applies_to" });
  }
  return { selected, notApplicable };
}

/**
 * Minimal glob: supports `*` (within a segment), `**` (across segments), and
 * bare substrings like `.tsx` or `src/routes/api/` to stay consistent with
 * how coding-standards' manifest.json already writes its path_patterns.
 */
export function matchesGlob(filePath, pattern) {
  if (!pattern.includes("*")) return filePath.includes(pattern);
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*");
  return new RegExp(`^${escaped}$`).test(filePath);
}

// ---------------------------------------------------------------------------
// Findings: validation, dedup, suppression
// ---------------------------------------------------------------------------

/**
 * Every finding must carry: which lens raised it, how severe, exactly where,
 * the evidence line it is about, why, and how sure. The `evidence` field is
 * the anti-hallucination anchor — a finding that cannot quote the line it is
 * about is a finding about a line that may not exist.
 */
export function validateFinding(finding, anchorIndex, opts = {}) {
  const errors = [];
  const f = finding || {};

  if (!f.lens || typeof f.lens !== "string") errors.push("missing `lens`");
  if (!SEVERITIES.includes(f.severity)) {
    errors.push(`\`severity\` must be one of ${SEVERITIES.join(" | ")}`);
  }
  if (!f.file || typeof f.file !== "string") errors.push("missing `file`");
  if (!Number.isInteger(f.line) || f.line < 1) errors.push("`line` must be a positive integer");

  const side = f.side || "RIGHT";
  if (!SIDES.includes(side)) errors.push("`side` must be LEFT or RIGHT");

  if (!f.evidence || typeof f.evidence !== "string" || f.evidence.trim() === "") {
    errors.push("missing `evidence` (quote the actual line this is about)");
  }
  if (!f.rationale || typeof f.rationale !== "string" || f.rationale.trim().length < 15) {
    errors.push("`rationale` must explain the failure mode, not just name it");
  }
  if (typeof f.confidence !== "number" || f.confidence < 0 || f.confidence > 1) {
    errors.push("`confidence` must be a number between 0 and 1");
  }

  // Anchor check — the 422 guard.
  if (anchorIndex && f.file && Number.isInteger(f.line) && SIDES.includes(side)) {
    if (!anchorIndex.byPath.has(f.file)) {
      errors.push(`file \`${f.file}\` is not in this PR's diff`);
    } else if (!anchorIndex.has(f.file, f.line, side)) {
      const near = anchorIndex.nearest(f.file, f.line, side);
      errors.push(
        `\`${f.file}:${f.line}\` (${side}) is not part of the diff` +
          (near ? ` — nearest anchorable ${side} line is ${near.line}` : "")
      );
    }
  }

  // Multi-line comments: start_line must precede line and share a side, and
  // must itself be anchorable.
  if (f.start_line !== undefined && f.start_line !== null) {
    if (!Number.isInteger(f.start_line) || f.start_line < 1) {
      errors.push("`start_line` must be a positive integer");
    } else if (f.start_line >= f.line) {
      errors.push("`start_line` must be strictly less than `line`");
    } else if (anchorIndex && !anchorIndex.has(f.file, f.start_line, f.start_side || side)) {
      errors.push(`\`start_line\` ${f.start_line} is not part of the diff`);
    }
  }

  // Evidence must actually match the line it claims to quote. This is the
  // check that catches a finding invented about a plausible-sounding line
  // that isn't there — the failure mode that makes agent review output
  // untrustworthy in the first place.
  if (opts.checkEvidence !== false && anchorIndex && errors.length === 0) {
    const anchor = anchorIndex.get(f.file, f.line, side);
    if (anchor) {
      const actual = normalizeForCompare(anchor.content);
      const claimed = normalizeForCompare(f.evidence);
      if (actual !== "" && claimed !== "" && !actual.includes(claimed) && !claimed.includes(actual)) {
        errors.push(
          `\`evidence\` does not match the line at ${f.file}:${f.line} ` +
            `(line is \`${anchor.content.trim().slice(0, 60)}\`)`
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function normalizeForCompare(s) {
  return String(s).replace(/\s+/g, " ").trim();
}

/**
 * Two lenses looking at the same line will often find the same thing from
 * different angles. Posting both is the "20 comments on one line" failure
 * that makes reviewers stop reading. Merge on (file, line, side), keep the
 * highest severity and confidence, and record every lens that agreed —
 * agreement across lenses is signal worth surfacing, not noise to discard.
 */
export function dedupeFindings(findings) {
  const byAnchor = new Map();
  for (const f of findings) {
    const key = `${f.file}:${f.side || "RIGHT"}:${f.line}`;
    const existing = byAnchor.get(key);
    if (!existing) {
      byAnchor.set(key, { ...f, lenses: [f.lens], mergedCount: 1 });
      continue;
    }
    existing.mergedCount++;
    if (!existing.lenses.includes(f.lens)) existing.lenses.push(f.lens);
    if (SEVERITY_RANK[f.severity] < SEVERITY_RANK[existing.severity]) {
      existing.severity = f.severity;
    }
    // Independent lenses reaching the same anchor raises confidence, capped
    // so corroboration can never manufacture certainty on its own.
    existing.confidence = Math.min(0.99, Math.max(existing.confidence, f.confidence) + 0.05);
    if (f.rationale && !existing.rationale.includes(f.rationale)) {
      existing.rationale = `${existing.rationale}\n\n_Also flagged by \`${f.lens}\`:_ ${f.rationale}`;
    }
  }
  return [...byAnchor.values()];
}

/**
 * Selectivity gate. Below-threshold findings are not deleted — they are
 * routed to the human as "held back", so a real finding the model wasn't
 * sure about is still visible to the reviewer without being posted publicly
 * on the author's PR.
 */
export function partitionByConfidence(findings, minConfidence = DEFAULT_MIN_CONFIDENCE) {
  const post = [];
  const held = [];
  for (const f of findings) {
    // A blocker is escalated regardless of confidence — an uncertain
    // "this leaks credentials" is exactly the finding a human must see.
    if (f.severity === "blocker" || f.confidence >= minConfidence) post.push(f);
    else held.push(f);
  }
  return { post, held };
}

export function sortFindings(findings) {
  return [...findings].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      b.confidence - a.confidence ||
      a.file.localeCompare(b.file) ||
      a.line - b.line
  );
}

// ---------------------------------------------------------------------------
// Review event resolution (the self-review 422 guard)
// ---------------------------------------------------------------------------

/**
 * GitHub rejects APPROVE and REQUEST_CHANGES on your own PR with a 422.
 * dev-agent authors PRs, so the common case is precisely the one that fails.
 * Resolve the event *before* submitting rather than catching the error after
 * — a 422 on submit loses the entire batch of line comments.
 */
export function resolveReviewEvent({ prAuthor, reviewerLogin, hasBlockers, requested, pending }) {
  // Pending review: no event is sent at all, so none of the event-legality
  // rules below apply. Notably the self-review 422 does not bite -- an author
  // may leave pending comments on their own PR, they simply cannot submit
  // them as APPROVE or REQUEST_CHANGES afterwards.
  if (pending) {
    return {
      event: null,
      pending: true,
      downgraded: false,
      reason: "created as a PENDING review — visible only to you until you submit it on GitHub",
    };
  }

  const isSelfReview =
    typeof prAuthor === "string" &&
    typeof reviewerLogin === "string" &&
    prAuthor.toLowerCase() === reviewerLogin.toLowerCase();

  if (isSelfReview) {
    return {
      event: "COMMENT",
      downgraded: true,
      reason:
        `\`${reviewerLogin}\` authored this PR; GitHub rejects APPROVE and ` +
        `REQUEST_CHANGES from the author (HTTP 422). Posting as COMMENT.`,
    };
  }

  if (requested && ["COMMENT", "APPROVE", "REQUEST_CHANGES"].includes(requested)) {
    return { event: requested, downgraded: false, reason: "explicitly requested" };
  }

  if (hasBlockers) {
    return {
      event: "REQUEST_CHANGES",
      downgraded: false,
      reason: "at least one blocker-severity finding",
    };
  }

  // Never auto-APPROVE. Approval is a human attestation; the skill's job is
  // to surface findings, not to sign off on a merge.
  return {
    event: "COMMENT",
    downgraded: false,
    reason: "no blockers — approval is left to the human reviewer",
  };
}

// ---------------------------------------------------------------------------
// Payload construction
// ---------------------------------------------------------------------------

export function buildReviewPayload({
  findings,
  summary,
  commitId,
  event = "COMMENT",
  maxFindings = DEFAULT_MAX_FINDINGS,
}) {
  const sorted = sortFindings(findings);
  const posted = sorted.slice(0, maxFindings);
  const truncated = sorted.slice(maxFindings);

  const comments = posted.map((f) => {
    const c = {
      path: f.file,
      line: f.line,
      side: f.side || "RIGHT",
      body: renderFindingBody(f),
    };
    if (f.start_line) {
      c.start_line = f.start_line;
      c.start_side = f.start_side || c.side;
    }
    return c;
  });

  // Omitting `event` entirely is what makes GitHub create the review in
  // PENDING state: the comments exist on the PR, rendered inline in the real
  // diff, but are visible only to the reviewer who created them until they
  // submit. Sending `event: null` is NOT the same thing and is rejected --
  // the key must be absent.
  const payload = { body: summary, comments };
  if (event) payload.event = event;
  if (commitId) payload.commit_id = commitId;
  return { payload, truncated, pending: !event };
}

export function renderFindingBody(f) {
  const label = { blocker: "Blocker", should: "Should", nit: "Nit" }[f.severity];
  const lenses = f.lenses && f.lenses.length > 1 ? f.lenses.join("`, `") : f.lens;
  const conf = `${Math.round(f.confidence * 100)}%`;
  const lines = [
    `**${label}** · \`${lenses}\` · confidence ${conf}`,
    "",
    f.rationale.trim(),
  ];
  if (f.suggestion) {
    lines.push("", "```suggestion", f.suggestion.replace(/\n$/, ""), "```");
  }
  return lines.join("\n");
}

/**
 * Findings that couldn't be anchored still matter — they just can't be line
 * comments. Rolling them into the summary body keeps them visible instead of
 * dropping them, which is what makes it safe to reject an anchor strictly.
 */
export function renderSummary({
  findings,
  unanchorable = [],
  held = [],
  truncated = [],
  lensReport,
  prMeta = {},
  eventDecision,
}) {
  const counts = { blocker: 0, should: 0, nit: 0 };
  for (const f of findings) counts[f.severity]++;

  const out = [];
  out.push(`## Review — \`${prMeta.repo || "repo"}#${prMeta.number || "?"}\``);
  out.push("");
  out.push(
    `**${counts.blocker} blocker · ${counts.should} should · ${counts.nit} nit** ` +
      `across ${prMeta.changedFiles ?? "?"} changed file(s).`
  );
  out.push("");

  if (eventDecision?.downgraded) {
    out.push(`> ${eventDecision.reason}`);
    out.push("");
  }

  const hasLensInfo =
    (lensReport?.selected?.length || 0) +
      (lensReport?.skipped?.length || 0) +
      (lensReport?.notApplicable?.length || 0) >
    0;

  if (hasLensInfo) {
    out.push("### Lenses applied");
    out.push("");
    for (const l of lensReport.selected || []) {
      out.push(`- \`${l.skill}\` — ${l.concern}`);
    }
    for (const s of lensReport.skipped || []) {
      out.push(`- ~~\`${s.skill}\`~~ — skipped: ${s.reason}`);
    }
    for (const s of lensReport.notApplicable || []) {
      out.push(`- ~~\`${s.skill}\`~~ — ${s.reason}`);
    }
    out.push("");
  }

  if (unanchorable.length) {
    out.push("### Findings without a diff anchor");
    out.push("");
    out.push(
      "_These could not be posted as line comments because the line is not part of this diff._"
    );
    out.push("");
    for (const f of unanchorable) {
      out.push(`- **${f.severity}** \`${f.file}:${f.line}\` — ${f.rationale.split("\n")[0]}`);
    }
    out.push("");
  }

  if (truncated.length) {
    out.push(`### ${truncated.length} further finding(s) not posted inline`);
    out.push("");
    for (const f of truncated) {
      out.push(`- **${f.severity}** \`${f.file}:${f.line}\` — ${f.rationale.split("\n")[0]}`);
    }
    out.push("");
  }

  if (held.length) {
    out.push(
      `_${held.length} low-confidence finding(s) were held back and reported to the reviewer only._`
    );
    out.push("");
  }

  out.push("---");
  out.push("");
  out.push(
    "_Generated by `review-pr`. Every finding carries the lens that raised it, " +
      "the evidence line, and a confidence score — dispute any of them; disputes " +
      "are what the skill learns from._"
  );
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

/**
 * Re-running a review on the same head SHA must not double-post. GitHub has
 * no natural dedup for reviews, so the marker goes in the body and is
 * checked against existing reviews before submitting.
 */
export function reviewMarker(headSha) {
  return `<!-- review-pr:${headSha} -->`;
}

export function hasExistingReview(existingReviews, headSha) {
  const marker = reviewMarker(headSha);
  return (existingReviews || []).some((r) => typeof r.body === "string" && r.body.includes(marker));
}

/**
 * GitHub allows exactly one pending review per user per PR; a second create
 * fails with "User can only have one pending review per pull request". That
 * error is recoverable but only if the caller knows which review to clear, so
 * find it first rather than letting the create fail.
 */
export function findPendingReview(existingReviews, reviewerLogin) {
  return (
    (existingReviews || []).find(
      (r) =>
        r &&
        r.state === "PENDING" &&
        (!reviewerLogin ||
          (r.user && String(r.user.login).toLowerCase() === String(reviewerLogin).toLowerCase()))
    ) || null
  );
}

/**
 * The head SHA the review was computed against must still be the head SHA at
 * submit time. If the author pushed during the review, the line numbers may
 * refer to code that no longer exists — silently posting stale comments onto
 * shifted lines is worse than failing.
 */
export function assertHeadUnchanged(fetchedSha, currentSha) {
  if (fetchedSha !== currentSha) {
    return {
      ok: false,
      reason:
        `PR head moved during review (fetched \`${fetchedSha?.slice(0, 7)}\`, ` +
        `now \`${currentSha?.slice(0, 7)}\`). Line anchors may be stale — re-run the review.`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Untrusted content handling
// ---------------------------------------------------------------------------

/**
 * A PR diff is attacker-controlled. A PR that adds a source comment
 * containing instruction-override phrasing is trying to talk to the
 * reviewer, not to the compiler. Content is never obeyed — but it is worth
 * flagging when it tries, because a PR attempting this is itself a finding.
 *
 * Patterns intentionally mirror the categories in
 * skill-add/scripts/scan-skillset.mjs (SEC-INJECT-*) so the two agree about
 * what counts, and are built at runtime from fragments so this file does not
 * itself trip that scanner.
 */
export function detectInjectionAttempts(files) {
  const patterns = [
    { id: "override", re: new RegExp(["ignore", "\\s+(?:all\\s+|any\\s+)?(?:the\\s+)?(?:previous|prior|above|earlier)\\s+", "(?:instruction|rule|prompt)"].join(""), "i") },
    { id: "role-reframe", re: new RegExp(["you\\s+are\\s+now\\s+", "[\\w\\s]{0,20}(?:debug|admin|elevated|unrestricted|developer)\\s*mode"].join(""), "i") },
    { id: "conceal", re: new RegExp(["do\\s+not\\s+(?:tell|inform|mention)", "[\\s\\S]{0,20}(?:the\\s+)?(?:user|developer|reviewer)"].join(""), "i") },
    { id: "auto-approve", re: /\b(?:approve|lgtm)\s+this\s+(?:pr|pull\s+request|change)\b/i },
  ];

  const hits = [];
  for (const f of files) {
    if (f.isBinary) continue;
    for (const anchor of f.anchors.values()) {
      if (anchor.kind !== "added") continue;
      for (const p of patterns) {
        if (p.re.test(anchor.content)) {
          hits.push({
            file: f.path,
            line: anchor.line,
            side: anchor.side,
            pattern: p.id,
            content: anchor.content.trim().slice(0, 120),
          });
        }
      }
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Diff budgeting
// ---------------------------------------------------------------------------

/**
 * A 12,000-line diff will not fit in one context window, and a review that
 * silently saw only the first third is a review that lies about its own
 * coverage. Chunk explicitly and report what was covered.
 */
export function planDiffChunks(files, { maxLinesPerChunk = 1500 } = {}) {
  const chunks = [];
  let current = { files: [], lines: 0 };
  const oversized = [];

  for (const f of files) {
    const count = f.anchors.size;
    if (f.isBinary) continue;
    if (count > maxLinesPerChunk) {
      oversized.push({ path: f.path, lines: count });
      continue;
    }
    if (current.lines + count > maxLinesPerChunk && current.files.length > 0) {
      chunks.push(current);
      current = { files: [], lines: 0 };
    }
    current.files.push(f.path);
    current.lines += count;
  }
  if (current.files.length > 0) chunks.push(current);
  return { chunks, oversized };
}
