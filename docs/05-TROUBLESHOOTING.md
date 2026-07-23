# Troubleshooting Guide

Every issue here has been observed in real usage. The entries are ordered from most to least common.

> Looking for what changed recently, or why something behaves the way it does? See [`HISTORY.md`](./HISTORY.md).

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

### `validate_skill.py` warns about session-memory being inconsistent

**Symptom:** Running the validator against a skill prints one of:
```
'session-memory: true' is set, but no step in this skill's body is marked
'Session-reusable:' -- the flag alone does nothing.
```
or
```
Found a 'Session-reusable:' marker in the body, but 'session-memory: true'
isn't set in frontmatter -- setup.sh won't inject the protocol pointer.
```

**Root cause:** The two-part opt-in (frontmatter flag + body marker, see `03-MANAGING-SKILLS.md`) is half-done — one half was added without the other.

**Fix:** Add whichever half is missing. If you set the flag intending to mark a step later, either mark it now or remove the flag until you do — a flag with no marked step does nothing but add noise to every session in that skill.

---

### `validate_skill.py` warns about graph-memory being inconsistent

Same two-part opt-in as session-memory, same fix — same root cause and same resolution. One real difference: graph-memory needs **two** markers (`**Graph-memory:**` before relying on query results, and again after finishing), not one. The validator only checks that at least one marker is present, so a skill with the flag set and only *one* of the two points marked will validate clean but not actually work as intended — that specific half-done state isn't currently caught mechanically. Check both points by hand when opting a skill in; see `fix-bug/SKILL.md`'s Step 4 and Step 12 for what both markers should look like.

---

### Agent isn't checking graph-memory before relying on graph query results

**Symptom:** `fix-bug` or `plan-feature` proceeds on a graph query's results without ever mentioning `graphify reflect` or `LESSONS.md`, even though the skill has `graph-memory: true` set.

**Root cause:** Same category as any other instruction-following gap — the pointer is injected correctly, but whether the agent actually acts on it in a given session is not independently enforced.

**What to do:**
```bash
cat graphify-out/reflections/LESSONS.md 2>/dev/null || echo "no lessons recorded yet -- may explain why nothing was mentioned"
```
If lessons genuinely exist and weren't checked, say so directly: "Check `graphify reflect`'s output before relying on that — did you look at `LESSONS.md`?" If no lessons exist yet, there's nothing to have caught — this isn't a failure, it's an empty history.

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

### `coding-standards` applies the wrong domain's standards, or none at all

**Symptom:** Code gets written that clearly should have followed, say, database conventions, but no `coding-standards-database` behavior is visible — or the reverse, a domain's standards get applied to a project that doesn't actually have that layer.

**Root cause options:**
1. The task's wording didn't clearly imply the domain, and the project's knowledge graph had nothing relevant to return either (most likely for a brand-new feature with no existing code to find) — see `HISTORY.md`'s round-2 entry for why this specific case is a known, not-yet-fully-closed limitation.
2. `coding-standards/references/manifest.json`'s `dependency_patterns` or `path_patterns` for that domain don't match this project's actual conventions (e.g. a non-standard file location for a schema file, or a package name genuinely not on the list — see `HISTORY.md` for the manifest broadening entries covering exactly this reason, more than once already).
3. `graphify-out/.graphify_stack.json` is missing or stale — Step 2 falls back to direct detection in this case, but if the fallback itself is also missing a signal, the same broadening fix applies.
4. The dispatcher applied a domain that isn't actually present — this should trigger a clarifying question per its own instructions (see `02-USAGE.md`), not silently apply. If it silently applied instead of asking, that's a protocol violation.

**What to do:** Be explicit about the domain in your request if you know it applies — "this touches the database too" is enough to unstick a wording-only miss. For the manifest mismatch case, check `dependency_patterns`/`path_patterns` for that domain against your actual project's dependencies and layout, and consider whether they need broadening (see `03-MANAGING-SKILLS.md`'s "Writing a master/dispatcher skill" section).

**Diagnosis:**
```bash
# Check the manifest's current coverage for a domain
python3 -c "
import json
m = json.load(open('coding-standards/references/manifest.json'))
for d in m['domains']:
    print(d['domain'], '-> dependency_patterns:', d['dependency_patterns'])
"
```

```bash
# Check what graphify actually detected for this project -- if your
# dependency/file isn't in here, that's why the manifest match missed it
cat graphify-out/.graphify_stack.json 2>/dev/null || echo "no stack file -- Step 2 used the fallback path instead"
```

---

### Agent claims to be reusing a session-memory finding that's actually stale, or never reuses when it plausibly could

**Symptom:** Either the agent says "already confirmed earlier..." for something that's since changed, or it re-runs a check every single time within one long session despite nothing changing.

**Root cause (stale reuse):** A genuine protocol miss — the agent should be checking "has anything since then plausibly changed this" before reusing, every time, per `SESSION-MEMORY-PROTOCOL.md`. If it reused something that turned out wrong, that check didn't happen correctly.

**Root cause (never reuses):** Either the step genuinely isn't marked `**Session-reusable:**` (only specific steps in `coding-standards` and `sync-prs` currently are — see `06-REFERENCE.md` for the full list), or the skill's frontmatter is missing `session-memory: true` entirely, in which case the pointer was never injected and the agent has no reason to know reuse is an option here.

**What to do:**
```bash
# Confirm the skill actually opted in and the step is actually marked
grep "session-memory: true" coding-standards/SKILL.md
grep -c "Session-reusable:" coding-standards/SKILL.md
```
If both are present and reuse still isn't happening (or is happening incorrectly), that's worth a direct correction in the moment: "Re-check that instead of reusing the earlier result — I'm not confident it still holds" always works, since the protocol explicitly allows and expects re-checking when uncertain.

**Prevention:** This is a genuinely new mechanism (see `HISTORY.md`) — expect it to need a few real sessions to observe before trusting it heavily.

---

### Agent commits or pushes without asking

**Symptom:** A commit or PR shows up from `fix-bug` that you never explicitly asked for.

**Root cause:** A protocol violation. `fix-bug` defaults to stopping at the edited file — it should only commit, push, or open a PR after you've explicitly opted in via the Step 1 clarification question (see `HISTORY.md`'s "ask before committing" entry and `02-USAGE.md`).

**What to do:**
```bash
git log --oneline -3
```
If there's a commit you didn't authorize, revert it and, if a PR was opened, close it. Treat this the same as any other unrequested-action protocol violation.

**Prevention:** Avoid phrases like "just fix it" without stating your commit preference either way — if you know up front you want it committed and pushed, say so explicitly ("...and open a PR when done") to skip being asked; if you're not sure, let it ask and answer explicitly rather than assuming a default.

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
