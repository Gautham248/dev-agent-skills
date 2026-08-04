#!/usr/bin/env bash
# agents-md-sync.sh — manage a project's AGENTS.md against this repo's
# canonical standing rules (config/AGENT-STANDING-RULES.md), using a sha256
# sidecar file for ownership/integrity detection instead of an in-file marker.
#
# Why this exists: Rule 0 in AGENT-STANDING-RULES.md used to tell the agent
# to hand-copy its own standing rules into AGENTS.md verbatim, and to treat
# ANY existing AGENTS.md as equivalent to its own. Two failure modes followed
# from that: (1) an AGENTS.md created by something else entirely — most
# commonly `opencode /init` run before this repo was set up — got silently
# treated as if it were ours, with none of these rules actually in it; (2)
# LLM-driven "copy verbatim" is inherently unreliable for a large document.
# This script fixes both: it reads the canonical file directly (no
# regeneration risk) and tracks provenance via a committed hash sidecar
# rather than trusting file content alone.
#
# Run from the target PROJECT's root directory (the workspace, not this
# skills repo). Usage:
#   agents-md-sync.sh status   # prints one state word, see below, exit 0 always
#   agents-md-sync.sh write    # create AGENTS.md, or refresh it if stale (case 1 / case 3)
#   agents-md-sync.sh append   # merge into an existing foreign AGENTS.md (case 2)
#
# States printed by `status`:
#   NO_AGENTS          — no AGENTS.md in this project yet
#   AGENTS_OURS_FRESH   — ours, sidecar matches, and rules haven't changed since
#   AGENTS_OURS_STALE   — ours (sidecar matches file), but the canonical rules
#                         have changed since this copy was written — safe to
#                         auto-refresh, nobody has hand-edited it
#   AGENTS_TAMPERED     — sidecar exists but doesn't match the file's current
#                         content — someone edited it since we last wrote it.
#                         Treated cautiously, same as foreign: don't auto-touch.
#   AGENTS_FOREIGN      — AGENTS.md exists but there's no sidecar at all — most
#                         likely created by something else (e.g. `opencode
#                         /init`) or hand-written before this repo was set up.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STANDING_RULES="$SKILLS_DIR/config/AGENT-STANDING-RULES.md"

AGENTS_FILE="AGENTS.md"
SIDECAR_FILE=".agents-md.sha256"

BEGIN_MARK="<!-- BEGIN dev-agent-skills managed block (do not edit by hand -- source of truth is $STANDING_RULES) -->"
END_MARK="<!-- END dev-agent-skills managed block -->"

hash_file() {
  # Portable sha256: prefer sha256sum (GNU/Linux), fall back to shasum -a 256
  # (macOS/BSD), fall back to openssl if neither is present.
  if command -v sha256sum &>/dev/null; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum &>/dev/null; then
    shasum -a 256 "$1" | awk '{print $1}'
  elif command -v openssl &>/dev/null; then
    openssl dgst -sha256 "$1" | awk '{print $NF}'
  else
    echo "agents-md-sync.sh: no sha256sum, shasum, or openssl found — cannot hash." >&2
    exit 2
  fi
}

require_standing_rules() {
  if [ ! -f "$STANDING_RULES" ]; then
    echo "agents-md-sync.sh: canonical file not found at $STANDING_RULES" >&2
    exit 2
  fi
}

write_sidecar() {
  # $1 = full-file hash, $2 = canonical-rules hash, at the moment of writing
  {
    echo "$1"
    echo "$2"
  } > "$SIDECAR_FILE"
}

cmd_status() {
  if [ ! -f "$AGENTS_FILE" ]; then
    echo "NO_AGENTS"
    return 0
  fi
  if [ ! -f "$SIDECAR_FILE" ]; then
    echo "AGENTS_FOREIGN"
    return 0
  fi

  local stored_full stored_canonical actual_full actual_canonical
  stored_full=$(sed -n '1p' "$SIDECAR_FILE")
  stored_canonical=$(sed -n '2p' "$SIDECAR_FILE")
  actual_full=$(hash_file "$AGENTS_FILE")

  if [ "$actual_full" != "$stored_full" ]; then
    echo "AGENTS_TAMPERED"
    return 0
  fi

  require_standing_rules
  actual_canonical=$(hash_file "$STANDING_RULES")
  if [ "$actual_canonical" = "$stored_canonical" ]; then
    echo "AGENTS_OURS_FRESH"
  else
    echo "AGENTS_OURS_STALE"
  fi
}

cmd_write() {
  local force="${1:-}"
  local state
  state=$(cmd_status)

  case "$state" in
    NO_AGENTS|AGENTS_OURS_STALE)
      : # proceed below
      ;;
    AGENTS_OURS_FRESH)
      echo "AGENTS.md is already up to date — nothing to do."
      return 0
      ;;
    AGENTS_FOREIGN|AGENTS_TAMPERED)
      if [ "$force" != "--force" ]; then
        echo "Refusing to overwrite: current state is $state. Use 'append' for a foreign AGENTS.md, or pass --force to overwrite anyway." >&2
        exit 1
      fi
      ;;
  esac

  require_standing_rules
  cp "$STANDING_RULES" "$AGENTS_FILE"
  local full_hash canonical_hash
  full_hash=$(hash_file "$AGENTS_FILE")
  canonical_hash=$(hash_file "$STANDING_RULES")
  write_sidecar "$full_hash" "$canonical_hash"
  echo "Wrote $AGENTS_FILE from $STANDING_RULES (was: $state)."
}

cmd_append() {
  local force="${1:-}"
  local state
  state=$(cmd_status)

  if [ "$state" = "NO_AGENTS" ]; then
    echo "No existing AGENTS.md — use 'write' instead of 'append'." >&2
    exit 1
  fi
  if [ "$state" != "AGENTS_FOREIGN" ] && [ "$force" != "--force" ]; then
    echo "Refusing to append: current state is $state, not AGENTS_FOREIGN. Pass --force to append anyway." >&2
    exit 1
  fi

  require_standing_rules
  {
    echo ""
    echo "$BEGIN_MARK"
    cat "$STANDING_RULES"
    echo ""
    echo "$END_MARK"
  } >> "$AGENTS_FILE"

  local full_hash canonical_hash
  full_hash=$(hash_file "$AGENTS_FILE")
  canonical_hash=$(hash_file "$STANDING_RULES")
  write_sidecar "$full_hash" "$canonical_hash"
  echo "Appended dev-agent-skills managed block to the existing $AGENTS_FILE (was: $state). Nothing above the BEGIN marker was touched."
}

case "${1:-status}" in
  status) cmd_status ;;
  write)  cmd_write "${2:-}" ;;
  append) cmd_append "${2:-}" ;;
  *)
    echo "Usage: agents-md-sync.sh {status|write [--force]|append [--force]}" >&2
    exit 2
    ;;
esac
