# Setup Guide

This guide gets `dev-agent-skills` installed on your machine, wired into your AI tools, and verified as working. Read the whole thing before running anything — the verification section at the end is what tells you whether each step actually worked, not just that it ran without erroring.

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

This is the only command you need. It does everything: injects the governance protocols into every skill, configures OpenCode globally, regenerates the README table, and symlinks the skills into every detected harness.

**What you should see** (exact output, with your actual path):

```
dev-agent-skills setup
Skills directory: /home/<you>/10xMinds/AI-Dev-Agent/dev-agent-skills

Found 10 skills: eslint-rule-author first-principles-review fix-bug graphify plan-feature skill-add skill-update sync-prs typescript-conventions webapp-conventions

  ✓ Clarification protocol — injected into 10 skill(s), refreshed in 0
  ✓ Self-improvement protocol — injected into 10 skill(s), refreshed in 0
  ℹ️  1 skill(s) still have the old bottom-of-file '## Self-improvement' section, now redundant with the injected pointer above: fix-bug
      Harmless to leave (the injected pointer applies regardless)...

  ✓ OpenCode global config — /home/<you>/.config/opencode/opencode.json (permission.skill=allow; ...)
  ✓ README.md skills table — regenerated (10 skills)

  ✓ Claude Code — /home/<you>/.claude/skills (7 new links)
  ✓ OpenCode — /home/<you>/.config/opencode/skills (7 new links)
  ✓ Hermes — added external_dirs to /home/<you>/.hermes/config.yaml

Done. To pick up new skills (and refresh the clarification protocol) after a git pull, run: bash setup.sh
```

The specific harness lines you see depend on what's installed. Missing a harness line entirely means that harness isn't installed on this machine — that's fine.

**Run setup.sh again on second run:**
```
  ✓ Clarification protocol — injected into 0 skill(s), refreshed in 10
  ✓ Self-improvement protocol — injected into 0 skill(s), refreshed in 10
  ✓ Claude Code — /home/<you>/.claude/skills (0 new links)
```
"Refreshed in 10, 0 new links" — this is correct. The script is idempotent.

---

## Step 3 — Verify the injection

Confirm the protocols actually landed inside the skills, not just that the script ran:

```bash
for skill in eslint-rule-author first-principles-review fix-bug graphify plan-feature skill-add skill-update sync-prs typescript-conventions webapp-conventions; do
  echo "=== $skill ==="
  grep -c "BEGIN dev-agent-skills clarification protocol" "$skill/SKILL.md" && echo "  clarification: OK" || echo "  clarification: MISSING"
  grep -c "BEGIN dev-agent-skills self-improvement protocol" "$skill/SKILL.md" && echo "  self-improvement: OK" || echo "  self-improvement: MISSING"
done
```

Every skill should print `1` and `OK` for both. Any `MISSING` means the injection failed — check that `CLARIFICATION-PROTOCOL.md` and `SELF-IMPROVEMENT-PROTOCOL.md` exist at the repo root.

Check the ordering is correct (clarification always before self-improvement):

```bash
for skill in eslint-rule-author first-principles-review fix-bug graphify plan-feature skill-add skill-update sync-prs typescript-conventions webapp-conventions; do
  clar=$(grep -n "BEGIN dev-agent-skills clarification" "$skill/SKILL.md" | cut -d: -f1)
  si=$(grep -n "BEGIN dev-agent-skills self-improvement" "$skill/SKILL.md" | cut -d: -f1)
  [ "$clar" -lt "$si" ] && echo "$skill: ORDER OK" || echo "$skill: ORDER WRONG"
done
```

All ten should print `ORDER OK`.

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
    "/home/<you>/10xMinds/AI-Dev-Agent/dev-agent-skills/AGENT-STANDING-RULES.md"
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

`git pull` gets the new content. `setup.sh` injects the protocols into any new skills, refreshes the injection in existing ones, and symlinks the new skills into your harnesses. You do not need to do anything else — the new skill is immediately available in your IDE after this.

---

## What to do if you move the repo

If you move the skills repo to a different path, re-run `setup.sh` from the new location:

```bash
cd /new/path/to/dev-agent-skills
bash setup.sh
```

This self-corrects the absolute paths in every `SKILL.md`'s protocol pointers and updates the `opencode.json` `instructions[]` entry. The old symlinks in your harness skill directories will break (they pointed to the old path) — `setup.sh` will create new ones pointing to the new location.
