# Verification Guide

The most consistent failure mode in any agent-assisted workflow is assuming something worked because it didn't error. This guide gives you the exact commands to independently verify each claim — at setup time, after imports, and during and after sessions. Run these yourself; don't rely on the agent's own summary of what it did.

> Looking for what changed recently, or why something behaves the way it does? See [`HISTORY.md`](./HISTORY.md).

---

## Post-setup verification checklist

Run all of these immediately after `setup.sh` completes. If any fail, fix them before doing anything else.

### 1. Protocol injection — every skill, correct order, discovered automatically

This loop discovers skills by scanning for `SKILL.md` files rather than naming them — it stays correct as skills are added or removed, no editing required later:

```bash
echo "=== INJECTION CHECK ==="
for dir in */; do
  skill="${dir%/}"
  [ -f "${dir}SKILL.md" ] || continue
  echo ""
  echo "--- $skill ---"
  grep -c "BEGIN dev-agent-skills clarification protocol" "${dir}SKILL.md" \
    && echo "  clarification: OK" || echo "  clarification: MISSING"
  grep -c "BEGIN dev-agent-skills self-improvement protocol" "${dir}SKILL.md" \
    && echo "  self-improvement: OK" || echo "  self-improvement: MISSING"
  if grep -q "session-memory: true" "${dir}SKILL.md"; then
    grep -c "BEGIN dev-agent-skills session-memory protocol" "${dir}SKILL.md" \
      && echo "  session-memory: OK (opted in)" || echo "  session-memory: MISSING despite opt-in"
  fi
  clar=$(grep -n "BEGIN dev-agent-skills clarification" "${dir}SKILL.md" | cut -d: -f1)
  si=$(grep -n "BEGIN dev-agent-skills self-improvement" "${dir}SKILL.md" | cut -d: -f1)
  [ "$clar" -lt "$si" ] && echo "  order: OK (clarification L$clar, self-improvement L$si)" || echo "  order: WRONG"
done
```

**Expected output for each skill:**
```
--- coding-standards ---
1
  clarification: OK
1
  self-improvement: OK
1
  session-memory: OK (opted in)
  order: OK (clarification L20, self-improvement L25)
```
The `session-memory` lines only appear for skills that opted in (currently `coding-standards` and `sync-prs`) — their absence for every other skill is correct, not a gap. Line numbers vary by skill; the invariant is `clarification < self-improvement`, and if session-memory is present, it comes after both.

**If `MISSING`:** The protocol file wasn't found at injection time. Check that `CLARIFICATION-PROTOCOL.md`, `SELF-IMPROVEMENT-PROTOCOL.md`, and (if relevant) `SESSION-MEMORY-PROTOCOL.md` all exist in `config/`, then re-run `bash setup.sh`.

**If session-memory shows `MISSING despite opt-in`:** the skill's frontmatter has `session-memory: true` but `setup.sh` hasn't been re-run since the flag was added — run it.

### 2. Symlinks — skills are visible in each harness

**Claude Code:**
```bash
ls ~/.claude/skills/ | sort
# should list all skill folder names
ls -la ~/.claude/skills/fix-bug
# should show: fix-bug -> /absolute/path/to/dev-agent-skills/fix-bug
```

**OpenCode:**
```bash
ls ~/.config/opencode/skills/ | sort
```

**Hermes:**
```bash
grep -A5 "external_dirs" ~/.hermes/config.yaml
# should include the path to dev-agent-skills
hermes skills list | grep "fix-bug"
```

**If a symlink points to the wrong path (repo was moved):**
```bash
# Remove the broken symlinks and re-run setup
rm ~/.claude/skills/fix-bug  # repeat for each broken link
bash setup.sh
```

### 3. OpenCode global config — critical fields present

```bash
cat ~/.config/opencode/opencode.json | python3 -c "
import json, sys
d = json.load(sys.stdin)
p = d.get('permission', {})
print('skill[*]:', p.get('skill', {}).get('*', 'MISSING'))
print('instructions:', d.get('instructions', 'MISSING'))
"
```

**Expected:**
```
skill[*]: allow
instructions: ['/home/<you>/dev-agent-skills/config/AGENT-STANDING-RULES.md']
```

**If `MISSING` for either:** `jq` was not available during setup. Install `jq` and re-run `bash setup.sh`.

### 4. OpenCode actually reads AGENT-STANDING-RULES.md

This cannot be verified by a file check alone. Verify behaviorally: start an OpenCode session in any project directory and send this message:

```
Without doing anything else, quote the first sentence of Rule 1 from AGENT-STANDING-RULES.md
```

**Expected response:** The agent quotes something about checking for `graphify-out/graph.json` before investigating in any other way.

**If it can't:** The `instructions[]` path in `opencode.json` is wrong (usually from a moved repo). Fix: re-run `bash setup.sh` from the correct location, verify the path in `opencode.json` updated, then test again.

### 5. `coding-standards` dispatcher wiring — manifest, sub-skills, isolation

The dispatcher pattern (see [`06-REFERENCE.md`](./06-REFERENCE.md) and [`03-MANAGING-SKILLS.md`](./03-MANAGING-SKILLS.md)) has its own structural checks worth running once after setup, and again after any change to `coding-standards` or its sub-skills:

```bash
# The manifest is valid JSON and has the domains you expect
python3 -c "
import json
m = json.load(open('coding-standards/references/manifest.json'))
print('version:', m['version'])
for d in m['domains']:
    print(f\"  {d['domain']} -> {d['skill']}\")
"
```

```bash
# No sub-skill references the manifest -- this is what keeps it dispatcher-only
grep -l "manifest.json" coding-standards-*/SKILL.md
# expected: no output at all
```

```bash
# Every domain skill named in the manifest actually exists and validates
python3 -c "
import json
m = json.load(open('coding-standards/references/manifest.json'))
for d in m['domains']:
    print(d['skill'])
" | while read -r skill; do
  python3 skill-factory/scripts/validate_skill.py "$skill" > /dev/null 2>&1 \
    && echo "$skill: OK" || echo "$skill: MISSING or invalid"
done
```

```bash
# graphify's stack-detection output exists and is real JSON -- this is what
# Step 2 (project detection) reads instead of running independent commands
test -f graphify-out/.graphify_stack.json && python3 -c "
import json
s = json.load(open('graphify-out/.graphify_stack.json'))
print('dependencies:', len(s['dependencies']))
print('notable_files:', s['notable_files'])
print('notable_dirs:', s['notable_dirs'])
" || echo "MISSING -- Step 2 will fall back to direct detection commands instead"
```

---

## Post-import verification checklist

Run after every `skill-add` import.

### 1. Imported skills appear at repo root

```bash
ls | grep "^superpowers-" | head -10  # replace superpowers with your prefix
```

Count matches against the installer's "Imported N skill(s)" line.

### 2. Protocols injected into imported skills

```bash
# Spot-check three imported skills
for skill in superpowers-systematic-debugging superpowers-brainstorming superpowers-when-stuck; do
  echo "=== $skill ==="
  grep -c "BEGIN dev-agent-skills clarification protocol" "$skill/SKILL.md" \
    && echo "  clarification: OK" || echo "  clarification: MISSING"
  grep -c "BEGIN dev-agent-skills self-improvement protocol" "$skill/SKILL.md" \
    && echo "  self-improvement: OK" || echo "  self-improvement: MISSING"
done
```

Imported skills won't have `session-memory: true` unless the upstream source happened to set it — that's expected; it's opt-in and not part of what an import brings in automatically.

### 3. Manifest updated

```bash
cat .skillsets.json | python3 -c "
import json, sys
d = json.load(sys.stdin)
for s in d['skillsets']:
  print(s['source_repo'], '—', len(s['imported_skills']), 'skills, commit:', s['commit'][:10])
"
```

### 4. README table regenerated

```bash
grep "superpowers-" README.md | wc -l
# should equal the number of imported skills
```

### 5. Cross-reference warnings — review and decide

```bash
# Re-run the skill in dry-run mode to see current cross-reference status
/skill-add <original-url> --subdir <original-subdir> --prefix <original-prefix> --dry-run
```

Any warnings printed represent unresolved references in the imported content. Each one requires a judgment call — see the "Cross-reference warnings" section in the Managing Skills guide.

---

## Mid-session verification

Run these during a session if something looks off.

### "Did the agent actually query the graph?"

```bash
# Check the mtime of the graph file
ls -la graphify-out/graph.json

# If you're not sure whether the agent queried it or just skipped it, ask directly:
# "Show me the exact graphify query command you ran and its output."
```

### "Did the agent make only the changes it said it would?"

```bash
git diff --stat
```

Compare against the plan you confirmed. Files in the diff that weren't mentioned in the plan are unexpected scope creep — ask the agent to explain and revert if needed.

```bash
# See the actual line-level changes in a specific file
git diff -- src/components/HeroSection.tsx
```

### "Did the agent commit or push without my explicit go-ahead?"

```bash
git log --oneline -3
```

`fix-bug` stops at the edited file by default and only commits/pushes after an explicit opt-in (see `HISTORY.md` and `02-USAGE.md`) — a commit you never authorized is a protocol violation worth flagging the same as any other unexpected action.

### "Is TypeScript still clean after the change?"

```bash
npx tsc --noEmit; echo "exit: $?"
```

Exit 0 = clean. Any other exit code means the change introduced a type error.

### "Did coding-standards dispatch to the right domain(s)?"

There's no single command for this — it's a judgment call based on what you know the task touched. What's checkable: if the agent claims it reused an earlier domain-detection result (see "session-memory reuse" below), you can confirm the reused claim is actually consistent with what it said earlier in the same conversation by scrolling back, rather than taking the claim on faith.

### "Did a session-memory reuse actually make sense?"

If you see something like *"Already confirmed earlier this session that this project uses react + prisma — skipping re-detection"* — verify it, don't just accept it:

1. Did that fact actually get established earlier in this same conversation? Scroll back and check.
2. Did anything happen in between that could have changed it (a dependency added, a schema file touched)? If yes and the agent didn't catch it, that's worth flagging — the protocol's own test requires checking this before reusing.

### "Does the change actually work?"

This is always specific to what was changed. For a URL fix, the check is "does the link open the right page?" For a logic fix, the check is "does the behavior match what was described in the plan?" The agent can tell you what it expects to be true, but you are the one who verifies it.

---

## Post-session verification

### Standard three-check after any code change

```bash
npx tsc --noEmit; echo "exit: $?"           # type safety
npx eslint src/ 2>&1 | tail -3             # lint (compare error count against baseline)
npm test                                    # tests (compare counts against baseline)
```

If you don't know the pre-session baseline for ESLint errors, check out the pre-session commit and run ESLint there:

```bash
git stash -u
git checkout <pre-session-commit>
npx eslint src/ 2>&1 | tail -3   # note the error/warning counts
git checkout -                    # back to current branch
git stash pop
```

Compare the post-session count against the pre-session count. New errors introduced by the session's changes need to be fixed before merging.

### Self-improvement protocol — was it applied correctly?

```bash
cat fix-bug/references/edge-cases.md 2>/dev/null || echo "no edge-cases.md yet"
```

After a session that used `fix-bug`:
- **If a new entry appeared:** Read it. Does it describe a real situation the skill didn't cover, stated clearly with a dated heading? If yes, it's a good entry. If it describes routine operation ("I read the file and found the bug"), it shouldn't be there — remove it.
- **If no new entry appeared:** That's the expected case for most sessions. Absence is correct, not a sign the protocol failed.

**What a good edge case entry looks like:**
```markdown
## 2026-07-01 — graphify skipped image-heavy repo without warning

What happened: Repo contained 120 product images in src/assets/. graphify ran but
produced a graph with only 12 nodes — the AST extraction worked but the structural
map was effectively empty because most files were images. The skill's instructions
don't mention a minimum-node threshold or how to detect this situation.
What I did: Re-ran graphify with --exclude-images flag (not documented in SKILL.md),
got 284 nodes. Proceeded from there.
```

**What a bad edge case entry looks like:**
```markdown
## 2026-07-01 — fixed the link

Found the wrong URL in HeroSection.tsx and updated it to the correct one.
```
(This is routine operation, not an edge case. Delete it.)

---

## Verification after a failed session

If a session went wrong (unexpected files changed, TypeScript errors introduced, plan not followed), do this before anything else:

```bash
# See exactly what changed
git diff --stat
git diff

# Revert everything from this session if needed
git checkout -- .          # reverts all unstaged changes
git clean -fd              # removes untracked files (use with caution)
```

Then identify what the agent did wrong — did it skip the graph step? Did it act before confirming? Did it commit/push without an explicit go-ahead? Did it change files outside the stated scope? Document this specifically before re-running. Vague "it didn't work" reports produce vague repeats of the same problem.

---

## Verifying after a `git pull` on a teammate's machine

When a teammate pulls your new skills:

```bash
cd ~/10xMinds/AI-Dev-Agent/dev-agent-skills
git pull
bash setup.sh
```

Verify the new skill arrived:
```bash
ls | grep your-new-skill
ls ~/.claude/skills/ | grep your-new-skill  # or whichever harness they use
```

Verify the skill's protocols are injected:
```bash
grep -c "BEGIN dev-agent-skills clarification protocol" your-new-skill/SKILL.md
# should print 1
```

If the skill shows up but the protocols are missing, the teammate's `setup.sh` failed silently — check that `CLARIFICATION-PROTOCOL.md` and `SELF-IMPROVEMENT-PROTOCOL.md` are both present in `config/` in the pulled copy.
