#!/usr/bin/env node
// skill-update/scripts/update-skillsets.mjs
//
// Reads .skillsets.json (the record install-skillset.sh already keeps of
// every external skillset that's been pulled in) and, for each entry,
// re-clones its source at the latest commit and refreshes the previously-
// imported skills in place if anything changed upstream.
//
// This deliberately does NOT re-discover skills that exist upstream but
// were never imported here (e.g. something added to the source repo
// after your last install, or something you excluded with --only the
// first time) — pass --include-new for that. Default behavior is "bring
// what I already have up to date", not "expand what I have automatically",
// since adding skills nobody asked for is exactly the kind of silent
// behavior this whole repo's clarification/confirmation culture exists to
// avoid.
//
// Reuses install-skillset.mjs entirely for the actual copy/rewrite/
// manifest logic — this script's only job is: read the manifest, loop
// over entries, clone each source, decide whether a refresh is needed,
// and report a clear summary. setup.sh runs once at the end, not once
// per skillset, so a multi-skillset update doesn't re-symlink/re-inject
// repeatedly.
//
// Usage:
//   node skill-update/scripts/update-skillsets.mjs [--source <git-url-substring>]
//                                      [--dry-run] [--skip-setup] [--include-new]

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.resolve(__dirname, "../..");
const INSTALL_MJS = path.join(__dirname, "../../skill-add/scripts/install-skillset.mjs");
const SETUP_SH = path.join(SKILLS_DIR, "setup.sh");
const MANIFEST_PATH = path.join(SKILLS_DIR, ".skillsets.json");

function parseArgs(argv) {
  const args = { source: null, dryRun: false, skipSetup: false, includeNew: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--source") args.source = argv[++i];
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--skip-setup") args.skipSetup = true;
    else if (a === "--include-new") args.includeNew = true;
    else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    }
  }
  return args;
}

function printHelp() {
  console.log(`update-skillsets.mjs — refresh every (or one) tracked external skillset from its source

Usage:
  node skill-update/scripts/update-skillsets.mjs [options]

Options:
  --source <substring>   Only update skillsets whose source_repo contains this
                          substring (e.g. --source superpowers). Default: all.
  --include-new           Also import skills that exist in the source repo but
                          weren't imported before (new upstream skills, or ones
                          you excluded with --only last time). Default: only
                          refresh what's already here.
  --dry-run               Check for upstream changes and report them without
                          touching the filesystem.
  --skip-setup            Don't run setup.sh at the end even if something changed.
`);
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    console.error(`✗ ${MANIFEST_PATH} exists but isn't valid JSON — can't safely determine what's tracked. Fix or remove it by hand before updating.`);
    process.exit(1);
  }
}

function cloneShallow(repoUrl, ref) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skillset-update-"));
  const cloneArgs = ["clone", "--depth", "1"];
  if (ref) cloneArgs.push("--branch", ref);
  cloneArgs.push(repoUrl, dir, "--quiet");
  execFileSync("git", cloneArgs, { stdio: ["ignore", "ignore", "inherit"] });
  const commit = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  return { dir, commit };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const manifest = loadManifest();
  if (!manifest || !manifest.skillsets?.length) {
    console.log("No tracked skillsets found (.skillsets.json is missing or empty) — nothing to update. Use install-skillset.sh to install one first.");
    process.exit(0);
  }

  let entries = manifest.skillsets;
  if (args.source) {
    entries = entries.filter((e) => e.source_repo.includes(args.source));
    if (entries.length === 0) {
      console.log(`No tracked skillset matches "${args.source}". Tracked sources:`);
      for (const e of manifest.skillsets) console.log(`  ${e.source_repo}${e.subdir ? `:${e.subdir}` : ""}`);
      process.exit(1);
    }
  }

  console.log(`Checking ${entries.length} tracked skillset(s) for upstream changes...\n`);

  const report = []; // { entry, oldCommit, newCommit, upToDate, result }
  let anyChanged = false;

  for (const entry of entries) {
    const label = `${entry.source_repo}${entry.subdir ? `:${entry.subdir}` : ""}`;
    let cloned;
    try {
      cloned = cloneShallow(entry.source_repo, entry.ref);
    } catch (e) {
      console.log(`✗ ${label} — failed to clone (${e.message.split("\n")[0]}). Skipping.`);
      report.push({ entry, label, error: true });
      continue;
    }

    const upToDate = cloned.commit === entry.commit && !args.includeNew;
    if (upToDate) {
      console.log(`✓ ${label} — already at the latest pulled commit (${entry.commit.slice(0, 10)}), nothing to check further.`);
      fs.rmSync(cloned.dir, { recursive: true, force: true });
      report.push({ entry, label, upToDate: true });
      continue;
    }

    console.log(`→ ${label} — ${cloned.commit === entry.commit ? "same commit, re-checking with --include-new" : `new commit available (${entry.commit.slice(0, 10)} -> ${cloned.commit.slice(0, 10)})`}`);

    const only = args.includeNew ? null : entry.imported_skills.map((s) => path.posix.basename(s.source_path));
    const resultFile = path.join(cloned.dir, "..", `result-${path.basename(cloned.dir)}.json`);

    const nodeArgs = [
      INSTALL_MJS,
      "--clone-dir", cloned.dir,
      "--skills-dir", SKILLS_DIR,
      "--repo-url", entry.source_repo,
      "--commit", cloned.commit,
      "--result-file", resultFile,
    ];
    if (entry.subdir) nodeArgs.push("--subdir", entry.subdir);
    if (entry.prefix) nodeArgs.push("--prefix", entry.prefix);
    if (entry.ref) nodeArgs.push("--ref", entry.ref);
    if (only) nodeArgs.push("--only", only.join(","));
    if (args.dryRun) nodeArgs.push("--dry-run");

    try {
      execFileSync(process.execPath, nodeArgs, { stdio: "inherit" });
    } catch (e) {
      console.log(`✗ ${label} — install-skillset.mjs failed: ${e.message.split("\n")[0]}`);
      report.push({ entry, label, error: true });
      fs.rmSync(cloned.dir, { recursive: true, force: true });
      continue;
    }

    let result = null;
    if (fs.existsSync(resultFile)) {
      try { result = JSON.parse(fs.readFileSync(resultFile, "utf8")); } catch { /* leave null */ }
      fs.rmSync(resultFile, { force: true });
    }
    fs.rmSync(cloned.dir, { recursive: true, force: true });

    if (result?.anyChanged) anyChanged = true;
    report.push({ entry, label, upToDate: false, result });
  }

  // ---- Final summary ----
  console.log("\n" + "─".repeat(60));
  console.log("Update summary:");
  for (const r of report) {
    if (r.error) {
      console.log(`  ✗ ${r.label} — failed, see above`);
    } else if (r.upToDate) {
      console.log(`  =  ${r.label} — already up to date`);
    } else if (args.dryRun) {
      console.log(`  →  ${r.label} — would refresh (--dry-run, nothing written)`);
    } else if (r.result?.anyChanged) {
      const changedSkills = r.result.imported.filter((s) => s.changed).map((s) => s.finalName);
      console.log(`  ↑  ${r.label} — updated, ${changedSkills.length} skill(s) actually changed: ${changedSkills.join(", ")}`);
    } else {
      console.log(`  =  ${r.label} — new commit pulled, but content identical to what's already here`);
    }
  }

  if (args.dryRun) {
    console.log("\n(--dry-run: nothing was written. Re-run without --dry-run to actually update.)");
    return;
  }

  if (anyChanged && !args.skipSetup) {
    console.log("\nRunning setup.sh once to re-symlink/refresh anything that changed...\n");
    execFileSync("bash", [SETUP_SH], { stdio: "inherit" });
  } else if (anyChanged && args.skipSetup) {
    console.log("\nSomething changed — run 'bash setup.sh' when ready (skipped automatically per --skip-setup).");
  } else {
    console.log("\nNothing changed — no need to re-run setup.sh.");
  }

  console.log("\nReview the diff, then commit:");
  console.log('  git add -A && git commit -m "update: refresh tracked skillsets"');
}

main();
