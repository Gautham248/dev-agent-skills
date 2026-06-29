#!/usr/bin/env node
// scripts/regen-readme.mjs
//
// Rebuilds the skills table in README.md from whatever skill folders
// actually exist at the repo root right now — same discovery logic
// setup.sh uses to decide what to symlink. This is what keeps the README
// honest whether a skill arrived by hand (CONTRIBUTING.md flow) or via
// install-skillset.sh.
//
// The table lives inside a managed block, the same idempotent-marker
// pattern setup.sh already uses for the clarification-protocol injection:
// everything between the markers is regenerated every run; everything
// outside them (the rest of the README) is left alone. If the markers
// don't exist yet, they're inserted right after the first "## Skills"
// heading (replacing a pre-existing hand-written table there, if any —
// a one-time migration on the first run); if there's no such heading,
// they're appended to the end of the file with a warning.
//
// Usage: node scripts/regen-readme.mjs [path/to/dev-agent-skills]
// Defaults to the directory two levels up from this script.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findTopLevelSkillDirs, parseSkillFrontmatter, truncate } from "./skill-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillsDir = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const readmePath = path.join(skillsDir, "README.md");

const BEGIN = "<!-- BEGIN dev-agent-skills skills table (managed by scripts/regen-readme.mjs -- do not edit this block by hand, edit the source SKILL.md instead and re-run setup.sh) -->";
const END = "<!-- END dev-agent-skills skills table -->";

function buildTable(skillsDir) {
  const dirs = findTopLevelSkillDirs(skillsDir);
  if (dirs.length === 0) {
    return "_(no skills found at the repo root yet)_";
  }
  const rows = dirs.map((dir) => {
    const folderName = path.basename(dir);
    const meta = parseSkillFrontmatter(path.join(dir, "SKILL.md"));
    const desc = truncate(meta.description);
    return `| [\`${folderName}\`](./${folderName}/) | ${desc} |`;
  });
  return ["| Skill | What it does |", "|---|---|", ...rows].join("\n");
}

function regenerate() {
  if (!fs.existsSync(readmePath)) {
    console.error(`  ⚠️  regen-readme: no README.md found at ${readmePath} — skipping.`);
    return;
  }
  const original = fs.readFileSync(readmePath, "utf8");
  const table = buildTable(skillsDir);
  const block = `${BEGIN}\n${table}\n${END}`;

  let updated;
  if (original.includes(BEGIN) && original.includes(END)) {
    const beginIdx = original.indexOf(BEGIN);
    const endIdx = original.indexOf(END) + END.length;
    updated = original.slice(0, beginIdx) + block + original.slice(endIdx);
  } else {
    const headingMatch = original.match(/^##\s+Skills\s*$/m);
    if (headingMatch) {
      // First-time migration case: there is likely a hand-written markdown
      // table sitting right after the heading already (the pre-automation
      // README). Consume it — blank lines, then consecutive `|`-prefixed
      // table lines — so the managed block replaces it instead of just
      // being inserted above a now-duplicate copy.
      const after = original.slice(headingMatch.index + headingMatch[0].length);
      const lines = after.split(/\r?\n/);
      let i = 0;
      while (i < lines.length && lines[i].trim() === "") i++;
      let consumedTable = false;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        i++;
        consumedTable = true;
      }
      while (i < lines.length && lines[i].trim() === "") i++;
      const restAfterTable = lines.slice(i).join("\n");
      const insertAt = headingMatch.index + headingMatch[0].length;
      updated = original.slice(0, insertAt) + "\n\n" + block + "\n\n" + restAfterTable.replace(/^\n+/, "");
      if (consumedTable) {
        console.log("  ℹ️  regen-readme: replaced a pre-existing hand-written table under '## Skills' with the managed block (one-time migration).");
      }
    } else {
      console.error("  ⚠️  regen-readme: no '## Skills' heading found — appending managed block to end of README.md instead. Consider moving it under a '## Skills' section by hand.");
      updated = original.trimEnd() + "\n\n## Skills\n\n" + block + "\n";
    }
  }

  if (updated !== original) {
    fs.writeFileSync(readmePath, updated, "utf8");
    console.log(`  ✓ README.md skills table — regenerated (${findTopLevelSkillDirs(skillsDir).length} skills)`);
  } else {
    console.log(`  ✓ README.md skills table — already up to date (${findTopLevelSkillDirs(skillsDir).length} skills)`);
  }
}

regenerate();
