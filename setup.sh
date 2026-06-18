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

# Find all skill folders (any folder containing a SKILL.md at its root)
SKILL_FOLDERS=()
for dir in "$SKILLS_DIR"/*/; do
  if [ -f "$dir/SKILL.md" ]; then
    SKILL_FOLDERS+=("$dir")
  fi
done

SKILL_COUNT=${#SKILL_FOLDERS[@]}
echo "Found $SKILL_COUNT skills: $(basename -a "${SKILL_FOLDERS[@]}" | tr '\n' ' ')"
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

# ── OpenCode ──────────────────────────────────────────────────────────────────
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

# ── Portable .agents/skills (Cursor, OpenCode, any agent) ────────────────────
if [ -d ".agents" ] || [ -f ".cursor/rules" ] || [ -f ".opencode.json" ]; then
  link_skills ".agents/skills" "Portable (.agents/skills)"
fi

echo ""
echo "Done. To pick up new skills after a git pull, run: bash setup.sh"
