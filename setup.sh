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

# ── Protocol injection (clarification + self-improvement) ────────────────────
#
# Every skill gets two standing pointers injected automatically, right after
# its YAML frontmatter, in this fixed order:
#   1. "clarify, then confirm, before acting"   -> CLARIFICATION-PROTOCOL.md
#   2. "record real edge cases as you find them" -> SELF-IMPROVEMENT-PROTOCOL.md
#
# New skills get both for free on the next `bash setup.sh` after a `git
# pull`, with no manual per-skill editing required. The actual rules live in
# ONE place each (the two *-PROTOCOL.md files at this repo's root) — this
# just wires a pointer to each into every skill, idempotently. Re-running
# this is always safe: both existing managed blocks are stripped and rebuilt
# fresh in one pass, in the same fixed order, every time — so the absolute
# path self-corrects if this repo was re-cloned somewhere else on this
# machine, and the relative order of the two blocks can never drift based on
# which one happened to already be present.
#
# This is deliberately a SKILL.md-level mechanism, not just an AGENTS.md
# rule — AGENTS.md is genuinely cross-tool now (Codex, Claude Code, OpenCode,
# Gemini CLI all read it), but Hermes does not appear to, and a SKILL.md-
# embedded instruction is the one thing every harness sees identically,
# regardless of whether it also honors AGENTS.md. Self-improvement in
# particular used to be opt-in and described as "Hermes only" (CONTRIBUTING.md's
# old per-skill "## Self-improvement" footer, relying on Hermes's built-in
# skill_manage tool) — this replaces that with a universal pointer any
# harness with a plain file-write capability can act on, no special tool
# required.

strip_managed_block() {
  # Reads $1, strips the line range between (and including) $2 and $3,
  # writes the result to stdout. Exact-line match, no regex — avoids any
  # escaping headaches with sed over markers containing parentheses.
  awk -v b="$2" -v e="$3" '
    $0==b {skip=1; next}
    $0==e {skip=0; next}
    skip==1 {next}
    {print}
  ' "$1"
}

inject_protocol_pointers() {
  local clar_path="$SKILLS_DIR/CLARIFICATION-PROTOCOL.md"
  local si_path="$SKILLS_DIR/SELF-IMPROVEMENT-PROTOCOL.md"
  # Written into SKILL.md as a relative path, not $clar_path/$si_path
  # (which stay absolute, above, only for the existence-check below).
  # Every skill lives at exactly one level of nesting under $SKILLS_DIR
  # (<repo-root>/<skill-name>/SKILL.md), so ../ from any SKILL.md always
  # resolves correctly regardless of where or how the repo was checked
  # out — including a `git merge`-only consumer like the dev-agent
  # service's SkillsSync, which never runs setup.sh itself and therefore
  # never gets the chance to regenerate an absolute path baked in by
  # whoever last ran setup.sh on their own machine.
  local clar_rel="../CLARIFICATION-PROTOCOL.md"
  local si_rel="../SELF-IMPROVEMENT-PROTOCOL.md"
  local clar_begin="<!-- BEGIN dev-agent-skills clarification protocol (managed by setup.sh -- do not edit this block manually; edit CLARIFICATION-PROTOCOL.md instead) -->"
  local clar_end="<!-- END dev-agent-skills clarification protocol -->"
  local si_begin="<!-- BEGIN dev-agent-skills self-improvement protocol (managed by setup.sh -- do not edit this block manually; edit SELF-IMPROVEMENT-PROTOCOL.md instead) -->"
  local si_end="<!-- END dev-agent-skills self-improvement protocol -->"

  local have_clar="true" have_si="true"
  [ -f "$clar_path" ] || { echo "  ⚠️  CLARIFICATION-PROTOCOL.md not found at $clar_path — skipping that injection for all skills."; have_clar="false"; }
  [ -f "$si_path" ] || { echo "  ⚠️  SELF-IMPROVEMENT-PROTOCOL.md not found at $si_path — skipping that injection for all skills."; have_si="false"; }
  if [ "$have_clar" = "false" ] && [ "$have_si" = "false" ]; then return; fi

  local clar_injected=0 clar_refreshed=0
  local si_injected=0 si_refreshed=0
  local skipped=0
  local legacy_footer_skills=()

  for skill_dir in "${SKILL_FOLDERS[@]}"; do
    local skill_md="${skill_dir}SKILL.md"
    local skill_name
    skill_name=$(basename "$skill_dir")
    [ -f "$skill_md" ] || continue

    local had_clar="false" had_si="false"
    grep -qF "$clar_begin" "$skill_md" && had_clar="true"
    grep -qF "$si_begin" "$skill_md" && had_si="true"
    if grep -qE '^## Self-improvement( |$)' "$skill_md"; then
      legacy_footer_skills+=("$skill_name")
    fi

    local stripped1 stripped2
    stripped1=$(mktemp)
    stripped2=$(mktemp)
    strip_managed_block "$skill_md" "$clar_begin" "$clar_end" > "$stripped1"
    strip_managed_block "$stripped1" "$si_begin" "$si_end" > "$stripped2"

    # Frontmatter is delimited by the first two lines that are exactly "---".
    local second_dash
    second_dash=$(grep -n '^---$' "$stripped2" | head -2 | tail -1 | cut -d: -f1)

    if [ -z "$second_dash" ]; then
      echo "  ⚠️  $skill_name: SKILL.md has no recognizable YAML frontmatter — left untouched. Add frontmatter (name/description) for either protocol to apply."
      rm -f "$stripped1" "$stripped2"
      skipped=$((skipped + 1))
      continue
    fi

    {
      head -n "$second_dash" "$stripped2"
      if [ "$have_clar" = "true" ]; then
        echo ""
        echo "$clar_begin"
        echo "Before doing anything else in this skill, read and follow the clarification protocol at:"
        echo "$clar_rel"
        echo "$clar_end"
      fi
      if [ "$have_si" = "true" ]; then
        echo ""
        echo "$si_begin"
        echo "While using this skill, and especially when you finish, read and follow the self-improvement protocol at:"
        echo "$si_rel"
        echo "(Append real edge cases to this skill's own references/edge-cases.md — create it if missing. See the protocol file for what qualifies.)"
        echo "$si_end"
      fi
      echo ""
      tail -n "+$((second_dash + 1))" "$stripped2"
    } | cat -s > "$skill_md"

    rm -f "$stripped1" "$stripped2"

    if [ "$have_clar" = "true" ]; then
      if [ "$had_clar" = "true" ]; then clar_refreshed=$((clar_refreshed + 1)); else clar_injected=$((clar_injected + 1)); fi
    fi
    if [ "$have_si" = "true" ]; then
      if [ "$had_si" = "true" ]; then si_refreshed=$((si_refreshed + 1)); else si_injected=$((si_injected + 1)); fi
    fi
  done

  if [ "$have_clar" = "true" ]; then
    local clar_summary="  ✓ Clarification protocol — injected into $clar_injected skill(s), refreshed in $clar_refreshed"
    [ "$skipped" -gt 0 ] && clar_summary="$clar_summary, skipped $skipped (no frontmatter)"
    echo "$clar_summary"
  fi
  if [ "$have_si" = "true" ]; then
    local si_summary="  ✓ Self-improvement protocol — injected into $si_injected skill(s), refreshed in $si_refreshed"
    [ "$skipped" -gt 0 ] && si_summary="$si_summary, skipped $skipped (no frontmatter)"
    echo "$si_summary"
  fi
  if [ "${#legacy_footer_skills[@]}" -gt 0 ]; then
    echo "  ℹ️  ${#legacy_footer_skills[@]} skill(s) still have the old bottom-of-file '## Self-improvement' section, now redundant with the injected pointer above: $(IFS=,; echo "${legacy_footer_skills[*]}")"
    echo "      Harmless to leave (the injected pointer applies regardless), but worth removing by hand if it doesn't say anything beyond what SELF-IMPROVEMENT-PROTOCOL.md already covers."
  fi
}

inject_protocol_pointers
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

# ── README skills table ───────────────────────────────────────────────────────
#
# Keeps the table in README.md in sync with whatever skill folders actually
# exist at the repo root, whether they got there by hand (CONTRIBUTING.md)
# or via install-skillset.sh. Same managed-block idea as the clarification
# protocol injection above: everything between the markers is regenerated,
# everything outside them is left alone.

if command -v node &>/dev/null; then
  node "$SKILLS_DIR/scripts/regen-readme.mjs" "$SKILLS_DIR"
else
  echo "  ⚠️  README skills table — Node.js not found, skipping. Run 'node scripts/regen-readme.mjs' once Node is available, or update the table in README.md by hand."
fi
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