#!/usr/bin/env node
// scripts/install-skillset.mjs
//
// Does the actual work for `install-skillset.sh`. Given a directory that's
// already a clone of some external skillset repo, this:
//
//   1. Finds every SKILL.md under it, at any depth (external skillsets are
//      not guaranteed to be flat — e.g. obra/superpowers-skills nests every
//      skill under skills/<category>/<skill-name>/SKILL.md).
//   2. Flattens each into its own folder at the dev-agent-skills repo root
//      (the convention CONTRIBUTING.md already documents: one folder per
//      skill, SKILL.md at its root) — because that's the layout setup.sh's
//      discovery loop and everything downstream of it already understands.
//   3. Detects collisions against what's already at the repo root, and
//      against a persisted manifest (.skillsets.json) of what was imported
//      by a previous run of this same script, so re-running an install for
//      the same source repo updates in place instead of refusing.
//   4. Rewrites cross-skill path references inside the copied files where
//      it can resolve them (e.g. a superpowers skill pointing at
//      `skills/collaboration/brainstorming` gets rewritten to whatever that
//      skill's flattened folder is actually named here) and flags, loudly,
//      anything it could not resolve — never silently drops a reference.
//   5. Writes/updates .skillsets.json (machine-readable provenance) and
//      appends a human-readable entry to SKILLSETS.md.
//   6. Regenerates the README skills table (delegates to regen-readme.mjs).
//
// This script does not touch git, does not clone anything, and does not
// run setup.sh — install-skillset.sh (the bash wrapper) does all of that
// around it. Keeping the clone/cleanup/git plumbing in bash and the
// discovery/copy/rewrite logic in Node is a deliberate split: string and
// path handling in bash for arbitrary external repo content is exactly the
// kind of thing that silently mishandles an edge case.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  findSkillMdFiles,
  walkTextFiles,
  hashDir,
} from "./skill-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { only: null, prefix: null, subdir: "", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--clone-dir") args.cloneDir = argv[++i];
    else if (a === "--skills-dir") args.skillsDir = argv[++i];
    else if (a === "--repo-url") args.repoUrl = argv[++i];
    else if (a === "--commit") args.commit = argv[++i];
    else if (a === "--ref") args.ref = argv[++i];
    else if (a === "--subdir") args.subdir = argv[++i] || "";
    else if (a === "--prefix") args.prefix = argv[++i] || null;
    else if (a === "--only") args.only = (argv[++i] || "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--result-file") args.resultFile = argv[++i];
  }
  for (const required of ["cloneDir", "skillsDir", "repoUrl", "commit"]) {
    if (!args[required]) {
      console.error(`install-skillset.mjs: missing required --${required.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}`);
      process.exit(1);
    }
  }
  return args;
}

function loadManifest(skillsDir) {
  const manifestPath = path.join(skillsDir, ".skillsets.json");
  if (!fs.existsSync(manifestPath)) return { skillsets: [] };
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    console.error("  ⚠️  .skillsets.json exists but isn't valid JSON — starting a fresh manifest rather than guessing. The old file is left in place; check it by hand if it had useful history.");
    return { skillsets: [] };
  }
}

function saveManifest(skillsDir, manifest) {
  fs.writeFileSync(path.join(skillsDir, ".skillsets.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

/** Who, if anyone, currently owns `finalName` at the repo root? */
function findOwner(manifest, finalName) {
  for (const entry of manifest.skillsets) {
    if (entry.imported_skills?.some((s) => s.final_name === finalName)) {
      return entry;
    }
  }
  return null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const searchRoot = args.subdir ? path.join(args.cloneDir, args.subdir) : args.cloneDir;

  if (!fs.existsSync(searchRoot)) {
    console.error(`install-skillset.mjs: subdir "${args.subdir}" not found in the cloned repo (looked for ${searchRoot}).`);
    process.exit(1);
  }

  const skillMdFiles = findSkillMdFiles(searchRoot);
  if (skillMdFiles.length === 0) {
    console.error(`install-skillset.mjs: no SKILL.md files found under ${searchRoot}. Nothing to install. (If the skills live in a subdirectory of this repo, pass --subdir.)`);
    process.exit(1);
  }

  const manifest = loadManifest(args.skillsDir);

  // ---- Pass 1: identify candidates, resolve names, decide skip/import/update ----
  const candidates = skillMdFiles.map((skillMdPath) => {
    const skillDir = path.dirname(skillMdPath);
    const relFromSearchRoot = path.relative(searchRoot, skillDir).split(path.sep).join("/");
    const baseName = path.basename(skillDir);
    return { skillDir, relFromSearchRoot, baseName };
  });

  const imported = [];
  const skipped = [];
  const seenFinalNames = new Set();

  for (const c of candidates) {
    if (args.only && !args.only.includes(c.baseName)) {
      continue; // not requested via --only, silently excluded (not a "skip")
    }
    const finalName = args.prefix ? `${args.prefix}-${c.baseName}` : c.baseName;

    if (seenFinalNames.has(finalName)) {
      skipped.push({ ...c, finalName, reason: `duplicate name within this same source repo (two skills both resolve to "${finalName}" — use --prefix or rename one upstream)` });
      continue;
    }

    const destDir = path.join(args.skillsDir, finalName);
    const existsOnDisk = fs.existsSync(destDir);
    const owner = findOwner(manifest, finalName);

    if (existsOnDisk && !owner) {
      skipped.push({ ...c, finalName, reason: `"${finalName}" already exists at the repo root and isn't tracked as something this script imported — looks like a hand-authored or differently-sourced skill. Use --prefix to avoid the collision.` });
      continue;
    }
    if (existsOnDisk && owner && owner.source_repo !== args.repoUrl) {
      skipped.push({ ...c, finalName, reason: `"${finalName}" was previously imported from a different source (${owner.source_repo}) — use --prefix to avoid overwriting a different skillset's skill.` });
      continue;
    }

    seenFinalNames.add(finalName);
    imported.push({ ...c, finalName, destDir, isUpdate: existsOnDisk && owner != null });
  }

  if (imported.length === 0) {
    console.log("Nothing to import (everything matched was skipped or excluded by --only). See above for reasons.");
    if (skipped.length) printSkipped(skipped);
    if (args.resultFile) {
      fs.writeFileSync(args.resultFile, JSON.stringify({
        repoUrl: args.repoUrl, subdir: args.subdir || null, prefix: args.prefix || null,
        commit: args.commit, anyChanged: false, imported: [],
        skipped: skipped.map((s) => ({ baseName: s.baseName, reason: s.reason })),
      }, null, 2), "utf8");
    }
    process.exit(0);
  }

  console.log(`Found ${candidates.length} skill(s) in the source repo; importing ${imported.length}, skipping ${skipped.length}.`);

  if (args.dryRun) {
    console.log("\n--dry-run: would import:");
    for (const s of imported) console.log(`  ${s.isUpdate ? "update" : "new   "}  ${s.relFromSearchRoot}  ->  ${s.finalName}/`);
    if (skipped.length) printSkipped(skipped);
    if (args.resultFile) {
      fs.writeFileSync(args.resultFile, JSON.stringify({
        repoUrl: args.repoUrl, subdir: args.subdir || null, prefix: args.prefix || null,
        commit: args.commit, anyChanged: null, dryRun: true,
        imported: imported.map((s) => ({ finalName: s.finalName, isUpdate: s.isUpdate })),
        skipped: skipped.map((s) => ({ baseName: s.baseName, reason: s.reason })),
      }, null, 2), "utf8");
    }
    process.exit(0);
  }

  // ---- Pass 2: copy ----
  for (const s of imported) {
    s.beforeHash = s.isUpdate ? hashDir(s.destDir) : null;
    if (fs.existsSync(s.destDir)) fs.rmSync(s.destDir, { recursive: true, force: true });
    fs.cpSync(s.skillDir, s.destDir, { recursive: true });
  }

  // ---- Pass 3: rewrite cross-skill references ----
  // Map every *relative path the source repo would have used to refer to
  // one of its own skills* -> the flattened final name it has here now.
  // Covers the shapes seen in practice: a bare relative path from the
  // search root ("collaboration/brainstorming"), the same path with the
  // source repo's own subdir prepended ("skills/collaboration/brainstorming"
  // — how references are actually written in the wild, since they're
  // relative to the repo root, not to the subdir we searched under), and
  // either of those with a trailing "/SKILL.md".
  const pathToFinalName = new Map();
  for (const s of imported) {
    pathToFinalName.set(s.relFromSearchRoot, s.finalName);
    pathToFinalName.set(s.relFromSearchRoot + "/SKILL.md", s.finalName + " skill");
    if (args.subdir) {
      const withSubdir = `${args.subdir}/${s.relFromSearchRoot}`;
      pathToFinalName.set(withSubdir, s.finalName);
      pathToFinalName.set(withSubdir + "/SKILL.md", s.finalName + " skill");
    }
  }
  // Also include skipped-but-present candidates as "known, not imported"
  // so references to them resolve to a clear no-op rather than triggering
  // a confusing leftover-reference warning with no context.
  for (const s of skipped) {
    if (!pathToFinalName.has(s.relFromSearchRoot)) {
      pathToFinalName.set(s.relFromSearchRoot, null);
    }
  }

  // Longest-pattern-first: otherwise the bare "collaboration/x" pattern
  // would consume part of "skills/collaboration/x" before the more
  // specific, fully-resolving subdir-prefixed pattern gets a chance to
  // match the whole thing — which would leave a stale "skills/" prefix
  // behind that doesn't exist on disk in the flattened layout.
  const rewritePatterns = [...pathToFinalName.entries()]
    .filter(([, finalName]) => finalName !== null)
    .sort((a, b) => b[0].length - a[0].length);

  const LOCKFILE_NAMES = new Set(["package-lock.json", "yarn.lock", "pnpm-lock.yaml"]);

  const rewriteWarnings = [];
  for (const s of imported) {
    const files = walkTextFiles(s.destDir).filter((f) => !LOCKFILE_NAMES.has(path.basename(f)));
    for (const file of files) {
      let content = fs.readFileSync(file, "utf8");
      let changed = false;

      for (const [relPath, finalName] of rewritePatterns) {
        const rootVarPattern = new RegExp(`\\$\\{[A-Z0-9_]+\\}\\/${escapeRegExp(relPath)}(\\/SKILL\\.md)?`, "g");
        if (rootVarPattern.test(content)) {
          content = content.replace(rootVarPattern, finalName);
          changed = true;
        }
        const barePattern = new RegExp(`(?<![\\w-])${escapeRegExp(relPath)}(\\/SKILL\\.md)?(?![\\w-])`, "g");
        if (barePattern.test(content)) {
          content = content.replace(barePattern, finalName);
          changed = true;
        }
      }

      if (changed) fs.writeFileSync(file, content, "utf8");

      // Second scan, post-rewrite: anything that still looks like an
      // unresolved cross-skill reference. Deliberately narrow — only
      // things that explicitly start with the source repo's own
      // skills-subdir convention, since a generic "word/word/word"
      // pattern also matches ordinary prose (e.g. "investigate/ask/
      // proceed"), shell shebangs, and npm lockfile registry paths, none
      // of which are skill references.
      const skillsPrefix = args.subdir || "skills";
      const leftoverPattern = new RegExp(`\\b${escapeRegExp(skillsPrefix)}\\/[a-z0-9_-]+(?:\\/[a-z0-9_-]+)+\\b`, "g");
      const leftover = content.match(leftoverPattern) || [];
      for (const hit of leftover) {
        rewriteWarnings.push({ file: path.relative(args.skillsDir, file), hit, skill: s.finalName });
      }
    }
  }

  // ---- Pass 4: manifest + human log ----
  const now = new Date().toISOString();
  const entry = {
    source_repo: args.repoUrl,
    ref: args.ref || null,
    commit: args.commit,
    subdir: args.subdir || null,
    prefix: args.prefix || null,
    imported_skills: imported.map((s) => ({ final_name: s.finalName, source_path: s.relFromSearchRoot })),
    installed_at: now,
  };
  // If this exact (repo, subdir, prefix) combo was already in the manifest,
  // update that entry in place rather than appending a duplicate history row.
  const existingIdx = manifest.skillsets.findIndex(
    (e) => e.source_repo === args.repoUrl && (e.subdir || null) === (args.subdir || null) && (e.prefix || null) === (args.prefix || null)
  );
  if (existingIdx >= 0) manifest.skillsets[existingIdx] = entry;
  else manifest.skillsets.push(entry);
  saveManifest(args.skillsDir, manifest);

  appendHumanLog(args.skillsDir, entry, imported, skipped);

  // ---- Pass 5: README ----
  try {
    execFileSync(process.execPath, [path.join(__dirname, "regen-readme.mjs"), args.skillsDir], { stdio: "inherit" });
  } catch (e) {
    console.error("  ⚠️  could not run regen-readme.mjs automatically:", e.message, "— run it by hand: node scripts/regen-readme.mjs");
  }

  // ---- Summary ----
  console.log(`\n✓ Imported ${imported.length} skill(s) from ${args.repoUrl}${args.subdir ? `:${args.subdir}` : ""} @ ${args.commit.slice(0, 10)}`);
  let anyChanged = false;
  for (const s of imported) {
    if (!s.isUpdate) {
      s.changed = true;
      anyChanged = true;
      console.log(`  new      ${s.finalName}/  (from ${s.relFromSearchRoot})`);
      continue;
    }
    const afterHash = hashDir(s.destDir);
    s.changed = afterHash !== s.beforeHash;
    if (s.changed) anyChanged = true;
    console.log(`  ${s.changed ? "updated  " : "unchanged"} ${s.finalName}/  (from ${s.relFromSearchRoot})${s.changed ? "" : " — content identical, nothing to update"}`);
  }

  if (args.resultFile) {
    fs.writeFileSync(args.resultFile, JSON.stringify({
      repoUrl: args.repoUrl,
      subdir: args.subdir || null,
      prefix: args.prefix || null,
      commit: args.commit,
      anyChanged,
      imported: imported.map((s) => ({ finalName: s.finalName, isUpdate: s.isUpdate, changed: s.changed })),
      skipped: skipped.map((s) => ({ baseName: s.baseName, reason: s.reason })),
    }, null, 2), "utf8");
  }

  if (skipped.length) printSkipped(skipped);

  if (rewriteWarnings.length) {
    console.log(`\n⚠️  ${rewriteWarnings.length} unresolved cross-reference(s) found in imported content — these point at a skill (or skills/-prefixed path) this script didn't recognize as something it just imported. Could be a skill excluded by --only, a reference to a skill that wasn't in this skillset at all, or just a doc path. Worth a manual look before relying on the affected skills:`);
    const byFile = new Map();
    for (const w of rewriteWarnings) {
      if (!byFile.has(w.file)) byFile.set(w.file, []);
      byFile.get(w.file).push(w.hit);
    }
    for (const [file, hits] of byFile) {
      console.log(`  ${file}: ${[...new Set(hits)].join(", ")}`);
    }
  }
}

function printSkipped(skipped) {
  console.log(`\nSkipped ${skipped.length}:`);
  for (const s of skipped) console.log(`  ${s.baseName} (${s.relFromSearchRoot}) — ${s.reason}`);
}

function appendHumanLog(skillsDir, entry, imported, skipped) {
  const logPath = path.join(skillsDir, "SKILLSETS.md");
  const header = "# Installed skillsets\n\nProvenance log of every external skillset pulled into this repo with `install-skillset.sh`. Machine-readable version: `.skillsets.json`. Don't hand-edit either — re-run the installer to update an entry.\n";
  let content = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : header;

  const lines = [
    `\n## ${entry.source_repo}${entry.subdir ? `:${entry.subdir}` : ""}`,
    `- Installed: ${entry.installed_at}`,
    `- Commit: \`${entry.commit}\``,
    entry.ref ? `- Ref: \`${entry.ref}\`` : null,
    entry.prefix ? `- Prefix: \`${entry.prefix}-\`` : null,
    `- Imported (${imported.length}): ${imported.map((s) => `\`${s.finalName}\``).join(", ")}`,
    skipped.length ? `- Skipped (${skipped.length}): ${skipped.map((s) => `\`${s.baseName}\` (${s.reason})`).join("; ")}` : null,
  ].filter(Boolean);

  fs.writeFileSync(logPath, content.trimEnd() + "\n" + lines.join("\n") + "\n", "utf8");
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main();
