# Setup Guide

This guide gets `dev-agent-skills` installed on your machine, wired into your AI tools, and verified as working. Read the whole thing before running anything — the verification section at the end is what tells you whether each step actually worked, not just that it ran without erroring.

> Looking for what changed recently, or why something behaves the way it does? See [`HISTORY.md`](./HISTORY.md).

---

## Prerequisites

You need all of these before starting. Check each one:

```bash
git --version        # any version
node --version       # v18+ required, v22 recommended
jq --version         # required for OpenCode config merge
```

If `jq` is missing:
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq
```

You also need at least one AI harness installed. Supported: OpenCode, Claude Code, Codex, Gemini CLI, Hermes. You don't need all of them — `setup.sh` detects what's present and skips what isn't.

---

## Step 1 — Clone the repo

Choose where you want the repo to live and clone it there. This path is permanent — the protocol injection in every `SKILL.md` uses absolute paths that point back here, so moving the repo later means re-running `setup.sh`.

```bash

git clone git@github.com:10xMinds/dev-agent-skills.git ~/10xMinds/AI-Dev-Agent/dev-agent-skills
cd ~/10xMinds/AI-Dev-Agent/dev-agent-skills
```

Replace the path with wherever you actually want it. The examples in this doc use `~/10xMinds/AI-Dev-Agent/dev-agent-skills` — substitute your actual path everywhere.

---

## Step 2 — Run setup.sh

```bash
bash setup.sh
```

This is the only command you need. It does everything: injects the governance protocols into every skill (the session-memory protocol only into skills that opt into it), configures OpenCode globally, regenerates the README table, and symlinks the skills into every detected harness.

**What you should see** (real output, with your actual path):

```
dev-agent-skills setup
Skills directory: /home/<you>/10xMinds/AI-Dev-Agent/dev-agent-skills

Found 19 skills: coding-standards-backend coding-standards-database coding-standards-e2e coding-standards-frontend coding-standards-project-organization coding-standards-tanstack-query coding-standards eslint-rule-author first-principles-review fix-bug graphify investigate-issue plan-feature skill-add skill-factory skill-update sync-prs typescript-conventions webapp-conventions

  ✓ Clarification protocol — injected into 0 skill(s), refreshed in 19
  ✓ Self-improvement protocol — injected into 0 skill(s), refreshed in 19
  ✓ Session-memory protocol — opted in: 2 skill(s) (injected 0 new, refreshed 2)
  ℹ️  1 skill(s) still have the old bottom-of-file '## Self-improvement' section, now redundant with the injected pointer above: fix-bug
      Harmless to leave (the injected pointer applies regardless)...

  ✓ OpenCode global config — /home/<you>/.config/opencode/opencode.json (permission.skill=allow; ...)
  ✓ README.md skills table — already up to date (19 skills)

  ✓ Claude Code — /home/<you>/.claude/skills (19 new links)
  ✓ OpenCode — /home/<you>/.config/opencode/skills (19 new links)
  ✓ Hermes — added external_dirs to /home/<you>/.hermes/config.yaml

Done. To pick up new skills (and refresh the clarification protocol) after a git pull, run: bash setup.sh
```

**Why "refreshed," not "injected new," even on a first run:** the managed protocol blocks are committed to git, not generated only locally — whoever last touched a skill already ran `setup.sh` and committed the result. You'll only see "injected N new" for a skill that's genuinely never had a given protocol block before (a brand-new skill someone just added, or a protocol someone just opted a skill into for the first time).

**Three protocols now, not two:** clarification and self-improvement are injected into every skill unconditionally, always. Session-memory is different — it's opt-in per skill (`session-memory: true` in that skill's frontmatter), so the count next to it reflects how many skills currently opt in, not the full skill count. Currently: `coding-standards` and `sync-prs`. See [`06-REFERENCE.md`](./06-REFERENCE.md) for what session-memory actually does, and [`03-MANAGING-SKILLS.md`](./03-MANAGING-SKILLS.md) for how to opt a new skill into it.

The specific harness lines you see depend on what's installed. Missing a harness line entirely means that harness isn't installed on this machine — that's fine.

**Run setup.sh again on a second run, nothing changed:**
```
  ✓ Clarification protocol — injected into 0 skill(s), refreshed in 19
  ✓ Self-improvement protocol — injected into 0 skill(s), refreshed in 19
  ✓ Session-memory protocol — opted in: 2 skill(s) (injected 0 new, refreshed 2)
  ✓ Claude Code — /home/<you>/.claude/skills (0 new links)
```
"0 new, all refreshed" — this is correct. The script is idempotent.

**Run setup.sh after removing `session-memory: true` from a skill's frontmatter:**
```
  ✓ Session-memory protocol — opted in: 1 skill(s) (injected 0 new, refreshed 1), removed from 1 (opted out since last run)
```
The pointer is actually removed from that skill's `SKILL.md` on this run — opting out takes effect immediately, same idempotent strip-and-rebuild logic as opting in.

---

## Step 3 — Verify the injection

Confirm the protocols actually landed inside the skills, not just that the script ran. This loop discovers skills automatically rather than naming them, so it stays correct as skills are added or removed — no need to edit this command later:

```bash
for dir in */; do
  skill="${dir%/}"
  [ -f "${dir}SKILL.md" ] || continue
  echo "=== $skill ==="
  grep -c "BEGIN dev-agent-skills clarification protocol" "${dir}SKILL.md" > /dev/null \
    && echo "  clarification: OK" || echo "  clarification: MISSING"
  grep -c "BEGIN dev-agent-skills self-improvement protocol" "${dir}SKILL.md" > /dev/null \
    && echo "  self-improvement: OK" || echo "  self-improvement: MISSING"
  if grep -q "session-memory: true" "${dir}SKILL.md"; then
    grep -c "BEGIN dev-agent-skills session-memory protocol" "${dir}SKILL.md" > /dev/null \
      && echo "  session-memory: OK (opted in)" || echo "  session-memory: MISSING (opted in but not injected — re-run setup.sh)"
  fi
done
```

Every skill should print `OK` for clarification and self-improvement. Only `coding-standards` and `sync-prs` (currently) should print a session-memory line at all — that's expected, not a gap, since it's opt-in.

Check the ordering is correct (clarification, then self-improvement, then session-memory if present):

```bash
for dir in */; do
  [ -f "${dir}SKILL.md" ] || continue
  clar=$(grep -n "BEGIN dev-agent-skills clarification" "${dir}SKILL.md" | cut -d: -f1)
  si=$(grep -n "BEGIN dev-agent-skills self-improvement" "${dir}SKILL.md" | cut -d: -f1)
  sm=$(grep -n "BEGIN dev-agent-skills session-memory" "${dir}SKILL.md" | cut -d: -f1)
  order_ok="true"
  [ -n "$clar" ] && [ -n "$si" ] && [ "$clar" -ge "$si" ] && order_ok="false"
  [ -n "$sm" ] && [ -n "$si" ] && [ "$si" -ge "$sm" ] && order_ok="false"
  [ "$order_ok" = "true" ] && echo "${dir%/}: ORDER OK" || echo "${dir%/}: ORDER WRONG"
done
```

All 19 should print `ORDER OK`.

Or, more thoroughly, run the repo's own validator against a skill directly, which checks this and considerably more (frontmatter correctness, description quality signals, line-count guidelines, and — for any skill with `session-memory: true` — that the flag and the `Session-reusable:` marker are actually consistent with each other):

```bash
python3 skill-factory/scripts/validate_skill.py coding-standards
```

`No errors found.` is what you want. See [`06-REFERENCE.md`](./06-REFERENCE.md) for the full list of what this checks.

---

## Step 4 — Verify OpenCode wiring (if you use OpenCode)

```bash
cat ~/.config/opencode/opencode.json
```

You should see something like:

```json
{
  "permission": {
    "skill": { "*": "allow" },
    "task": "ask",
    "external_directory": {
      "/home/<you>/10xMinds/AI-Dev-Agent/dev-agent-skills/*": "allow"
    }
  },
  "instructions": [
    "/home/<you>/10xMinds/AI-Dev-Agent/dev-agent-skills/config/AGENT-STANDING-RULES.md"
  ]
}
```

The critical fields are `instructions[]` containing the path to `AGENT-STANDING-RULES.md` and `permission.skill["*"] = "allow"`. If either is missing, `jq` was not available when `setup.sh` ran — install `jq` and re-run.

Confirm OpenCode is actually reading the file (not just that the path is registered):

```bash
# Start an OpenCode session in any directory, then ask:
# "Quote the first sentence of Rule 1 from AGENT-STANDING-RULES.md"
```

If it can quote it verbatim, the file is genuinely loaded. If it says it can't find it or makes something up, the path in `opencode.json` points somewhere wrong — usually a re-clone to a different location. Re-run `setup.sh` from the new location to self-correct the path.

---

## Step 5 — Verify Hermes wiring (if you use Hermes)

```bash
grep -A3 "external_dirs" ~/.hermes/config.yaml
```

You should see your skills directory listed under `external_dirs`:

```yaml
skills:
  external_dirs:
    - /home/<you>/10xMinds/AI-Dev-Agent/dev-agent-skills
```

Confirm Hermes actually sees the skills:

```bash
hermes skills list | grep fix-bug
```

If `fix-bug` appears, Hermes is correctly loading from the skills repo.

**Note on the newer skills:** `coding-standards` is a dispatcher — see [`06-REFERENCE.md`](./06-REFERENCE.md) for what that means. Because Hermes doesn't auto-select skills by description the way OpenCode does, always name the skill explicitly in a Hermes prompt, same as any other skill in this repo (see [`02-USAGE.md`](./02-USAGE.md)).

---

## Step 6 — Verify Claude Code wiring (if you use Claude Code)

```bash
ls ~/.claude/skills/ | head -10
```

You should see symlinks to the skill folders. Confirm they actually resolve:

```bash
ls -la ~/.claude/skills/fix-bug
# should print something like:
# lrwxrwxrwx 1 ... fix-bug -> /home/<you>/10xMinds/AI-Dev-Agent/dev-agent-skills/fix-bug
```

If the symlink target is a broken path (e.g. repo was moved), re-run `setup.sh` from the current location.

---

## Keeping your setup current

Every time someone pushes new or updated skills to the repo:

```bash
cd ~/10xMinds/AI-Dev-Agent/dev-agent-skills
git pull
bash setup.sh
```

`git pull` gets the new content. `setup.sh` injects the protocols into any new skills, refreshes the injection in existing ones (adding or removing the session-memory pointer per skill as needed), and symlinks the new skills into your harnesses. You do not need to do anything else — the new skill is immediately available in your IDE after this.

---

## What to do if you move the repo

If you move the skills repo to a different path, re-run `setup.sh` from the new location:

```bash
cd /new/path/to/dev-agent-skills
bash setup.sh
```

This self-corrects the absolute paths in every `SKILL.md`'s protocol pointers and updates the `opencode.json` `instructions[]` entry. The old symlinks in your harness skill directories will break (they pointed to the old path) — `setup.sh` will create new ones pointing to the new location.
