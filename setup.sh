#!/usr/bin/env bash
# setup.sh — wire dev-agent-skills into your AI IDE(s)
#
# Run once after cloning. Run again after pulling new skills.
# Safe to run multiple times — uses symlinks, won't duplicate.
#
# Usage:
#   bash setup.sh

set -e

SKILLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_COUNT=0

echo "dev-agent-skills setup"
echo "Skills directory: $SKILLS_DIR"
echo ""

SKILL_FOLDERS=()
for dir in "$SKILLS_DIR"/*/; do
  if [ -f "$dir/SKILL.md" ]; then
    SKILL_FOLDERS+=("$dir")
  fi
done

SKILL_COUNT=${#SKILL_FOLDERS[@]}
echo "Found $SKILL_COUNT skills: $(basename -a "${SKILL_FOLDERS[@]}" | tr '\n' ' ')"
echo ""

# ── Clarification protocol injection ──────────────────────────────────────────
#
# Every skill gets a standing "clarify, then confirm, before acting" step
# injected automatically, right after its YAML frontmatter — so new skills
# get it for free on the next `bash setup.sh` after a `git pull`, with no
# manual per-skill editing required. The actual rules live in ONE place
# (CLARIFICATION-PROTOCOL.md, this repo's root) — this just wires a pointer
# to it into every skill, idempotently. Re-running this is always safe: any
# existing managed block is stripped and rebuilt fresh (so the absolute path
# self-corrects if this repo was re-cloned somewhere else on this machine).
#
# This is deliberately a SKILL.md-level mechanism, not just an AGENTS.md
# rule — AGENTS.md is genuinely cross-tool now (Codex, Claude Code, OpenCode,
# Gemini CLI all read it), but Hermes does not appear to, and a SKILL.md-
# embedded instruction is the one thing every harness sees identically,
# regardless of whether it also honors AGENTS.md.

inject_clarification_protocol() {
  local protocol_path="$SKILLS_DIR/CLARIFICATION-PROTOCOL.md"

  if [ ! -f "$protocol_path" ]; then
    echo "  ⚠️  CLARIFICATION-PROTOCOL.md not found at $protocol_path — skipping injection for all skills."
    return
  fi

  local begin_marker="<!-- BEGIN dev-agent-skills clarification protocol (managed by setup.sh -- do not edit this block manually; edit CLARIFICATION-PROTOCOL.md instead) -->"
  local end_marker="<!-- END dev-agent-skills clarification protocol -->"
  local injected=0
  local refreshed=0
  local skipped=0

  for skill_dir in "${SKILL_FOLDERS[@]}"; do
    local skill_md="${skill_dir}SKILL.md"
    local skill_name
    skill_name=$(basename "$skill_dir")
    [ -f "$skill_md" ] || continue

    local had_block="false"
    if grep -qF "$begin_marker" "$skill_md"; then
      had_block="true"
    fi

    # Strip any existing managed block (exact-line match, no regex — avoids
    # any escaping headaches with sed over a marker containing parentheses).
    local stripped
    stripped=$(mktemp)
    awk -v b="$begin_marker" -v e="$end_marker" '
      $0==b {skip=1; next}
      $0==e {skip=0; next}
      skip==1 {next}
      {print}
    ' "$skill_md" > "$stripped"

    # Frontmatter is delimited by the first two lines that are exactly "---".
    local second_dash
    second_dash=$(grep -n '^---$' "$stripped" | head -2 | tail -1 | cut -d: -f1)

    if [ -z "$second_dash" ]; then
      echo "  ⚠️  $skill_name: SKILL.md has no recognizable YAML frontmatter — left untouched. Add frontmatter (name/description) for this to apply."
      rm -f "$stripped"
      skipped=$((skipped + 1))
      continue
    fi

    {
      head -n "$second_dash" "$stripped"
      echo ""
      echo "$begin_marker"
      echo "Before doing anything else in this skill, read and follow the clarification protocol at:"
      echo "$protocol_path"
      echo "$end_marker"
      echo ""
      tail -n "+$((second_dash + 1))" "$stripped"
    } | cat -s > "$skill_md"

    rm -f "$stripped"

    if [ "$had_block" = "true" ]; then
      refreshed=$((refreshed + 1))
    else
      injected=$((injected + 1))
    fi
  done

  local summary="  ✓ Clarification protocol — injected into $injected skill(s), refreshed in $refreshed"
  if [ "$skipped" -gt 0 ]; then
    summary="$summary, skipped $skipped (no frontmatter)"
  fi
  echo "$summary"
}

inject_clarification_protocol
echo ""

# ── OpenCode global config (permission + standing rules) ─────────────────────

configure_opencode_global() {
  if ! command -v opencode &>/dev/null && [ ! -d "$HOME/.config/opencode" ]; then
    return  # OpenCode isn't installed/used on this machine — nothing to do
  fi

  local standing_rules_path="$SKILLS_DIR/AGENT-STANDING-RULES.md"
  if [ ! -f "$standing_rules_path" ]; then
    echo "  ⚠️  AGENT-STANDING-RULES.md not found at $standing_rules_path — skipping OpenCode global config."
    return
  fi

  local global_dir="$HOME/.config/opencode"
  local config_path="$global_dir/opencode.json"
  mkdir -p "$global_dir"

  if ! command -v jq &>/dev/null; then
    echo "  ⚠️  OpenCode global config — jq not found, cannot safely merge into $config_path."
    echo "      Add this manually (merge with whatever is already there, don't just overwrite it):"
    echo "      { \"permission\": { \"skill\": { \"*\": \"allow\" }, \"task\": \"ask\", \"external_directory\": { \"$SKILLS_DIR/*\": \"allow\" } }, \"instructions\": [\"$standing_rules_path\"] }"
    return
  fi

  if [ ! -f "$config_path" ]; then
    echo '{}' > "$config_path"
  fi

  local tmp
  tmp=$(mktemp)
  jq --arg instr "$standing_rules_path" --arg skillsglob "$SKILLS_DIR/*" '
    .permission = (.permission // {}) |
    .permission.skill = (.permission.skill // {}) |
    .permission.skill["*"] = "allow" |
    .permission.task = (.permission.task // "ask") |
    .permission.external_directory = (
      if (.permission.external_directory | type) == "object" then .permission.external_directory
      elif (.permission.external_directory | type) == "string" then { ("*"): .permission.external_directory }
      else {}
      end
    ) |
    .permission.external_directory[$skillsglob] = "allow" |
    .instructions = ((.instructions // []) + [$instr] | unique)
  ' "$config_path" > "$tmp" && mv "$tmp" "$config_path"

  echo "  ✓ OpenCode global config — $config_path (permission.skill=allow; permission.task=ask if not already set; $SKILLS_DIR pre-approved for external_directory access; standing rules wired via instructions[])"
}

configure_opencode_global
echo ""

link_skills() {
  local target_dir="$1"
  local agent_name="$2"
  mkdir -p "$target_dir"
  local linked=0
  for skill_dir in "${SKILL_FOLDERS[@]}"; do
    skill_name=$(basename "$skill_dir")
    link_path="$target_dir/$skill_name"
    if [ -L "$link_path" ]; then
      : # already linked
    elif [ -d "$link_path" ]; then
      echo "  ⚠️  $skill_name: directory already exists at $link_path (not a symlink — skipping)"
      continue
    else
      ln -s "$skill_dir" "$link_path"
      linked=$((linked + 1))
    fi
  done
  echo "  ✓ $agent_name — $target_dir ($linked new links)"
}

# ── Claude Code ──────────────────────────────────────────────────────────────
if command -v claude &>/dev/null || [ -d "$HOME/.claude" ]; then
  link_skills "$HOME/.claude/skills" "Claude Code"
fi

# ── Codex ─────────────────────────────────────────────────────────────────────
if command -v codex &>/dev/null || [ -d "$HOME/.codex" ]; then
  link_skills "$HOME/.codex/skills" "Codex"
fi

# ── Gemini CLI ────────────────────────────────────────────────────────────────
if command -v gemini &>/dev/null || [ -d "$HOME/.config/gemini" ]; then
  link_skills "$HOME/.config/gemini/skills" "Gemini CLI"
fi

# ── OpenCode (global skills dir) ──────────────────────────────────────────────

if command -v opencode &>/dev/null || [ -d "$HOME/.config/opencode" ]; then
  link_skills "$HOME/.config/opencode/skills" "OpenCode"
fi

# ── Hermes ────────────────────────────────────────────────────────────────────
if command -v hermes &>/dev/null || [ -d "$HOME/.hermes" ]; then
  HERMES_CONFIG="$HOME/.hermes/config.yaml"
  if [ -f "$HERMES_CONFIG" ]; then
    if grep -q "external_dirs" "$HERMES_CONFIG"; then
      if ! grep -q "$SKILLS_DIR" "$HERMES_CONFIG"; then
        echo "  ⚠️  Hermes: external_dirs exists in config.yaml but $SKILLS_DIR is not listed."
        echo "      Add it manually under skills.external_dirs in $HERMES_CONFIG"
      else
        echo "  ✓ Hermes — already configured in $HERMES_CONFIG"
      fi
    else
      # Append external_dirs to config
      cat >> "$HERMES_CONFIG" << YAML

# Added by dev-agent-skills setup.sh
skills:
  external_dirs:
    - $SKILLS_DIR
YAML
      echo "  ✓ Hermes — added external_dirs to $HERMES_CONFIG"
    fi
  else
    echo "  ⚠️  Hermes: config.yaml not found at $HERMES_CONFIG"
    echo "      Run 'hermes setup' first, then re-run this script."
  fi
fi

# ── Portable .agents/skills (Cursor, or any agent that reads this convention) ─
#
# NOTE: this only fires if run from a directory that ALREADY has .agents/,
# .cursor/rules, or .opencode.json present — which means it does nothing
# when run the normal way (cloning dev-agent-skills and running setup.sh
# from inside it). It's a best-effort extra for people who instead run this
# script from inside their actual project directory. For OpenCode
# specifically, do not rely on this block — use the global block above.
if [ -d ".agents" ] || [ -f ".cursor/rules" ] || [ -f ".opencode.json" ]; then
  link_skills ".agents/skills" "Portable (.agents/skills, project-local)"
fi

echo ""
echo "Done. To pick up new skills (and refresh the clarification protocol) after a git pull, run: bash setup.sh"