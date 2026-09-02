// skill-add/scripts/scan-skillset.mjs
//
// Tier 1 static security scan for skills entering this repo from an
// external, untrusted source (install-skillset.mjs) or being refreshed
// from one (update-skillsets.mjs, which delegates to install-skillset.mjs
// and so gets this for free).
//
// This is NOT a sandboxed execution analysis and does not follow import
// chains across files — it is a fast, deterministic, no-LLM pattern scan
// over the text content of every file a skill brings in, in the same
// spirit as validate_skill.py's structural checks: mechanical, scriptable,
// exit-code-gated, and never silently skipped. It exists to catch the
// class of attack documented against Agent Skills generally — instruction
// hijacking, remote-script execution disguised as a "required" setup
// step, credential exfiltration through outbound requests, and hidden
// Unicode — not to replace human review of a skillset before installing
// it.
//
// Deliberately reuses skill-lib.mjs's walkTextFiles/isTextFile so this
// scan sees exactly the same file set the cross-reference rewrite pass in
// install-skillset.mjs already walks — no separate notion of "which files
// count" to keep in sync.
//
// Usage (library):
//   import { scanSkillDir, scanFile } from "./scan-skillset.mjs";
//   const findings = scanSkillDir("/path/to/imported-skill");
//
// Usage (CLI, for ad-hoc checks or a CI sweep):
//   node scan-skillset.mjs <dir> [<dir> ...]
//   node scan-skillset.mjs --repo-root <skills-dir>   # scan every top-level skill

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { walkTextFiles, findTopLevelSkillDirs } from "../../scripts/skill-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Rule set
// ---------------------------------------------------------------------------
//
// Severity meanings:
//   critical / high  -> blocks the import by default (see scanSkillDir's
//                        caller in install-skillset.mjs); requires a human
//                        to explicitly override with --allow-unsafe.
//   medium           -> surfaced as a warning, does not block. Same
//                        philosophy install-skillset.mjs already applies
//                        to unresolved cross-reference warnings: loud,
//                        never silent, but not everything rises to a hard
//                        stop.
//
// Each pattern is intentionally narrow rather than broad — a rule that
// fires on ordinary skill content (a real fix-bug-style skill legitimately
// runs `curl`, legitimately mentions "instructions", legitimately embeds
// commands) produces noise that trains reviewers to click past findings.
// Matched against real content in this repo before being finalized (see
// scan-skillset.test.mjs) to keep false positives at zero against the
// existing roster.

export const RULES = [
  // --- Remote code execution ------------------------------------------------
  {
    id: "SEC-EXEC-001",
    severity: "critical",
    category: "Remote execution",
    pattern: /curl\s+(-[A-Za-z]+\s+)*\S*[^\n|]*\|\s*(sudo\s+)?(ba)?sh\b/i,
    message: "Pipes a remote download directly into a shell (curl | sh pattern).",
  },
  {
    id: "SEC-EXEC-002",
    severity: "critical",
    category: "Remote execution",
    pattern: /wget\s+(-[A-Za-z]+\s+)*\S*[^\n|]*\|\s*(sudo\s+)?(ba)?sh\b/i,
    message: "Pipes a remote download directly into a shell (wget | sh pattern).",
  },
  {
    id: "SEC-EXEC-003",
    severity: "critical",
    category: "Remote execution",
    pattern: /base64\s+(-d|--decode)\b[^\n]*\|\s*(sudo\s+)?(ba)?sh\b/i,
    message: "Decodes a base64 payload and pipes it directly into a shell.",
  },
  {
    id: "SEC-EXEC-004",
    severity: "high",
    category: "Remote execution",
    pattern: /\bnpm\s+install\s+(-g|--global)\s+(?!@?[\w.\-/]+(\s|$))/i,
    // Deliberately narrow: flags "npm install -g" followed by something
    // that isn't a plain package-name token (e.g. a $VAR, a URL, a flag
    // stack) rather than every global install, which is common and
    // legitimate in setup instructions.
    message: "Global package install with a non-literal target — worth a manual look.",
  },

  // --- Instruction hijacking / prompt injection -----------------------------
  {
    id: "SEC-INJECT-001",
    severity: "high",
    category: "Instruction hijacking",
    pattern: /ignore\s+(all\s+|any\s+)?(the\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?|prompts?)/i,
    message: "Classic instruction-override phrasing (\"ignore previous instructions\").",
  },
  {
    id: "SEC-INJECT-002",
    severity: "high",
    category: "Instruction hijacking",
    pattern: /you\s+are\s+now\s+in\s+[\w\s]{0,20}(debug|admin|elevated|unrestricted|developer|god)\s*mode/i,
    message: "Attempts to reframe the agent's operating context or privilege level.",
  },
  {
    id: "SEC-INJECT-003",
    severity: "medium",
    category: "Instruction hijacking",
    pattern: /do\s+not\s+(tell|inform|mention\s+(this|it)\s+to)\s+the\s+(user|developer|reviewer)/i,
    message: "Instructs the agent to conceal an action from the human it's working for.",
  },

  // --- Credential handling ---------------------------------------------------
  {
    id: "SEC-CRED-001",
    severity: "high",
    category: "Credential exfiltration",
    pattern: /curl\b[^\n]{0,200}(-H|--header)\s+["']?Authorization:\s*Bearer\s+\$/i,
    message: "Embeds a live credential into an outbound curl request.",
  },
  {
    id: "SEC-CRED-002",
    severity: "high",
    category: "Credential exfiltration",
    pattern: /\bcat\s+.*\.env\b[^\n]{0,80}\|\s*(curl|nc|ncat|wget)\b/i,
    message: "Reads an .env file and pipes it toward a network tool.",
  },

  // --- Hidden / obfuscated content --------------------------------------------
  {
    id: "SEC-UNICODE-001",
    severity: "medium",
    category: "Hidden content",
    // Zero-width space/joiner/non-joiner, bidi override/embedding controls,
    // BOM appearing mid-file. A legitimate skill has no reason to contain
    // these in prose or code.
    pattern: /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/,
    message: "Zero-width or bidirectional-control Unicode characters present — may render differently than it parses.",
  },

  // --- Suspicious links --------------------------------------------------------
  {
    id: "SEC-URL-001",
    severity: "medium",
    category: "Suspicious link",
    pattern: /https?:\/\/(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|buff\.ly|ow\.ly)\//i,
    message: "URL-shortener link — the real destination can't be verified from the text alone.",
  },
];

// ---------------------------------------------------------------------------
// Structural rule: front-loaded "mandatory prerequisite" framing
// ---------------------------------------------------------------------------
//
// Documented technique: rewrite a SKILL.md so a helper script is framed as
// a required first step, placed before the skill's own stated purpose, so
// an agent runs it before evaluating whether it's actually relevant to
// what the skill claims to do. This repo's own legitimate skills also use
// "before doing anything else..." framing (the injected protocol blocks),
// which is exactly why this rule looks specifically for a *script
// execution* being framed that way, in the BODY content authored by the
// skill itself — not for the phrase alone, and not inside the managed
// protocol blocks this repo injects (those are stripped before this check
// runs; see stripManagedBlocks below).
function checkFrontloadedScript(skillMdContent, filePath) {
  const findings = [];
  const firstHeadingMatch = skillMdContent.match(/\n#{1,2}\s+\S/);
  const bodyStart = firstHeadingMatch ? firstHeadingMatch.index : skillMdContent.length;
  const beforeFirstHeading = skillMdContent.slice(0, bodyStart);

  // Non-greedy, bounded spans that stop at a sentence boundary ('. ') but
  // otherwise allow any whitespace including newlines — real markdown
  // prose wraps across lines (e.g. "You must\nrun scripts/x.sh as a
  // required first step"), so excluding \n outright (an earlier version
  // of this rule did) missed exactly the wrapped phrasing real skill
  // authors write. Confirmed by testing against a fixture built from the
  // documented front-loaded-inducement technique.
  const pattern = /\b(required|mandatory|must)\b(?:(?!\.\s)[\s\S]){0,80}?\b(run|execute)\b(?:(?!\.\s)[\s\S]){0,80}?\.(sh|py|mjs|js|rb)\b/i;
  const match = beforeFirstHeading.match(pattern);
  if (match) {
    const line = skillMdContent.slice(0, match.index).split("\n").length;
    findings.push({
      id: "SEC-STRUCT-001",
      severity: "medium",
      category: "Structural",
      file: filePath,
      line,
      evidence: match[0].slice(0, 80),
      message: "A script is framed as required before the skill's own stated purpose begins — the front-loaded-inducement pattern used to disguise injected payloads as setup steps.",
    });
  }
  return findings;
}

// Strip this repo's own managed protocol blocks before scanning SKILL.md
// content. These are legitimately injected by setup.sh into every skill
// (including freshly-imported ones, after this scan has already run once
// on the raw imported content) and contain phrasing ("before doing
// anything else...") that would otherwise look identical to the injection
// pattern this scanner exists to catch. Freshly-cloned external content
// never has these blocks yet (setup.sh hasn't run), so in the normal
// install-skillset.mjs flow this is a no-op — it matters for the
// --check-security CI sweep, which scans already-set-up skills on disk.
const MANAGED_BLOCK_RE =
  /<!-- BEGIN dev-agent-skills [\s\S]*? protocol \(managed by setup\.sh[\s\S]*?<!-- END dev-agent-skills [\s\S]*? protocol -->\n?/g;

function stripManagedBlocks(content, filePath) {
  if (path.basename(filePath) !== "SKILL.md") return content;
  return content.replace(MANAGED_BLOCK_RE, "\n");
}

// ---------------------------------------------------------------------------
// Core scan functions
// ---------------------------------------------------------------------------

/** Scan a single file's content (already read) for rule matches. */
export function scanFile(filePath, rawContent) {
  const content = stripManagedBlocks(rawContent, filePath);
  const findings = [];

  for (const rule of RULES) {
    const match = content.match(rule.pattern);
    if (match) {
      const line = content.slice(0, match.index).split("\n").length;
      findings.push({
        id: rule.id,
        severity: rule.severity,
        category: rule.category,
        file: filePath,
        line,
        evidence: match[0].replace(/\s+/g, " ").trim().slice(0, 100),
        message: rule.message,
      });
    }
  }

  if (path.basename(filePath) === "SKILL.md") {
    findings.push(...checkFrontloadedScript(content, filePath));
  }

  return findings;
}

// Files this scanner never treats as scannable skill content, regardless
// of which directory it's pointed at. This matters only for the scanner's
// own implementation file, scan-skillset.mjs — it physically lives inside
// skill-add/, which is itself a top-level skill folder, and its rule
// descriptions necessarily quote the exact patterns they detect (e.g.
// "curl | sh pattern"), which would otherwise self-trigger on any sweep
// of this repo. Confirmed by testing: this is exactly what happened on
// the first real sweep, before the test suite (test/scan-skillset.test.mjs)
// and its fixtures (test/fixtures/) were moved out of skill-add/ entirely
// to keep this exclusion list as small as possible.
const SELF_EXCLUDE_BASENAMES = new Set(["scan-skillset.mjs"]);

function isSelfReferential(filePath) {
  return SELF_EXCLUDE_BASENAMES.has(path.basename(filePath));
}

/** Scan every text file under a skill's flattened destination directory. */
export function scanSkillDir(destDir) {
  const findings = [];
  for (const file of walkTextFiles(destDir)) {
    if (isSelfReferential(file)) continue;
    let content;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue; // unreadable file — not this scan's job to diagnose that
    }
    findings.push(...scanFile(file, content));
  }
  return findings;
}

export function isBlocking(finding) {
  return finding.severity === "critical" || finding.severity === "high";
}

export function formatFinding(finding, relativeTo) {
  const rel = relativeTo ? path.relative(relativeTo, finding.file) : finding.file;
  const loc = finding.line ? `${rel}:${finding.line}` : rel;
  const evidence = finding.evidence ? `  →  ${finding.evidence}` : "";
  return `  [${finding.id}] ${finding.severity.toUpperCase()}  (${finding.category})  ${loc}${evidence}\n      ${finding.message}`;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
//
// Two modes:
//   node scan-skillset.mjs <dir> [<dir> ...]     scan specific directories
//   node scan-skillset.mjs --repo-root <dir>     scan every top-level skill
//                                                  under <dir> (the
//                                                  --check-security sweep
//                                                  setup.sh's CI mode uses)
//
// Exit code 0 = no blocking findings. Exit code 1 = at least one
// critical/high finding somewhere. Medium findings never affect exit code
// on their own — they're reported, not gating, same as everywhere else
// this scanner is used.

function runCli() {
  const argv = process.argv.slice(2);
  let targets = [];

  if (argv[0] === "--repo-root") {
    const root = argv[1];
    if (!root) {
      console.error("scan-skillset.mjs --repo-root requires a path.");
      process.exit(2);
    }
    targets = findTopLevelSkillDirs(root);
    if (targets.length === 0) {
      console.log(`No skill folders found under ${root}.`);
      process.exit(0);
    }
  } else {
    targets = argv.filter((a) => !a.startsWith("--"));
    if (targets.length === 0) {
      console.error("Usage: node scan-skillset.mjs <dir> [<dir> ...]\n       node scan-skillset.mjs --repo-root <skills-dir>");
      process.exit(2);
    }
  }

  let allFindings = [];
  for (const dir of targets) {
    const abs = path.resolve(dir);
    const findings = scanSkillDir(abs).map((f) => ({ ...f, skill: path.basename(abs) }));
    allFindings.push(...findings);
  }

  const blocking = allFindings.filter(isBlocking);
  const warnings = allFindings.filter((f) => !isBlocking(f));

  if (allFindings.length === 0) {
    console.log(`✓ No security findings across ${targets.length} skill dir(s).`);
    process.exit(0);
  }

  if (blocking.length) {
    console.log(`✗ ${blocking.length} blocking finding(s):`);
    for (const f of blocking) console.log(formatFinding(f));
  }
  if (warnings.length) {
    console.log(`${blocking.length ? "\n" : ""}⚠ ${warnings.length} non-blocking finding(s):`);
    for (const f of warnings) console.log(formatFinding(f));
  }

  process.exit(blocking.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
