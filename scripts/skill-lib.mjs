// scripts/skill-lib.mjs
//
// Shared helpers for anything that needs to discover skills or read their
// frontmatter. Used by install-skillset.mjs and regen-readme.mjs so the two
// scripts can never disagree about what counts as "a skill" or how a
// SKILL.md is parsed.
//
// Deliberately dependency-free (no js-yaml) — frontmatter in this repo and
// in every external skillset checked so far only uses plain scalars and
// folded `>` block scalars for `description`, so a small manual parser is
// enough and keeps `npm install` out of the install path entirely.

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const TEXT_EXTENSIONS = new Set([
  ".md", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".sh", ".json", ".txt", ".yaml", ".yml",
]);

/**
 * Recursively find every SKILL.md under `root`, at any depth, skipping
 * `.git`. Returns absolute paths.
 */
export function findSkillMdFiles(root) {
  const results = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name === "SKILL.md") {
        results.push(full);
      }
    }
  }
  walk(root);
  return results;
}

/**
 * Find direct top-level skill directories (one level under `skillsDir`,
 * the dev-agent-skills convention: every skill is its own folder at the
 * repo root). This intentionally does NOT recurse — it mirrors exactly
 * what setup.sh's own discovery loop does, so the README table always
 * matches what setup.sh actually links.
 */
export function findTopLevelSkillDirs(skillsDir) {
  let entries;
  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const dirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillMd = path.join(skillsDir, entry.name, "SKILL.md");
    if (fs.existsSync(skillMd)) dirs.push(path.join(skillsDir, entry.name));
  }
  return dirs.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}

/**
 * Parse the YAML frontmatter of a SKILL.md just enough to extract `name`
 * and `description`. Handles:
 *   name: foo
 *   description: One line.
 * and:
 *   description: >
 *     Folded block scalar
 *     across several lines.
 * Anything fancier (nested maps, lists, quoted multi-line) falls back to
 * "(no description found)" rather than throwing — a skillset author using
 * unusual YAML shouldn't crash the installer, just get a weaker table row.
 */
export function parseSkillFrontmatter(skillMdPath) {
  const raw = fs.readFileSync(skillMdPath, "utf8");
  const lines = raw.split(/\r?\n/);

  if (lines[0]?.trim() !== "---") {
    return { name: null, description: null, hasFrontmatter: false };
  }
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { name: null, description: null, hasFrontmatter: false };
  }

  const fm = lines.slice(1, end);
  let name = null;
  let description = null;

  for (let i = 0; i < fm.length; i++) {
    const line = fm[i];
    const nameMatch = line.match(/^name:\s*(.*)$/);
    if (nameMatch && name === null) {
      name = stripQuotes(nameMatch[1].trim());
      continue;
    }
    const descMatch = line.match(/^description:\s*(.*)$/);
    if (descMatch) {
      const inline = descMatch[1].trim();
      if (inline === ">" || inline === "|" || inline === ">-" || inline === "|-") {
        // Folded/literal block scalar — collect indented continuation lines.
        const collected = [];
        let j = i + 1;
        const baseIndent = (fm[j]?.match(/^(\s*)/)?.[1] ?? "").length;
        while (j < fm.length) {
          const l = fm[j];
          if (l.trim() === "") { j++; continue; }
          const indent = (l.match(/^(\s*)/)?.[1] ?? "").length;
          if (indent < baseIndent && baseIndent > 0) break;
          // Stop if we've hit a new top-level key (no leading whitespace, has a colon-key shape)
          if (indent === 0 && /^[a-zA-Z0-9_-]+:/.test(l)) break;
          collected.push(l.trim());
          j++;
        }
        description = collected.join(" ").trim();
      } else {
        description = stripQuotes(inline);
      }
    }
  }

  return { name, description, hasFrontmatter: true };
}

function stripQuotes(s) {
  if (!s) return s;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/** Truncate a description for a markdown table cell. */
export function truncate(s, max = 110) {
  if (!s) return "_(no description found)_";
  const oneLine = s.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return oneLine.slice(0, max - 1).trimEnd() + "…";
}

export function isTextFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath));
}

// setup.sh injects this exact managed block into every SKILL.md. A skill
// freshly re-copied from its source (pre-setup.sh) won't have it yet, but
// a skill already on disk from a prior install (post-setup.sh) will.
// That's a difference in *pipeline stage*, not in source content — if
// hashDir didn't normalize it away, every single update would report as
// "changed" regardless of whether the source actually changed, which is
// exactly the false-positive this hash check exists to prevent. (Found
// by testing update-skillsets.mjs for real, not by inspection — the
// first version of this script had exactly that bug.)
const CLARIFICATION_BLOCK_RE = /<!-- BEGIN dev-agent-skills clarification protocol[\s\S]*?<!-- END dev-agent-skills clarification protocol -->\n?/g;

function normalizeForHash(filePath, content) {
  if (path.basename(filePath) === "SKILL.md") {
    return content
      .replace(CLARIFICATION_BLOCK_RE, "\n")
      .replace(/\n{3,}/g, "\n\n");
  }
  return content;
}

/** Recursively walk a directory, returning absolute paths of every text file. */
export function walkTextFiles(root) {
  const results = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && isTextFile(full)) results.push(full);
    }
  }
  walk(root);
  return results;
}

/**
 * Deterministic content hash of an entire directory tree — every file's
 * relative path and (normalized) bytes, sorted by path so it doesn't
 * depend on filesystem read order. Used to tell whether re-importing a
 * skill from its source actually changed anything, vs. just re-running
 * and getting byte-identical output. SKILL.md's clarification-protocol
 * block (added by setup.sh, not by the source repo) is stripped before
 * hashing on both sides of any comparison — see normalizeForHash above.
 */
export function hashDir(root) {
  const hash = createHash("sha256");
  if (!fs.existsSync(root)) return hash.digest("hex");
  const files = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push(full);
    }
  }
  walk(root);
  files.sort();
  for (const file of files) {
    hash.update(path.relative(root, file));
    hash.update("\0");
    const raw = fs.readFileSync(file);
    const isProbablyText = isTextFile(file);
    hash.update(isProbablyText ? normalizeForHash(file, raw.toString("utf8")) : raw);
    hash.update("\0");
  }
  return hash.digest("hex");
}
