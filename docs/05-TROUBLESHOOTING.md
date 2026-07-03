# Troubleshooting Guide

Every issue here has been observed in real usage. The entries are ordered from most to least common.

---

## Setup issues

### `setup.sh` runs but OpenCode doesn't pick up AGENT-STANDING-RULES.md

**Symptom:** The OpenCode session doesn't follow Rules 0–4. The agent explores the codebase by grepping instead of querying the graph. Asking "what does Rule 1 say?" gets a made-up answer.

**Diagnosis:**
```bash
cat ~/.config/opencode/opencode.json | grep -A2 "instructions"
```
If the path in `instructions[]` is wrong (wrong location, old location from before a repo move), that's the cause.

**Fix:**
```bash
# Re-run setup.sh from the current repo location
cd ~/10xMinds/AI-Dev-Agent/dev-agent-skills
bash setup.sh

# Re-check
cat ~/.config/opencode/opencode.json | grep -A2 "instructions"
# Path should now match the current SKILLS_DIR
```

**If `jq` is not installed:**
```bash
# Install jq
sudo apt-get install jq     # Ubuntu/Debian
brew install jq             # macOS

# Then re-run setup
bash setup.sh
```

---

### Protocol blocks missing from some skills after setup.sh

**Symptom:** Some `SKILL.md` files have the protocol blocks, others don't. `setup.sh` output shows "skipped N (no frontmatter)".

**Diagnosis:**
```bash
# Find which skills have no frontmatter
for dir in */; do
  if [ -f "${dir}SKILL.md" ]; then
    if ! grep -q '^---$' "${dir}SKILL.md"; then
      echo "${dir}: NO FRONTMATTER"
    fi
  fi
done
```

**Fix:** Add YAML frontmatter to each affected skill's `SKILL.md`:
```markdown
---
name: your-skill-name
description: >
  Use when... [describe trigger phrases]
---
```

Then re-run `bash setup.sh`.

---

### Symlinks are broken after moving the repo

**Symptom:** `ls -la ~/.claude/skills/fix-bug` shows a broken symlink (arrow pointing to a path that doesn't exist).

**Diagnosis:**
```bash
ls -la ~/.claude/skills/ | grep -v "^total" | grep " -> " | while read -r line; do
  target=$(echo "$line" | awk '{print $NF}')
  [ -e "$target" ] || echo "BROKEN: $target"
done
```

**Fix:**
```bash
# Remove broken links (they'll be recreated by setup.sh)
find ~/.claude/skills ~/.config/opencode/skills ~/.codex/skills -type l ! -e -delete 2>/dev/null

# Re-run setup from new location
cd /new/location/dev-agent-skills
bash setup.sh
```

---

### Hermes doesn't see the skills

**Symptom:** `hermes skills list` doesn't show the skills from this repo. Or Hermes says a skill doesn't exist when you try to use it.

**Diagnosis:**
```bash
cat ~/.hermes/config.yaml | grep -A5 "external_dirs"
```

If `dev-agent-skills` path is missing:

**Fix:**
```bash
bash setup.sh
# setup.sh will append the path to external_dirs
```

If the path is present but wrong:
```bash
# Edit config.yaml directly
nano ~/.hermes/config.yaml
# Update the path under skills.external_dirs to the correct current location
```

---

## Usage issues

### Agent skips the graph step

**Symptom:** First response includes `grep`, `find`, or file browsing instead of mentioning `graphify-out/graph.json`.

**Root cause options:**
1. OpenCode isn't loading `AGENT-STANDING-RULES.md` (see first troubleshooting entry above)
2. The session is Hermes and the skill name wasn't explicit in the prompt
3. The `graphify` skill isn't installed

**Fix for option 1:** Verify and fix OpenCode config as above.

**Fix for option 2:** Always name the skill explicitly in Hermes prompts:
```
Use the fix-bug skill, following AGENT-STANDING-RULES.md, to fix the broken link.
```

**Fix for option 3:**
```bash
hermes skills list | grep graphify
# If missing, install graphify skill per its own setup instructions
```

**Mid-session recovery:** Interrupt and say:
```
Stop. Before investigating, run: test -f graphify-out/graph.json && echo "GRAPH EXISTS" || echo "NO GRAPH YET"
Then follow Rule 1 from AGENT-STANDING-RULES.md.
```

---

### Agent presents the plan and then acts immediately without waiting

**Symptom:** Plan appears and changes are already made in the same message, or within seconds.

**Root cause:** The agent treated the plan presentation as a formality rather than a genuine stop.

**Recovery:**
```bash
git checkout -- .    # revert all unstaged changes
```

Then re-prompt with explicit scope control:
```
Load the fix-bug skill. Before making any changes, present your plan. 
Wait for my explicit "yes, go ahead" before touching any file.
```

**Prevention:** Avoid phrases like "just do it" or "go ahead and fix this" in the initial prompt — these can be interpreted as pre-authorization for the plan step.

---

### Agent asks for a file path or line number

**Symptom:** "Which file should I modify?" or "What line is the issue on?"

**Root cause:** Either the graph query returned no useful results, or the request was genuinely too vague for the agent to identify candidates.

**What to do:** Give more context about the symptom, not the file:
```
The broken link is the App Store button — it's on the main homepage,
in the hero section at the top of the page, the big button that says "Download on App Store."
```

The agent should be able to find the file from a symptom description. If it truly cannot after investigation, it should say "I found N candidates, which one?" — not "please give me the path." If it's asking for the path directly without investigating first, that's a protocol violation; say:
```
Investigate first using the knowledge graph before asking me for file paths.
```

---

### Hermes loads the wrong skill or no skill

**Symptom:** You asked to fix a bug and the agent responded with general advice instead of following the `fix-bug` skill's step-by-step process.

**Root cause:** Hermes does not auto-select skills based on natural language. The skill name must be explicitly mentioned in the prompt.

**Fix:** Always be explicit with Hermes:
```
Use the fix-bug skill to fix the broken App Store link on the homepage.
```
or:
```
Follow the fix-bug skill for this: [description of bug]
```

---

### Self-improvement entries appearing after every session

**Symptom:** `references/edge-cases.md` grows with a new entry after every session, including routine ones where nothing unusual happened.

**Root cause:** The agent is recording routine operation rather than genuine edge cases — a violation of the self-improvement protocol's own anti-patterns.

**Fix:** Delete the spurious entries manually:
```bash
nano fix-bug/references/edge-cases.md
# Remove any entry that describes routine workflow rather than a genuine gap
```

Then in the next session, if you see the agent about to write a self-improvement entry, verify it first:
```
Before writing to edge-cases.md, tell me what the edge case is and why 
it qualifies under SELF-IMPROVEMENT-PROTOCOL.md's criteria.
```

---

### `skill-add` fails with "no SKILL.md files found"

**Symptom:**
```
install-skillset.mjs: no SKILL.md files found under /tmp/xyz. Nothing to install.
```

**Root cause:** The source repo organizes skills under a subdirectory, and you didn't pass `--subdir`.

**Fix:**
```bash
# First, find where the SKILL.md files actually are:
git clone --depth 1 <url> /tmp/check-skills && find /tmp/check-skills -name SKILL.md
# Note the common ancestor directory and pass it as --subdir:
/skill-add <url> --subdir <that-directory> [--prefix <name>]
```

---

### `skill-add` skips all skills with "already exists" message

**Symptom:**
```
Skipped: brainstorming — "brainstorming" already exists at the repo root and isn't tracked...
```

**Root cause:** You have a hand-authored skill with the same name, or a previous import from a different source.

**Fix:** Use `--prefix` to give the imported skills a distinct namespace:
```
/skill-add <url> --subdir skills --prefix myprefix
```

---

### `skill-update` reports "already up to date" but the skill content seems stale

**Symptom:** You know upstream has changed the skill content, but the update command says nothing to do.

**Root cause (most likely):** The upstream repo has the changed content on a branch, not on the default branch — and your original install didn't pin a `--ref`.

**Diagnosis:**
```bash
cat .skillsets.json | python3 -c "
import json, sys
d = json.load(sys.stdin)
for s in d['skillsets']:
    print('ref:', s.get('ref'), 'commit:', s['commit'][:12])
"
```

**Fix (if you need to track a specific branch):** Re-import with `--ref`:
```
/skill-add <url> --subdir <subdir> --prefix <prefix> --ref <branch-name>
```

**Root cause (less likely):** The `commit` field in `.skillsets.json` was manually edited or got out of sync.

**Fix:**
```
# Force a full content re-check regardless of commit SHA:
/skill-update --include-new
```

---

### Protocol blocks have wrong absolute paths after a re-clone

**Symptom:** Protocol pointer block inside `SKILL.md` says:
```
/home/oldmachine/dev-agent-skills/config/CLARIFICATION-PROTOCOL.md
```
But the repo is now at a different path.

**Root cause:** `setup.sh` wasn't re-run after the re-clone.

**Fix:**
```bash
bash setup.sh
```

The injection step strips and rebuilds the blocks fresh every run, using the current `SKILLS_DIR` path. One run of `setup.sh` self-corrects all paths in all skills.

---

### README skills table is out of date

**Symptom:** `README.md` doesn't list a skill you know exists in the repo.

**Root cause:** `setup.sh` (or `regen-readme.mjs`) wasn't run after the skill was added, or Node.js wasn't available when it ran.

**Fix:**
```bash
node scripts/regen-readme.mjs
# or just:
bash setup.sh
```

**If Node is not available:**
```bash
node --version
# If command not found, install Node.js v18+ from nodejs.org
```

---

## Edge cases in the import / update pipeline

### Imported skill has broken cross-references after install

**Symptom:** A skill's `SKILL.md` contains references like `skills/collaboration/planning` that weren't resolved to the flattened name.

**Root cause:** Either the referenced skill wasn't imported (excluded by `--only`, or from a different source), or the reference pattern is unusual enough that the rewriter didn't recognize it.

**Fix:** Manual edit — open the affected `SKILL.md` and replace the broken reference with the correct flattened folder name:
```bash
# Find what the flattened name actually is:
ls | grep planning

# Edit the file:
nano superpowers-writing-plans/SKILL.md
# Change "skills/collaboration/planning" to "superpowers-planning" (or whatever the actual name is)
```

Then commit:
```bash
git add superpowers-writing-plans/SKILL.md
git commit -m "fix: manual cross-reference correction after import"
```

### `npm test` breaks after importing a skillset that includes test fixtures

**Symptom:** Your own project's test suite picks up test files from an imported skill's `references/` or `scripts/` directory.

**Root cause:** Some skill repos include test files in their skill folders, and your Jest/Vitest config scans the whole project root.

**Fix:** Add the imported skill folders to your test exclusion config:
```js
// jest.config.js or vitest.config.ts
export default {
  testPathIgnorePatterns: ['<rootDir>/superpowers-*/', '<rootDir>/fix-bug/'],
}
```

Or, if the skills repo is separate from your project repo (the intended setup), this won't happen — the `testPathIgnorePatterns` fix is only needed if someone runs `npm test` from inside the skills repo itself.
