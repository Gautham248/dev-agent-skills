#!/usr/bin/env bash
# setup.sh — wire dev-agent-skills into your AI IDE(s)
#
# Run once after cloning. Run again after pulling new skills.
# Safe to run multiple times — uses symlinks, won't duplicate.
#
# Usage:
#   bash setup.sh
#   bash setup.sh --check-security   # CI-suitable: run the security scanner
#                                     # (scan-skillset.mjs) across every
#                                     # skill folder currently in this repo
#                                     # and exit — does not link, inject, or
#                                     # write anything. Exit code 1 if any
#                                     # critical/high finding exists anywhere,
#                                     # 0 otherwise. Useful as a retroactive
#                                     # baseline sweep and as a repeatable CI
#                                     # gate on every PR, catching a poisoned
#                                     # skill that was hand-authored or
#                                     # merged directly rather than pulled in
#                                     # through skill-add (which already
#                                     # scans on the way in).

set -e

SKILLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_COUNT=0

if [ "${1:-}" = "--check-security" ]; then
  echo "dev-agent-skills — security scan (--check-security)"
  echo "Skills directory: $SKILLS_DIR"
  echo ""
  if ! command -v node &>/dev/null; then
    echo "✗ --check-security requires Node.js. Install Node and re-run." >&2
    exit 1
  fi
  exec node "$SKILLS_DIR/skill-add/scripts/scan-skillset.mjs" --repo-root "$SKILLS_DIR"
fi

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
# rule — AGENTS.md is cross-tool for some harnesses (Codex reads it
# natively) but not others: Claude Code reads CLAUDE.md, not AGENTS.md
# (confirmed against Anthropic's docs — the documented pattern is a
# CLAUDE.md that imports AGENTS.md with `@AGENTS.md`, which is what
# configure_claude_code_global() below wires up at the user-instructions
# level). Gemini CLI reads GEMINI.md, not AGENTS.md, per its own docs.
# Hermes does not appear to read any of them. A SKILL.md-embedded
# instruction is the one thing every harness sees identically, regardless
# of which memory-file convention it honors. Self-improvement in
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
  local clar_path="$SKILLS_DIR/config/CLARIFICATION-PROTOCOL.md"
  local si_path="$SKILLS_DIR/config/SELF-IMPROVEMENT-PROTOCOL.md"
  local sm_path="$SKILLS_DIR/config/SESSION-MEMORY-PROTOCOL.md"
  local gm_path="$SKILLS_DIR/config/GRAPH-MEMORY-PROTOCOL.md"
  # Written into SKILL.md as a relative path, not $clar_path/$si_path/$sm_path/$gm_path
  # (which stay absolute, above, only for the existence-check below).
  # Every skill lives at exactly one level of nesting under $SKILLS_DIR
  # (<repo-root>/<skill-name>/SKILL.md), so ../config/ from any SKILL.md
  # always resolves correctly regardless of where or how the repo was checked
  # out — including a `git merge`-only consumer like the dev-agent
  # service's SkillsSync, which never runs setup.sh itself and therefore
  # never gets the chance to regenerate an absolute path baked in by
  # whoever last ran setup.sh on their own machine.
  local clar_rel="../config/CLARIFICATION-PROTOCOL.md"
  local si_rel="../config/SELF-IMPROVEMENT-PROTOCOL.md"
  local sm_rel="../config/SESSION-MEMORY-PROTOCOL.md"
  local gm_rel="../config/GRAPH-MEMORY-PROTOCOL.md"
  local clar_begin="<!-- BEGIN dev-agent-skills clarification protocol (managed by setup.sh -- do not edit this block manually; edit CLARIFICATION-PROTOCOL.md instead) -->"
  local clar_end="<!-- END dev-agent-skills clarification protocol -->"
  local si_begin="<!-- BEGIN dev-agent-skills self-improvement protocol (managed by setup.sh -- do not edit this block manually; edit SELF-IMPROVEMENT-PROTOCOL.md instead) -->"
  local si_end="<!-- END dev-agent-skills self-improvement protocol -->"
  local sm_begin="<!-- BEGIN dev-agent-skills session-memory protocol (managed by setup.sh -- do not edit this block manually; edit SESSION-MEMORY-PROTOCOL.md instead) -->"
  local sm_end="<!-- END dev-agent-skills session-memory protocol -->"
  local gm_begin="<!-- BEGIN dev-agent-skills graph-memory protocol (managed by setup.sh -- do not edit this block manually; edit GRAPH-MEMORY-PROTOCOL.md instead) -->"
  local gm_end="<!-- END dev-agent-skills graph-memory protocol -->"

  local have_clar="true" have_si="true" have_sm="true" have_gm="true"
  [ -f "$clar_path" ] || { echo "  ⚠️  CLARIFICATION-PROTOCOL.md not found at $clar_path — skipping that injection for all skills."; have_clar="false"; }
  [ -f "$si_path" ] || { echo "  ⚠️  SELF-IMPROVEMENT-PROTOCOL.md not found at $si_path — skipping that injection for all skills."; have_si="false"; }
  [ -f "$sm_path" ] || have_sm="false"
  [ -f "$gm_path" ] || have_gm="false"
  if [ "$have_clar" = "false" ] && [ "$have_si" = "false" ] && [ "$have_sm" = "false" ] && [ "$have_gm" = "false" ]; then return; fi

  local clar_injected=0 clar_refreshed=0
  local si_injected=0 si_refreshed=0
  local sm_injected=0 sm_refreshed=0 sm_removed=0 sm_opted_in=0
  local gm_injected=0 gm_refreshed=0 gm_removed=0 gm_opted_in=0
  local skipped=0
  local legacy_footer_skills=()

  for skill_dir in "${SKILL_FOLDERS[@]}"; do
    local skill_md="${skill_dir}SKILL.md"
    local skill_name
    skill_name=$(basename "$skill_dir")
    [ -f "$skill_md" ] || continue

    local had_clar="false" had_si="false" had_sm="false" had_gm="false"
    grep -qF "$clar_begin" "$skill_md" && had_clar="true"
    grep -qF "$si_begin" "$skill_md" && had_si="true"
    grep -qF "$sm_begin" "$skill_md" && had_sm="true"
    grep -qF "$gm_begin" "$skill_md" && had_gm="true"
    if grep -qE '^## Self-improvement( |$)' "$skill_md"; then
      legacy_footer_skills+=("$skill_name")
    fi

    local stripped1 stripped2 stripped3 stripped4
    stripped1=$(mktemp)
    stripped2=$(mktemp)
    stripped3=$(mktemp)
    stripped4=$(mktemp)
    strip_managed_block "$skill_md" "$clar_begin" "$clar_end" > "$stripped1"
    strip_managed_block "$stripped1" "$si_begin" "$si_end" > "$stripped2"
    strip_managed_block "$stripped2" "$sm_begin" "$sm_end" > "$stripped3"
    strip_managed_block "$stripped3" "$gm_begin" "$gm_end" > "$stripped4"

    # Frontmatter is delimited by the first two lines that are exactly "---".
    local second_dash
    second_dash=$(grep -n '^---$' "$stripped4" | head -2 | tail -1 | cut -d: -f1)

    if [ -z "$second_dash" ]; then
      echo "  ⚠️  $skill_name: SKILL.md has no recognizable YAML frontmatter — left untouched. Add frontmatter (name/description) for any protocol to apply."
      rm -f "$stripped1" "$stripped2" "$stripped3" "$stripped4"
      skipped=$((skipped + 1))
      continue
    fi

    # session-memory and graph-memory are opt-in per skill, unlike
    # clarification/self-improvement which apply to every skill
    # unconditionally. Only this skill's own frontmatter (the region up to
    # $second_dash) decides whether it gets the pointer — a skill that
    # removes the flag on a later run correctly loses the pointer too,
    # since it's simply not re-added below.
    local want_sm="false" want_gm="false"
    if [ "$have_sm" = "true" ] && head -n "$second_dash" "$stripped4" | grep -qiE '^session-memory:[[:space:]]*true[[:space:]]*$'; then
      want_sm="true"
      sm_opted_in=$((sm_opted_in + 1))
    fi
    if [ "$have_gm" = "true" ] && head -n "$second_dash" "$stripped4" | grep -qiE '^graph-memory:[[:space:]]*true[[:space:]]*$'; then
      want_gm="true"
      gm_opted_in=$((gm_opted_in + 1))
    fi

    {
      head -n "$second_dash" "$stripped4"
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
      if [ "$want_sm" = "true" ]; then
        echo ""
        echo "$sm_begin"
        echo "This skill opted in to session-memory (session-memory: true). Whenever you reach a step"
        echo "marked 'Session-reusable:' below, read and follow the session-memory protocol at:"
        echo "$sm_rel"
        echo "$sm_end"
      fi
      if [ "$want_gm" = "true" ]; then
        echo ""
        echo "$gm_begin"
        echo "This skill opted in to graph-memory (graph-memory: true). At each point marked"
        echo "'Graph-memory:' below, read and follow the graph-memory protocol at:"
        echo "$gm_rel"
        echo "$gm_end"
      fi
      echo ""
      tail -n "+$((second_dash + 1))" "$stripped4"
    } | cat -s > "$skill_md"

    rm -f "$stripped1" "$stripped2" "$stripped3" "$stripped4"

    if [ "$have_clar" = "true" ]; then
      if [ "$had_clar" = "true" ]; then clar_refreshed=$((clar_refreshed + 1)); else clar_injected=$((clar_injected + 1)); fi
    fi
    if [ "$have_si" = "true" ]; then
      if [ "$had_si" = "true" ]; then si_refreshed=$((si_refreshed + 1)); else si_injected=$((si_injected + 1)); fi
    fi
    if [ "$want_sm" = "true" ]; then
      if [ "$had_sm" = "true" ]; then sm_refreshed=$((sm_refreshed + 1)); else sm_injected=$((sm_injected + 1)); fi
    elif [ "$had_sm" = "true" ]; then
      sm_removed=$((sm_removed + 1))
    fi
    if [ "$want_gm" = "true" ]; then
      if [ "$had_gm" = "true" ]; then gm_refreshed=$((gm_refreshed + 1)); else gm_injected=$((gm_injected + 1)); fi
    elif [ "$had_gm" = "true" ]; then
      gm_removed=$((gm_removed + 1))
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
  if [ "$have_sm" = "true" ]; then
    local sm_summary="  ✓ Session-memory protocol — opted in: $sm_opted_in skill(s) (injected $sm_injected new, refreshed $sm_refreshed)"
    [ "$sm_removed" -gt 0 ] && sm_summary="$sm_summary, removed from $sm_removed (opted out since last run)"
    echo "$sm_summary"
  fi
  if [ "$have_gm" = "true" ]; then
    local gm_summary="  ✓ Graph-memory protocol — opted in: $gm_opted_in skill(s) (injected $gm_injected new, refreshed $gm_refreshed)"
    [ "$gm_removed" -gt 0 ] && gm_summary="$gm_summary, removed from $gm_removed (opted out since last run)"
    echo "$gm_summary"
  fi
  if [ "${#legacy_footer_skills[@]}" -gt 0 ]; then
    echo "  ℹ️  ${#legacy_footer_skills[@]} skill(s) still have the old bottom-of-file '## Self-improvement' section, now redundant with the injected pointer above: $(IFS=,; echo "${legacy_footer_skills[*]}")"
    echo "      Harmless to leave (the injected pointer applies regardless), but worth removing by hand if it doesn't say anything beyond what SELF-IMPROVEMENT-PROTOCOL.md already covers."
  fi
}

# ── AGENTS.md sync script pointer ─────────────────────────────────────────────
#
# AGENT-STANDING-RULES.md's Rule 0 invokes scripts/agents-md-sync.sh to manage
# a project's AGENTS.md. Since that rule runs from inside an arbitrary target
# project directory (not from within this repo), it needs this script's
# absolute path, not a relative one — same reasoning as the OpenCode global
# config above ($standing_rules_path), and the same self-correcting mechanism
# as inject_protocol_pointers below: strip whatever placeholder/path is
# already there and rebuild it fresh every run, so a re-clone to a new
# location just works on the next `bash setup.sh`.

inject_agents_md_sync_pointer() {
  local standing_rules_path="$SKILLS_DIR/config/AGENT-STANDING-RULES.md"
  local root_agents_path="$SKILLS_DIR/AGENTS.md"
  local sync_script_path="$SKILLS_DIR/scripts/agents-md-sync.sh"

  if [ ! -f "$standing_rules_path" ]; then
    echo "  ⚠️  AGENT-STANDING-RULES.md not found at $standing_rules_path — skipping sync-script pointer injection."
    return
  fi
  if [ ! -f "$sync_script_path" ]; then
    echo "  ⚠️  agents-md-sync.sh not found at $sync_script_path — skipping sync-script pointer injection."
    return
  fi

  # Match either the unfilled placeholder (fresh checkout, never run before)
  # or any previously-injected absolute path (re-run, possibly after a
  # re-clone to a different location). Process both the canonical source
  # (config/AGENT-STANDING-RULES.md) and the repo's own root AGENTS.md so
  # a fresh clone that runs setup.sh has the correct pointer in the file an
  # agent actually reads, not just in the canonical source.
  local target tmp
  for target in "$standing_rules_path" "$root_agents_path"; do
    if [ ! -f "$target" ]; then
      continue
    fi
    tmp=$(mktemp)
    awk -v new="$sync_script_path" '
      /^Rule 0 below uses this script to manage a project.s AGENTS.md: / {
        print "Rule 0 below uses this script to manage a project'"'"'s AGENTS.md: " new
        next
      }
      { print }
    ' "$target" > "$tmp" && mv "$tmp" "$target"
    echo "  ✓ AGENTS.md sync script pointer — $target now points to $sync_script_path"
  done
}

inject_agents_md_sync_pointer
echo ""

inject_protocol_pointers
echo ""

# ── OpenCode global config (permission + standing rules) ─────────────────────

configure_opencode_global() {
  if ! command -v opencode &>/dev/null && [ ! -d "$HOME/.config/opencode" ]; then
    return  # OpenCode isn't installed/used on this machine — nothing to do
  fi

  local standing_rules_path="$SKILLS_DIR/config/AGENT-STANDING-RULES.md"
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

# ── Claude Code global config (standing rules import) ────────────────────────
#
# Claude Code reads CLAUDE.md, not AGENTS.md (confirmed against current
# Anthropic docs: docs/en/memory.md, "AGENTS.md" section — Claude Code does
# not read AGENTS.md directly). Its documented cross-tool pattern is a
# CLAUDE.md that imports the shared file with `@path/to/file` syntax.
#
# ~/.claude/CLAUDE.md is Claude Code's "User instructions" scope — loaded at
# the start of every session, in every project, on this machine, same as
# OpenCode's instructions[] above. We inject an absolute-path import of
# AGENT-STANDING-RULES.md there via the same strip_managed_block idiom used
# for SKILL.md, so it self-corrects if this repo is re-cloned elsewhere.
#
# Deliberately NOT using --append-system-prompt: that flag has to be passed
# on every single invocation, which conflicts with "clone and run setup.sh,
# nothing else" (docs/01-SETUP.md). A CLAUDE.md import is the only
# set-once mechanism Claude Code offers for this.
#
# Per Anthropic's docs, imports in USER-scope memory files (~/.claude/CLAUDE.md)
# load without the external-import approval dialog that project-scope imports
# trigger — so this requires no manual confirmation step, same as OpenCode's
# config above.

configure_claude_code_global() {
  if ! command -v claude &>/dev/null && [ ! -d "$HOME/.claude" ]; then
    return  # Claude Code isn't installed/used on this machine — nothing to do
  fi

  local standing_rules_path="$SKILLS_DIR/config/AGENT-STANDING-RULES.md"
  if [ ! -f "$standing_rules_path" ]; then
    echo "  ⚠️  AGENT-STANDING-RULES.md not found at $standing_rules_path — skipping Claude Code global config."
    return
  fi

  local global_dir="$HOME/.claude"
  local claude_md="$global_dir/CLAUDE.md"
  mkdir -p "$global_dir"
  [ -f "$claude_md" ] || touch "$claude_md"

  local begin="<!-- BEGIN dev-agent-skills standing rules import (managed by setup.sh -- do not edit this block manually; edit config/AGENT-STANDING-RULES.md instead) -->"
  local end="<!-- END dev-agent-skills standing rules import -->"

  local stripped
  stripped=$(mktemp)
  strip_managed_block "$claude_md" "$begin" "$end" > "$stripped"

  {
    cat "$stripped"
    echo ""
    echo "$begin"
    echo "@$standing_rules_path"
    echo "$end"
  } | cat -s > "$claude_md"
  rm -f "$stripped"

  echo "  ✓ Claude Code global config — $claude_md imports $standing_rules_path (loads every session, every project, via Claude Code's User instructions scope)"
}

configure_claude_code_global
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
  local relinked=0
  for skill_dir in "${SKILL_FOLDERS[@]}"; do
    skill_name=$(basename "$skill_dir")
    link_path="$target_dir/$skill_name"
    if [ -L "$link_path" ]; then
      if [ ! -e "$link_path" ]; then
        # Dangling: the symlink exists but its target doesn't. Almost
        # certainly this repo was re-cloned/moved and the old target path
        # no longer exists — the same self-correcting pattern used for
        # opencode.json / CLAUDE.md / the AGENTS.md sync pointer elsewhere
        # in this script, just never applied to skill symlinks themselves.
        # A dangling target can never legitimately be someone's intentional
        # setup, so it's safe to fix without asking.
        rm "$link_path"
        ln -s "$skill_dir" "$link_path"
        relinked=$((relinked + 1))
      elif [ "$(readlink "$link_path")" != "$skill_dir" ]; then
        # Valid symlink, but pointing somewhere other than our current
        # skill_dir and that target actually exists — could be a legitimate
        # manual setup pointing elsewhere. Ambiguous ownership, same as the
        # directory-collision case below: don't touch it, just say so.
        echo "  ⚠️  $skill_name: $link_path is a symlink but points elsewhere ($(readlink "$link_path")) — leaving it as-is."
      fi
      # else: already correctly linked, nothing to do
    elif [ -d "$link_path" ]; then
      if diff -rq "$skill_dir" "$link_path" >/dev/null 2>&1; then
        echo "  ⚠️  $skill_name: an identical, non-symlinked copy already exists at $link_path — looks like a leftover from before this was symlinked. Safe to replace: rm -rf \"$link_path\" && re-run setup.sh."
      else
        echo "  ⚠️  $skill_name: a DIFFERENT directory already exists at $link_path — looks like your own custom skill, not ours. Leaving it untouched; it will not receive protocol injections or updates from this repo. Rename one of the two if that's unintentional."
      fi
      continue
    else
      ln -s "$skill_dir" "$link_path"
      linked=$((linked + 1))
    fi
  done
  echo "  ✓ $agent_name — $target_dir ($linked new links, $relinked relinked)"
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